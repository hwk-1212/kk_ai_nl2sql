"""Token 计算器 — 使用 tiktoken 计算消息列表的实际 token 数。

兼容 OpenAI / DeepSeek / Qwen 的 cl100k_base 编码。
"""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


class TokenCounter:
    """基于 tiktoken 的 token 计算工具，支持多模型。"""

    MODEL_ENCODING: dict[str, str] = {
        "deepseek-chat": "cl100k_base",
        "deepseek-reasoner": "cl100k_base",
        "qwen-plus": "cl100k_base",
    }

    def __init__(self) -> None:
        self._encoders: dict[str, object] = {}

    def _get_encoder(self, model: str = "deepseek-chat"):
        encoding_name = self.MODEL_ENCODING.get(model, "cl100k_base")
        if encoding_name not in self._encoders:
            try:
                import tiktoken
                self._encoders[encoding_name] = tiktoken.get_encoding(encoding_name)
            except ImportError:
                logger.warning("tiktoken not installed, using char-based estimation")
                return None
        return self._encoders[encoding_name]

    def count(self, text: str, model: str = "deepseek-chat") -> int:
        """计算单段文本的 token 数。"""
        if not text:
            return 0
        encoder = self._get_encoder(model)
        if encoder:
            return len(encoder.encode(text))
        return max(1, len(text) // 4)

    def count_messages(self, messages: list[dict], model: str = "deepseek-chat") -> int:
        """
        计算消息列表的总 token 数。
        每条消息额外 +4 tokens (role + 分隔符开销)，
        最终 +2 tokens (reply priming)。
        """
        total = 0
        for msg in messages:
            total += 4
            total += self.count(msg.get("content", ""), model)
            if msg.get("role"):
                total += 1
            if msg.get("tool_calls"):
                total += self.count(str(msg["tool_calls"]), model)
        total += 2
        return total
