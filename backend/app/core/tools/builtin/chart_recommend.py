"""Agent 工具: recommend_chart — 根据查询结果推荐可视化图表类型。

推荐规则:
  1 时间列 + 1 数值列 → line
  1 分类列 + 1 数值列 → bar
  1 分类列 + 1 占比列 → pie
  1 时间列 + N 数值列 → area
  2 数值列             → scatter
  其他                 → table

返回 ChartConfig JSON (与前端 ChartRenderer 兼容)。
"""
from __future__ import annotations

import json
import logging

from app.core.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)

RECOMMEND_CHART_PARAMS = {
    "type": "object",
    "properties": {
        "columns": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "type": {"type": "string"},
                },
            },
            "description": "列信息列表 [{name, type}]",
        },
        "sample_data": {
            "type": "array",
            "items": {"type": "object"},
            "description": "样例数据 (前 5 行), 每行为 {列名: 值}",
        },
        "query_intent": {
            "type": "string",
            "description": "用户查询意图描述 (可选)",
        },
    },
    "required": ["columns", "sample_data"],
}

_TIME_TYPES = {"date", "timestamp", "datetime", "time"}
_NUMERIC_TYPES = {"integer", "float", "bigint", "double precision", "numeric", "real", "int"}
_CATEGORY_TYPES = {"varchar", "text", "string", "char", "character varying"}

COLOR_PALETTE = [
    "#4F46E5", "#06B6D4", "#10B981", "#F59E0B", "#EF4444",
    "#8B5CF6", "#EC4899", "#14B8A6", "#F97316", "#6366F1",
]


def _classify_columns(columns: list[dict]) -> dict:
    time_cols = []
    numeric_cols = []
    category_cols = []
    for col in columns:
        ctype = col.get("type", "varchar").lower()
        name = col.get("name", "")
        if ctype in _TIME_TYPES or "date" in name.lower() or "time" in name.lower():
            time_cols.append(name)
        elif ctype in _NUMERIC_TYPES or ctype.startswith("int") or ctype.startswith("float"):
            numeric_cols.append(name)
        else:
            category_cols.append(name)
    return {"time": time_cols, "numeric": numeric_cols, "category": category_cols}


def _is_proportion(sample_data: list[dict], col_name: str) -> bool:
    """检查数值列是否为占比列 (值加起来接近 100 或 1)。"""
    values = []
    for row in sample_data:
        v = row.get(col_name)
        if v is not None:
            try:
                values.append(float(v))
            except (ValueError, TypeError):
                return False
    if not values:
        return False
    total = sum(values)
    return (0.9 <= total <= 1.1) or (90 <= total <= 110)


def _recommend(columns: list[dict], sample_data: list[dict], query_intent: str = "") -> dict:
    """核心推荐逻辑，返回 ChartConfig。"""
    classified = _classify_columns(columns)
    time_cols = classified["time"]
    numeric_cols = classified["numeric"]
    category_cols = classified["category"]

    intent_lower = query_intent.lower() if query_intent else ""

    if "饼" in intent_lower or "pie" in intent_lower or "占比" in intent_lower or "比例" in intent_lower:
        if category_cols and numeric_cols:
            return _build_config("pie", category_cols[0], [numeric_cols[0]], sample_data)

    if "折线" in intent_lower or "line" in intent_lower or "趋势" in intent_lower:
        x = time_cols[0] if time_cols else (category_cols[0] if category_cols else None)
        if x and numeric_cols:
            return _build_config("line", x, numeric_cols[:5], sample_data)

    if "散点" in intent_lower or "scatter" in intent_lower:
        if len(numeric_cols) >= 2:
            return _build_config("scatter", numeric_cols[0], [numeric_cols[1]], sample_data)

    if len(time_cols) == 1 and len(numeric_cols) == 1:
        return _build_config("line", time_cols[0], numeric_cols, sample_data)

    if len(time_cols) == 1 and len(numeric_cols) > 1:
        return _build_config("area", time_cols[0], numeric_cols[:5], sample_data)

    if len(category_cols) == 1 and len(numeric_cols) == 1:
        if _is_proportion(sample_data, numeric_cols[0]):
            return _build_config("pie", category_cols[0], [numeric_cols[0]], sample_data)
        return _build_config("bar", category_cols[0], [numeric_cols[0]], sample_data)

    if len(category_cols) == 1 and len(numeric_cols) > 1:
        return _build_config("bar", category_cols[0], numeric_cols[:5], sample_data)

    if len(numeric_cols) == 2 and not time_cols and not category_cols:
        return _build_config("scatter", numeric_cols[0], [numeric_cols[1]], sample_data)

    if category_cols and numeric_cols:
        return _build_config("bar", category_cols[0], numeric_cols[:3], sample_data)

    return _build_config("table", None, [], sample_data, columns)


def _build_config(
    chart_type: str,
    x_field: str | None,
    y_fields: list[str],
    sample_data: list[dict],
    columns: list[dict] | None = None,
) -> dict:
    """构建前端兼容的 ChartConfig。"""
    config: dict = {
        "type": chart_type,
        "title": "",
        "data": sample_data,
    }

    if chart_type in ("bar", "line", "area", "scatter"):
        config["xField"] = x_field
        config["yFields"] = y_fields
        config["series"] = [
            {"name": f, "dataKey": f, "color": COLOR_PALETTE[i % len(COLOR_PALETTE)]}
            for i, f in enumerate(y_fields)
        ]

    elif chart_type == "pie":
        config["nameField"] = x_field
        config["valueField"] = y_fields[0] if y_fields else ""
        config["series"] = [{"name": x_field, "dataKey": y_fields[0] if y_fields else ""}]

    elif chart_type == "table":
        if columns:
            config["columns"] = [col.get("name", "") for col in columns]
        else:
            if sample_data:
                config["columns"] = list(sample_data[0].keys())

    return config


async def _recommend_chart(arguments: dict, context: dict) -> str:
    """推荐图表类型并返回 ChartConfig JSON。"""
    columns = arguments.get("columns", [])
    sample_data = arguments.get("sample_data", [])
    query_intent = arguments.get("query_intent", "")

    if not columns:
        return "错误: 请提供列信息 (columns)。"

    config = _recommend(columns, sample_data, query_intent)
    return json.dumps(config, ensure_ascii=False, default=str)


async def _recommend_chart_simple(arguments: dict) -> str:
    """兼容无上下文的调用方式。"""
    return await _recommend_chart(arguments, {})


def register_chart_recommend(registry: ToolRegistry):
    """注册 recommend_chart 工具。"""
    registry.register_context_tool(
        name="recommend_chart",
        description=(
            "根据 SQL 查询结果的列类型和数据特征，推荐合适的可视化图表类型和配置。"
            "返回前端可直接渲染的 ChartConfig JSON。"
        ),
        parameters=RECOMMEND_CHART_PARAMS,
        fn=_recommend_chart,
    )
