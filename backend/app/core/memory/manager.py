"""记忆管理器 — 编排记忆的召回与存储"""
import asyncio
import logging
from app.core.memory.memos_client import MemosClient, MemorySearchResult

logger = logging.getLogger(__name__)


class MemoryManager:
    """封装 MemOS 的召回 / 存储 / Prompt 注入"""

    def __init__(
        self,
        client: MemosClient,
        recall_enabled: bool = True,
        save_enabled: bool = True,
        relativity_threshold: float = 0.3,
        recall_timeout: float = 15.0,
    ):
        self.client = client
        self.recall_enabled = recall_enabled
        self.save_enabled = save_enabled
        self.relativity_threshold = relativity_threshold
        self.recall_timeout = recall_timeout

    # ---- 记忆召回 ----

    async def recall(
        self,
        user_id: str,
        query: str,
        conversation_id: str | None = None,
    ) -> MemorySearchResult:
        """
        召回记忆。超时 / 异常时降级为空结果，不阻塞对话。
        """
        if not self.recall_enabled:
            return MemorySearchResult()

        try:
            result = await asyncio.wait_for(
                self.client.search_memory(
                    user_id=user_id,
                    query=query,
                    conversation_id=conversation_id,
                ),
                timeout=self.recall_timeout,
            )
            # 按 relativity 过滤低相关度
            result.memories = [
                m for m in result.memories
                if m.relativity >= self.relativity_threshold
            ]
            return result
        except asyncio.TimeoutError:
            logger.warning(f"MemOS recall timeout ({self.recall_timeout}s), degrading")
            return MemorySearchResult()
        except Exception as e:
            logger.warning(f"MemOS recall failed, degrading: {e}")
            return MemorySearchResult()

    # ---- 记忆存储 ----

    async def save(
        self,
        user_id: str,
        conversation_id: str,
        messages: list[dict[str, str]],
    ) -> str | None:
        """
        异步保存对话到 MemOS，返回 task_id。
        异常时静默失败，不影响主流程。
        """
        if not self.save_enabled:
            return None

        try:
            result = await self.client.add_memory(
                user_id=user_id,
                conversation_id=conversation_id,
                messages=messages,
            )
            task_id = result.get("task_id")
            if task_id:
                logger.info(f"MemOS save task: {task_id}")
            return task_id
        except Exception as e:
            logger.warning(f"MemOS save failed: {e}")
            return None

    # ---- Prompt 构建 ----

    @staticmethod
    def build_memory_prompt(result: MemorySearchResult) -> str:
        """将召回结果格式化为可注入 system prompt 的文本"""
        parts: list[str] = []

        if result.memories:
            parts.append("## 用户相关记忆")
            for m in result.memories:
                parts.append(f"- {m.memory_key}: {m.memory_value}")

        if result.preferences:
            parts.append("\n## 用户偏好")
            for p in result.preferences:
                label = "显式" if p.preference_type == "explicit_preference" else "隐式"
                parts.append(f"- [{label}] {p.preference}")

        if result.preference_note:
            parts.append(f"\n{result.preference_note.strip()}")

        return "\n".join(parts) if parts else ""

    # ---- 序列化供前端展示 ----

    @staticmethod
    def to_sse_payload(result: MemorySearchResult) -> dict:
        """将召回结果序列化为 SSE memory_recall 事件的 payload"""
        return {
            "memories": [
                {
                    "id": m.id,
                    "content": f"{m.memory_key}: {m.memory_value}",
                    "relevance": round(m.relativity, 3),
                    "source": ", ".join(m.tags[:3]) if m.tags else "记忆",
                }
                for m in result.memories
            ],
            "preferences": [
                {
                    "id": p.id,
                    "type": p.preference_type,
                    "content": p.preference,
                }
                for p in result.preferences
            ],
        }
