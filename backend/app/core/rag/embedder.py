"""Embedding 服务 — 使用 Qwen text-embedding-v4 (OpenAI SDK)"""
import asyncio
import logging
from openai import AsyncOpenAI
import httpx

logger = logging.getLogger(__name__)

# 批量 embedding 最大文本数 — text-embedding-v4 限制单次最多 10 条
MAX_BATCH_SIZE = 6
# 批次间延迟 (秒) — 避免触发 API 限流
BATCH_DELAY = 0.5
# 单次 API 调用超时 (秒)
API_TIMEOUT = 60.0
# 重试次数
MAX_RETRIES = 3


class Embedder:
    """文本向量化"""

    def __init__(self, api_key: str, base_url: str, model: str = "text-embedding-v4", dim: int = 1024):
        self.client = AsyncOpenAI(
            api_key=api_key,
            base_url=base_url,
            timeout=httpx.Timeout(API_TIMEOUT, connect=10.0),
            max_retries=MAX_RETRIES,
        )
        self.model = model
        self.dim = dim

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        """批量文本向量化 — 自动分批 + 延迟 + 重试"""
        if not texts:
            return []

        total_batches = (len(texts) + MAX_BATCH_SIZE - 1) // MAX_BATCH_SIZE
        logger.info(f"Embedding {len(texts)} texts in {total_batches} batches")

        all_embeddings: list[list[float]] = []
        for i in range(0, len(texts), MAX_BATCH_SIZE):
            batch_idx = i // MAX_BATCH_SIZE + 1
            batch = texts[i : i + MAX_BATCH_SIZE]

            try:
                resp = await self.client.embeddings.create(
                    model=self.model,
                    input=batch,
                    dimensions=self.dim,
                )
                batch_embs = [d.embedding for d in sorted(resp.data, key=lambda x: x.index)]
                all_embeddings.extend(batch_embs)
                logger.info(f"Batch {batch_idx}/{total_batches} done ({len(batch)} texts)")
            except Exception as e:
                logger.error(f"Batch {batch_idx}/{total_batches} failed: {e}")
                raise

            # 批次间延迟，避免限流
            if i + MAX_BATCH_SIZE < len(texts):
                await asyncio.sleep(BATCH_DELAY)

        return all_embeddings

    async def embed_query(self, text: str) -> list[float]:
        """单条查询向量化"""
        result = await self.embed_texts([text])
        return result[0]
