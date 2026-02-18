"""报告 Celery 异步任务 — 定时报告生成 / 重型报告异步执行。

TODO (Phase 3g): 实现任务逻辑
"""
from __future__ import annotations
import logging
from app.tasks import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, name="tasks.generate_report")
def generate_report(self, report_id: str, user_id: str, template_id: str | None = None):
    """异步生成报告。
    TODO (Phase 3g): 调用 ReportGenerator.generate()
    """
    logger.info(f"generate_report task called: report_id={report_id}")
    raise NotImplementedError("Phase 3g")


@celery_app.task(bind=True, name="tasks.scheduled_report")
def scheduled_report(self, schedule_id: str):
    """定时报告任务 (由 Celery Beat 触发)。
    TODO (Phase 3g): 查询 ReportSchedule → 调用 generate_report
    """
    logger.info(f"scheduled_report task called: schedule_id={schedule_id}")
    raise NotImplementedError("Phase 3g")
