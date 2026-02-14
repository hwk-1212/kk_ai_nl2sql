"""知识库管理 API — CRUD + 文档上传"""
import io
import uuid
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.knowledge_base import KnowledgeBase
from app.models.document import Document
from app.schemas.knowledge import KBCreate, KBUpdate, KBResponse, DocumentResponse, KBDetail
from app.config import get_settings
from app.db.minio_client import minio_client

router = APIRouter(prefix="/knowledge-bases", tags=["knowledge"])
logger = logging.getLogger(__name__)
settings = get_settings()

# 允许的文件类型
ALLOWED_EXTENSIONS = {"pdf", "docx", "xlsx", "txt", "md", "csv"}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB


def _serialize_kb(kb: KnowledgeBase, doc_count: int | None = None) -> dict:
    return {
        "id": str(kb.id),
        "name": kb.name,
        "description": kb.description,
        "embedding_model": kb.embedding_model,
        "embedding_dim": kb.embedding_dim,
        "chunk_size": kb.chunk_size,
        "chunk_overlap": kb.chunk_overlap,
        "doc_count": doc_count if doc_count is not None else kb.doc_count,
        "created_at": kb.created_at.isoformat() if kb.created_at else "",
        "updated_at": kb.updated_at.isoformat() if kb.updated_at else "",
    }


def _serialize_doc(doc: Document) -> dict:
    return {
        "id": str(doc.id),
        "kb_id": str(doc.kb_id),
        "filename": doc.filename,
        "file_type": doc.file_type,
        "file_size": doc.file_size,
        "status": doc.status,
        "chunk_count": doc.chunk_count,
        "error_message": doc.error_message,
        "created_at": doc.created_at.isoformat() if doc.created_at else "",
    }


# ======================== Knowledge Base CRUD ========================

