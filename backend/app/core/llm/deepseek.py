"""DeepSeek Provider — 支持 deepseek-chat (v3.2) 对话+思考双模式"""
import logging
from typing import AsyncGenerator
from openai import AsyncOpenAI
from app.core.llm.base import BaseLLMProvider, StreamChunk, ModelInfo

logger = logging.getLogger(__name__)


class DeepSeekProvider(BaseLLMProvider):
    """
    DeepSeek v3.2 混合推理模型
    - deepseek-chat: 普通对话 (thinking disabled)
    - deepseek-chat + thinking enabled: 推理模式，返回 reasoning_content + content
    """

    def __init__(self, api_key: str, base_url: str = "https://api.deepseek.com"):
        self.client = AsyncOpenAI(api_key=api_key, base_url=base_url)

    async def stream_chat(
        self,
        messages: list[dict],
        model: str = "deepseek-chat",
        thinking_enabled: bool = False,
        temperature: float = 0.7,
        tools: list[dict] | None = None,
        **kwargs,
    ) -> AsyncGenerator[StreamChunk, None]:
        # 构建请求参数
        params: dict = {
            "model": "deepseek-chat",  # v3.2 统一入口
            "messages": messages,
            "stream": True,
        }

        if thinking_enabled:
            params["extra_body"] = {"thinking": {"type": "enabled"}}
        else:
            params["temperature"] = temperature

        if tools:
            params["tools"] = tools

        reasoning_full = ""
        content_full = ""
        usage_data = None
        last_finish_reason = None
        tool_calls_acc: dict[int, dict] = {}  # index → {id, function: {name, arguments}}

        try:
            response = await self.client.chat.completions.create(**params)

            async for chunk in response:
                if chunk.usage:
                    usage_dict = chunk.usage.model_dump()
                    reasoning_tokens = None
                    if usage_dict.get("completion_tokens_details"):
                        reasoning_tokens = usage_dict["completion_tokens_details"].get("reasoning_tokens")
                    usage_data = {
                        "prompt_tokens": usage_dict.get("prompt_tokens", 0),
                        "completion_tokens": usage_dict.get("completion_tokens", 0),
                        "total_tokens": usage_dict.get("total_tokens", 0),
                        "reasoning_tokens": reasoning_tokens,
                    }

                if not chunk.choices:
                    continue

                delta = chunk.choices[0].delta
                finish_reason = chunk.choices[0].finish_reason
                if finish_reason:
                    last_finish_reason = finish_reason
                delta_dict = delta.model_dump() if delta else {}

                rc = delta_dict.get("reasoning_content")
                if rc:
                    reasoning_full += rc
                    yield StreamChunk(type="reasoning", data=rc)

                c = delta_dict.get("content")
                if c:
                    content_full += c
                    yield StreamChunk(type="content", data=c)

                # 累积 tool_call 增量
                if delta.tool_calls:
                    for tc in delta.tool_calls:
                        idx = tc.index
                        if idx not in tool_calls_acc:
                            tool_calls_acc[idx] = {"id": "", "type": "function", "function": {"name": "", "arguments": ""}}
                        if tc.id:
                            tool_calls_acc[idx]["id"] = tc.id
                        if tc.function:
                            if tc.function.name:
                                tool_calls_acc[idx]["function"]["name"] += tc.function.name
                            if tc.function.arguments:
                                tool_calls_acc[idx]["function"]["arguments"] += tc.function.arguments

            assembled = list(tool_calls_acc.values()) if tool_calls_acc else None
            yield StreamChunk(
                type="done",
                reasoning=reasoning_full if reasoning_full else None,
                content=content_full,
                usage=usage_data,
                model="deepseek-chat",
                finish_reason=last_finish_reason or "stop",
                tool_calls=assembled,
            )

        except Exception as e:
            logger.error(f"DeepSeek stream error: {e}")
            yield StreamChunk(type="error", data=str(e))

    def list_models(self) -> list[ModelInfo]:
        return [
            ModelInfo(
                id="deepseek-chat",
                name="DeepSeek V3.2 (对话)",
                provider="deepseek",
                supports_thinking=True,
                description="DeepSeek v3.2 混合推理模型，支持普通对话和深度推理两种模式",
            ),
        ]
