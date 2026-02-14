"""Admin API — 租户管理 + 用户管理 + 审计日志 + 计费 + Dashboard"""
import uuid
import logging
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select, func, and_, cast, Date, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.deps import get_current_user, require_role
from app.core.security import hash_password
from app.core.audit import audit_log
from app.core.billing import MODEL_PRICING, get_monthly_usage
from app.models.user import User
from app.models.tenant import Tenant, DEFAULT_TENANT_CONFIG
from app.models.audit_log import AuditLog
from app.models.usage_record import UsageRecord
from app.models.conversation import Conversation
from app.models.message import Message

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"])

# ════════════════════════════════════════════════════════════
#  Schemas
# ════════════════════════════════════════════════════════════


class TenantCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    config: dict | None = None


class TenantUpdate(BaseModel):
    name: str | None = None
    config: dict | None = None
    is_active: bool | None = None


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    nickname: str = Field(default="User", max_length=100)
    role: str = Field(default="user")
    tenant_id: str | None = None


class UserUpdate(BaseModel):
    nickname: str | None = None
    role: str | None = None
    is_active: bool | None = None
    tenant_id: str | None = None


# ════════════════════════════════════════════════════════════
#  Serializers
# ════════════════════════════════════════════════════════════

def _ser_tenant(t: Tenant, user_count: int = 0) -> dict:
    return {
        "id": str(t.id),
        "name": t.name,
        "config": t.config,
        "is_active": t.is_active,
        "user_count": user_count,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
    }


def _ser_user(u: User) -> dict:
    return {
        "id": str(u.id),
        "email": u.email,
        "nickname": u.nickname,
        "role": u.role,
        "tenant_id": str(u.tenant_id) if u.tenant_id else None,
        "tenant_name": u.tenant.name if u.tenant else None,
        "is_active": u.is_active,
        "created_at": u.created_at.isoformat() if u.created_at else None,
    }


def _ser_audit(a: AuditLog) -> dict:
    return {
        "id": str(a.id),
        "user_id": str(a.user_id) if a.user_id else None,
        "action": a.action,
        "resource": a.resource,
        "detail": a.detail,
        "ip": a.ip,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }


# ════════════════════════════════════════════════════════════
#  Dashboard
# ════════════════════════════════════════════════════════════

@router.get("/dashboard")
async def get_dashboard(
    admin: User = Depends(require_role("super_admin", "tenant_admin")),
    db: AsyncSession = Depends(get_db),
):
    """管理后台总览"""
    is_super = admin.role == "super_admin"
    tenant_filter = True if is_super else (User.tenant_id == admin.tenant_id)

    # 用户数
    q = select(func.count(User.id)).where(tenant_filter)
    total_users = (await db.execute(q)).scalar() or 0

    # 租户数 (super_admin only)
    total_tenants = 0
    if is_super:
        total_tenants = (await db.execute(select(func.count(Tenant.id)))).scalar() or 0

    # 今日消息数
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    if is_super:
        msg_q = select(func.count(Message.id)).where(Message.created_at >= today_start)
    else:
        msg_q = (
            select(func.count(Message.id))
            .join(Conversation, Message.conversation_id == Conversation.id)
            .where(Conversation.tenant_id == admin.tenant_id, Message.created_at >= today_start)
        )
    today_messages = (await db.execute(msg_q)).scalar() or 0

    # 本月 Token 用量
    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if is_super:
        tok_q = select(func.coalesce(func.sum(UsageRecord.total_tokens), 0)).where(
            UsageRecord.created_at >= month_start
        )
    else:
        tok_q = select(func.coalesce(func.sum(UsageRecord.total_tokens), 0)).where(
            UsageRecord.tenant_id == admin.tenant_id, UsageRecord.created_at >= month_start
        )
    month_tokens = (await db.execute(tok_q)).scalar() or 0

    # 7 日趋势
    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
    if is_super:
        trend_q = (
            select(
                cast(UsageRecord.created_at, Date).label("day"),
                func.sum(UsageRecord.total_tokens).label("tokens"),
                func.count(UsageRecord.id).label("requests"),
                func.sum(UsageRecord.cost).label("cost"),
            )
            .where(UsageRecord.created_at >= seven_days_ago)
            .group_by(cast(UsageRecord.created_at, Date))
            .order_by(cast(UsageRecord.created_at, Date))
        )
    else:
        trend_q = (
            select(
                cast(UsageRecord.created_at, Date).label("day"),
                func.sum(UsageRecord.total_tokens).label("tokens"),
                func.count(UsageRecord.id).label("requests"),
                func.sum(UsageRecord.cost).label("cost"),
            )
            .where(UsageRecord.tenant_id == admin.tenant_id, UsageRecord.created_at >= seven_days_ago)
            .group_by(cast(UsageRecord.created_at, Date))
            .order_by(cast(UsageRecord.created_at, Date))
        )
    trend_rows = (await db.execute(trend_q)).all()
    daily_trend = [
        {"date": str(r.day), "tokens": int(r.tokens or 0), "requests": int(r.requests or 0), "cost": float(r.cost or 0)}
        for r in trend_rows
    ]

    return {
        "total_users": total_users,
        "total_tenants": total_tenants,
        "today_messages": today_messages,
        "month_tokens": month_tokens,
        "daily_trend": daily_trend,
    }


