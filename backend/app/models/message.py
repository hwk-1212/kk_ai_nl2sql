import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey, JSON, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import Base


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=text("uuid_generate_v4()")
    )
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # system / user / assistant / tool
    content: Mapped[str] = mapped_column(Text, default="")
    reasoning_content: Mapped[str | None] = mapped_column(Text, default=None)
    usage: Mapped[dict | None] = mapped_column(JSON, default=None)
    extra: Mapped[dict | None] = mapped_column("extra", JSON, default=None)
    # extra: {
    #   "tool_calls": [{"id": "...", "name": "...", "arguments": {...}, "status": "success", "result": "..."}],
    #   "memories": [{"id": "...", "content": "...", "relevance": 0.8, "source": "..."}],
    #   "rag_sources": [{"content": "...", "score": 0.9, "source": "file.pdf", "page": 3}],
    # }
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
        server_default=text("now()")
    )

    # relationships
    conversation: Mapped["Conversation"] = relationship(back_populates="messages")

    def __repr__(self) -> str:
        return f"<Message {self.role} in {self.conversation_id}>"
