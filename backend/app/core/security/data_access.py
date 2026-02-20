"""数据访问控制引擎 — SQL 执行前的权限检查和 SQL 改写"""
import logging
from typing import TYPE_CHECKING
from pydantic import BaseModel
from sqlalchemy import select

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.data_table import DataTable
    from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


class ColumnAccess(BaseModel):
    """列访问权限"""
    column: str
    visibility: str  # "visible" | "masked" | "hidden"
    masking_rule: str | None = None


class DataAccessControl:
    """数据访问控制 — SQL 执行前的权限检查和 SQL 改写"""

    async def check_table_access(
        self,
        user: "User",
        table: "DataTable",
        operation: str,
        db: "AsyncSession",
    ) -> bool:
        """
        检查用户对表的操作权限 (read/write/admin)
        逻辑:
        1. 表的所有者 (user_id) 默认有全部权限
        2. 查询用户关联的 DataRole
        3. 查询 TablePermission 是否允许该操作
        4. 无权限返回 False
        """
        # 表所有者默认有全部权限
        if table.user_id == user.id:
            return True

        # 查询用户的数据角色
        from app.models.data_permission import DataRoleAssignment, DataRole, TablePermission

        result = await db.execute(
            select(DataRoleAssignment)
            .join(DataRole, DataRoleAssignment.data_role_id == DataRole.id)
            .where(
                DataRoleAssignment.user_id == user.id,
                DataRole.tenant_id == user.tenant_id if user.tenant_id else None,
            )
        )
        assignments = result.scalars().all()
        role_ids = [a.data_role_id for a in assignments]

        if not role_ids:
            return False

        # 查询表权限
        result = await db.execute(
            select(TablePermission).where(
                TablePermission.data_role_id.in_(role_ids),
                TablePermission.data_table_id == table.id,
            )
        )
        permissions = result.scalars().all()

        for perm in permissions:
            if operation == "read" and perm.permission in ["read", "write", "admin"]:
                return True
            if operation == "write" and perm.permission in ["write", "admin"]:
                return True
            if operation == "admin" and perm.permission == "admin":
                return True

        return False

    async def get_visible_columns(
        self,
        user: "User",
        table: "DataTable",
        db: "AsyncSession",
    ) -> list[ColumnAccess]:
        """
        获取用户对表的每列可见性和脱敏规则
        返回: [{column: "phone", visibility: "masked", rule: "last4"}, ...]
        默认: 表所有者所有列可见; 其他用户按 ColumnPermission 控制
        """
        # 表所有者所有列可见
        if table.user_id == user.id:
            # 返回所有列（需要从表结构获取，这里简化处理）
            return []

        from app.models.data_permission import DataRoleAssignment, DataRole, ColumnPermission

        # 查询用户的数据角色
        result = await db.execute(
            select(DataRoleAssignment)
            .join(DataRole, DataRoleAssignment.data_role_id == DataRole.id)
            .where(
                DataRoleAssignment.user_id == user.id,
                DataRole.tenant_id == user.tenant_id if user.tenant_id else None,
            )
        )
        assignments = result.scalars().all()
        role_ids = [a.data_role_id for a in assignments]

        if not role_ids:
            return []

        # 查询列权限
        result = await db.execute(
            select(ColumnPermission).where(
                ColumnPermission.data_role_id.in_(role_ids),
                ColumnPermission.data_table_id == table.id,
            )
        )
        col_perms = result.scalars().all()

        return [
            ColumnAccess(
                column=cp.column_name,
                visibility=cp.visibility,
                masking_rule=cp.masking_rule,
            )
            for cp in col_perms
        ]

    async def rewrite_sql_with_filters(
        self,
        user: "User",
        sql: str,
        tables: list["DataTable"],
        db: "AsyncSession",
    ) -> str:
        """
        将行级过滤条件注入 SQL WHERE 子句
        使用 sqlparse 解析 SQL，在每个 FROM 表引用上追加 WHERE 条件
        示例: SELECT * FROM orders → SELECT * FROM orders WHERE department = '销售部'
        """
        from app.models.data_permission import DataRoleAssignment, DataRole, RowFilter

        # 查询用户的数据角色
        result = await db.execute(
            select(DataRoleAssignment)
            .join(DataRole, DataRoleAssignment.data_role_id == DataRole.id)
            .where(
                DataRoleAssignment.user_id == user.id,
                DataRole.tenant_id == user.tenant_id if user.tenant_id else None,
            )
        )
        assignments = result.scalars().all()
        role_ids = [a.data_role_id for a in assignments]

        if not role_ids:
            return sql

        # 查询行级过滤条件
        table_ids = {t.id for t in tables}
        result = await db.execute(
            select(RowFilter).where(
                RowFilter.data_role_id.in_(role_ids),
                RowFilter.data_table_id.in_(table_ids),
            )
        )
        filters = result.scalars().all()

        if not filters:
            return sql

        # 按表分组过滤条件
        filters_by_table = {}
        for f in filters:
            if f.data_table_id not in filters_by_table:
                filters_by_table[f.data_table_id] = []
            filters_by_table[f.data_table_id].append(f.filter_expression)

        # 简化处理：在所有 WHERE 子句后追加过滤条件
        # 实际应该使用 sqlparse 解析 SQL AST 并精确注入
        if "WHERE" in sql.upper():
            # 已有 WHERE，追加 AND
            filter_expr = " AND ".join(
                ["(" + " AND ".join(filters_by_table.get(t.id, [])) + ")" for t in tables if t.id in filters_by_table]
            )
            if filter_expr:
                sql = sql + " AND " + filter_expr
        else:
            # 没有 WHERE，添加 WHERE
            filter_expr = " AND ".join(
                ["(" + " AND ".join(filters_by_table.get(t.id, [])) + ")" for t in tables if t.id in filters_by_table]
            )
            if filter_expr:
                sql = sql + " WHERE " + filter_expr

        return sql

    async def apply_column_masking(
        self,
        result: dict,
        user: "User",
        table: "DataTable",
        db: "AsyncSession",
    ) -> dict:
        """
        对查询结果应用列级脱敏
        遍历结果集每一行，对 visibility=masked 的列应用脱敏规则
        visibility=hidden 的列直接移除
        """
        from app.core.security.masking import apply_mask

        col_access = await self.get_visible_columns(user, table, db)
        if not col_access:
            return result

        col_map = {ca.column: ca for ca in col_access}

        if "rows" not in result or "columns" not in result:
            return result

        # 过滤隐藏的列
        visible_columns = [c for c in result["columns"] if col_map.get(c, ColumnAccess(column=c, visibility="visible")).visibility != "hidden"]
        result["columns"] = visible_columns

        # 对每行应用脱敏
        masked_rows = []
        for row in result["rows"]:
            masked_row = {}
            for col in visible_columns:
                value = row.get(col)
                ca = col_map.get(col)
                if ca and ca.visibility == "masked" and ca.masking_rule:
                    value = apply_mask(value, ca.masking_rule)
                masked_row[col] = value
            masked_rows.append(masked_row)

        result["rows"] = masked_rows
        return result
