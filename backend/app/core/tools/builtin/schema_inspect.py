"""Agent 工具: 表结构检查 — 获取用户数据表的列名、类型、注释信息。

TODO (Phase 3b): 实现工具注册和执行逻辑
"""
from __future__ import annotations
import logging
from app.core.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)

SCHEMA_INSPECT_PARAMS = {
    "type": "object",
    "properties": {
        "table_name": {"type": "string", "description": "要检查的表名 (可选，不填则列出所有表)"},
    },
    "required": [],
}


async def _schema_inspect(arguments: dict) -> str:
    """检查表结构并返回列信息。
    TODO (Phase 3b): 查询 information_schema 或 SchemaCache
    """
    raise NotImplementedError("Phase 3b")


def register_schema_inspect(registry: ToolRegistry):
    registry.register_builtin(
        name="schema_inspect",
        description="查看用户数据表的结构信息 (列名、类型、注释)。不传表名则列出所有可用表。",
        parameters=SCHEMA_INSPECT_PARAMS,
        fn=_schema_inspect,
    )
    logger.info("Registered builtin tool: schema_inspect")
