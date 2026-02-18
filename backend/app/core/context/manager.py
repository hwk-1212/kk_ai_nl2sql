"""上下文管理器 — 维护 NL2SQL 对话的多轮上下文窗口。

在普通聊天基础上，额外注入当前激活数据源的 Schema 信息，
并根据 Token 预算自动裁剪或摘要历史消息。

TODO (Phase 3c): 实现完整逻辑
"""
from __future__ import annotations
import uuid
import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class ContextWindow:
    messages: list[dict]
    total_tokens: int
    truncated: bool
    schema_injected: bool


class ContextManager:
    """为 NL2SQL 会话构建发送给 LLM 的上下文窗口。"""

    def __init__(self, token_counter, summarizer, max_tokens: int = 8192):
        self.token_counter = token_counter
        self.summarizer = summarizer
        self.max_tokens = max_tokens

    async def build_context(
        self,
        conversation_id: uuid.UUID,
        new_message: str,
        schema_info: str | None = None,
        history: list[dict] | None = None,
    ) -> ContextWindow:
        """构建发送给 LLM 的消息列表，含 Schema 注入和 Token 裁剪。
        TODO (Phase 3c): 实现 Token 预算分配和摘要回退策略
        """
        raise NotImplementedError("Phase 3c")

    async def get_active_schema(self, user_id: uuid.UUID) -> str | None:
        """获取用户当前激活数据源的 Schema 描述文本。
        TODO (Phase 3c): 从 SchemaCache 获取，触发懒加载
        """
        raise NotImplementedError("Phase 3c")
