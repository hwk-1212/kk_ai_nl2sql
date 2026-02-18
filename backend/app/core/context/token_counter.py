"""Token 计算器 — 使用 tiktoken 计算消息列表的实际 token 数。

兼容 OpenAI / DeepSeek / Qwen 的 cl100k_base 编码。

TODO (Phase 3c): 实现完整计算逻辑
"""
from __future__ import annotations
import logging

logger = logging.getLogger(__name__)


class TokenCounter:
    """基于 tiktoken 的 token 计算工具。"""

    _encoding = None

    @classmethod
    def _get_encoding(cls):
        if cls._encoding is None:
            try:
                import tiktoken
                cls._encoding = tiktoken.get_encoding("cl100k_base")
            except ImportError:
                logger.warning("tiktoken not installed, using char-based estimation")
        return cls._encoding

    def count_text(self, text: str) -> int:
        """计算单段文本的 token 数。"""
        enc = self._get_encoding()
        if enc:
            return len(enc.encode(text))
        return len(text) // 4

    def count_messages(self, messages: list[dict]) -> int:
        """计算消息列表的总 token 数 (含 role/content 开销)。
        TODO (Phase 3c): 按 OpenAI 标准计算每条消息的 overhead
        """
        total = 0
        for msg in messages:
            total += 4  # per-message overhead
            total += self.count_text(msg.get("content", ""))
            total += self.count_text(msg.get("role", ""))
        total += 2  # reply priming
        return total
