"""报告 / 模板 / 定时任务 Pydantic Schemas。"""
from __future__ import annotations

import uuid
from datetime import datetime
from pydantic import BaseModel, Field


# ── Report ──────────────────────────────────────────────────

class ReportCreate(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    data_config: dict | None = None
    template_id: str | None = None

class ReportUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    data_config: dict | None = None

class GenerateReportRequest(BaseModel):
    sql: str | None = None
    data_config: dict | None = None

class ReportResponse(BaseModel):
    id: str
    user_id: str
    tenant_id: str | None = None
    title: str
    content: str | None = None
    report_type: str
    template_id: str | None = None
    data_config: dict | None = None
    sections: dict | None = None
    charts: list | None = None
    status: str
    error_message: str | None = None
    schedule_id: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


# ── ReportTemplate ──────────────────────────────────────────

class ReportTemplateCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    template_content: str | None = None
    data_config: dict | None = None
    category: str | None = None

class ReportTemplateUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    template_content: str | None = None
    data_config: dict | None = None
    category: str | None = None

class ReportTemplateResponse(BaseModel):
    id: str
    user_id: str | None = None
    tenant_id: str | None = None
    name: str
    description: str | None = None
    template_content: str | None = None
    data_config: dict | None = None
    category: str | None = None
    is_system: bool = False
    created_at: datetime | None = None


# ── ReportSchedule ──────────────────────────────────────────

class ReportScheduleCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    cron_expression: str = Field(min_length=1, max_length=100)
    template_id: str | None = None
    data_config: dict | None = None
    recipients: list[str] | None = None

class ReportScheduleUpdate(BaseModel):
    name: str | None = None
    cron_expression: str | None = None
    template_id: str | None = None
    data_config: dict | None = None
    recipients: list[str] | None = None

class ReportScheduleResponse(BaseModel):
    id: str
    user_id: str
    tenant_id: str | None = None
    name: str
    template_id: str | None = None
    cron_expression: str
    data_config: dict | None = None
    is_active: bool
    recipients: dict | None = None
    last_run_at: datetime | None = None
    next_run_at: datetime | None = None
    created_at: datetime | None = None
