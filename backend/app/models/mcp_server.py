"""MCP Server 注册 ORM 模型"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, DateTime, text, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import Base


class MCPServer(Base):
    __tablename__ = "mcp_servers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=text("uuid_generate_v4()")
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    transport_type: Mapped[str] = mapped_column(String(20), nullable=False)  # stdio / sse / http
    config: Mapped[str] = mapped_column(String(2000), nullable=False)  # command or URL
    env: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # 环境变量 (stdio 模式)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    tools_cache: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # 缓存的工具列表
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
        server_default=text("now()")
    )
