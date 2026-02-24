"""查询结果缓存 — L1 内存 LRU + L2 Redis 双级缓存。

L1: 内存 OrderedDict LRU，O(1) 查找，进程内有效。
L2: Redis SETEX，跨进程共享，TTL 5 分钟。
缓存 key = sha256(tenant_id:user_id:normalized_sql)。
"""
from __future__ import annotations

import hashlib
import json
import logging
import time
from collections import OrderedDict
from typing import Any

import sqlparse

logger = logging.getLogger(__name__)


class QueryCache:
    """SQL 查询结果多级缓存。"""

    L1_MAX_SIZE = 200
    L2_TTL_SECONDS = 300
    MAX_CACHEABLE_BYTES = 1_000_000  # 1 MB

    def __init__(self, redis_client, *, l1_max: int = L1_MAX_SIZE, l2_ttl: int = L2_TTL_SECONDS):
        self._redis = redis_client
        self._l1: OrderedDict[str, tuple[float, dict]] = OrderedDict()
        self._l1_max = l1_max
        self._l2_ttl = l2_ttl
        self._table_keys: dict[str, set[str]] = {}
        self._user_keys: dict[str, set[str]] = {}
        self._hits = {"l1": 0, "l2": 0, "miss": 0}

    # ── key generation ──────────────────────────────────────

    @staticmethod
    def cache_key(tenant_id: str, user_id: str, sql: str) -> str:
        normalized = sqlparse.format(sql, strip_comments=True, reindent=True).strip()
        raw = f"{tenant_id}:{user_id}:{normalized}"
        return f"qcache:{user_id[:8]}:{hashlib.sha256(raw.encode()).hexdigest()[:24]}"

    # ── read ────────────────────────────────────────────────

    async def get(self, key: str) -> dict | None:
        """L1 → L2 → None"""
        # L1
        entry = self._l1.get(key)
        if entry is not None:
            ts, data = entry
            if time.time() - ts < self._l2_ttl:
                self._l1.move_to_end(key)
                self._hits["l1"] += 1
                return data
            else:
                del self._l1[key]

        # L2
        try:
            raw = await self._redis.get(key)
        except Exception:
            raw = None
        if raw is not None:
            try:
                data = json.loads(raw)
                self._l1_put(key, data)
                self._hits["l2"] += 1
                return data
            except (json.JSONDecodeError, TypeError):
                pass

        self._hits["miss"] += 1
        return None

    # ── write ───────────────────────────────────────────────

    async def set(
        self, key: str, result: dict,
        table_names: list[str] | None = None,
        user_id: str | None = None,
    ) -> None:
        payload = json.dumps(result, ensure_ascii=False, default=str)
        if len(payload) > self.MAX_CACHEABLE_BYTES:
            return

        self._l1_put(key, result)

        try:
            await self._redis.setex(key, self._l2_ttl, payload)
        except Exception as e:
            logger.debug("QueryCache L2 set error: %s", e)

        if table_names:
            for tn in table_names:
                self._table_keys.setdefault(tn, set()).add(key)
        if user_id:
            self._user_keys.setdefault(user_id, set()).add(key)

    # ── invalidation ────────────────────────────────────────

    async def invalidate_table(self, table_name: str) -> int:
        """清除与某张表相关的所有缓存。"""
        keys = self._table_keys.pop(table_name, set())
        count = 0
        for k in keys:
            self._l1.pop(k, None)
            try:
                await self._redis.delete(k)
            except Exception:
                pass
            count += 1
        return count

    async def invalidate_user(self, user_id: str) -> int:
        """清除用户的全部查询缓存。"""
        count = 0

        tracked_keys = self._user_keys.pop(user_id, set())
        for k in tracked_keys:
            self._l1.pop(k, None)
            try:
                await self._redis.delete(k)
            except Exception:
                pass
            count += 1

        uid_prefix = user_id[:8]
        pattern = f"qcache:{uid_prefix}:*"
        try:
            cursor = "0"
            while cursor:
                cursor, keys = await self._redis.scan(cursor=cursor, match=pattern, count=100)
                if keys:
                    await self._redis.delete(*keys)
                    count += len(keys)
                if cursor == "0" or cursor == 0:
                    break
        except Exception as e:
            logger.debug("QueryCache invalidate_user scan error: %s", e)
        return count

    async def invalidate_all(self) -> None:
        """清除所有查询缓存。"""
        self._l1.clear()
        self._table_keys.clear()
        try:
            cursor = "0"
            while cursor:
                cursor, keys = await self._redis.scan(cursor=cursor, match="qcache:*", count=200)
                if keys:
                    await self._redis.delete(*keys)
                if cursor == "0" or cursor == 0:
                    break
        except Exception:
            pass

    # ── stats ───────────────────────────────────────────────

    def stats(self) -> dict:
        return {
            "l1_size": len(self._l1),
            "l1_max": self._l1_max,
            "hits": dict(self._hits),
            "table_key_groups": len(self._table_keys),
        }

    # ── internal ────────────────────────────────────────────

    def _l1_put(self, key: str, data: dict) -> None:
        self._l1[key] = (time.time(), data)
        self._l1.move_to_end(key)
        while len(self._l1) > self._l1_max:
            self._l1.popitem(last=False)
