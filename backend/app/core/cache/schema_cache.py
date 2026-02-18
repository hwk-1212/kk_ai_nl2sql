"""Schema 元数据缓存 — 缓存用户数据表的列名 / 类型 / 注释信息。

避免每次 NL2SQL 都查询 information_schema，提升响应速度。

TODO (Phase 3f): 实现完整缓存逻辑
"""
from __future__ import annotations
import uuid
import logging

logger = logging.getLogger(__name__)


class SchemaCache:
    """表结构元数据 Redis 缓存。"""

    KEY_PREFIX = "scache:"
    DEFAULT_TTL = 3600  # 1 hour

    def __init__(self, redis_client, ttl: int = DEFAULT_TTL):
        self.redis = redis_client
        self.ttl = ttl

    async def get_table_schema(self, user_id: uuid.UUID, table_id: uuid.UUID) -> dict | None:
        """获取表结构缓存: {columns: [{name, type, comment}], ...}
        TODO (Phase 3f): 实现 Redis GET
        """
        raise NotImplementedError("Phase 3f")

    async def set_table_schema(self, user_id: uuid.UUID, table_id: uuid.UUID, schema: dict) -> None:
        """缓存表结构。
        TODO (Phase 3f): 实现 Redis SETEX
        """
        raise NotImplementedError("Phase 3f")

    async def invalidate_table(self, user_id: uuid.UUID, table_id: uuid.UUID) -> None:
        """表结构变更时失效对应缓存。
        TODO (Phase 3f): 实现 Redis DEL
        """
        raise NotImplementedError("Phase 3f")
