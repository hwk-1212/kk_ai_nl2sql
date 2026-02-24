"""指标 / 维度 / 业务术语 Pydantic Schemas。
"""
from __future__ import annotations
import uuid
from datetime import datetime
from pydantic import BaseModel, Field


class MetricCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    english_name: str = Field(..., min_length=1, max_length=255)
    display_name: str | None = None
    description: str | None = None
    formula: str = Field(..., min_length=1)
    data_table_id: uuid.UUID | None = None
    source_table: str = Field(..., min_length=1, max_length=255)
    dimensions: list[str] | None = None
    filters: list[str] | None = None
    time_granularity: list[str] | None = None
    category: str | None = None
    aggregation: str | None = None
    unit: str | None = None
    tags: dict | None = None
    status: str = "active"
    version: str = "1.0"


class MetricUpdate(BaseModel):
    name: str | None = None
    english_name: str | None = None
    display_name: str | None = None
    description: str | None = None
    formula: str | None = None
    data_table_id: uuid.UUID | None = None
    source_table: str | None = None
    dimensions: list[str] | None = None
    filters: list[str] | None = None
    time_granularity: list[str] | None = None
    category: str | None = None
    aggregation: str | None = None
    unit: str | None = None
    tags: dict | None = None
    status: str | None = None
    version: str | None = None


class MetricResponse(BaseModel):
    id: uuid.UUID
    name: str
    english_name: str
    display_name: str | None = None
    description: str | None = None
    formula: str
    data_table_id: uuid.UUID | None = None
    source_table: str
    dimensions: list[str] | None = None
    filters: list[str] | None = None
    time_granularity: list[str] | None = None
    category: str | None = None
    aggregation: str | None = None
    unit: str | None = None
    tags: dict | None = None
    status: str
    version: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MetricOut(MetricResponse):
    """向后兼容"""
    pass


class MetricSearchResponse(BaseModel):
    """指标搜索结果"""
    metric_id: str
    name: str
    english_name: str
    formula: str
    description: str | None
    dimensions: list[str] | None
    filters: list[str] | None
    source_table: str
    category: str | None
    score: float


class DimensionCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    english_name: str = Field(..., min_length=1, max_length=255)
    display_name: str | None = None
    description: str | None = None
    source_column: str = Field(..., min_length=1)
    data_table_id: uuid.UUID | None = None
    dim_type: str = "categorical"
    hierarchy: dict | None = None


class DimensionUpdate(BaseModel):
    name: str | None = None
    english_name: str | None = None
    display_name: str | None = None
    description: str | None = None
    source_column: str | None = None
    data_table_id: uuid.UUID | None = None
    dim_type: str | None = None
    hierarchy: dict | None = None


class DimensionResponse(BaseModel):
    id: uuid.UUID
    name: str
    english_name: str
    display_name: str | None = None
    description: str | None = None
    source_column: str
    data_table_id: uuid.UUID | None = None
    dim_type: str
    hierarchy: dict | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class DimensionOut(DimensionResponse):
    """向后兼容"""
    pass


class BusinessTermCreate(BaseModel):
    term: str = Field(..., min_length=1, max_length=255)
    canonical_name: str = Field(..., min_length=1, max_length=255)
    term_type: str = Field(default="metric", pattern="^(metric|dimension|filter)$")
    description: str | None = None
    sql_expression: str | None = None
    synonyms: str | None = None


class BusinessTermUpdate(BaseModel):
    term: str | None = None
    canonical_name: str | None = None
    term_type: str | None = None
    description: str | None = None
    sql_expression: str | None = None
    synonyms: str | None = None


class BusinessTermResponse(BaseModel):
    id: uuid.UUID
    term: str
    canonical_name: str
    term_type: str
    description: str | None = None
    sql_expression: str | None = None
    synonyms: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class BusinessTermOut(BusinessTermResponse):
    """向后兼容"""
    pass
