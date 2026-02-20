"""Agent 工具: execute_sql — 在用户数据表上执行只读 SQL 查询。

执行流程:
  1. SQLSecurityChecker.check(sql, allow_write=False)
  2. SQLSecurityChecker.extract_table_names(sql)
  3. SQLSecurityChecker.enforce_limit(sql, 1000)
  4. IsolatedSQLExecutor.execute_read(tenant_schema, sql)
  5. 格式化结果返回
"""
from __future__ import annotations

import json
import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.tools.registry import ToolRegistry
from app.core.security.sql_checker import SQLSecurityChecker
from app.models.data_table import DataTable
from app.models.user import User

logger = logging.getLogger(__name__)

EXECUTE_SQL_PARAMS = {
    "type": "object",
    "properties": {
        "sql": {
            "type": "string",
            "description": "要执行的 SQL SELECT 查询语句。表名使用 inspect_tables 返回的 pg_table_name。",
        },
    },
    "required": ["sql"],
}

_checker = SQLSecurityChecker()


async def _execute_sql(arguments: dict, context: dict) -> str:
    """执行只读 SQL 查询并返回结果。"""
    user: User = context["user"]
    db: AsyncSession = context["db"]
    request = context.get("request")

    sql = arguments.get("sql", "").strip()
    if not sql:
        return "错误: 请提供 SQL 查询语句。"

    check_result = _checker.check(sql, allow_write=False)
    if not check_result.is_safe:
        return f"SQL 安全检查未通过: {check_result.blocked_reason}"

    sql = _checker.enforce_limit(sql)

    referenced_tables = _checker.extract_table_names(sql)

    q = select(DataTable).where(DataTable.user_id == user.id)
    result = await db.execute(q)
    user_tables = result.scalars().all()
    user_pg_names = {t.pg_table_name.lower() for t in user_tables}

    # 查找引用的表
    matched_tables = []
    for ref in referenced_tables:
        ref_clean = ref.lower().strip('"')
        parts = ref_clean.split(".")
        table_part = parts[-1]
        for t in user_tables:
            if t.pg_table_name.lower() == table_part:
                matched_tables.append(t)
                break
        else:
            return f"访问被拒绝: 表 '{ref}' 不属于您的数据表。请使用 inspect_tables 查看可用表。"

    # 权限检查 (Phase 3E)
    from app.core.security.data_access import DataAccessControl
    dac = DataAccessControl()
    for table in matched_tables:
        if not await dac.check_table_access(user, table, "read", db):
            return f"权限不足: 无法访问表 {table.display_name}"

    # 行级过滤注入
    sql = await dac.rewrite_sql_with_filters(user, sql, matched_tables, db)

    if not request:
        return "内部错误: 无法获取执行器。"

    executor = getattr(request.app.state, "isolated_executor", None)
    if not executor:
        return "内部错误: SQL 执行器未初始化。"

    schema = executor.get_user_schema(user.tenant_id)

    try:
        query_result = await executor.execute_read(
            tenant_schema=schema,
            sql=sql,
        )
    except Exception as e:
        error_msg = str(e)
        if "statement timeout" in error_msg.lower():
            return "查询超时: SQL 执行时间超过限制，请优化查询或减少数据量。"
        return f"SQL 执行错误: {error_msg[:500]}"

    if not query_result.rows:
        return f"查询成功，但没有返回结果。\n\nSQL: `{sql}`"

    result_data = {
        "columns": query_result.columns,
        "rows": query_result.rows[:50],
        "total_rows": query_result.row_count,
        "truncated": query_result.truncated,
        "execution_ms": query_result.execution_ms,
    }

    # 列级脱敏 (Phase 3E)
    for table in matched_tables:
        result_data = await dac.apply_column_masking(result_data, user, table, db)

    lines = [f"查询成功 ({query_result.row_count} 行, {query_result.execution_ms}ms)"]
    if query_result.truncated:
        lines.append(f"⚠️ 结果已截断 (最多显示 1000 行)")
    lines.append("")
    lines.append(json.dumps(result_data, ensure_ascii=False, default=str))

    return "\n".join(lines)


def register_execute_sql(registry: ToolRegistry):
    """注册 execute_sql 工具。"""
    registry.register_context_tool(
        name="execute_sql",
        description="在用户数据表上执行只读 SQL 查询 (SELECT)。自动进行安全检查和结果行数限制。表名使用 inspect_tables 返回的 pg_table_name。",
        parameters=EXECUTE_SQL_PARAMS,
        fn=_execute_sql,
    )
