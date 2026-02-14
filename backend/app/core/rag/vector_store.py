"""Milvus 向量存储 — 按知识库隔离 Collection"""
import logging
from pymilvus import (
    connections,
    Collection,
    CollectionSchema,
    FieldSchema,
    DataType,
    utility,
)

logger = logging.getLogger(__name__)


class VectorStore:
    """Milvus 向量存储操作"""

    def __init__(self, host: str = "localhost", port: int = 19530):
        self.host = host
        self.port = port

    def _connect(self):
        connections.connect(alias="default", host=self.host, port=self.port)

    def _disconnect(self):
        try:
            connections.disconnect("default")
        except Exception:
            pass

    def create_collection(self, collection_name: str, dim: int = 1024):
        """创建知识库对应的 Milvus collection"""
        self._connect()
        try:
            if utility.has_collection(collection_name):
                logger.info(f"Collection {collection_name} already exists")
                return

            fields = [
                FieldSchema("id", DataType.VARCHAR, max_length=64, is_primary=True),
                FieldSchema("content", DataType.VARCHAR, max_length=8192),
                FieldSchema("doc_id", DataType.VARCHAR, max_length=64),
                FieldSchema("metadata", DataType.JSON),
                FieldSchema("embedding", DataType.FLOAT_VECTOR, dim=dim),
            ]
            schema = CollectionSchema(fields, description=f"RAG collection: {collection_name}")
            col = Collection(collection_name, schema)

            # 创建 HNSW 索引
            col.create_index(
                "embedding",
                {
                    "metric_type": "COSINE",
                    "index_type": "HNSW",
                    "params": {"M": 16, "efConstruction": 256},
                },
            )
            logger.info(f"Created Milvus collection: {collection_name} (dim={dim})")
        finally:
            self._disconnect()

    def drop_collection(self, collection_name: str):
        """删除 collection"""
        self._connect()
        try:
            if utility.has_collection(collection_name):
                utility.drop_collection(collection_name)
                logger.info(f"Dropped Milvus collection: {collection_name}")
        finally:
            self._disconnect()

    def insert(self, collection_name: str, ids: list[str], contents: list[str],
               doc_ids: list[str], metadatas: list[dict], embeddings: list[list[float]]):
        """插入向量数据"""
        self._connect()
        try:
            col = Collection(collection_name)
            col.insert([ids, contents, doc_ids, metadatas, embeddings])
            col.flush()
            logger.info(f"Inserted {len(ids)} vectors into {collection_name}")
        finally:
            self._disconnect()

    def delete_by_doc_id(self, collection_name: str, doc_id: str):
        """按文档 ID 删除所有 chunk 向量"""
        self._connect()
        try:
            if not utility.has_collection(collection_name):
                return
            col = Collection(collection_name)
            col.load()
            col.delete(f'doc_id == "{doc_id}"')
            col.flush()
            logger.info(f"Deleted vectors for doc_id={doc_id} from {collection_name}")
        finally:
            self._disconnect()

    def query_by_doc_id(self, collection_name: str, doc_id: str, limit: int = 1000) -> list[dict]:
        """按文档 ID 查询所有 chunk"""
        self._connect()
        try:
            if not utility.has_collection(collection_name):
                return []
            col = Collection(collection_name)
            col.load()

            results = col.query(
                expr=f'doc_id == "{doc_id}"',
                output_fields=["id", "content", "doc_id", "metadata"],
                limit=limit,
            )

            # 按 page → chunk_index 排序 — metadata 可能为 None (旧数据)
            def _sort_key(x):
                meta = x.get("metadata") or {}
                if not isinstance(meta, dict):
                    return (0, 0)
                return (meta.get("page", 0) or 0, meta.get("chunk_index", 0))

            results.sort(key=_sort_key)
            return [
                {
                    "id": r["id"],
                    "content": r["content"],
                    "doc_id": r["doc_id"],
                    "metadata": r.get("metadata") or {},
                }
                for r in results
            ]
        finally:
            self._disconnect()

    def search(self, collection_name: str, query_embedding: list[float],
               top_k: int = 20) -> list[dict]:
        """向量相似度搜索"""
        self._connect()
        try:
            if not utility.has_collection(collection_name):
                return []

            col = Collection(collection_name)
            col.load()

            results = col.search(
                data=[query_embedding],
                anns_field="embedding",
                param={"metric_type": "COSINE", "params": {"ef": 128}},
                limit=top_k,
                output_fields=["content", "doc_id", "metadata"],
            )

            hits = []
            for hit in results[0]:
                hits.append({
                    "id": hit.id,
                    "content": hit.entity.get("content"),
                    "doc_id": hit.entity.get("doc_id"),
                    "metadata": hit.entity.get("metadata"),
                    "score": hit.distance,
                })
            return hits
        finally:
            self._disconnect()
