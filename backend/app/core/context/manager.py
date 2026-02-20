"""上下文管理器 — 自动控制对话窗口大小。

当对话上下文 token 数达到模型上限的 60% 时，
自动将旧消息通过 LLM 压缩为摘要，保留最近对话原文。
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

from app.core.context.token_counter import TokenCounter
from app.core.context.summarizer import ContextSummarizer

if TYPE_CHECKING:
    from app.core.llm.router import LLMRouter

logger = logging.getLogger(__name__)


@dataclass
class ContextBuildResult:
    """build_messages 的返回值"""
    messages: list[dict]
    was_compressed: bool = False
    original_tokens: int = 0
    compressed_tokens: int = 0


class ContextManager:
    """上下文管理器 — 自动控制对话窗口大小"""

    MAX_TOKENS: dict[str, int] = {
        "deepseek-chat": 64000,
        "deepseek-reasoner": 64000,
        "qwen-plus": 128000,
    }
    COMPRESS_THRESHOLD = 0.6
    KEEP_RECENT_ROUNDS = 6
    MIN_MESSAGES_TO_COMPRESS = 10

    def __init__(self, token_counter: TokenCounter, summarizer: ContextSummarizer) -> None:
        self.counter = token_counter
        self.summarizer = summarizer

    async def build_messages(
        self,
        system_prompt: str,
        history_messages: list[dict],
        user_input: str,
        model: str,
        llm_router: LLMRouter | None = None,
        tool_definitions: list[dict] | None = None,
    ) -> ContextBuildResult:
        """
        构建最终发送给 LLM 的消息列表。

        流程:
        1. 组装完整消息列表: system + history + user_input
        2. 计算总 token 数（含工具定义开销）
        3. 若超过阈值且历史消息足够长 → 压缩旧消息
        4. 返回 ContextBuildResult（含压缩前后 token 统计）
        """
        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(history_messages)
        messages.append({"role": "user", "content": user_input})

        total_tokens = self.counter.count_messages(messages, model)
        max_tokens = self.MAX_TOKENS.get(model, 64000)

        if tool_definitions:
            tool_tokens = self.counter.count(str(tool_definitions), model)
            total_tokens += tool_tokens

        original_tokens = total_tokens

        if (
            total_tokens > max_tokens * self.COMPRESS_THRESHOLD
            and len(history_messages) >= self.MIN_MESSAGES_TO_COMPRESS
            and llm_router is not None
        ):
            compressed = await self._compress(
                system_prompt, history_messages, user_input, model, llm_router
            )
            compressed_tokens = self.counter.count_messages(compressed, model)
            if tool_definitions:
                compressed_tokens += self.counter.count(str(tool_definitions), model)

            logger.info(
                f"Context compressed: {original_tokens} -> {compressed_tokens} tokens "
                f"(threshold={int(max_tokens * self.COMPRESS_THRESHOLD)}, "
                f"history_msgs={len(history_messages)})"
            )
            return ContextBuildResult(
                messages=compressed,
                was_compressed=True,
                original_tokens=original_tokens,
                compressed_tokens=compressed_tokens,
            )

        return ContextBuildResult(
            messages=messages,
            was_compressed=False,
            original_tokens=original_tokens,
            compressed_tokens=original_tokens,
        )

    async def _compress(
        self,
        system_prompt: str,
        history: list[dict],
        user_input: str,
        model: str,
        llm_router: LLMRouter,
    ) -> list[dict]:
        """
        压缩策略:
        1. 保留 system prompt
        2. 将旧消息 (除最近 N 轮) 通过 LLM 压缩为一条摘要
        3. 保留最近 KEEP_RECENT_ROUNDS 轮对话原文
        4. 拼接: system + 摘要消息 + 最近 N 轮 + 当前 user_input
        """
        keep_count = self.KEEP_RECENT_ROUNDS * 2
        if len(history) > keep_count:
            old_messages = history[:-keep_count]
            recent_messages = history[-keep_count:]
        else:
            old_messages = []
            recent_messages = history

        if old_messages:
            summary = await self.summarizer.summarize(
                old_messages, llm_router, model
            )
            summary_msg = {
                "role": "system",
                "content": f"[上下文摘要] 以下是之前对话的摘要:\n{summary}",
            }
            return [
                {"role": "system", "content": system_prompt},
                summary_msg,
                *recent_messages,
                {"role": "user", "content": user_input},
            ]

        return [
            {"role": "system", "content": system_prompt},
            *recent_messages,
            {"role": "user", "content": user_input},
        ]
