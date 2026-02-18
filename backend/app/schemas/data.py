"""数据管理 Pydantic Schemas — 数据源 / 数据表 CRUD。

TODO (Phase 3a): 补充完整字段校验
"""
from __future__ import annotations
import uuid
from datetime import datetime
from pydantic import BaseModel, Field


class DataSourceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    source_type: str = Field(default="upload", pattern="^(upload|sqlite|csv|excel)$")


class DataSourceOut(BaseModel):
    id: uuid.UUID
    name: str
    source_type: str
    file_name: str | None = None
    file_size: int | None = None
    status: str
    table_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DataTableOut(BaseModel):
    id: uuid.UUID
    data_source_id: uuid.UUID
    name: str
    pg_table_name: str
    column_count: int = 0
    row_count: int = 0
    columns_meta: dict | None = None
    description: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class TablePreviewOut(BaseModel):
    table_id: uuid.UUID
    table_name: str
    columns: list[str]
    rows: list[list]
    total_rows: int
    preview_rows: int
