"""LLM Router — 根据 model_id 路由到对应 Provider"""
import logging
from typing import AsyncGenerator
from app.core.llm.base import BaseLLMProvider, StreamChunk, ModelInfo

logger = logging.getLogger(__name__)


class LLMRouter:
    """根据 model_id 自动路由到对应 Provider"""

    def __init__(self):
        self.providers: dict[str, BaseLLMProvider] = {}
        self.model_provider_map: dict[str, str] = {}

    def register_provider(self, name: str, provider: BaseLLMProvider):
        """注册一个 Provider，并自动映射其模型"""
        self.providers[name] = provider
        for model_info in provider.list_models():
            self.model_provider_map[model_info.id] = name
            logger.info(f"Registered model: {model_info.id} -> {name}")

    def get_provider(self, model_id: str) -> BaseLLMProvider:
        provider_name = self.model_provider_map.get(model_id)
        if not provider_name:
            raise ValueError(f"Unknown model: {model_id}. Available: {list(self.model_provider_map.keys())}")
        return self.providers[provider_name]

    async def stream(
        self,
        model_id: str,
        messages: list[dict],
        thinking_enabled: bool = False,
        **kwargs,
    ) -> AsyncGenerator[StreamChunk, None]:
        provider = self.get_provider(model_id)
        async for chunk in provider.stream_chat(
            messages=messages,
            model=model_id,
            thinking_enabled=thinking_enabled,
            **kwargs,
        ):
            yield chunk

    def list_all_models(self) -> list[ModelInfo]:
        models = []
        for provider in self.providers.values():
            models.extend(provider.list_models())
        return models


# Singleton
llm_router = LLMRouter()
