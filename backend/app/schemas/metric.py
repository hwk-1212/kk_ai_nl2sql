"""指标 / 维度 / 业务术语 Pydantic Schemas。

TODO (Phase 3d): 补充完整字段校验
"""
from __future__ import annotations
import uuid
from datetime import datetime
from pydantic import BaseModel, Field


class MetricCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    display_name: str | None = None
    description: str | None = None
    formula: str = Field(..., min_length=1)
    data_table_id: uuid.UUID | None = None
    aggregation: str | None = None
    unit: str | None = None
    tags: dict | None = None


class MetricOut(BaseModel):
    id: uuid.UUID
    name: str
    display_name: str | None = None
    description: str | None = None
    formula: str
    data_table_id: uuid.UUID | None = None
    aggregation: str | None = None
    unit: str | None = None
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class DimensionCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    display_name: str | None = None
    description: str | None = None
    source_column: str = Field(..., min_length=1)
    data_table_id: uuid.UUID | None = None
    dim_type: str = "categorical"


class DimensionOut(BaseModel):
    id: uuid.UUID
    name: str
    display_name: str | None = None
    source_column: str
    dim_type: str
    created_at: datetime

    model_config = {"from_attributes": True}


class BusinessTermCreate(BaseModel):
    term: str = Field(..., min_length=1, max_length=255)
    canonical_name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    sql_expression: str | None = None
    synonyms: str | None = None


class BusinessTermOut(BaseModel):
    id: uuid.UUID
    term: str
    canonical_name: str
    description: str | None = None
    sql_expression: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
