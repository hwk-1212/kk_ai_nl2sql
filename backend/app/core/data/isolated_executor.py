"""租户隔离 SQL 执行器 — 在 user_data schema 下安全地执行用户 SQL。

每个用户的数据表隔离在 user_data.u_{user_id}_{table_name}，
执行前经过 SecurityChecker 审查，结果行数受 SQL_MAX_RESULT_ROWS 限制。

TODO (Phase 3a): 实现完整执行流程
"""
from __future__ import annotations
import uuid
import logging
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class IsolatedExecutor:
    """在 user_data schema 隔离环境下执行 SQL。"""

    def __init__(self, db_session):
        self.db = db_session

    async def execute_query(
        self,
        user_id: uuid.UUID,
        sql: str,
        params: dict | None = None,
        timeout: int | None = None,
    ) -> dict:
        """执行只读查询，返回 {columns, rows, row_count, execution_ms}。
        TODO (Phase 3a):
          1. sql_checker 安全检查
          2. 注入 search_path = user_data
          3. 设置 statement_timeout
          4. 执行并截断超过 SQL_MAX_RESULT_ROWS 的结果
        """
        raise NotImplementedError("Phase 3a")

    async def create_table_from_parsed(
        self,
        user_id: uuid.UUID,
        table_name: str,
        columns: list[str],
        rows: list[list],
        col_types: list[str] | None = None,
    ) -> str:
        """在 user_data schema 中建表并写入数据，返回完整表名。
        TODO (Phase 3a): CREATE TABLE + COPY/INSERT
        """
        raise NotImplementedError("Phase 3a")

    async def drop_table(self, user_id: uuid.UUID, table_name: str) -> None:
        """删除 user_data schema 中的表。
        TODO (Phase 3a): DROP TABLE IF EXISTS
        """
        raise NotImplementedError("Phase 3a")

    @staticmethod
    def qualified_table(user_id: uuid.UUID, table_name: str) -> str:
        """返回 schema-qualified 表名: user_data.u_{uid}_{table}"""
        uid_short = str(user_id).replace("-", "")[:16]
        return f"user_data.u_{uid_short}_{table_name}"
