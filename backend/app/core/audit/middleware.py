"""审计中间件 — 自动记录数据类 API 请求的审计日志。

TODO (Phase 3f): 实现 FastAPI 中间件 / 装饰器
"""
from __future__ import annotations
import time
import logging
from functools import wraps

logger = logging.getLogger(__name__)


def audit_log(action: str):
    """装饰器: 自动将 API handler 的调用记录到审计日志。
    TODO (Phase 3f): 捕获参数 / 结果 / 异常，写入 DataAuditLog
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            start = time.monotonic()
            try:
                result = await func(*args, **kwargs)
                elapsed = int((time.monotonic() - start) * 1000)
                logger.debug(f"AUDIT [{action}] OK {elapsed}ms")
                return result
            except Exception as e:
                elapsed = int((time.monotonic() - start) * 1000)
                logger.warning(f"AUDIT [{action}] FAIL {elapsed}ms: {e}")
                raise
        return wrapper
    return decorator
