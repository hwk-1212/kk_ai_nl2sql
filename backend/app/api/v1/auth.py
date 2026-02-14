"""认证 API: register / login / refresh / me / logout"""
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.db.redis import get_redis
from app.core.security import (
    hash_password, verify_password,
    create_access_token, create_refresh_token, decode_token,
)
from app.core.deps import get_current_user
from app.core.audit import audit_log
from app.models.user import User
from app.schemas.auth import (
    RegisterRequest, LoginRequest, TokenResponse,
    RefreshRequest, UserResponse,
)
from app.config import get_settings
import redis.asyncio as aioredis

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(req: RegisterRequest, request: Request, db: AsyncSession = Depends(get_db)):
    # 检查邮箱是否已存在
    result = await db.execute(select(User).where(User.email == req.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    # 分配默认租户
    default_tenant_id = getattr(request.app.state, "default_tenant_id", None)

    user = User(
        email=req.email,
        password_hash=hash_password(req.password),
        nickname=req.nickname,
        tenant_id=default_tenant_id,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    access_token = create_access_token(str(user.id), user.role)
    refresh_token = create_refresh_token(str(user.id))

    await audit_log(db, user, "register", f"user:{user.id}", {"email": req.email}, request)
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")

    access_token = create_access_token(str(user.id), user.role)
    refresh_token = create_refresh_token(str(user.id))

    await audit_log(db, user, "login", f"user:{user.id}", None, request)
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    req: RefreshRequest,
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
):
    payload = decode_token(req.refresh_token)
    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    jti = payload.get("jti", "")
    # 检查是否在黑名单
    if await redis.get(f"token_blacklist:{jti}"):
        raise HTTPException(status_code=401, detail="Token has been revoked")

    user_id = payload.get("sub")
    import uuid
    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    # 将旧 refresh token 加入黑名单
    ttl = settings.jwt_refresh_token_expire_days * 86400
    await redis.setex(f"token_blacklist:{jti}", ttl, "1")

    new_access = create_access_token(str(user.id), user.role)
    new_refresh = create_refresh_token(str(user.id))

    return TokenResponse(access_token=new_access, refresh_token=new_refresh)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse(
        id=str(current_user.id),
        email=current_user.email,
        nickname=current_user.nickname,
        role=current_user.role,
        is_active=current_user.is_active,
        tenant_id=str(current_user.tenant_id) if current_user.tenant_id else None,
    )


@router.post("/logout", status_code=204)
async def logout(
    req: RefreshRequest,
    redis: aioredis.Redis = Depends(get_redis),
):
    """将 refresh token 加入黑名单"""
    payload = decode_token(req.refresh_token)
    if payload and payload.get("type") == "refresh":
        jti = payload.get("jti", "")
        ttl = settings.jwt_refresh_token_expire_days * 86400
        await redis.setex(f"token_blacklist:{jti}", ttl, "1")
    return None
