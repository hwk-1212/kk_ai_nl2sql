"""Agent 工具: 指标检索 — 查找用户定义的业务指标和计算公式。

TODO (Phase 3b): 实现工具注册和执行逻辑
"""
from __future__ import annotations
import logging
from app.core.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)

METRIC_LOOKUP_PARAMS = {
    "type": "object",
    "properties": {
        "keyword": {"type": "string", "description": "搜索关键词 (指标名称或描述)"},
    },
    "required": ["keyword"],
}


async def _metric_lookup(arguments: dict) -> str:
    """检索匹配的业务指标。
    TODO (Phase 3b): 查询 Metric 表 + SemanticLayer
    """
    raise NotImplementedError("Phase 3b")


def register_metric_lookup(registry: ToolRegistry):
    registry.register_builtin(
        name="metric_lookup",
        description="搜索用户定义的业务指标，返回指标名称、计算公式和关联表。",
        parameters=METRIC_LOOKUP_PARAMS,
        fn=_metric_lookup,
    )
    logger.info("Registered builtin tool: metric_lookup")
