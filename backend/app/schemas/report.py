"""报告 Pydantic Schemas。

TODO (Phase 3g): 补充完整字段校验
"""
from __future__ import annotations
import uuid
from datetime import datetime
from pydantic import BaseModel, Field


class ReportCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    template_id: uuid.UUID | None = None
    params: dict | None = None


class ReportOut(BaseModel):
    id: uuid.UUID
    title: str
    report_type: str
    status: str
    content: str | None = None
    sections: dict | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ReportScheduleCreate(BaseModel):
    template_id: uuid.UUID
    cron_expression: str = Field(..., min_length=5, max_length=100)
    recipients: list[str] | None = None


class ReportScheduleOut(BaseModel):
    id: uuid.UUID
    template_id: uuid.UUID
    cron_expression: str
    is_active: bool
    last_run_at: datetime | None = None
    next_run_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
