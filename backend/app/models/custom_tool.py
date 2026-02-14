"""自定义工具 ORM 模型"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Integer, Boolean, Text, text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, JSON
from app.models.base import Base


class CustomTool(Base):
    __tablename__ = "custom_tools"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=text("uuid_generate_v4()")
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(String(2000), nullable=False, default="")
    # 工具类型: "http" (HTTP webhook)
    tool_type: Mapped[str] = mapped_column(String(50), nullable=False, default="http")
    # 参数 JSON Schema: {"type": "object", "properties": {...}, "required": [...]}
    parameters: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    # HTTP 配置
    http_url: Mapped[str] = mapped_column(String(2000), nullable=False, default="")
    http_method: Mapped[str] = mapped_column(String(10), nullable=False, default="POST")
    http_headers: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    # 请求体模板: 支持 {{arg_name}} 占位符, 为空则直接 JSON 发送 arguments
    http_body_template: Mapped[str] = mapped_column(Text, nullable=False, default="")
    # 状态
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
        server_default=text("now()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
        server_default=text("now()"), onupdate=lambda: datetime.now(timezone.utc)
    )
