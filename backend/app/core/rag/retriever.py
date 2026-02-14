"""RAG 检索器 — Milvus ANN + qwen3-rerank"""
import logging
from pydantic import BaseModel
import httpx
from app.core.rag.embedder import Embedder
from app.core.rag.vector_store import VectorStore

logger = logging.getLogger(__name__)


class RAGChunk(BaseModel):
    """检索到的文档片段"""
    content: str
    doc_id: str
    score: float
    metadata: dict = {}


class RAGRetriever:
    """RAG 检索 + Rerank"""

    def __init__(
        self,
        embedder: Embedder,
        vector_store: VectorStore,
        rerank_api_key: str | None = None,
        rerank_base_url: str = "https://dashscope.aliyuncs.com/compatible-api/v1",
    ):
        self.embedder = embedder
        self.vector_store = vector_store
        self.rerank_api_key = rerank_api_key
        self.rerank_base_url = rerank_base_url

    async def retrieve(
        self,
        query: str,
        collection_names: list[str],
        top_k: int = 5,
        ann_top_k: int = 20,
        use_rerank: bool = True,
    ) -> list[RAGChunk]:
        """
        检索流程:
        1. query → embedding
        2. Milvus ANN search (每个 collection)
        3. 合并去重
        4. qwen3-rerank 精排
        5. 返回 top_k
        """
        if not collection_names:
            return []

        # 1. 查询向量化
        query_embedding = await self.embedder.embed_query(query)

        # 2. 多 collection 检索 + 合并
        all_hits: list[dict] = []
        for col_name in collection_names:
            try:
                hits = self.vector_store.search(col_name, query_embedding, top_k=ann_top_k)
                all_hits.extend(hits)
            except Exception as e:
                logger.warning(f"Milvus search failed for {col_name}: {e}")

        if not all_hits:
            return []

        # 按 score 降序去重
        seen = set()
        unique_hits = []
        for h in sorted(all_hits, key=lambda x: x["score"], reverse=True):
            if h["id"] not in seen:
                seen.add(h["id"])
                unique_hits.append(h)

        # 3. Rerank
        if use_rerank and self.rerank_api_key and len(unique_hits) > 1:
            chunks = await self._rerank(query, unique_hits, top_k)
        else:
            chunks = [
                RAGChunk(
                    content=h["content"],
                    doc_id=h["doc_id"],
                    score=h["score"],
                    metadata=h.get("metadata", {}),
                )
                for h in unique_hits[:top_k]
            ]

        return chunks

    async def _rerank(self, query: str, hits: list[dict], top_n: int) -> list[RAGChunk]:
        """调用 qwen3-rerank API"""
        documents = [h["content"] for h in hits]
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    f"{self.rerank_base_url}/reranks",
                    headers={
                        "Authorization": f"Bearer {self.rerank_api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": "qwen3-rerank",
                        "query": query,
                        "documents": documents,
                        "top_n": top_n,
                    },
                )
                resp.raise_for_status()
                data = resp.json()

            chunks = []
            for r in data.get("results", []):
                idx = r["index"]
                hit = hits[idx]
                chunks.append(RAGChunk(
                    content=hit["content"],
                    doc_id=hit["doc_id"],
                    score=r["relevance_score"],
                    metadata=hit.get("metadata", {}),
                ))
            return chunks
        except Exception as e:
            logger.warning(f"Rerank failed, falling back to vector scores: {e}")
            return [
                RAGChunk(
                    content=h["content"],
                    doc_id=h["doc_id"],
                    score=h["score"],
                    metadata=h.get("metadata", {}),
                )
                for h in hits[:top_n]
            ]

    @staticmethod
    def build_rag_prompt(chunks: list[RAGChunk]) -> str:
        """将检索结果格式化为可注入 prompt 的文本"""
        if not chunks:
            return ""
        parts = ["## 参考资料 (知识库检索结果)\n请参考以下内容回答用户的问题：\n"]
        for i, c in enumerate(chunks, 1):
            fname = c.metadata.get("filename") or c.metadata.get("source", "文档")
            page = c.metadata.get("page")
            loc = f"{fname}"
            if page:
                loc += f" (第{page}页)"
            parts.append(f"[{i}] {c.content}\n— 来源: {loc}\n")
        return "\n".join(parts)

    @staticmethod
    def to_sse_payload(chunks: list[RAGChunk]) -> list[dict]:
        """序列化为 SSE rag_source 事件 payload"""
        return [
            {
                "content": c.content[:200],
                "score": round(c.score, 3),
                "source": c.metadata.get("filename") or c.metadata.get("source", ""),
                "page": c.metadata.get("page"),
            }
            for c in chunks
        ]
