"""文档处理 Pipeline — 文件 → Markdown → 分块 → Embedding → Milvus"""
import asyncio
import io
import uuid
import logging

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document as LCDocument

from app.core.rag.embedder import Embedder
from app.core.rag.vector_store import VectorStore
from app.core.rag.file2md import File2Markdown

logger = logging.getLogger(__name__)

# 全局处理锁 — 确保同一时间只有一个文档在做 embedding，避免 API 并发超限
_processing_lock = asyncio.Lock()


class DocumentProcessor:
    """文档处理 Pipeline: 文件 → Markdown → 分块 → Embedding → Milvus"""

    def __init__(self, embedder: Embedder, vector_store: VectorStore, file2md: File2Markdown):
        self.embedder = embedder
        self.vector_store = vector_store
        self.file2md = file2md

    async def process(
        self,
        file_bytes: bytes,
        file_type: str,
        doc_id: str,
        collection_name: str,
        chunk_size: int = 1000,
        chunk_overlap: int = 200,
        filename: str = "",
    ) -> tuple[int, str]:
        """
        完整处理流程:
        1. 文件 → Markdown (提取图片到 MinIO)
        2. Markdown → 分块
        3. 向量化 (串行锁保护)
        4. 存入 Milvus
        返回: (chunk 数量, markdown 文本)
        """
        # 1. 转换为 Markdown
        logger.info(f"Converting {filename} ({file_type}) to Markdown")
        md_content = self.file2md.convert(file_bytes, file_type, filename)

        if not md_content or not md_content.strip():
            raise ValueError("No content extracted from document — file may be a scanned image PDF")

        logger.info(f"Markdown generated: {len(md_content)} chars")

        # 2. Markdown → 分块 (使用 Markdown 友好的分隔符)
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            length_function=len,
            separators=["\n## ", "\n### ", "\n#### ", "\n\n", "\n", "。", ".", " ", ""],
        )
        # 用 LangChain Document 包裹以保留 metadata
        lc_doc = LCDocument(page_content=md_content, metadata={"source": filename})
        chunks = splitter.split_documents([lc_doc])

        # 过滤过短的 chunk (< 10 字)
        chunks = [c for c in chunks if len(c.page_content.strip()) >= 10]
        logger.info(f"Split into {len(chunks)} chunks (after filtering)")

        if not chunks:
            raise ValueError("No meaningful chunks generated from document")

        # 3. 向量化 — 使用锁确保同一时间只有一个文档做 embedding
        async with _processing_lock:
            logger.info(f"Embedding {len(chunks)} chunks for doc={doc_id} (lock acquired)")
            texts = [c.page_content for c in chunks]
            embeddings = await self.embedder.embed_texts(texts)
            logger.info(f"Generated {len(embeddings)} embeddings")

        # 4. 存入 Milvus — 增加 chunk_index、filename 等元数据
        ids = [str(uuid.uuid4()) for _ in chunks]
        doc_ids = [doc_id] * len(chunks)
        metadatas = []
        for idx, c in enumerate(chunks):
            meta = {
                "filename": filename,
                "chunk_index": idx,
                "total_chunks": len(chunks),
            }
            metadatas.append(meta)

        # 截断 content 到 Milvus VARCHAR 最大长度
        contents = [t[:8000] for t in texts]

        self.vector_store.insert(
            collection_name=collection_name,
            ids=ids,
            contents=contents,
            doc_ids=doc_ids,
            metadatas=metadatas,
            embeddings=embeddings,
        )
        return len(chunks), md_content
