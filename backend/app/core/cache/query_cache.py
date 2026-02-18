"""查询结果缓存 — 相同 SQL 在 TTL 内直接返回缓存结果。

基于 Redis，key 为 SQL hash + 用户维度。

TODO (Phase 3f): 实现完整缓存逻辑
"""
from __future__ import annotations
import hashlib
import json
import logging

logger = logging.getLogger(__name__)


class QueryCache:
    """SQL 查询结果 Redis 缓存。"""

    KEY_PREFIX = "qcache:"
    DEFAULT_TTL = 300  # 5 minutes

    def __init__(self, redis_client, ttl: int = DEFAULT_TTL):
        self.redis = redis_client
        self.ttl = ttl

    @staticmethod
    def _key(user_id: str, sql: str) -> str:
        h = hashlib.sha256(f"{user_id}:{sql}".encode()).hexdigest()[:24]
        return f"qcache:{h}"

    async def get(self, user_id: str, sql: str) -> dict | None:
        """获取缓存的查询结果。
        TODO (Phase 3f): 实现 Redis GET + JSON 反序列化
        """
        raise NotImplementedError("Phase 3f")

    async def set(self, user_id: str, sql: str, result: dict) -> None:
        """缓存查询结果。
        TODO (Phase 3f): 实现 Redis SETEX
        """
        raise NotImplementedError("Phase 3f")

    async def invalidate_user(self, user_id: str) -> int:
        """清除用户的所有查询缓存。
        TODO (Phase 3f): 实现 SCAN + DEL
        """
        raise NotImplementedError("Phase 3f")