# ════════════════════════════════════════════════════════════
#  Tenant CRUD (super_admin only)
# ════════════════════════════════════════════════════════════

@router.get("/tenants")
async def list_tenants(
    admin: User = Depends(require_role("super_admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Tenant, func.count(User.id).label("user_count"))
        .outerjoin(User, User.tenant_id == Tenant.id)
        .group_by(Tenant.id)
        .order_by(Tenant.created_at.desc())
    )
    rows = result.all()
    return [_ser_tenant(t, uc) for t, uc in rows]


@router.post("/tenants", status_code=201)
async def create_tenant(
    body: TenantCreate,
    request: Request,
    admin: User = Depends(require_role("super_admin")),
    db: AsyncSession = Depends(get_db),
):
    # 检查名称唯一
    existing = await db.execute(select(Tenant).where(Tenant.name == body.name))
    if existing.scalar_one_or_none():
        raise HTTPException(400, f"Tenant name already exists: {body.name}")

    tenant = Tenant(
        name=body.name,
        config=body.config or dict(DEFAULT_TENANT_CONFIG),
    )
    db.add(tenant)
    await db.commit()
    await db.refresh(tenant)

    await audit_log(db, admin, "create_tenant", f"tenant:{tenant.id}", {"name": body.name}, request)
    return _ser_tenant(tenant)


@router.patch("/tenants/{tenant_id}")
async def update_tenant(
    tenant_id: str,
    body: TenantUpdate,
    request: Request,
    admin: User = Depends(require_role("super_admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Tenant).where(Tenant.id == uuid.UUID(tenant_id)))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(404, "Tenant not found")

    changes = {}
    if body.name is not None:
        tenant.name = body.name
        changes["name"] = body.name
    if body.config is not None:
        tenant.config = body.config
        changes["config"] = body.config
    if body.is_active is not None:
        tenant.is_active = body.is_active
        changes["is_active"] = body.is_active

    await db.commit()
    await db.refresh(tenant)
    await audit_log(db, admin, "update_tenant", f"tenant:{tenant_id}", changes, request)
    return _ser_tenant(tenant)


@router.delete("/tenants/{tenant_id}", status_code=204)
async def delete_tenant(
    tenant_id: str,
    request: Request,
    admin: User = Depends(require_role("super_admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Tenant).where(Tenant.id == uuid.UUID(tenant_id)))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(404, "Tenant not found")

    # 软删除: 标记 inactive 而非物理删除
    tenant.is_active = False
    await db.commit()
    await audit_log(db, admin, "delete_tenant", f"tenant:{tenant_id}", {"name": tenant.name}, request)


# ════════════════════════════════════════════════════════════
#  User Management (tenant_admin+)
# ════════════════════════════════════════════════════════════

@router.get("/users")
async def list_users(
    admin: User = Depends(require_role("super_admin", "tenant_admin")),
    db: AsyncSession = Depends(get_db),
    search: str = Query(default="", max_length=200),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
):
    from sqlalchemy.orm import selectinload

    q = select(User).options(selectinload(User.tenant))

    # tenant_admin 只看本租户
    if admin.role == "tenant_admin":
        q = q.where(User.tenant_id == admin.tenant_id)

    if search:
        q = q.where(User.email.ilike(f"%{search}%") | User.nickname.ilike(f"%{search}%"))

    q = q.order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(q)
    users = result.scalars().all()

    # total count
    count_q = select(func.count(User.id))
    if admin.role == "tenant_admin":
        count_q = count_q.where(User.tenant_id == admin.tenant_id)
    if search:
        count_q = count_q.where(User.email.ilike(f"%{search}%") | User.nickname.ilike(f"%{search}%"))
    total = (await db.execute(count_q)).scalar() or 0

    return {"items": [_ser_user(u) for u in users], "total": total, "page": page, "page_size": page_size}


@router.post("/users", status_code=201)
async def create_user(
    body: UserCreate,
    request: Request,
    admin: User = Depends(require_role("super_admin", "tenant_admin")),
    db: AsyncSession = Depends(get_db),
):
    # 邮箱唯一
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Email already registered")

    # 权限: tenant_admin 只能创建同租户 user
    if admin.role == "tenant_admin":
        if body.role != "user":
            raise HTTPException(403, "Tenant admin can only create user role")
        body.tenant_id = str(admin.tenant_id) if admin.tenant_id else None

    # 权限: 不允许创建 super_admin (除非本身是 super_admin)
    if body.role == "super_admin" and admin.role != "super_admin":
        raise HTTPException(403, "Only super_admin can create super_admin users")

    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        nickname=body.nickname,
        role=body.role,
        tenant_id=uuid.UUID(body.tenant_id) if body.tenant_id else admin.tenant_id,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    await audit_log(db, admin, "create_user", f"user:{user.id}", {"email": body.email, "role": body.role}, request)
    return _ser_user(user)


@router.patch("/users/{user_id}")
async def update_user(
    user_id: str,
    body: UserUpdate,
    request: Request,
    admin: User = Depends(require_role("super_admin", "tenant_admin")),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy.orm import selectinload
    result = await db.execute(select(User).options(selectinload(User.tenant)).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")

    # tenant_admin 只能管理同租户
    if admin.role == "tenant_admin" and user.tenant_id != admin.tenant_id:
        raise HTTPException(403, "Cannot manage users from other tenants")

    changes = {}
    if body.nickname is not None:
        user.nickname = body.nickname
        changes["nickname"] = body.nickname
    if body.role is not None:
        if body.role == "super_admin" and admin.role != "super_admin":
            raise HTTPException(403, "Only super_admin can assign super_admin role")
        if admin.role == "tenant_admin" and body.role != "user":
            raise HTTPException(403, "Tenant admin can only set user role")
        user.role = body.role
        changes["role"] = body.role
    if body.is_active is not None:
        user.is_active = body.is_active
        changes["is_active"] = body.is_active
    if body.tenant_id is not None and admin.role == "super_admin":
        user.tenant_id = uuid.UUID(body.tenant_id) if body.tenant_id else None
        changes["tenant_id"] = body.tenant_id

    await db.commit()
    await db.refresh(user)
    await audit_log(db, admin, "update_user", f"user:{user_id}", changes, request)
    return _ser_user(user)


@router.delete("/users/{user_id}", status_code=204)
async def delete_user(
    user_id: str,
    request: Request,
    admin: User = Depends(require_role("super_admin", "tenant_admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")

    if admin.role == "tenant_admin" and user.tenant_id != admin.tenant_id:
        raise HTTPException(403, "Cannot manage users from other tenants")

    if str(user.id) == str(admin.id):
        raise HTTPException(400, "Cannot delete yourself")

    # 软删除
    user.is_active = False
    await db.commit()
    await audit_log(db, admin, "delete_user", f"user:{user_id}", {"email": user.email}, request)


# ════════════════════════════════════════════════════════════
#  Audit Logs (tenant_admin+)
# ════════════════════════════════════════════════════════════

@router.get("/audit-logs")
async def list_audit_logs(
    admin: User = Depends(require_role("super_admin", "tenant_admin")),
    db: AsyncSession = Depends(get_db),
    action: str = Query(default="", max_length=50),
    user_id: str = Query(default="", max_length=50),
    start_time: str = Query(default="", max_length=30),
    end_time: str = Query(default="", max_length=30),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
):
    q = select(AuditLog)

    # tenant_admin 只看本租户
    if admin.role == "tenant_admin":
        q = q.where(AuditLog.tenant_id == admin.tenant_id)

    if action:
        q = q.where(AuditLog.action == action)
    if user_id:
        q = q.where(AuditLog.user_id == uuid.UUID(user_id))
    if start_time:
        q = q.where(AuditLog.created_at >= datetime.fromisoformat(start_time))
    if end_time:
        q = q.where(AuditLog.created_at <= datetime.fromisoformat(end_time))

    # count
    count_q = select(func.count(AuditLog.id))
    if admin.role == "tenant_admin":
        count_q = count_q.where(AuditLog.tenant_id == admin.tenant_id)
    if action:
        count_q = count_q.where(AuditLog.action == action)
    total = (await db.execute(count_q)).scalar() or 0

    q = q.order_by(AuditLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(q)
    logs = result.scalars().all()

    # 补充用户信息
    user_ids = {a.user_id for a in logs if a.user_id}
    user_map: dict[str, str] = {}
    if user_ids:
        user_result = await db.execute(select(User.id, User.nickname, User.email).where(User.id.in_(user_ids)))
        for uid, nickname, email in user_result.all():
            user_map[str(uid)] = nickname or email

    items = []
    for a in logs:
        d = _ser_audit(a)
        d["user_name"] = user_map.get(str(a.user_id), "unknown") if a.user_id else "system"
        items.append(d)

    return {"items": items, "total": total, "page": page, "page_size": page_size}


# ════════════════════════════════════════════════════════════
#  Billing (tenant_admin+)
# ════════════════════════════════════════════════════════════

@router.get("/billing/summary")
async def billing_summary(
    admin: User = Depends(require_role("super_admin", "tenant_admin")),
    db: AsyncSession = Depends(get_db),
    period: str = Query(default="month", pattern="^(week|month)$"),
):
    """用量汇总 — 按日期聚合 + 按模型分布 + Top 用户"""
    is_super = admin.role == "super_admin"

    if period == "week":
        start = datetime.now(timezone.utc) - timedelta(days=7)
    else:
        start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    base_filter = UsageRecord.created_at >= start
    if not is_super:
        base_filter = and_(base_filter, UsageRecord.tenant_id == admin.tenant_id)

    # 总量
    totals = await db.execute(
        select(
            func.count(UsageRecord.id).label("total_requests"),
            func.coalesce(func.sum(UsageRecord.input_tokens), 0).label("total_input"),
            func.coalesce(func.sum(UsageRecord.output_tokens), 0).label("total_output"),
            func.coalesce(func.sum(UsageRecord.total_tokens), 0).label("total_tokens"),
            func.coalesce(func.sum(UsageRecord.cost), 0).label("total_cost"),
        ).where(base_filter)
    )
    row = totals.one()

    # 按日聚合
    daily = await db.execute(
        select(
            cast(UsageRecord.created_at, Date).label("day"),
            func.sum(UsageRecord.total_tokens).label("tokens"),
            func.count(UsageRecord.id).label("requests"),
            func.sum(UsageRecord.cost).label("cost"),
        )
        .where(base_filter)
        .group_by(cast(UsageRecord.created_at, Date))
        .order_by(cast(UsageRecord.created_at, Date))
    )
    daily_data = [
        {"date": str(r.day), "tokens": int(r.tokens or 0), "requests": int(r.requests or 0), "cost": round(float(r.cost or 0), 2)}
        for r in daily.all()
    ]

    # 按模型分布
    by_model = await db.execute(
        select(
            UsageRecord.model,
            func.sum(UsageRecord.total_tokens).label("tokens"),
            func.count(UsageRecord.id).label("requests"),
            func.sum(UsageRecord.cost).label("cost"),
        )
        .where(base_filter)
        .group_by(UsageRecord.model)
        .order_by(func.sum(UsageRecord.total_tokens).desc())
    )
    model_data = [
        {"model": r.model, "tokens": int(r.tokens or 0), "requests": int(r.requests or 0), "cost": round(float(r.cost or 0), 2)}
        for r in by_model.all()
    ]

    # Top 5 用户
    top_users_q = (
        select(
            UsageRecord.user_id,
            func.sum(UsageRecord.total_tokens).label("tokens"),
            func.sum(UsageRecord.cost).label("cost"),
        )
        .where(base_filter)
        .group_by(UsageRecord.user_id)
        .order_by(func.sum(UsageRecord.total_tokens).desc())
        .limit(5)
    )
    top_users_rows = (await db.execute(top_users_q)).all()
    top_user_ids = [r.user_id for r in top_users_rows]
    user_map: dict[str, str] = {}
    if top_user_ids:
        u_result = await db.execute(select(User.id, User.nickname, User.email).where(User.id.in_(top_user_ids)))
        for uid, nickname, email in u_result.all():
            user_map[str(uid)] = nickname or email

    top_users = [
        {"user_id": str(r.user_id), "name": user_map.get(str(r.user_id), "unknown"), "tokens": int(r.tokens or 0), "cost": round(float(r.cost or 0), 2)}
        for r in top_users_rows
    ]

    # 配额信息 (tenant_admin)
    quota_info = None
    if not is_super and admin.tenant_id:
        tenant_result = await db.execute(select(Tenant).where(Tenant.id == admin.tenant_id))
        tenant = tenant_result.scalar_one_or_none()
        if tenant and tenant.config:
            quota = tenant.config.get("token_quota", 0)
            used = await get_monthly_usage(str(admin.tenant_id))
            quota_info = {"quota": quota, "used": used, "unlimited": quota <= 0}

    return {
        "total_requests": int(row.total_requests),
        "total_input_tokens": int(row.total_input),
        "total_output_tokens": int(row.total_output),
        "total_tokens": int(row.total_tokens),
        "total_cost": round(float(row.total_cost), 2),
        "daily": daily_data,
        "by_model": model_data,
        "top_users": top_users,
        "quota": quota_info,
        "model_pricing": MODEL_PRICING,
    }


@router.get("/billing/details")
async def billing_details(
    admin: User = Depends(require_role("super_admin", "tenant_admin")),
    db: AsyncSession = Depends(get_db),
    model: str = Query(default="", max_length=100),
    user_id: str = Query(default="", max_length=50),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
):
    """用量明细查询"""
    is_super = admin.role == "super_admin"

    q = select(UsageRecord)
    if not is_super:
        q = q.where(UsageRecord.tenant_id == admin.tenant_id)
    if model:
        q = q.where(UsageRecord.model == model)
    if user_id:
        q = q.where(UsageRecord.user_id == uuid.UUID(user_id))

    # count
    count_q = select(func.count(UsageRecord.id))
    if not is_super:
        count_q = count_q.where(UsageRecord.tenant_id == admin.tenant_id)
    if model:
        count_q = count_q.where(UsageRecord.model == model)
    if user_id:
        count_q = count_q.where(UsageRecord.user_id == uuid.UUID(user_id))
    total = (await db.execute(count_q)).scalar() or 0

    q = q.order_by(UsageRecord.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(q)
    records = result.scalars().all()

    return {
        "items": [
            {
                "id": str(r.id),
                "user_id": str(r.user_id),
                "model": r.model,
                "input_tokens": r.input_tokens,
                "output_tokens": r.output_tokens,
                "total_tokens": r.total_tokens,
                "cost": round(r.cost, 4),
                "trigger_type": r.trigger_type,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in records
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/billing/quota")
async def get_quota(
    admin: User = Depends(require_role("super_admin")),
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Query(...),
):
    result = await db.execute(select(Tenant).where(Tenant.id == uuid.UUID(tenant_id)))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(404, "Tenant not found")
    used = await get_monthly_usage(str(tenant.id))
    return {"tenant_id": str(tenant.id), "config": tenant.config, "monthly_used": used}


@router.patch("/billing/quota")
async def update_quota(
    request: Request,
    admin: User = Depends(require_role("super_admin")),
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Query(...),
    token_quota: int = Query(default=0, ge=0),
):
    result = await db.execute(select(Tenant).where(Tenant.id == uuid.UUID(tenant_id)))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(404, "Tenant not found")

    config = dict(tenant.config or {})
    config["token_quota"] = token_quota
    tenant.config = config
    await db.commit()
    await db.refresh(tenant)
    await audit_log(db, admin, "update_quota", f"tenant:{tenant_id}", {"token_quota": token_quota}, request)
    return {"tenant_id": str(tenant.id), "config": tenant.config}
