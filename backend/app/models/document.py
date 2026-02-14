"""知识库文档 ORM 模型"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Integer, text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import Base


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=text("uuid_generate_v4()")
    )
    kb_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("knowledge_bases.id", ondelete="CASCADE"), nullable=False, index=True
    )
    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    file_type: Mapped[str] = mapped_column(String(20), nullable=False)  # pdf, docx, txt, md, csv
    file_size: Mapped[int] = mapped_column(Integer, nullable=False, default=0)  # bytes
    minio_path: Mapped[str] = mapped_column(String(1000), nullable=False, default="")
    minio_md_path: Mapped[str] = mapped_column(String(1000), nullable=False, default="")  # Markdown 文件路径
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="uploading"
    )  # uploading → processing → ready → failed
    chunk_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_message: Mapped[str] = mapped_column(String(2000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
        server_default=text("now()")
    )

    # relationships
    knowledge_base: Mapped["KnowledgeBase"] = relationship(back_populates="documents")
