"""数据管理 Pydantic Schemas — 数据源 / 数据表 CRUD。"""
from __future__ import annotations
import uuid
from datetime import datetime
from pydantic import BaseModel, Field


# ---------- Column info ----------

class ColumnSchema(BaseModel):
    name: str
    type: str
    nullable: bool = True
    comment: str | None = None


# ---------- DataSource ----------

class DataSourceResponse(BaseModel):
    id: uuid.UUID
    name: str
    source_type: str
    file_name: str | None = None
    file_size: int | None = None
    file_type: str | None = None
    status: str
    table_count: int = 0
    error_message: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DataSourceDetailResponse(DataSourceResponse):
    tables: list[DataTableResponse] = []
    minio_path: str | None = None


class DataSourceListResponse(BaseModel):
    items: list[DataSourceResponse]
    total: int


# ---------- DataTable ----------

class DataTableResponse(BaseModel):
    id: uuid.UUID
    data_source_id: uuid.UUID
    name: str
    display_name: str
    pg_schema: str
    pg_table_name: str
    column_count: int = 0
    row_count: int = 0
    columns_meta: list[ColumnSchema] | None = None
    description: str | None = None
    is_writable: bool = True
    visibility: str = "private"
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class DataTableListResponse(BaseModel):
    items: list[DataTableResponse]
    total: int


class UpdateTableRequest(BaseModel):
    display_name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None


# ---------- Table Data ----------

class TableDataResponse(BaseModel):
    table_id: uuid.UUID
    table_name: str
    columns: list[str]
    column_types: list[str] | None = None
    rows: list[list]
    total_count: int
    page: int
    page_size: int
    has_more: bool


class TableSchemaResponse(BaseModel):
    table_id: uuid.UUID
    table_name: str
    pg_schema: str
    pg_table_name: str
    columns: list[ColumnSchema]
    row_count: int
