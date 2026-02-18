"""数据审计服务 — 记录 NL2SQL 查询的完整审计日志。

TODO (Phase 3f): 实现审计日志写入和查询
"""
from __future__ import annotations
import uuid
import logging

logger = logging.getLogger(__name__)


class DataAuditor:
    """NL2SQL 操作审计日志服务。"""

    def __init__(self, db_session):
        self.db = db_session

    async def log_query(
        self,
        user_id: uuid.UUID,
        sql: str,
        status: str = "success",
        execution_ms: int = 0,
        row_count: int = 0,
        error: str | None = None,
    ) -> None:
        """记录一条 SQL 查询审计日志。
        TODO (Phase 3f): 写入 DataAuditLog 表
        """
        raise NotImplementedError("Phase 3f")

    async def get_logs(self, user_id: uuid.UUID | None = None, limit: int = 100, offset: int = 0) -> list[dict]:
        """查询审计日志。
        TODO (Phase 3f): 分页查询 DataAuditLog
        """
        raise NotImplementedError("Phase 3f")

    async def get_stats(self, user_id: uuid.UUID | None = None, days: int = 7) -> dict:
        """获取审计统计: 查询次数、失败率、平均耗时等。
        TODO (Phase 3f): 聚合查询
        """
        raise NotImplementedError("Phase 3f")
