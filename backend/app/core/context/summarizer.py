"""上下文摘要器 — 当 Token 超限时将历史消息压缩为摘要。

使用 LLM 的非流式调用将多条对话历史压缩为一段简洁摘要，
保留关键信息：用户意图、数据发现、查询结论、用户偏好。
"""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.core.llm.router import LLMRouter

logger = logging.getLogger(__name__)

SUMMARIZE_PROMPT = """请将以下对话历史压缩为一段简洁的摘要。
保留关键信息：用户意图、重要数据发现、查询结果要点、用户偏好。
不要遗漏任何重要的数据分析结论或业务发现。

对话历史:
{conversation_text}

请用第三人称描述，输出简洁的摘要（不超过 500 字）:"""


class ContextSummarizer:
    """使用 LLM 将多条历史消息压缩为单条摘要消息。"""

    SUMMARIZE_MODEL = "deepseek-chat"

    async def summarize(
        self,
        messages: list[dict],
        llm_router: LLMRouter,
        model: str | None = None,
    ) -> str:
        """
        将 messages 压缩为摘要文本。
        通过 llm_router.stream 收集完整响应（因为 router 仅提供流式接口）。
        """
        conversation_text = self._format_messages(messages)
        if not conversation_text.strip():
            return ""

        use_model = model or self.SUMMARIZE_MODEL
        prompt = SUMMARIZE_PROMPT.format(conversation_text=conversation_text)

        try:
            summary_parts: list[str] = []
            async for chunk in llm_router.stream(
                model_id=use_model,
                messages=[
                    {"role": "system", "content": "你是一个对话摘要助手。请简洁地总结对话内容。"},
                    {"role": "user", "content": prompt},
                ],
                thinking_enabled=False,
                temperature=0.3,
            ):
                if chunk.type == "content" and chunk.data:
                    summary_parts.append(chunk.data)

            summary = "".join(summary_parts).strip()
            if summary:
                logger.info(f"Context summarized: {len(messages)} messages -> {len(summary)} chars")
            return summary

        except Exception:
            logger.exception("Failed to generate context summary, falling back to truncation")
            return self._fallback_summary(messages)

    @staticmethod
    def _format_messages(messages: list[dict]) -> str:
        """将消息列表格式化为文本块。"""
        lines: list[str] = []
        for msg in messages:
            role = msg.get("role", "unknown")
            content = msg.get("content", "")
            if not content:
                continue
            role_label = {"user": "用户", "assistant": "助手", "system": "系统", "tool": "工具"}.get(role, role)
            if len(content) > 800:
                content = content[:800] + "..."
            lines.append(f"[{role_label}]: {content}")
        return "\n".join(lines)

    @staticmethod
    def _fallback_summary(messages: list[dict]) -> str:
        """LLM 调用失败时的简单截断摘要。"""
        parts: list[str] = []
        for msg in messages:
            role = msg.get("role", "")
            content = msg.get("content", "")
            if role == "user" and content:
                parts.append(f"用户曾询问: {content[:100]}")
            elif role == "assistant" and content:
                parts.append(f"助手回复要点: {content[:100]}")
        return "\n".join(parts[-10:])
