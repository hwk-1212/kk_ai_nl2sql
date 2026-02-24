"""报告 API — 报告生成 / 模板 / 定时任务管理 CRUD。"""
import uuid
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.report import Report
from app.models.report_template import ReportTemplate
from app.models.report_schedule import ReportSchedule
from app.schemas.report import (
    ReportCreate, ReportUpdate, ReportResponse, GenerateReportRequest,
    ReportTemplateCreate, ReportTemplateUpdate, ReportTemplateResponse,
    ReportScheduleCreate, ReportScheduleUpdate, ReportScheduleResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/reports", tags=["reports"])


def _ser_report(r: Report) -> dict:
    return {
        "id": str(r.id),
        "user_id": str(r.user_id),
        "tenant_id": str(r.tenant_id) if r.tenant_id else None,
        "title": r.title,
        "content": r.content,
        "report_type": r.report_type,
        "template_id": str(r.template_id) if r.template_id else None,
        "data_config": r.data_config,
        "sections": r.sections,
        "charts": r.charts,
        "status": r.status,
        "error_message": r.error_message,
        "schedule_id": str(r.schedule_id) if r.schedule_id else None,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    }


def _ser_template(t: ReportTemplate) -> dict:
    return {
        "id": str(t.id),
        "user_id": str(t.user_id) if t.user_id else None,
        "tenant_id": str(t.tenant_id) if t.tenant_id else None,
        "name": t.name,
        "description": t.description,
        "template_content": t.template_content,
        "data_config": t.data_config,
        "category": t.category,
        "is_system": t.is_system,
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }


def _ser_schedule(s: ReportSchedule) -> dict:
    return {
        "id": str(s.id),
        "user_id": str(s.user_id),
        "tenant_id": str(s.tenant_id) if s.tenant_id else None,
        "name": s.name,
        "template_id": str(s.template_id) if s.template_id else None,
        "cron_expression": s.cron_expression,
        "data_config": s.data_config,
        "is_active": s.is_active,
        "recipients": s.recipients,
        "last_run_at": s.last_run_at.isoformat() if s.last_run_at else None,
        "next_run_at": s.next_run_at.isoformat() if s.next_run_at else None,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }


# ════════════════════════════════════════════════════════════
#  Report CRUD
# ════════════════════════════════════════════════════════════

@router.get("/")
async def list_reports(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    status: str = Query(default="", max_length=20),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    q = select(Report).where(Report.user_id == user.id)
    count_q = select(func.count(Report.id)).where(Report.user_id == user.id)
    if status:
        q = q.where(Report.status == status)
        count_q = count_q.where(Report.status == status)

    total = (await db.execute(count_q)).scalar() or 0
    q = q.order_by(Report.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(q)
    reports = result.scalars().all()
    return {"items": [_ser_report(r) for r in reports], "total": total, "page": page, "page_size": page_size}


@router.post("/", status_code=201)
async def create_report(
    body: ReportCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    report = Report(
        user_id=user.id,
        tenant_id=user.tenant_id,
        title=body.title,
        report_type="manual",
        template_id=uuid.UUID(body.template_id) if body.template_id else None,
        data_config=body.data_config,
        status="draft",
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)
    return _ser_report(report)


@router.get("/{report_id}")
async def get_report(
    report_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Report).where(Report.id == uuid.UUID(report_id), Report.user_id == user.id)
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(404, "Report not found")
    return _ser_report(report)


@router.put("/{report_id}")
async def update_report(
    report_id: str,
    body: ReportUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Report).where(Report.id == uuid.UUID(report_id), Report.user_id == user.id)
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(404, "Report not found")

    if body.title is not None:
        report.title = body.title
    if body.content is not None:
        report.content = body.content
    if body.data_config is not None:
        report.data_config = body.data_config

    report.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(report)
    return _ser_report(report)


@router.delete("/{report_id}", status_code=204)
async def delete_report(
    report_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Report).where(Report.id == uuid.UUID(report_id), Report.user_id == user.id)
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(404, "Report not found")
    await db.delete(report)
    await db.commit()


@router.post("/{report_id}/generate")
async def trigger_generate(
    report_id: str,
    body: GenerateReportRequest | None = None,
    request: Request = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """触发 AI 报告生成 (异步 Celery 任务)。"""
    result = await db.execute(
        select(Report).where(Report.id == uuid.UUID(report_id), Report.user_id == user.id)
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(404, "Report not found")

    if body and body.data_config:
        report.data_config = body.data_config
    if body and body.sql:
        report.data_config = {"queries": [{"sql": body.sql, "name": "用户查询"}]}

    report.status = "generating"
    report.updated_at = datetime.now(timezone.utc)
    await db.commit()

    from app.tasks.report_tasks import generate_report
    generate_report.delay(str(report.id), str(user.id))

    return {"status": "generating", "report_id": str(report.id)}


@router.get("/{report_id}/export")
async def export_report(
    report_id: str,
    format: str = Query(default="html", pattern="^(html|pdf)$"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Report).where(Report.id == uuid.UUID(report_id), Report.user_id == user.id)
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(404, "Report not found")
    if report.status != "ready":
        raise HTTPException(400, "Report is not ready for export")

    return {
        "report_id": str(report.id),
        "format": format,
        "content": report.content,
        "title": report.title,
    }


# ════════════════════════════════════════════════════════════
#  Template CRUD
# ════════════════════════════════════════════════════════════

@router.get("/templates/list")
async def list_templates(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(ReportTemplate).where(
        (ReportTemplate.user_id == user.id) | (ReportTemplate.is_system.is_(True))
    ).order_by(ReportTemplate.created_at.desc())
    result = await db.execute(q)
    templates = result.scalars().all()
    return [_ser_template(t) for t in templates]


@router.post("/templates", status_code=201)
async def create_template(
    body: ReportTemplateCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    tmpl = ReportTemplate(
        user_id=user.id,
        tenant_id=user.tenant_id,
        name=body.name,
        description=body.description,
        template_content=body.template_content,
        data_config=body.data_config,
        category=body.category,
        is_system=False,
    )
    db.add(tmpl)
    await db.commit()
    await db.refresh(tmpl)
    return _ser_template(tmpl)


@router.put("/templates/{template_id}")
async def update_template(
    template_id: str,
    body: ReportTemplateUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ReportTemplate).where(
            ReportTemplate.id == uuid.UUID(template_id),
            ReportTemplate.user_id == user.id,
        )
    )
    tmpl = result.scalar_one_or_none()
    if not tmpl:
        raise HTTPException(404, "Template not found")

    if body.name is not None:
        tmpl.name = body.name
    if body.description is not None:
        tmpl.description = body.description
    if body.template_content is not None:
        tmpl.template_content = body.template_content
    if body.data_config is not None:
        tmpl.data_config = body.data_config
    if body.category is not None:
        tmpl.category = body.category

    await db.commit()
    await db.refresh(tmpl)
    return _ser_template(tmpl)


@router.delete("/templates/{template_id}", status_code=204)
async def delete_template(
    template_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ReportTemplate).where(
            ReportTemplate.id == uuid.UUID(template_id),
            ReportTemplate.user_id == user.id,
            ReportTemplate.is_system.is_(False),
        )
    )
    tmpl = result.scalar_one_or_none()
    if not tmpl:
        raise HTTPException(404, "Template not found or is a system template")
    await db.delete(tmpl)
    await db.commit()


# ════════════════════════════════════════════════════════════
#  Schedule CRUD
# ════════════════════════════════════════════════════════════

@router.get("/schedules/list")
async def list_schedules(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(ReportSchedule).where(ReportSchedule.user_id == user.id).order_by(ReportSchedule.created_at.desc())
    result = await db.execute(q)
    schedules = result.scalars().all()
    return [_ser_schedule(s) for s in schedules]


@router.post("/schedules", status_code=201)
async def create_schedule(
    body: ReportScheduleCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.core.report.scheduler import ReportScheduler
    scheduler = ReportScheduler()
    schedule = await scheduler.create_schedule(
        db=db,
        user_id=user.id,
        tenant_id=user.tenant_id,
        name=body.name,
        cron_expression=body.cron_expression,
        template_id=uuid.UUID(body.template_id) if body.template_id else None,
        data_config=body.data_config,
        recipients=body.recipients,
    )
    await db.commit()
    return _ser_schedule(schedule)


@router.put("/schedules/{schedule_id}")
async def update_schedule(
    schedule_id: str,
    body: ReportScheduleUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ReportSchedule).where(
            ReportSchedule.id == uuid.UUID(schedule_id),
            ReportSchedule.user_id == user.id,
        )
    )
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(404, "Schedule not found")

    from app.core.report.scheduler import ReportScheduler
    scheduler = ReportScheduler()
    kwargs = {}
    if body.name is not None:
        kwargs["name"] = body.name
    if body.cron_expression is not None:
        kwargs["cron_expression"] = body.cron_expression
    if body.template_id is not None:
        kwargs["template_id"] = uuid.UUID(body.template_id) if body.template_id else None
    if body.data_config is not None:
        kwargs["data_config"] = body.data_config
    if body.recipients is not None:
        kwargs["recipients"] = {"emails": body.recipients}

    schedule = await scheduler.update_schedule(db, schedule, **kwargs)
    await db.commit()
    return _ser_schedule(schedule)


@router.delete("/schedules/{schedule_id}", status_code=204)
async def delete_schedule(
    schedule_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ReportSchedule).where(
            ReportSchedule.id == uuid.UUID(schedule_id),
            ReportSchedule.user_id == user.id,
        )
    )
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(404, "Schedule not found")
    await db.delete(schedule)
    await db.commit()


@router.patch("/schedules/{schedule_id}/toggle")
async def toggle_schedule(
    schedule_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ReportSchedule).where(
            ReportSchedule.id == uuid.UUID(schedule_id),
            ReportSchedule.user_id == user.id,
        )
    )
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(404, "Schedule not found")

    from app.core.report.scheduler import ReportScheduler
    scheduler = ReportScheduler()
    schedule = await scheduler.toggle(db, schedule, not schedule.is_active)
    await db.commit()
    return _ser_schedule(schedule)


@router.post("/schedules/{schedule_id}/run")
async def manual_run_schedule(
    schedule_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ReportSchedule).where(
            ReportSchedule.id == uuid.UUID(schedule_id),
            ReportSchedule.user_id == user.id,
        )
    )
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(404, "Schedule not found")

    from app.tasks.report_tasks import scheduled_report
    scheduled_report.delay(str(schedule.id))
    return {"status": "dispatched", "schedule_id": str(schedule.id)}
