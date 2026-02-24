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

import asyncio
import io
import json
import logging
import uuid
from functools import partial

from app.core.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)

_MINIO_BUCKET = "charts"

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
            "description": "样例数据: [{列名:值},...] 或 [[v1,v2],[v1,v2]]",
        },
        "rows": {
            "type": "array",
            "description": "若 sample_data 未提供，可用 rows (二维数组) 配合 columns",
        },
        "query_intent": {
            "type": "string",
            "description": "用户查询意图描述 (可选)",
        },
    },
    "required": ["columns"],
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


def _rows_to_objects(columns: list, rows: list) -> list[dict]:
    """将 [[v1,v2],[v1,v2]] 转为 [{col1:v1,col2:v2}, ...]。"""
    if not columns or not rows:
        return []
    col_names = [c.get("name", c) if isinstance(c, dict) else str(c) for c in columns]
    return [dict(zip(col_names, row)) for row in rows]


def _render_chart_png(config: dict) -> bytes | None:
    """用 matplotlib (Agg) 将 ChartConfig 渲染为 PNG bytes，供上传 MinIO。"""
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        import matplotlib.font_manager as fm

        # 尝试使用系统中文字体，失败则用默认字体（labels 可能显示方块，但不崩溃）
        _try_set_cjk_font()

        chart_type = config.get("type", "table")
        data: list[dict] = config.get("data", [])
        title: str = config.get("title", "")
        x_field: str | None = config.get("xField") or config.get("nameField")
        y_fields: list[str] = config.get("yFields") or (
            [config["valueField"]] if config.get("valueField") else []
        )

        if not data or chart_type == "table":
            return None

        palette = COLOR_PALETTE
        fig, ax = plt.subplots(figsize=(10, 5), dpi=130)
        fig.patch.set_facecolor("white")
        ax.set_facecolor("#f8fafc")
        ax.spines["top"].set_visible(False)
        ax.spines["right"].set_visible(False)
        ax.spines["left"].set_color("#e2e8f0")
        ax.spines["bottom"].set_color("#e2e8f0")
        ax.tick_params(colors="#94a3b8", labelsize=10)

        x_values = [str(row.get(x_field, "")) for row in data] if x_field else list(range(len(data)))

        if chart_type in ("bar",):
            width = max(0.15, min(0.6, 0.6 / max(len(y_fields), 1)))
            offsets = [i * width - (len(y_fields) - 1) * width / 2 for i in range(len(y_fields))]
            x_pos = list(range(len(x_values)))
            for i, yf in enumerate(y_fields):
                y_values = [_safe_float(row.get(yf)) for row in data]
                bars = ax.bar([p + offsets[i] for p in x_pos], y_values,
                              width=width, color=palette[i % len(palette)],
                              alpha=0.88, label=yf, zorder=3)
                for bar in bars:
                    h = bar.get_height()
                    if h > 0:
                        ax.text(bar.get_x() + bar.get_width() / 2, h + 0.01 * max(1, h),
                                f"{h:g}", ha="center", va="bottom", fontsize=8, color="#64748b")
            ax.set_xticks(x_pos)
            ax.set_xticklabels(x_values, rotation=30 if len(x_values) > 5 else 0, ha="right", fontsize=9)
            ax.set_axisbelow(True)
            ax.grid(axis="y", color="#e2e8f0", linewidth=0.8)
            ax.legend(fontsize=9, framealpha=0.8)

        elif chart_type == "line":
            for i, yf in enumerate(y_fields):
                y_values = [_safe_float(row.get(yf)) for row in data]
                ax.plot(x_values, y_values, color=palette[i % len(palette)],
                        marker="o", markersize=5, linewidth=2, label=yf, zorder=3)
            ax.grid(color="#e2e8f0", linewidth=0.8)
            ax.legend(fontsize=9, framealpha=0.8)

        elif chart_type == "area":
            for i, yf in enumerate(y_fields):
                y_values = [_safe_float(row.get(yf)) for row in data]
                ax.plot(x_values, y_values, color=palette[i % len(palette)],
                        linewidth=2, label=yf)
                ax.fill_between(x_values, y_values, alpha=0.15, color=palette[i % len(palette)])
            ax.grid(color="#e2e8f0", linewidth=0.8)
            ax.legend(fontsize=9, framealpha=0.8)

        elif chart_type == "pie":
            name_field = x_field or (list(data[0].keys())[0] if data else "name")
            val_field = y_fields[0] if y_fields else (list(data[0].keys())[-1] if data else "value")
            labels = [str(row.get(name_field, "")) for row in data]
            values = [_safe_float(row.get(val_field)) for row in data]
            wedges, texts, autotexts = ax.pie(
                values, labels=labels,
                colors=palette[:len(values)],
                autopct="%1.1f%%", startangle=90,
                wedgeprops={"edgecolor": "white", "linewidth": 1.5},
                textprops={"fontsize": 9},
            )
            for at in autotexts:
                at.set_fontsize(8)
                at.set_color("white")

        elif chart_type == "scatter" and len(y_fields) >= 1:
            y_values = [_safe_float(row.get(y_fields[0])) for row in data]
            x_num = [_safe_float(row.get(x_field, i)) if x_field else i for i, row in enumerate(data)]
            ax.scatter(x_num, y_values, color=palette[0], alpha=0.75, s=60, zorder=3)
            ax.grid(color="#e2e8f0", linewidth=0.8)

        if title:
            ax.set_title(title, fontsize=13, fontweight="bold", color="#1e293b", pad=12)

        plt.tight_layout()
        buf = io.BytesIO()
        plt.savefig(buf, format="png", bbox_inches="tight", facecolor="white")
        plt.close(fig)
        buf.seek(0)
        return buf.read()
    except Exception as exc:
        logger.warning("Chart PNG render failed: %s", exc)
        return None


