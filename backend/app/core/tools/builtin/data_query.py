"""Agent 工具: SQL 查询执行 — LLM 生成的 SQL 经安全检查后在 user_data schema 执行。

TODO (Phase 3b): 实现工具注册和执行逻辑
"""
from __future__ import annotations
import logging
from app.core.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)

DATA_QUERY_PARAMS = {
    "type": "object",
    "properties": {
        "sql": {"type": "string", "description": "要执行的 SQL 查询语句 (SELECT only)"},
    },
    "required": ["sql"],
}


async def _data_query(arguments: dict) -> str:
    """执行 SQL 查询并返回结果。
    TODO (Phase 3b): 安全检查 → IsolatedExecutor 执行 → 格式化结果
    """
    raise NotImplementedError("Phase 3b")


def register_data_query(registry: ToolRegistry):
    """注册 data_query 工具。"""
    registry.register_builtin(
        name="data_query",
        description="在用户数据表上执行 SQL 查询。仅支持 SELECT 语句，自动限制结果行数。",
        parameters=DATA_QUERY_PARAMS,
        fn=_data_query,
    )
    logger.info("Registered builtin tool: data_query")
