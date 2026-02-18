"""审计模块: 原有操作审计 + 新增数据查询审计。

原 audit.py 的功能保留在此文件，
新增的 NL2SQL 数据审计在 data_auditor / middleware 中。
"""
import logging
from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.audit_log import AuditLog
from app.models.user import User

logger = logging.getLogger(__name__)


def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def audit_log(
    db: AsyncSession,
    user: User | None,
    action: str,
    resource: str = "",
    detail: dict | None = None,
    request: Request | None = None,
):
    """记录一条审计日志"""
    ip = _get_client_ip(request) if request else ""
    ua = request.headers.get("user-agent", "")[:500] if request else ""

    log = AuditLog(
        tenant_id=user.tenant_id if user else None,
        user_id=user.id if user else None,
        action=action,
        resource=resource,
        detail=detail,
        ip=ip,
        user_agent=ua,
    )
    db.add(log)
    await db.commit()
    logger.debug(f"Audit: {action} by {user.email if user else 'system'} on {resource}")
