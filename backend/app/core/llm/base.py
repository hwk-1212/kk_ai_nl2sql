"""LLM Provider 抽象基类"""
from abc import ABC, abstractmethod
from typing import AsyncGenerator, Literal
from pydantic import BaseModel


class StreamChunk(BaseModel):
    """统一的流式数据块"""
    type: Literal["reasoning", "content", "done", "error"]
    data: str = ""
    # done 事件时携带
    reasoning: str | None = None
    content: str | None = None
    usage: dict | None = None
    model: str | None = None
    finish_reason: str | None = None
    tool_calls: list[dict] | None = None  # finish_reason=="tool_calls" 时携带


class ModelInfo(BaseModel):
    """模型信息"""
    id: str
    name: str
    provider: str
    supports_thinking: bool = False
    description: str = ""


class BaseLLMProvider(ABC):
    """LLM Provider 统一接口"""

    @abstractmethod
    async def stream_chat(
        self,
        messages: list[dict],
        model: str,
        thinking_enabled: bool = False,
        temperature: float = 0.7,
        tools: list[dict] | None = None,
        **kwargs,
    ) -> AsyncGenerator[StreamChunk, None]:
        """流式对话，yield StreamChunk"""
        ...

    @abstractmethod
    def list_models(self) -> list[ModelInfo]:
        """返回该 Provider 支持的模型列表"""
        ...
