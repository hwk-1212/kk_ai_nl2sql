"""语义层 — 指标向量化 + 语义检索"""
import logging
import uuid
from typing import TYPE_CHECKING
from pydantic import BaseModel

from app.core.rag.embedder import Embedder
from app.core.rag.vector_store import VectorStore

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession
    from app.models.metric import Metric
    from app.models.business_term import BusinessTerm

logger = logging.getLogger(__name__)

COLLECTION_NAME = "kk_metrics"
EMBEDDING_DIM = 1024


class MetricSearchResult(BaseModel):
    """指标检索结果"""
    metric_id: str
    name: str
    english_name: str
    formula: str
    description: str | None
    dimensions: list[str] | None
    filters: list[str] | None
    source_table: str
    category: str | None
    score: float


class SemanticLayer:
    """语义层 — 指标向量化 + 语义检索"""

    def __init__(self, embedder: Embedder, vector_store: VectorStore):
        self.embedder = embedder
        self.vector_store = vector_store

    async def index_metric(self, metric: "Metric"):
        """
        将指标写入 Milvus:
        - 文本: "{name} {english_name} {description} {formula}"
        - 向量: text-embedding-v4 编码
        - 元数据: metric_id, user_id, tenant_id, category
        """
        text_parts = [metric.name, metric.english_name]
        if metric.description:
            text_parts.append(metric.description)
        text_parts.append(metric.formula)
        text = " ".join(text_parts)

        embedding = await self.embedder.embed_query(text)

        metadata = {
            "metric_id": str(metric.id),
            "user_id": str(metric.user_id),
            "tenant_id": str(metric.tenant_id) if metric.tenant_id else "",
            "category": metric.category or "",
            "name": metric.name,
            "english_name": metric.english_name,
            "formula": metric.formula,
            "source_table": metric.source_table,
            "description": metric.description or "",
            "dimensions": metric.dimensions or [],
            "filters": metric.filters or [],
        }

        self.vector_store.insert(
            collection_name=COLLECTION_NAME,
            ids=[str(metric.id)],
            contents=[text[:8000]],
            doc_ids=[str(metric.id)],
            metadatas=[metadata],
            embeddings=[embedding],
        )
        logger.info(f"Indexed metric: {metric.name} ({metric.id})")

    async def index_term(self, term: "BusinessTerm", metric: "Metric"):
        """
        将业务术语写入 Milvus:
        - 文本: "{term.term} → {metric.name} {metric.description}"
        """
        text = f"{term.term} → {metric.name}"
        if metric.description:
            text += f" {metric.description}"

        embedding = await self.embedder.embed_query(text)

        metadata = {
            "term_id": str(term.id),
            "metric_id": str(metric.id),
            "user_id": str(term.user_id),
            "tenant_id": str(term.tenant_id) if term.tenant_id else "",
            "term": term.term,
            "canonical_name": term.canonical_name,
            "term_type": term.term_type,
        }

        self.vector_store.insert(
            collection_name=COLLECTION_NAME,
            ids=[f"term_{term.id}"],
            contents=[text[:8000]],
            doc_ids=[str(metric.id)],
            metadatas=[metadata],
            embeddings=[embedding],
        )
        logger.info(f"Indexed term: {term.term} → {metric.name}")

    async def search(
        self,
        query: str,
        user_id: str,
        tenant_id: str | None,
        top_k: int = 5,
    ) -> list[MetricSearchResult]:
        """
        语义检索:
        1. query → embedding
        2. Milvus ANN search (过滤 user_id/tenant_id)
        3. 返回 top-k 指标 (含 formula, dimensions, filters)
        """
        query_embedding = await self.embedder.embed_query(query)

        hits = self.vector_store.search(
            collection_name=COLLECTION_NAME,
            query_embedding=query_embedding,
            top_k=top_k * 3,
        )

        results: list[MetricSearchResult] = []
        seen_metric_ids: set[str] = set()
        for hit in hits:
            meta = hit.get("metadata", {})
            hit_user_id = meta.get("user_id", "")
            hit_tenant_id = meta.get("tenant_id", "")

            if hit_user_id != user_id:
                continue
            if tenant_id and hit_tenant_id != tenant_id:
                continue

            metric_id = meta.get("metric_id")
            if not metric_id:
                continue

            if metric_id in seen_metric_ids:
                continue
            seen_metric_ids.add(metric_id)

            if not meta.get("name"):
                continue

            results.append(
                MetricSearchResult(
                    metric_id=metric_id,
                    name=meta.get("name", ""),
                    english_name=meta.get("english_name", ""),
                    formula=meta.get("formula", ""),
                    description=meta.get("description"),
                    dimensions=meta.get("dimensions"),
                    filters=meta.get("filters"),
                    source_table=meta.get("source_table", ""),
                    category=meta.get("category"),
                    score=hit.get("score", 0.0),
                )
            )

            if len(results) >= top_k:
                break

        return results

    async def remove_metric(self, metric_id: str):
        """从 Milvus 中删除指标向量"""
        try:
            self.vector_store.delete(
                collection_name=COLLECTION_NAME,
                ids=[metric_id],
            )
            logger.info(f"Removed metric vector: {metric_id}")
        except Exception as e:
            logger.warning(f"Failed to remove metric vector {metric_id}: {e}")

    async def rebuild_index(self, user_id: str, db: "AsyncSession"):
        """重建用户的所有指标索引"""
        from app.models.metric import Metric
        from sqlalchemy import select

        result = await db.execute(
            select(Metric).where(Metric.user_id == uuid.UUID(user_id))
        )
        metrics = result.scalars().all()

        for metric in metrics:
            await self.index_metric(metric)

        logger.info(f"Rebuilt index for {len(metrics)} metrics (user={user_id})")
