"""定时任务管理 — 管理 Celery Beat 定时报告调度。

TODO (Phase 3g): 实现 CRUD + Celery Beat schedule 动态更新
"""
from __future__ import annotations
import uuid
import logging

logger = logging.getLogger(__name__)


class ReportScheduler:
    """管理报告定时生成任务。"""

    def __init__(self, db_session):
        self.db = db_session

    async def create_schedule(self, user_id: uuid.UUID, report_template_id: uuid.UUID, cron: str, recipients: list[str] | None = None) -> dict:
        """创建定时报告任务。
        TODO (Phase 3g): 写入 ReportSchedule 表 + 注册 Celery Beat entry
        """
        raise NotImplementedError("Phase 3g")

    async def list_schedules(self, user_id: uuid.UUID) -> list[dict]:
        """列出用户的所有定时任务。"""
        raise NotImplementedError("Phase 3g")

    async def toggle_schedule(self, schedule_id: uuid.UUID, is_active: bool) -> None:
        """启用/禁用定时任务。"""
        raise NotImplementedError("Phase 3g")

    async def delete_schedule(self, schedule_id: uuid.UUID) -> None:
        """删除定时任务。"""
        raise NotImplementedError("Phase 3g")
