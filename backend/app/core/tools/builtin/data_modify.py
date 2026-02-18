"""Agent 工具: 数据修改 — 对用户数据执行受控的 INSERT / UPDATE / DELETE。

与 data_query (只读) 不同，此工具允许写操作，但需要严格审计。

TODO (Phase 3b): 实现工具注册和执行逻辑
"""
from __future__ import annotations
import logging
from app.core.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)

DATA_MODIFY_PARAMS = {
    "type": "object",
    "properties": {
        "sql": {"type": "string", "description": "要执行的修改语句 (INSERT/UPDATE/DELETE)"},
        "reason": {"type": "string", "description": "修改原因 (必填，用于审计)"},
    },
    "required": ["sql", "reason"],
}


async def _data_modify(arguments: dict) -> str:
    """执行数据修改操作。
    TODO (Phase 3b): 权限检查 → 安全审计 → 执行 → 记录审计日志
    """
    raise NotImplementedError("Phase 3b")


def register_data_modify(registry: ToolRegistry):
    registry.register_builtin(
        name="data_modify",
        description="对用户数据表执行修改操作 (INSERT/UPDATE/DELETE)。需提供修改原因，操作会被完整审计记录。",
        parameters=DATA_MODIFY_PARAMS,
        fn=_data_modify,
    )
    logger.info("Registered builtin tool: data_modify")
