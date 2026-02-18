"""Agent 工具: 图表推荐 — 根据查询结果推荐最适合的可视化图表类型。

TODO (Phase 3b): 实现工具注册和执行逻辑
"""
from __future__ import annotations
import logging
from app.core.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)

CHART_RECOMMEND_PARAMS = {
    "type": "object",
    "properties": {
        "columns": {
            "type": "array",
            "items": {"type": "string"},
            "description": "查询结果的列名列表",
        },
        "sample_data": {
            "type": "string",
            "description": "前几行数据的 JSON 字符串 (可选)",
        },
    },
    "required": ["columns"],
}


async def _chart_recommend(arguments: dict) -> str:
    """分析数据结构，推荐合适的图表类型。
    TODO (Phase 3b): 根据列类型和数据分布推荐 bar/line/pie/table 等
    """
    raise NotImplementedError("Phase 3b")


def register_chart_recommend(registry: ToolRegistry):
    registry.register_builtin(
        name="chart_recommend",
        description="分析查询结果的列和数据特征，推荐合适的可视化图表类型 (柱状图、折线图、饼图等)。",
        parameters=CHART_RECOMMEND_PARAMS,
        fn=_chart_recommend,
    )
    logger.info("Registered builtin tool: chart_recommend")