@router.get("")
async def list_knowledge_bases(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """列出当前用户的所有知识库 — doc_count 动态计算"""
    result = await db.execute(
        select(KnowledgeBase)
        .where(KnowledgeBase.user_id == current_user.id)
        .order_by(KnowledgeBase.updated_at.desc())
    )
    kbs = result.scalars().all()

    # 动态计算每个知识库的文档数
    out = []
    for kb in kbs:
        count_result = await db.execute(
            select(func.count(Document.id)).where(Document.kb_id == kb.id)
        )
        doc_count = count_result.scalar() or 0
        out.append(_serialize_kb(kb, doc_count=doc_count))
    return out


@router.post("", status_code=201)
async def create_knowledge_base(
    payload: KBCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """创建知识库 — 同时创建 Milvus collection"""
    kb = KnowledgeBase(
        user_id=current_user.id,
        name=payload.name,
        description=payload.description,
        embedding_model=payload.embedding_model,
        embedding_dim=payload.embedding_dim,
        chunk_size=payload.chunk_size,
        chunk_overlap=payload.chunk_overlap,
    )
    db.add(kb)
    await db.commit()
    await db.refresh(kb)

    # 创建 Milvus collection
    vector_store = getattr(request.app.state, "vector_store", None)
    if vector_store:
        try:
            vector_store.create_collection(kb.collection_name, dim=kb.embedding_dim)
        except Exception as e:
            logger.error(f"Failed to create Milvus collection: {e}")

    return _serialize_kb(kb)


@router.get("/{kb_id}")
async def get_knowledge_base(
    kb_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取知识库详情（含文档列表）"""
    try:
        uid = uuid.UUID(kb_id)
    except ValueError:
        raise HTTPException(400, "Invalid knowledge base ID")

    result = await db.execute(
        select(KnowledgeBase)
        .options(selectinload(KnowledgeBase.documents))
        .where(KnowledgeBase.id == uid, KnowledgeBase.user_id == current_user.id)
    )
    kb = result.scalar_one_or_none()
    if not kb:
        raise HTTPException(404, "Knowledge base not found")

    data = _serialize_kb(kb, doc_count=len(kb.documents))
    data["documents"] = [_serialize_doc(d) for d in kb.documents]
    return data


@router.patch("/{kb_id}")
async def update_knowledge_base(
    kb_id: str,
    payload: KBUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新知识库基本信息"""
    try:
        uid = uuid.UUID(kb_id)
    except ValueError:
        raise HTTPException(400, "Invalid knowledge base ID")

    result = await db.execute(
        select(KnowledgeBase).where(KnowledgeBase.id == uid, KnowledgeBase.user_id == current_user.id)
    )
    kb = result.scalar_one_or_none()
    if not kb:
        raise HTTPException(404, "Knowledge base not found")

    if payload.name is not None:
        kb.name = payload.name
    if payload.description is not None:
        kb.description = payload.description
    kb.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(kb)
    return _serialize_kb(kb)


@router.delete("/{kb_id}", status_code=204)
async def delete_knowledge_base(
    kb_id: str,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除知识库 — DB 立即删除，Milvus + MinIO 异步清理"""
    try:
        uid = uuid.UUID(kb_id)
    except ValueError:
        raise HTTPException(400, "Invalid knowledge base ID")

    result = await db.execute(
        select(KnowledgeBase)
        .options(selectinload(KnowledgeBase.documents))
        .where(KnowledgeBase.id == uid, KnowledgeBase.user_id == current_user.id)
    )
    kb = result.scalar_one_or_none()
    if not kb:
        raise HTTPException(404, "Knowledge base not found")

    # 收集需要异步清理的信息
    collection_name = kb.collection_name
    minio_paths = []
    for doc in kb.documents:
        if doc.minio_path:
            minio_paths.append(doc.minio_path)
        if doc.minio_md_path:
            minio_paths.append(doc.minio_md_path)

    # 立即删除 DB 记录 (cascade 会删 documents)
    await db.delete(kb)
    await db.commit()

    # 异步清理 Milvus + MinIO
    background_tasks.add_task(
        _cleanup_kb_background,
        collection_name=collection_name,
        minio_paths=minio_paths,
        app=request.app,
    )


# ======================== Document Upload & Management ========================

@router.get("/{kb_id}/documents")
async def list_documents(
    kb_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """列出知识库文档"""
    try:
        uid = uuid.UUID(kb_id)
    except ValueError:
        raise HTTPException(400, "Invalid knowledge base ID")

    # 验证知识库归属
    result = await db.execute(
        select(KnowledgeBase).where(KnowledgeBase.id == uid, KnowledgeBase.user_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(404, "Knowledge base not found")

    result = await db.execute(
        select(Document).where(Document.kb_id == uid).order_by(Document.created_at.desc())
    )
    docs = result.scalars().all()
    return [_serialize_doc(d) for d in docs]


@router.post("/{kb_id}/documents", status_code=201)
async def upload_document(
    kb_id: str,
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """上传文档到知识库 — 异步处理"""
    try:
        uid = uuid.UUID(kb_id)
    except ValueError:
        raise HTTPException(400, "Invalid knowledge base ID")

    result = await db.execute(
        select(KnowledgeBase).where(KnowledgeBase.id == uid, KnowledgeBase.user_id == current_user.id)
    )
    kb = result.scalar_one_or_none()
    if not kb:
        raise HTTPException(404, "Knowledge base not found")

    # 检查文件类型
    filename = file.filename or "unknown.txt"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"Unsupported file type: {ext}. Allowed: {', '.join(ALLOWED_EXTENSIONS)}")

    # 读取文件内容
    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(400, f"File too large. Max: {MAX_FILE_SIZE // 1024 // 1024}MB")

    # 上传到 MinIO — 简化路径: kb_name/filename
    safe_kb_name = kb.name.replace("/", "_").replace("\\", "_")
    minio_path = f"{safe_kb_name}/{filename}"
    try:
        _ensure_bucket()
        minio_client.put_object(
            settings.minio_bucket,
            minio_path,
            io.BytesIO(file_bytes),
            length=len(file_bytes),
            content_type=file.content_type or "application/octet-stream",
        )
    except Exception as e:
        logger.error(f"MinIO upload failed: {e}")
        raise HTTPException(500, "File upload failed")

    # 创建文档记录
    doc = Document(
        kb_id=kb.id,
        filename=filename,
        file_type=ext,
        file_size=len(file_bytes),
        minio_path=minio_path,
        status="processing",
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    # Markdown 和图片的 MinIO 路径
    base_name = filename.rsplit(".", 1)[0] if "." in filename else filename
    minio_md_path = f"{safe_kb_name}/{base_name}.md"
    images_prefix = f"{safe_kb_name}/images"

    # 异步处理文档: 文件 → Markdown → 分块 → Embedding → Milvus
    background_tasks.add_task(
        _process_document_background,
        doc_id=str(doc.id),
        kb_id=str(kb.id),
        collection_name=kb.collection_name,
        chunk_size=kb.chunk_size,
        chunk_overlap=kb.chunk_overlap,
        file_bytes=file_bytes,
        file_type=ext,
        filename=filename,
        minio_md_path=minio_md_path,
        images_prefix=images_prefix,
        app=request.app,
    )

    return _serialize_doc(doc)


@router.delete("/{kb_id}/documents/{doc_id}", status_code=204)
async def delete_document(
    kb_id: str,
    doc_id: str,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除文档 — DB 立即删除，Milvus + MinIO 异步清理"""
    try:
        kb_uuid = uuid.UUID(kb_id)
        doc_uuid = uuid.UUID(doc_id)
    except ValueError:
        raise HTTPException(400, "Invalid ID")

    # 验证归属
    result = await db.execute(
        select(KnowledgeBase).where(KnowledgeBase.id == kb_uuid, KnowledgeBase.user_id == current_user.id)
    )
    kb = result.scalar_one_or_none()
    if not kb:
        raise HTTPException(404, "Knowledge base not found")

    result = await db.execute(
        select(Document).where(Document.id == doc_uuid, Document.kb_id == kb_uuid)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(404, "Document not found")

    # 收集清理信息
    collection_name = kb.collection_name
    doc_id_str = str(doc.id)
    minio_paths = [p for p in [doc.minio_path, doc.minio_md_path] if p]

    # 立即删除 DB 记录
    await db.delete(doc)
    kb.updated_at = datetime.now(timezone.utc)
    await db.commit()

    # 异步清理 Milvus 向量 + MinIO 文件
    background_tasks.add_task(
        _cleanup_doc_background,
        collection_name=collection_name,
        doc_id=doc_id_str,
        minio_paths=minio_paths,
        app=request.app,
    )


# ======================== Document Retry / Preview / Chunks ========================

@router.post("/{kb_id}/documents/{doc_id}/retry")
async def retry_document(
    kb_id: str,
    doc_id: str,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """重新处理失败的文档"""
    try:
        kb_uuid = uuid.UUID(kb_id)
        doc_uuid = uuid.UUID(doc_id)
    except ValueError:
        raise HTTPException(400, "Invalid ID")

    result = await db.execute(
        select(KnowledgeBase).where(KnowledgeBase.id == kb_uuid, KnowledgeBase.user_id == current_user.id)
    )
    kb = result.scalar_one_or_none()
    if not kb:
        raise HTTPException(404, "Knowledge base not found")

    result = await db.execute(
        select(Document).where(Document.id == doc_uuid, Document.kb_id == kb_uuid)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(404, "Document not found")

    if doc.status not in ("failed",):
        raise HTTPException(400, f"Cannot retry document with status: {doc.status}")

    if not doc.minio_path:
        raise HTTPException(400, "Original file not found in storage")

    # 从 MinIO 重新下载文件
    try:
        response = minio_client.get_object(settings.minio_bucket, doc.minio_path)
        file_bytes = response.read()
        response.close()
        response.release_conn()
    except Exception as e:
        logger.error(f"Failed to read file from MinIO: {e}")
        raise HTTPException(500, "Failed to read original file")

    # 先清理旧向量（如果有的话）
    vector_store = getattr(request.app.state, "vector_store", None)
    if vector_store:
        try:
            vector_store.delete_by_doc_id(kb.collection_name, str(doc.id))
        except Exception:
            pass

    # 重置状态
    doc.status = "processing"
    doc.error_message = None
    doc.chunk_count = 0
    await db.commit()
    await db.refresh(doc)

    # 计算 Markdown 和图片路径
    safe_kb_name = kb.name.replace("/", "_").replace("\\", "_")
    base_name = doc.filename.rsplit(".", 1)[0] if "." in doc.filename else doc.filename
    minio_md_path = f"{safe_kb_name}/{base_name}.md"
    images_prefix = f"{safe_kb_name}/images"

    # 提交后台处理
    background_tasks.add_task(
        _process_document_background,
        doc_id=str(doc.id),
        kb_id=str(kb.id),
        collection_name=kb.collection_name,
        chunk_size=kb.chunk_size,
        chunk_overlap=kb.chunk_overlap,
        file_bytes=file_bytes,
        file_type=doc.file_type,
        filename=doc.filename,
        minio_md_path=minio_md_path,
        images_prefix=images_prefix,
        app=request.app,
    )

    return _serialize_doc(doc)


@router.get("/{kb_id}/documents/{doc_id}/preview")
async def preview_document(
    kb_id: str,
    doc_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """代理返回文档原件流 — 避免 presigned URL 签名问题"""
    try:
        kb_uuid = uuid.UUID(kb_id)
        doc_uuid = uuid.UUID(doc_id)
    except ValueError:
        raise HTTPException(400, "Invalid ID")

    result = await db.execute(
        select(KnowledgeBase).where(KnowledgeBase.id == kb_uuid, KnowledgeBase.user_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(404, "Knowledge base not found")

    result = await db.execute(
        select(Document).where(Document.id == doc_uuid, Document.kb_id == kb_uuid)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(404, "Document not found")

    if not doc.minio_path:
        raise HTTPException(400, "File not found in storage")

    CONTENT_TYPE_MAP = {
        "pdf": "application/pdf",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "txt": "text/plain; charset=utf-8",
        "md": "text/markdown; charset=utf-8",
        "csv": "text/csv; charset=utf-8",
    }

    try:
        response = minio_client.get_object(settings.minio_bucket, doc.minio_path)

        def _iter():
            try:
                for chunk in response.stream(1024 * 64):  # 64KB chunks
                    yield chunk
            finally:
                response.close()
                response.release_conn()

        content_type = CONTENT_TYPE_MAP.get(doc.file_type, "application/octet-stream")
        # URL-encode filename for Content-Disposition
        from urllib.parse import quote
        encoded_filename = quote(doc.filename)

        return StreamingResponse(
            _iter(),
            media_type=content_type,
            headers={
                "Content-Disposition": f"inline; filename*=UTF-8''{encoded_filename}",
                "Content-Length": str(doc.file_size),
            },
        )
    except Exception as e:
        logger.error(f"Failed to stream file from MinIO: {e}")
        raise HTTPException(500, "Failed to read file")


@router.get("/{kb_id}/documents/{doc_id}/chunks")
async def list_document_chunks(
    kb_id: str,
    doc_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """列出文档的所有 chunks (含 page、index 元数据)"""
    try:
        kb_uuid = uuid.UUID(kb_id)
        doc_uuid = uuid.UUID(doc_id)
    except ValueError:
        raise HTTPException(400, "Invalid ID")

    result = await db.execute(
        select(KnowledgeBase).where(KnowledgeBase.id == kb_uuid, KnowledgeBase.user_id == current_user.id)
    )
    kb = result.scalar_one_or_none()
    if not kb:
        raise HTTPException(404, "Knowledge base not found")

    result = await db.execute(
        select(Document).where(Document.id == doc_uuid, Document.kb_id == kb_uuid)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(404, "Document not found")

    if doc.status != "ready":
        return []

    vector_store = getattr(request.app.state, "vector_store", None)
    if not vector_store:
        raise HTTPException(500, "Vector store not available")

    try:
        chunks = vector_store.query_by_doc_id(kb.collection_name, str(doc.id))
        return [
            {
                "id": c["id"],
                "content": c["content"],
                "chunk_index": c["metadata"].get("chunk_index", i),
                "page": c["metadata"].get("page"),
                "total_chunks": c["metadata"].get("total_chunks"),
            }
            for i, c in enumerate(chunks)
        ]
    except Exception as e:
        logger.error(f"Failed to query chunks: {e}")
        raise HTTPException(500, "Failed to retrieve chunks")


@router.get("/{kb_id}/documents/{doc_id}/markdown")
async def get_document_markdown(
    kb_id: str,
    doc_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取文档转换后的 Markdown 内容"""
    try:
        kb_uuid = uuid.UUID(kb_id)
        doc_uuid = uuid.UUID(doc_id)
    except ValueError:
        raise HTTPException(400, "Invalid ID")

    result = await db.execute(
        select(KnowledgeBase).where(KnowledgeBase.id == kb_uuid, KnowledgeBase.user_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(404, "Knowledge base not found")

    result = await db.execute(
        select(Document).where(Document.id == doc_uuid, Document.kb_id == kb_uuid)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(404, "Document not found")

    if not doc.minio_md_path:
        raise HTTPException(404, "Markdown not available for this document")

    try:
        response = minio_client.get_object(settings.minio_bucket, doc.minio_md_path)
        md_content = response.read().decode("utf-8")
        response.close()
        response.release_conn()
        return {"markdown": md_content, "filename": doc.filename}
    except Exception as e:
        logger.error(f"Failed to read markdown from MinIO: {e}")
        raise HTTPException(500, "Failed to read markdown")


# ======================== Files Proxy (for images in markdown) ========================

files_router = APIRouter(prefix="/files", tags=["files"])


@files_router.get("/{bucket}/{path:path}")
async def proxy_file(bucket: str, path: str):
    """代理 MinIO 文件 — 主要用于 Markdown 中的图片"""
    try:
        response = minio_client.get_object(bucket, path)

        def _iter():
            try:
                for chunk in response.stream(1024 * 64):
                    yield chunk
            finally:
                response.close()
                response.release_conn()

        # 根据扩展名推断 content-type
        ext = path.rsplit(".", 1)[-1].lower() if "." in path else ""
        ct_map = {
            "png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg",
            "gif": "image/gif", "webp": "image/webp", "svg": "image/svg+xml",
            "pdf": "application/pdf", "md": "text/markdown",
        }
        content_type = ct_map.get(ext, "application/octet-stream")
        return StreamingResponse(_iter(), media_type=content_type)
    except Exception as e:
        logger.error(f"Failed to proxy file {bucket}/{path}: {e}")
        raise HTTPException(404, "File not found")


# ======================== Background Cleanup ========================

def _cleanup_kb_background(collection_name: str, minio_paths: list[str], app):
    """异步清理知识库: Milvus collection + MinIO 文件"""
    # 删除 Milvus collection
    vector_store = getattr(app.state, "vector_store", None)
    if vector_store:
        try:
            vector_store.drop_collection(collection_name)
            logger.info(f"Dropped Milvus collection: {collection_name}")
        except Exception as e:
            logger.warning(f"Failed to drop Milvus collection {collection_name}: {e}")

    # 删除 MinIO 文件
    for path in minio_paths:
        try:
            minio_client.remove_object(settings.minio_bucket, path)
        except Exception as e:
            logger.warning(f"Failed to delete MinIO object {path}: {e}")

    logger.info(f"KB cleanup done: collection={collection_name}, {len(minio_paths)} files")


def _cleanup_doc_background(collection_name: str, doc_id: str, minio_paths: list[str], app):
    """异步清理文档: Milvus 向量 + MinIO 文件"""
    # 删除 Milvus 向量
    vector_store = getattr(app.state, "vector_store", None)
    if vector_store:
        try:
            vector_store.delete_by_doc_id(collection_name, doc_id)
            logger.info(f"Deleted Milvus vectors for doc_id={doc_id}")
        except Exception as e:
            logger.warning(f"Failed to delete vectors for doc_id={doc_id}: {e}")

    # 删除 MinIO 文件
    for path in minio_paths:
        try:
            minio_client.remove_object(settings.minio_bucket, path)
        except Exception as e:
            logger.warning(f"Failed to delete MinIO object {path}: {e}")

    logger.info(f"Doc cleanup done: doc_id={doc_id}, {len(minio_paths)} files")


# ======================== Helpers ========================

def _ensure_bucket():
    """确保 MinIO bucket 存在"""
    if not minio_client.bucket_exists(settings.minio_bucket):
        minio_client.make_bucket(settings.minio_bucket)


async def _process_document_background(
    doc_id: str,
    kb_id: str,
    collection_name: str,
    chunk_size: int,
    chunk_overlap: int,
    file_bytes: bytes,
    file_type: str,
    filename: str,
    minio_md_path: str,
    images_prefix: str,
    app,
):
    """后台任务: 文件 → Markdown → 分块 → Embedding → Milvus + 存 Markdown 到 MinIO"""
    from app.db.session import async_session_maker
    from app.core.rag.document_processor import DocumentProcessor

    async with async_session_maker() as db:
        try:
            doc = await db.get(Document, uuid.UUID(doc_id))
            kb = await db.get(KnowledgeBase, uuid.UUID(kb_id))
            if not doc or not kb:
                return

            processor: DocumentProcessor = getattr(app.state, "doc_processor", None)
            if not processor:
                logger.error("DocumentProcessor not initialized")
                doc.status = "failed"
                doc.error_message = "System not ready"
                await db.commit()
                return

            # 设置图片上传前缀 (针对本次文档)
            processor.file2md.images_prefix = images_prefix

            chunk_count, md_content = await processor.process(
                file_bytes=file_bytes,
                file_type=file_type,
                doc_id=doc_id,
                collection_name=collection_name,
                chunk_size=chunk_size,
                chunk_overlap=chunk_overlap,
                filename=filename,
            )

            # 将 Markdown 存到 MinIO
            try:
                md_bytes = md_content.encode("utf-8")
                _ensure_bucket()
                minio_client.put_object(
                    settings.minio_bucket,
                    minio_md_path,
                    io.BytesIO(md_bytes),
                    length=len(md_bytes),
                    content_type="text/markdown; charset=utf-8",
                )
                doc.minio_md_path = minio_md_path
            except Exception as e:
                logger.warning(f"Failed to save markdown to MinIO: {e}")

            doc.status = "ready"
            doc.chunk_count = chunk_count
            kb.updated_at = datetime.now(timezone.utc)
            await db.commit()
            logger.info(f"Document processed: {filename} → {chunk_count} chunks")

        except Exception as e:
            logger.error(f"Document processing failed: {e}")
            try:
                doc = await db.get(Document, uuid.UUID(doc_id))
                if doc:
                    doc.status = "failed"
                    doc.error_message = str(e)[:2000]
                    await db.commit()
            except Exception:
                pass
