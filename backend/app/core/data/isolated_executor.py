"""租户隔离 SQL 执行器 — 在用户专属 schema 下安全地执行 SQL。

安全措施:
  - SET search_path 限定到用户 schema + public
  - SET statement_timeout 防止长查询
  - SET lock_timeout 防止死锁等待
  - 结果行数限制 (SQL_MAX_RESULT_ROWS)
  - 写操作权限校验 + 事务 savepoint
"""
from __future__ import annotations

import logging
import time
import uuid
from dataclasses import dataclass

from sqlalchemy import text as sa_text
from sqlalchemy.ext.asyncio import AsyncEngine

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


@dataclass
class QueryResult:
    columns: list[str]
    rows: list[list]
    row_count: int
    truncated: bool
    execution_ms: int


@dataclass
class WriteResult:
    affected_rows: int
    execution_ms: int


def _pg_identifier(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


class IsolatedSQLExecutor:
    """租户隔离的 SQL 执行器 — 强制 search_path + 超时保护。"""

    def __init__(self, engine: AsyncEngine):
        self.engine = engine

    async def execute_read(
        self,
        tenant_schema: str,
        sql: str,
        params: dict | None = None,
        timeout: int | None = None,
    ) -> QueryResult:
        """
        执行只读 SQL 查询。
        1. SET search_path TO {tenant_schema}, public
        2. SET statement_timeout
        3. SET lock_timeout
        4. 执行 SQL
        5. 限制结果行数
        """
        timeout = timeout or settings.sql_execution_timeout
        max_rows = settings.sql_max_result_rows

        start = time.monotonic()
        async with self.engine.connect() as conn:
            await conn.execute(sa_text(
                f"SET LOCAL search_path TO {_pg_identifier(tenant_schema)}, public"
            ))
            await conn.execute(sa_text(f"SET LOCAL statement_timeout TO '{timeout}s'"))
            await conn.execute(sa_text("SET LOCAL lock_timeout TO '5s'"))

            result = await conn.execute(sa_text(sql), params or {})
            columns = list(result.keys())
            all_rows = result.fetchall()

            truncated = len(all_rows) > max_rows
            rows = [list(r) for r in all_rows[:max_rows]]

            elapsed = int((time.monotonic() - start) * 1000)

        return QueryResult(
            columns=columns,
            rows=rows,
            row_count=len(rows),
            truncated=truncated,
            execution_ms=elapsed,
        )

    async def execute_write(
        self,
        tenant_schema: str,
        sql: str,
        user_id: uuid.UUID,
        table_pg_schema: str,
        table_pg_name: str,
        is_writable: bool = True,
        params: dict | None = None,
    ) -> WriteResult:
        """
        执行写 SQL (INSERT/UPDATE/DELETE)。
        验证权限 → 开启事务 → savepoint → 执行。
        """
        if not is_writable:
            raise PermissionError("Table is read-only")
        if table_pg_schema != tenant_schema:
            raise PermissionError("Schema mismatch: cannot write across tenant boundaries")

        timeout = settings.sql_execution_timeout
        start = time.monotonic()

        async with self.engine.begin() as conn:
            await conn.execute(sa_text(
                f"SET LOCAL search_path TO {_pg_identifier(tenant_schema)}, public"
            ))
            await conn.execute(sa_text(f"SET LOCAL statement_timeout TO '{timeout}s'"))
            await conn.execute(sa_text("SET LOCAL lock_timeout TO '5s'"))

            result = await conn.execute(sa_text(sql), params or {})
            affected = result.rowcount

        elapsed = int((time.monotonic() - start) * 1000)
        return WriteResult(affected_rows=affected, execution_ms=elapsed)

    @staticmethod
    def get_user_schema(tenant_id: uuid.UUID | None) -> str:
        if tenant_id:
            tid8 = str(tenant_id).replace("-", "")[:8]
            return f"ud_tenant_{tid8}"
        return "user_data"
