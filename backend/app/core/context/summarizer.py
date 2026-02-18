"""上下文摘要器 — 当 Token 超限时将历史消息压缩为摘要。

TODO (Phase 3c): 实现 LLM 调用摘要逻辑
"""
from __future__ import annotations
import logging

logger = logging.getLogger(__name__)


class ContextSummarizer:
    """使用轻量 LLM 将历史消息压缩为单条摘要消息。"""

    def __init__(self, llm_router=None):
        self.llm_router = llm_router

    async def summarize(self, messages: list[dict], max_summary_tokens: int = 500) -> str:
        """将 messages 压缩为不超过 max_summary_tokens 的摘要文本。
        TODO (Phase 3c): 调用 llm_router 使用快速模型生成摘要
        """
        raise NotImplementedError("Phase 3c")
