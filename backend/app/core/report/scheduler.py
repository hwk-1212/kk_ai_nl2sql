"""定时报告调度器 — 管理 Celery Beat 定时报告。

通过 croniter 计算下次运行时间，提供 CRUD 接口给 API 层调用。
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.report_schedule import ReportSchedule
from app.models.report import Report

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)


def _next_run(cron_expression: str) -> datetime | None:
    """计算下次运行时间。"""
    try:
        from croniter import croniter
        it = croniter(cron_expression, datetime.now(timezone.utc))
        return it.get_next(datetime).replace(tzinfo=timezone.utc)
    except Exception:
        try:
            parts = cron_expression.strip().split()
            if len(parts) == 5:
                from datetime import timedelta
                return datetime.now(timezone.utc) + timedelta(hours=1)
        except Exception:
            pass
        return None


class ReportScheduler:
    """管理报告定时生成任务。"""

    async def create_schedule(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        tenant_id: uuid.UUID | None,
        name: str,
        cron_expression: str,
        template_id: uuid.UUID | None = None,
        data_config: dict | None = None,
        recipients: list[str] | None = None,
    ) -> ReportSchedule:
        next_at = _next_run(cron_expression)
        schedule = ReportSchedule(
            user_id=user_id,
            tenant_id=tenant_id,
            name=name,
            template_id=template_id,
            cron_expression=cron_expression,
            data_config=data_config or {},
            is_active=True,
            recipients={"emails": recipients} if recipients else None,
            next_run_at=next_at,
        )
        db.add(schedule)
        await db.flush()
        await db.refresh(schedule)
        return schedule

    async def update_schedule(
        self,
        db: AsyncSession,
        schedule: ReportSchedule,
        **kwargs,
    ) -> ReportSchedule:
        for key, value in kwargs.items():
            if value is not None and hasattr(schedule, key):
                setattr(schedule, key, value)
        if "cron_expression" in kwargs and kwargs["cron_expression"]:
            schedule.next_run_at = _next_run(kwargs["cron_expression"])
        await db.flush()
        await db.refresh(schedule)
        return schedule

    async def toggle(self, db: AsyncSession, schedule: ReportSchedule, is_active: bool) -> ReportSchedule:
        schedule.is_active = is_active
        if is_active:
            schedule.next_run_at = _next_run(schedule.cron_expression)
        await db.flush()
        await db.refresh(schedule)
        return schedule

    async def mark_run(self, db: AsyncSession, schedule_id: uuid.UUID) -> None:
        """标记一次执行完成，更新 last_run_at 和 next_run_at。"""
        result = await db.execute(select(ReportSchedule).where(ReportSchedule.id == schedule_id))
        schedule = result.scalar_one_or_none()
        if schedule:
            schedule.last_run_at = datetime.now(timezone.utc)
            schedule.next_run_at = _next_run(schedule.cron_expression)
            await db.flush()

    async def get_due_schedules(self, db: AsyncSession) -> list[ReportSchedule]:
        """获取所有到期应执行的定时任务。"""
        now = datetime.now(timezone.utc)
        result = await db.execute(
            select(ReportSchedule).where(
                ReportSchedule.is_active.is_(True),
                ReportSchedule.next_run_at <= now,
            )
        )
        return list(result.scalars().all())
