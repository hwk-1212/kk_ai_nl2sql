"""数据审计 API — 查询 NL2SQL 操作审计日志 + 统计。"""
import uuid
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.deps import get_current_user, require_role
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin/data-audit", tags=["data-audit"])


@router.get("/")
async def list_data_audit_logs(
    request: Request,
    admin: User = Depends(require_role("super_admin", "tenant_admin")),
    db: AsyncSession = Depends(get_db),
    user_id: str = Query(default="", max_length=50),
    table_id: str = Query(default="", max_length=50),
    action: str = Query(default="", max_length=50),
    status: str = Query(default="", max_length=20),
    start_date: str = Query(default="", max_length=30),
    end_date: str = Query(default="", max_length=30),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
):
    """查询数据审计日志 (分页 + 筛选)。"""
    auditor = getattr(request.app.state, "data_auditor", None)
    if not auditor:
        return {"items": [], "total": 0, "page": page, "page_size": page_size}

    kwargs: dict = {"db": db, "page": page, "page_size": page_size}
    if admin.role == "tenant_admin":
        kwargs["tenant_id"] = admin.tenant_id
    if user_id:
        kwargs["user_id"] = uuid.UUID(user_id)
    if table_id:
        kwargs["table_id"] = uuid.UUID(table_id)
    if action:
        kwargs["action"] = action
    if status:
        kwargs["status"] = status
    if start_date:
        kwargs["start_date"] = datetime.fromisoformat(start_date)
    if end_date:
        kwargs["end_date"] = datetime.fromisoformat(end_date)

    return await auditor.get_logs(**kwargs)


@router.get("/stats")
async def data_audit_stats(
    request: Request,
    admin: User = Depends(require_role("super_admin", "tenant_admin")),
    db: AsyncSession = Depends(get_db),
    days: int = Query(default=7, ge=1, le=90),
):
    """审计统计 (查询量趋势/高频表/失败率)。"""
    auditor = getattr(request.app.state, "data_auditor", None)
    if not auditor:
        return {"period_days": days, "total_operations": 0}

    kwargs: dict = {"db": db, "days": days}
    if admin.role == "tenant_admin":
        kwargs["tenant_id"] = admin.tenant_id

    return await auditor.get_stats(**kwargs)


@router.get("/{log_id}")
async def get_data_audit_detail(
    log_id: str,
    request: Request,
    admin: User = Depends(require_role("super_admin", "tenant_admin")),
    db: AsyncSession = Depends(get_db),
):
    """审计详情 (含 SQL + 快照)。"""
    from sqlalchemy import select
    from app.models.data_audit_log import DataAuditLog

    q = select(DataAuditLog).where(DataAuditLog.id == uuid.UUID(log_id))
    if admin.role == "tenant_admin":
        q = q.where(DataAuditLog.tenant_id == admin.tenant_id)

    result = await db.execute(q)
    log = result.scalar_one_or_none()
    if not log:
        from fastapi import HTTPException
        raise HTTPException(404, "Audit log not found")

    return {
        "id": str(log.id),
        "user_id": str(log.user_id),
        "tenant_id": str(log.tenant_id) if log.tenant_id else None,
        "conversation_id": str(log.conversation_id) if log.conversation_id else None,
        "action": log.action,
        "data_table_id": str(log.data_table_id) if log.data_table_id else None,
        "table_name": log.table_name,
        "sql_text": log.sql_text,
        "sql_hash": log.sql_hash,
        "affected_rows": log.affected_rows,
        "execution_ms": log.execution_ms,
        "result_row_count": log.result_row_count,
        "status": log.status,
        "error_message": log.error_message,
        "before_snapshot": log.before_snapshot,
        "after_snapshot": log.after_snapshot,
        "client_ip": log.client_ip,
        "user_agent": log.user_agent,
        "extra": log.extra,
        "created_at": log.created_at.isoformat() if log.created_at else None,
    }
