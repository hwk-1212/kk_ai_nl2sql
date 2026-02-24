"""报告 Celery 异步任务 — 定时报告生成 / 重型报告异步执行。"""
from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone

from app.tasks import celery_app

logger = logging.getLogger(__name__)


def _run_async(coro):
    """在 Celery worker（同步进程）中运行 async 函数。"""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(bind=True, name="tasks.generate_report", max_retries=3)
def generate_report(self, report_id: str, user_id: str):
    """异步生成报告。"""
    logger.info("generate_report task: report_id=%s user_id=%s", report_id, user_id)
    try:
        _run_async(_generate_report_async(report_id, user_id))
    except Exception as exc:
        logger.error("generate_report failed: %s", exc)
        _run_async(_mark_report_failed(report_id, str(exc)))
        raise self.retry(exc=exc, countdown=30)


@celery_app.task(bind=True, name="tasks.scheduled_report")
def scheduled_report(self, schedule_id: str):
    """定时报告任务 (由检查循环触发)。"""
    logger.info("scheduled_report task: schedule_id=%s", schedule_id)
    try:
        _run_async(_run_scheduled_report(schedule_id))
    except Exception as exc:
        logger.error("scheduled_report failed: %s", exc)


@celery_app.task(name="tasks.check_scheduled_reports")
def check_scheduled_reports():
    """每 5 分钟检查到期的定时报告。"""
    logger.info("Checking for due report schedules...")
    try:
        _run_async(_check_and_dispatch())
    except Exception as exc:
        logger.error("check_scheduled_reports failed: %s", exc)


# ── async implementations ──────────────────────────────────

async def _generate_report_async(report_id: str, user_id: str):
    from app.db.session import async_session_maker
    from sqlalchemy import select

    async with async_session_maker() as db:
        from app.models.report import Report
        from app.models.report_template import ReportTemplate

        result = await db.execute(select(Report).where(Report.id == uuid.UUID(report_id)))
        report = result.scalar_one_or_none()
        if not report:
            logger.error("Report not found: %s", report_id)
            return

        report.status = "generating"
        await db.flush()

        template_content = None
        if report.template_id:
            tmpl_result = await db.execute(select(ReportTemplate).where(ReportTemplate.id == report.template_id))
            tmpl = tmpl_result.scalar_one_or_none()
            if tmpl:
                template_content = tmpl.template_content

        from app.core.llm.router import llm_router
        from app.core.data.isolated_executor import IsolatedSQLExecutor
        from app.db.session import engine
        from app.core.report.generator import ReportGenerator

        executor = IsolatedSQLExecutor(engine=engine)
        generator = ReportGenerator(llm_router=llm_router, executor=executor)

        data_config = report.data_config or {}
        gen_result = await generator.generate(
            db=db,
            user_id=report.user_id,
            tenant_id=report.tenant_id,
            title=report.title,
            data_config=data_config,
            template_content=template_content,
        )

        report.content = gen_result["content"]
        report.charts = gen_result.get("charts")
        report.sections = gen_result.get("sections")
        report.status = "ready"
        report.updated_at = datetime.now(timezone.utc)
        await db.commit()
        logger.info("Report generated: %s", report_id)


async def _mark_report_failed(report_id: str, error: str):
    from app.db.session import async_session_maker
    from sqlalchemy import select

    async with async_session_maker() as db:
        from app.models.report import Report
        result = await db.execute(select(Report).where(Report.id == uuid.UUID(report_id)))
        report = result.scalar_one_or_none()
        if report:
            report.status = "failed"
            report.error_message = error[:2000]
            await db.commit()


async def _run_scheduled_report(schedule_id: str):
    from app.db.session import async_session_maker
    from sqlalchemy import select

    async with async_session_maker() as db:
        from app.models.report_schedule import ReportSchedule
        from app.models.report import Report
        from app.core.report.scheduler import ReportScheduler

        result = await db.execute(select(ReportSchedule).where(ReportSchedule.id == uuid.UUID(schedule_id)))
        schedule = result.scalar_one_or_none()
        if not schedule or not schedule.is_active:
            return

        report = Report(
            user_id=schedule.user_id,
            tenant_id=schedule.tenant_id,
            title=f"定时报告 - {schedule.name} - {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')}",
            report_type="scheduled",
            template_id=schedule.template_id,
            data_config=schedule.data_config,
            status="generating",
            schedule_id=schedule.id,
        )
        db.add(report)
        await db.flush()
        await db.refresh(report)

        scheduler = ReportScheduler()
        await scheduler.mark_run(db, schedule.id)
        await db.commit()

    generate_report.delay(str(report.id), str(report.user_id))


async def _check_and_dispatch():
    from app.db.session import async_session_maker
    from app.core.report.scheduler import ReportScheduler

    async with async_session_maker() as db:
        scheduler = ReportScheduler()
        due = await scheduler.get_due_schedules(db)
        for s in due:
            logger.info("Dispatching scheduled report: %s (%s)", s.name, s.id)
            scheduled_report.delay(str(s.id))
