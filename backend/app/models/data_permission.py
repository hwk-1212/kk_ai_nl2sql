"""数据权限 ORM — DataRole / DataRoleAssignment / TablePermission / ColumnPermission / RowFilter。"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Text, text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import Base


class DataRole(Base):
    __tablename__ = "data_roles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=text("uuid_generate_v4()")
    )
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
        server_default=text("now()")
    )


class DataRoleAssignment(Base):
    __tablename__ = "data_role_assignments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=text("uuid_generate_v4()")
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("data_roles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
        server_default=text("now()")
    )


class TablePermission(Base):
    __tablename__ = "table_permissions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=text("uuid_generate_v4()")
    )
    role_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("data_roles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    table_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("data_tables.id", ondelete="CASCADE"), nullable=False
    )
    can_read: Mapped[bool] = mapped_column(Boolean, default=True)
    can_write: Mapped[bool] = mapped_column(Boolean, default=False)


class ColumnPermission(Base):
    __tablename__ = "column_permissions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=text("uuid_generate_v4()")
    )
    table_permission_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("table_permissions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    column_name: Mapped[str] = mapped_column(String(255), nullable=False)
    visible: Mapped[bool] = mapped_column(Boolean, default=True)
    mask_type: Mapped[str | None] = mapped_column(String(20), nullable=True)


class RowFilter(Base):
    __tablename__ = "row_filters"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=text("uuid_generate_v4()")
    )
    table_permission_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("table_permissions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    filter_expression: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
