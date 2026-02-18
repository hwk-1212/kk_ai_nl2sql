"""报告 API — 报告生成 / 列表 / 定时任务管理。

TODO (Phase 3g): 实现完整 CRUD 逻辑
"""
from fastapi import APIRouter

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/")
async def list_reports():
    """列出当前用户的报告。"""
    return {"status": "not_implemented"}


@router.post("/")
async def create_report():
    """手动生成报告。"""
    return {"status": "not_implemented"}


@router.get("/{report_id}")
async def get_report(report_id: str):
    """获取报告详情。"""
    return {"status": "not_implemented"}


@router.get("/schedules")
async def list_schedules():
    """列出定时任务。"""
    return {"status": "not_implemented"}


@router.post("/schedules")
async def create_schedule():
    """创建定时报告任务。"""
    return {"status": "not_implemented"}
