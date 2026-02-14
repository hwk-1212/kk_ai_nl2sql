"""用量计费系统 — 记录用量 + 额度检查 + 模型单价"""
import logging
from datetime import datetime, timezone
from app.db.redis import redis_client
from app.models.usage_record import UsageRecord
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# 模型单价 (RMB / 1K tokens)
MODEL_PRICING: dict[str, dict[str, float]] = {
    "deepseek-chat":     {"input": 0.001, "output": 0.002},
    "deepseek-reasoner": {"input": 0.004, "output": 0.016},
    "qwen-plus":         {"input": 0.0008, "output": 0.002},
    "qwen3-235b-a22b":   {"input": 0.004, "output": 0.016},
}


def calculate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    """根据模型单价计算费用 (RMB)"""
    pricing = MODEL_PRICING.get(model, {"input": 0.002, "output": 0.004})
    cost = (input_tokens / 1000) * pricing["input"] + (output_tokens / 1000) * pricing["output"]
    return round(cost, 6)


def _monthly_key(tenant_id: str) -> str:
    """Redis key for monthly token counter"""
    ym = datetime.now(timezone.utc).strftime("%Y-%m")
    return f"tenant:{tenant_id}:monthly_tokens:{ym}"


async def record_usage(
    db: AsyncSession,
    user_id: str,
    tenant_id: str | None,
    model: str,
    input_tokens: int,
    output_tokens: int,
    trigger_type: str = "chat",
    conversation_id: str | None = None,
):
    """记录一次 LLM 用量 → DB + Redis"""
    import uuid as _uuid

    total = input_tokens + output_tokens
    cost = calculate_cost(model, input_tokens, output_tokens)

    record = UsageRecord(
        user_id=_uuid.UUID(user_id),
        tenant_id=_uuid.UUID(tenant_id) if tenant_id else None,
        model=model,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        total_tokens=total,
        cost=cost,
        trigger_type=trigger_type,
        conversation_id=_uuid.UUID(conversation_id) if conversation_id else None,
    )
    db.add(record)
    await db.commit()

    # 更新 Redis 月度计数器 (30天自动过期)
    if tenant_id:
        key = _monthly_key(tenant_id)
        await redis_client.incrby(key, total)
        await redis_client.expire(key, 86400 * 35)  # 35 天 TTL

    logger.info(f"Usage recorded: user={user_id} model={model} tokens={total} cost=¥{cost}")


async def check_quota(tenant_id: str | None, tenant_config: dict | None) -> tuple[bool, str]:
    """
    检查租户是否还有额度.
    Returns (allowed: bool, message: str)
    """
    if not tenant_id or not tenant_config:
        return True, ""

    quota = tenant_config.get("token_quota", 0)
    if quota <= 0:  # 0 = 无限制
        return True, ""

    key = _monthly_key(tenant_id)
    current = int(await redis_client.get(key) or 0)

    if current >= quota:
        return False, f"月度 Token 额度已用完 ({current:,}/{quota:,})"

    return True, ""


async def get_monthly_usage(tenant_id: str) -> int:
    """获取当月已用 Token 数 (from Redis)"""
    key = _monthly_key(tenant_id)
    return int(await redis_client.get(key) or 0)
