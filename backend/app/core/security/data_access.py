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

    async def _get_user_role_ids(self, user: "User", db: "AsyncSession") -> list:
        """查询用户在当前租户下的所有数据角色 ID。"""
        from app.models.data_permission import DataRoleAssignment, DataRole

        q = (
            select(DataRoleAssignment.data_role_id)
            .join(DataRole, DataRoleAssignment.data_role_id == DataRole.id)
            .where(DataRoleAssignment.user_id == user.id)
        )
        if user.tenant_id:
            q = q.where(DataRole.tenant_id == user.tenant_id)
        else:
            q = q.where(DataRole.tenant_id.is_(None))

        result = await db.execute(q)
        return [row[0] for row in result.all()]

    async def check_table_access(
        self,
        user: "User",
        table: "DataTable",
        operation: str,
        db: "AsyncSession",
    ) -> bool:
        """
        检查用户对表的操作权限 (read/write/admin)
        1. 表的所有者 (user_id) 默认有全部权限
        2. 查询用户关联的 DataRole（限定在同租户）
        3. 查询 TablePermission 是否允许该操作
        """
        if table.user_id == user.id:
            return True

        from app.models.data_permission import TablePermission

        role_ids = await self._get_user_role_ids(user, db)
        if not role_ids:
            return False

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
        if table.user_id == user.id:
            return []

        from app.models.data_permission import ColumnPermission

        role_ids = await self._get_user_role_ids(user, db)
        if not role_ids:
            return []

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
        将行级过滤条件注入 SQL WHERE 子句。
        使用正则定位 WHERE/ORDER BY/GROUP BY/HAVING/LIMIT 边界，
        在正确位置插入过滤条件。
        """
        from app.models.data_permission import RowFilter
        import re

        role_ids = await self._get_user_role_ids(user, db)
        if not role_ids:
            return sql

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

        filters_by_table: dict = {}
        for f in filters:
            filters_by_table.setdefault(f.data_table_id, []).append(f.filter_expression)

        filter_parts = []
        for t in tables:
            exprs = filters_by_table.get(t.id, [])
            if exprs:
                filter_parts.append("(" + " AND ".join(exprs) + ")")
        if not filter_parts:
            return sql
        filter_expr = " AND ".join(filter_parts)

        upper = sql.upper()
        has_where = bool(re.search(r"\bWHERE\b", upper))

        tail_match = re.search(
            r"\b(GROUP\s+BY|HAVING|ORDER\s+BY|LIMIT|OFFSET|UNION|INTERSECT|EXCEPT|FOR\s+UPDATE)\b",
            upper,
        )

        if has_where:
            if tail_match:
                pos = tail_match.start()
                sql = sql[:pos] + f"AND {filter_expr} " + sql[pos:]
            else:
                sql = sql + " AND " + filter_expr
        else:
            if tail_match:
                pos = tail_match.start()
                sql = sql[:pos] + f"WHERE {filter_expr} " + sql[pos:]
            else:
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
        对查询结果应用列级脱敏。
        rows 为 list[list]（与 QueryResult 对齐），columns 为 list[str]。
        visibility=hidden 的列从 columns+rows 中移除；
        visibility=masked 的列应用脱敏规则。
        """
        from app.core.security.masking import apply_mask

        col_access = await self.get_visible_columns(user, table, db)
        if not col_access:
            return result

        col_map = {ca.column: ca for ca in col_access}

        if "rows" not in result or "columns" not in result:
            return result

        all_columns: list[str] = result["columns"]

        keep_indices: list[int] = []
        mask_rules: dict[int, str] = {}
        for idx, col in enumerate(all_columns):
            ca = col_map.get(col)
            if ca and ca.visibility == "hidden":
                continue
            keep_indices.append(idx)
            if ca and ca.visibility == "masked" and ca.masking_rule:
                mask_rules[idx] = ca.masking_rule

        result["columns"] = [all_columns[i] for i in keep_indices]

        masked_rows = []
        for row in result["rows"]:
            new_row = []
            for idx in keep_indices:
                value = row[idx] if idx < len(row) else None
                if idx in mask_rules:
                    value = apply_mask(value, mask_rules[idx])
                new_row.append(value)
            masked_rows.append(new_row)

        result["rows"] = masked_rows
        return result
