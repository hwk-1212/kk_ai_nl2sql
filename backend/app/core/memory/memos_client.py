"""MemOS Cloud REST API 异步封装"""
import logging
from typing import Any

import httpx
from pydantic import BaseModel

logger = logging.getLogger(__name__)


# ---------- Response Models ----------

class MemoryItem(BaseModel):
    """事实记忆"""
    id: str
    memory_key: str
    memory_value: str
    memory_type: str = "UserMemory"
    confidence: float = 0.0
    tags: list[str] = []
    relativity: float = 0.0
    conversation_id: str = ""
    create_time: int = 0
    update_time: int = 0
    status: str = "activated"


class PreferenceItem(BaseModel):
    """偏好记忆"""
    id: str
    preference_type: str  # "explicit_preference" | "implicit_preference"
    preference: str
    reasoning: str = ""
    relativity: float = 0.0
    conversation_id: str = ""
    create_time: int = 0
    update_time: int = 0
    status: str = "activated"


class MemorySearchResult(BaseModel):
    """search/memory 完整返回"""
    memories: list[MemoryItem] = []
    preferences: list[PreferenceItem] = []
    preference_note: str = ""


class MemosClient:
    """MemOS Cloud API 客户端"""

    def __init__(self, api_key: str, base_url: str = "https://memos.memtensor.cn/api/openmem/v1"):
        self.base_url = base_url.rstrip("/")
        self.headers = {
            "Authorization": f"Token {api_key}",
            "Content-Type": "application/json",
        }
        self._client: httpx.AsyncClient | None = None

    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=30.0)
        return self._client

    async def close(self):
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    # ---- add/message ----

    async def add_memory(
        self,
        user_id: str,
        conversation_id: str,
        messages: list[dict[str, str]],
    ) -> dict[str, Any]:
        """
        添加记忆（异步操作，返回 task_id）。
        messages: [{"role": "user"|"assistant", "content": "..."}]
        """
        payload = {
            "user_id": user_id,
            "conversation_id": conversation_id,
            "messages": messages,
        }
        try:
            resp = await self.client.post(
                f"{self.base_url}/add/message",
                headers=self.headers,
                json=payload,
            )
            resp.raise_for_status()
            body = resp.json()
            if body.get("code") != 0:
                logger.warning(f"MemOS add_memory non-zero code: {body}")
            return body.get("data", {})
        except Exception as e:
            logger.error(f"MemOS add_memory failed: {e}")
            return {}

    # ---- search/memory ----

    async def search_memory(
        self,
        user_id: str,
        query: str,
        conversation_id: str | None = None,
        filter: dict | None = None,
    ) -> MemorySearchResult:
        """
        检索记忆，返回结构化结果。
        """
        payload: dict[str, Any] = {
            "user_id": user_id,
            "query": query,
        }
        if conversation_id:
            payload["conversation_id"] = conversation_id
        if filter:
            payload["filter"] = filter

        try:
            resp = await self.client.post(
                f"{self.base_url}/search/memory",
                headers=self.headers,
                json=payload,
            )
            resp.raise_for_status()
            body = resp.json()
            if body.get("code") != 0:
                logger.warning(f"MemOS search_memory non-zero code: {body}")
                return MemorySearchResult()

            data = body.get("data", {})
            return MemorySearchResult(
                memories=[MemoryItem(**m) for m in data.get("memory_detail_list", [])],
                preferences=[PreferenceItem(**p) for p in data.get("preference_detail_list", [])],
                preference_note=data.get("preference_note", ""),
            )
        except Exception as e:
            logger.error(f"MemOS search_memory failed: {e}")
            return MemorySearchResult()

    # ---- delete/memory ----

    async def delete_memory(self, memory_ids: list[str]) -> bool:
        """删除记忆"""
        payload = {"memory_ids": memory_ids}
        try:
            resp = await self.client.post(
                f"{self.base_url}/delete/memory",
                headers=self.headers,
                json=payload,
            )
            resp.raise_for_status()
            body = resp.json()
            return body.get("data", {}).get("success", False)
        except Exception as e:
            logger.error(f"MemOS delete_memory failed: {e}")
            return False
