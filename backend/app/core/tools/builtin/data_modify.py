"""Agent 工具: modify_user_data — 对用户自建表执行写操作 (INSERT/UPDATE/DELETE)。

安全限制:
  - 仅允许用户自己的 schema 下的表
  - 验证 table.is_writable
  - 验证 table.user_id == user.id
  - 单次影响行数限制 1000 行
  - 事务 + savepoint 保护
"""
from __future__ import annotations

import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.tools.registry import ToolRegistry
from app.core.security.sql_checker import SQLSecurityChecker
from app.models.data_table import DataTable
from app.models.user import User

logger = logging.getLogger(__name__)

MODIFY_USER_DATA_PARAMS = {
    "type": "object",
    "properties": {
        "sql": {
            "type": "string",
            "description": "要执行的写 SQL 语句 (INSERT/UPDATE/DELETE)",
        },
        "table_name": {
            "type": "string",
            "description": "目标表的 pg_table_name",
        },
    },
    "required": ["sql", "table_name"],
}

_checker = SQLSecurityChecker()


async def _modify_user_data(arguments: dict, context: dict) -> str:
    """对用户数据表执行写操作。"""
    user: User = context["user"]
    db: AsyncSession = context["db"]
    request = context.get("request")

    sql = arguments.get("sql", "").strip()
    table_name = arguments.get("table_name", "").strip()

    if not sql:
        return "错误: 请提供 SQL 语句。"
    if not table_name:
        return "错误: 请提供目标表名 (table_name)。"

    check_result = _checker.check(sql, allow_write=True)
    if not check_result.is_safe:
        return f"SQL 安全检查未通过: {check_result.blocked_reason}"

    q = select(DataTable).where(
        DataTable.user_id == user.id,
        DataTable.pg_table_name == table_name,
    )
    result = await db.execute(q)
    target = result.scalar_one_or_none()

    if not target:
        return f"未找到表 '{table_name}'，或该表不属于您。请使用 inspect_tables 查看可用表。"

    if not target.is_writable:
        return f"表 '{table_name}' 为只读，不允许写操作。"

    if not request:
        return "内部错误: 无法获取执行器。"

    executor = getattr(request.app.state, "isolated_executor", None)
    if not executor:
        return "内部错误: SQL 执行器未初始化。"

    schema = executor.get_user_schema(user.tenant_id)

    try:
        write_result = await executor.execute_write(
            tenant_schema=schema,
            sql=sql,
            user_id=user.id,
            table_pg_schema=target.pg_schema,
            table_pg_name=target.pg_table_name,
            is_writable=target.is_writable,
        )
    except PermissionError as e:
        return f"权限错误: {e}"
    except Exception as e:
        error_msg = str(e)
        if "statement timeout" in error_msg.lower():
            return "操作超时: 请减少影响的数据量。"
        return f"SQL 执行错误: {error_msg[:500]}"

    if write_result.affected_rows > 1000:
        logger.warning(
            "Large write operation: user=%s table=%s affected=%d",
            user.id, table_name, write_result.affected_rows,
        )

    return (
        f"操作成功: 影响 {write_result.affected_rows} 行 "
        f"(耗时 {write_result.execution_ms}ms)"
    )


def register_modify_user_data(registry: ToolRegistry):
    """注册 modify_user_data 工具。"""
    registry.register_context_tool(
        name="modify_user_data",
        description="对用户数据表执行写操作 (INSERT/UPDATE/DELETE)。仅限用户自己上传的可写表。需提供 pg_table_name。",
        parameters=MODIFY_USER_DATA_PARAMS,
        fn=_modify_user_data,
    )
