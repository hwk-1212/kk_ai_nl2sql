import time
from datetime import datetime, timezone
from fastapi import APIRouter
from app.config import get_settings
from app.db.redis import redis_client
from app.db.milvus import check_milvus_health
from app.db.minio_client import check_minio_health
from sqlalchemy import text
from app.db.session import engine

router = APIRouter(tags=["health"])
settings = get_settings()
_start_time = time.monotonic()


@router.get("/health")
async def health_check():
    """检查所有依赖服务的健康状态"""
    services = {}

    # PostgreSQL
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        services["postgresql"] = "ok"
    except Exception as e:
        services["postgresql"] = f"error: {str(e)[:80]}"

    # Redis
    try:
        pong = await redis_client.ping()
        services["redis"] = "ok" if pong else "error"
    except Exception as e:
        services["redis"] = f"error: {str(e)[:80]}"

    # Milvus
    try:
        healthy = check_milvus_health()
        services["milvus"] = "ok" if healthy else "error"
    except Exception as e:
        services["milvus"] = f"error: {str(e)[:80]}"

    # MinIO
    try:
        healthy = check_minio_health()
        services["minio"] = "ok" if healthy else "error"
    except Exception as e:
        services["minio"] = f"error: {str(e)[:80]}"

    all_ok = all(v == "ok" for v in services.values())

    uptime_seconds = round(time.monotonic() - _start_time)
    return {
        "status": "healthy" if all_ok else "degraded",
        "version": settings.app_version,
        "uptime_seconds": uptime_seconds,
        "services": services,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
