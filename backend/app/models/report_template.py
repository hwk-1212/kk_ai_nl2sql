"""ReportTemplate ORM — 报告模板。"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Text, text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.models.base import Base


class ReportTemplate(Base):
    __tablename__ = "report_templates"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=text("uuid_generate_v4()")
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    template_content: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    category: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_system: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
        server_default=text("now()")
    )
