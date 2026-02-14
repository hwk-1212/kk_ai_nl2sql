"""租户模型"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, DateTime, JSON, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import Base

DEFAULT_TENANT_CONFIG = {
    "allowed_models": ["deepseek-chat", "deepseek-reasoner", "qwen-plus"],
    "token_quota": 0,            # 0 = 无限制
    "storage_quota_mb": 10240,
    "max_users": 100,
}


class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=text("uuid_generate_v4()")
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    config: Mapped[dict] = mapped_column(JSON, nullable=False, default=lambda: dict(DEFAULT_TENANT_CONFIG))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
        server_default=text("now()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        server_default=text("now()")
    )

    # relationships
    users: Mapped[list["User"]] = relationship(back_populates="tenant")

    def __repr__(self) -> str:
        return f"<Tenant {self.name}>"
