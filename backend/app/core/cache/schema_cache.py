"""Schema 元数据缓存 — Redis 缓存表结构，避免 Agent 每次 inspect 都查库。"""
from __future__ import annotations

import json
import logging
import uuid

logger = logging.getLogger(__name__)


class SchemaCache:
    """表结构 Redis 缓存。"""

    KEY_PREFIX = "scache:"
    DEFAULT_TTL = 600  # 10 min

    def __init__(self, redis_client, ttl: int = DEFAULT_TTL):
        self._redis = redis_client
        self._ttl = ttl

    def _key(self, user_id: uuid.UUID, table_id: uuid.UUID) -> str:
        return f"{self.KEY_PREFIX}{user_id}:{table_id}"

    async def get_table_schema(self, user_id: uuid.UUID, table_id: uuid.UUID) -> dict | None:
        key = self._key(user_id, table_id)
        try:
            raw = await self._redis.get(key)
        except Exception:
            return None
        if raw is None:
            return None
        try:
            return json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            return None

    async def set_table_schema(self, user_id: uuid.UUID, table_id: uuid.UUID, schema: dict) -> None:
        key = self._key(user_id, table_id)
        try:
            payload = json.dumps(schema, ensure_ascii=False, default=str)
            await self._redis.setex(key, self._ttl, payload)
        except Exception as e:
            logger.debug("SchemaCache set error: %s", e)

    async def invalidate_table(self, user_id: uuid.UUID, table_id: uuid.UUID) -> None:
        key = self._key(user_id, table_id)
        try:
            await self._redis.delete(key)
        except Exception:
            pass

    async def invalidate_user(self, user_id: uuid.UUID) -> int:
        """清除用户所有表结构缓存。"""
        prefix = f"{self.KEY_PREFIX}{user_id}:"
        count = 0
        try:
            cursor = "0"
            while cursor:
                cursor, keys = await self._redis.scan(cursor=cursor, match=f"{prefix}*", count=100)
                if keys:
                    await self._redis.delete(*keys)
                    count += len(keys)
                if cursor == "0" or cursor == 0:
                    break
        except Exception:
            pass
        return count
