"""Agent 工具: inspect_tables + inspect_table_schema

inspect_tables     — 列出用户可用的所有数据表及摘要
inspect_table_schema — 获取指定表的完整结构 + 示例数据
"""
from __future__ import annotations

import json
import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.tools.registry import ToolRegistry
from app.models.data_table import DataTable
from app.models.user import User

logger = logging.getLogger(__name__)

# ======================== inspect_tables ========================

INSPECT_TABLES_PARAMS = {
    "type": "object",
    "properties": {
        "keyword": {
            "type": "string",
            "description": "可选的过滤关键词，按表名或描述搜索",
        },
    },
}


async def _inspect_tables(arguments: dict, context: dict) -> str:
    """列出用户的所有数据表。"""
    user: User = context["user"]
    db: AsyncSession = context["db"]
    keyword = arguments.get("keyword", "").strip()

    q = select(DataTable).where(DataTable.user_id == user.id).order_by(DataTable.created_at.desc())
    result = await db.execute(q)
    tables = result.scalars().all()

    if keyword:
        kw_lower = keyword.lower()
        tables = [
            t for t in tables
            if kw_lower in (t.display_name or t.name).lower()
            or (t.description and kw_lower in t.description.lower())
        ]

    if not tables:
        return "当前没有可用的数据表。请先上传数据文件。"

    lines = [f"共 {len(tables)} 张数据表:\n"]
    for t in tables:
        name = t.display_name or t.name
        cols = t.column_count
        rows = t.row_count
        desc = f" — {t.description}" if t.description else ""
        lines.append(f"- **{name}** (pg: `{t.pg_table_name}`) | {cols} 列 | {rows} 行{desc}")

    return "\n".join(lines)


# ======================== inspect_table_schema ========================

INSPECT_TABLE_SCHEMA_PARAMS = {
    "type": "object",
    "properties": {
        "table_name": {
            "type": "string",
            "description": "表名 (pg_table_name 或 display_name)",
        },
    },
    "required": ["table_name"],
}


async def _inspect_table_schema(arguments: dict, context: dict) -> str:
    """返回列名、类型、注释、前 3 行示例数据。"""
    user: User = context["user"]
    db: AsyncSession = context["db"]
    request = context.get("request")

    table_name = arguments.get("table_name", "").strip()
    if not table_name:
        return "请提供表名 (table_name)。"

    q = select(DataTable).where(DataTable.user_id == user.id)
    result = await db.execute(q)
    tables = result.scalars().all()

    target = None
    name_lower = table_name.lower()
    for t in tables:
        if t.pg_table_name.lower() == name_lower or (t.display_name or t.name).lower() == name_lower:
            target = t
            break

    if not target:
        available = ", ".join((t.display_name or t.name) for t in tables[:10])
        return f"未找到表 '{table_name}'。可用的表: {available}"

    columns_meta = target.columns_meta or []
    lines = [f"## 表: {target.display_name or target.name}"]
    lines.append(f"- PG 表名: `{target.pg_schema}.{target.pg_table_name}`")
    lines.append(f"- 行数: {target.row_count}")
    lines.append(f"\n### 列结构\n")
    lines.append("| 列名 | 类型 | 可空 | 备注 |")
    lines.append("|------|------|------|------|")

    for col in columns_meta:
        name = col.get("name", "")
        ctype = col.get("type", "varchar")
        nullable = "是" if col.get("nullable", True) else "否"
        comment = col.get("comment") or ""
        lines.append(f"| {name} | {ctype} | {nullable} | {comment} |")

    if request:
        dm = getattr(request.app.state, "data_manager", None)
        if dm:
            data = await dm.get_table_data(db, user.id, target.id, page=1, page_size=3)
            if data and data.get("rows"):
                lines.append(f"\n### 示例数据 (前 {len(data['rows'])} 行)\n")
                cols = data["columns"]
                lines.append("| " + " | ".join(cols) + " |")
                lines.append("|" + "|".join(["------"] * len(cols)) + "|")
                for row in data["rows"]:
                    cells = [str(v) if v is not None else "NULL" for v in row]
                    lines.append("| " + " | ".join(cells) + " |")

    return "\n".join(lines)


# ======================== 注册 ========================

def register_schema_tools(registry: ToolRegistry):
    """注册 inspect_tables 和 inspect_table_schema 工具。"""
    registry.register_context_tool(
        name="inspect_tables",
        description="列出用户上传的所有数据表，返回表名、列数、行数摘要。可按关键词过滤。",
        parameters=INSPECT_TABLES_PARAMS,
        fn=_inspect_tables,
    )
    registry.register_context_tool(
        name="inspect_table_schema",
        description="获取指定数据表的完整结构信息，包含列名、类型、可空性以及前 3 行示例数据。",
        parameters=INSPECT_TABLE_SCHEMA_PARAMS,
        fn=_inspect_table_schema,
    )