def _try_set_cjk_font() -> None:
    """尝试设置 CJK 字体，避免中文乱码（找不到字体时静默跳过）。"""
    import matplotlib.pyplot as plt
    candidates = [
        "WenQuanYi Micro Hei", "Noto Sans CJK SC", "SimHei",
        "PingFang SC", "Microsoft YaHei", "Arial Unicode MS",
    ]
    import matplotlib.font_manager as fm
    available = {f.name for f in fm.fontManager.ttflist}
    for name in candidates:
        if name in available:
            plt.rcParams["font.sans-serif"] = [name]
            plt.rcParams["axes.unicode_minus"] = False
            return


def _safe_float(v: object) -> float:
    try:
        return float(v)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return 0.0


async def _upload_png_to_minio(png_bytes: bytes) -> str | None:
    """将 PNG bytes 上传到 MinIO，返回公开访问 URL。"""
    try:
        from app.db.minio_client import minio_client
        from app.config import get_settings
        import io as _io

        settings = get_settings()
        bucket = _MINIO_BUCKET

        # 确保 bucket 存在
        loop = asyncio.get_event_loop()
        def _ensure_bucket():
            if not minio_client.bucket_exists(bucket):
                minio_client.make_bucket(bucket)
        await loop.run_in_executor(None, _ensure_bucket)

        object_name = f"chart_{uuid.uuid4().hex}.png"
        data_stream = _io.BytesIO(png_bytes)

        def _put():
            minio_client.put_object(
                bucket, object_name, data_stream, length=len(png_bytes),
                content_type="image/png",
            )

        await loop.run_in_executor(None, _put)

        endpoint = settings.minio_endpoint.rstrip("/")
        scheme = "https" if settings.minio_secure else "http"
        return f"{scheme}://{endpoint}/{bucket}/{object_name}"
    except Exception as exc:
        logger.warning("MinIO chart upload failed: %s", exc)
        return None


async def _recommend_chart(arguments: dict, context: dict) -> str:
    """推荐图表类型并返回 ChartConfig JSON（含 MinIO 图片地址）。"""
    columns = arguments.get("columns", [])
    sample_data = arguments.get("sample_data", [])
    rows = arguments.get("rows", [])  # LLM 可能传 rows 而非 sample_data
    query_intent = arguments.get("query_intent", "")

    if not columns:
        return "错误: 请提供列信息 (columns)。"

    # 若 sample_data 是 [[...],[...]] 或传了 rows，转为 [{col:val}, ...]
    if sample_data and isinstance(sample_data[0], (list, tuple)):
        sample_data = _rows_to_objects(columns, sample_data)
    elif rows and columns:
        sample_data = _rows_to_objects(columns, rows)
    elif not sample_data:
        sample_data = []

    config = _recommend(columns, sample_data, query_intent)

    # 渲染为 PNG 并上传 MinIO
    loop = asyncio.get_event_loop()
    png_bytes = await loop.run_in_executor(None, partial(_render_chart_png, config))
    if png_bytes:
        image_url = await _upload_png_to_minio(png_bytes)
        if image_url:
            config["image_url"] = image_url

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
