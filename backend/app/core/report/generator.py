"""报告生成引擎 — 执行 SQL 查询 + LLM 分析 + 图表推荐，输出结构化 Markdown 报告。"""
from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

if TYPE_CHECKING:
    from app.core.llm.router import LLMRouter
    from app.core.data.isolated_executor import IsolatedSQLExecutor

logger = logging.getLogger(__name__)

REPORT_SYSTEM_PROMPT = """你是专业的数据分析报告撰写者。
根据以下数据查询结果，生成一份结构化的分析报告。

报告要求:
1. 包含概述、关键发现、详细分析、趋势洞察、建议
2. 使用 Markdown 格式
3. 数据引用必须精确
4. 给出可操作的业务建议
5. 语言简洁专业

{template_instructions}

数据查询结果:
{query_results}

请生成报告:"""

GENERATE_MODEL = "deepseek-chat"


class ReportGenerator:
    """AI 报告生成引擎。"""

    def __init__(self, llm_router: "LLMRouter", executor: "IsolatedSQLExecutor"):
        self._llm = llm_router
        self._executor = executor

    async def generate(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        tenant_id: uuid.UUID | None,
        title: str,
        data_config: dict,
        template_content: str | None = None,
    ) -> dict:
        """
        生成报告:
        1. 根据 data_config 执行所有数据查询
        2. 收集查询结果
        3. 调用 LLM 生成 Markdown 报告
        4. 推荐图表
        返回 {"content": str, "charts": list, "sections": dict}
        """
        query_results = await self._execute_queries(db, user_id, tenant_id, data_config)

        if not query_results:
            return {
                "content": f"# {title}\n\n> 未找到可用的数据查询结果，请检查数据配置。",
                "charts": [],
                "sections": {},
            }

        template_instructions = ""
        if template_content:
            template_instructions = f"参考以下报告模板结构:\n{template_content}"

        results_text = self._format_query_results(query_results)

        prompt = REPORT_SYSTEM_PROMPT.format(
            template_instructions=template_instructions,
            query_results=results_text,
        )

        content = await self._call_llm(prompt, title)

        charts = self._recommend_charts(query_results)

        return {
            "content": content,
            "charts": charts,
            "sections": {
                "query_count": len(query_results),
                "total_rows": sum(r.get("row_count", 0) for r in query_results),
                "generated_at": datetime.now(timezone.utc).isoformat(),
            },
        }

    async def generate_from_query(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        tenant_id: uuid.UUID | None,
        sql: str,
        title: str = "查询报告",
    ) -> dict:
        """从单条 SQL 查询生成简报。"""
        schema = self._executor.get_user_schema(tenant_id)
        try:
            result = await self._executor.execute_read(tenant_schema=schema, sql=sql)
            query_results = [{
                "sql": sql,
                "columns": result.columns,
                "rows": result.rows[:100],
                "row_count": result.row_count,
            }]
        except Exception as e:
            return {
                "content": f"# {title}\n\n> SQL 执行失败: {e}",
                "charts": [],
                "sections": {},
            }

        results_text = self._format_query_results(query_results)
        prompt = REPORT_SYSTEM_PROMPT.format(
            template_instructions="",
            query_results=results_text,
        )
        content = await self._call_llm(prompt, title)
        charts = self._recommend_charts(query_results)
        return {"content": content, "charts": charts, "sections": {}}

    # ── internal ────────────────────────────────────────────

    async def _execute_queries(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        tenant_id: uuid.UUID | None,
        data_config: dict,
    ) -> list[dict]:
        """执行 data_config 中定义的所有 SQL 查询。"""
        queries = data_config.get("queries", [])
        if not queries and data_config.get("sql"):
            queries = [{"sql": data_config["sql"], "name": data_config.get("name", "查询")}]

        schema = self._executor.get_user_schema(tenant_id)
        results = []

        for q_def in queries:
            sql = q_def.get("sql", "").strip()
            name = q_def.get("name", "查询")
            if not sql:
                continue

            from app.core.security.sql_checker import SQLSecurityChecker
            checker = SQLSecurityChecker()
            check = checker.check(sql, allow_write=False)
            if not check.is_safe:
                results.append({"name": name, "sql": sql, "error": check.blocked_reason, "columns": [], "rows": [], "row_count": 0})
                continue

            sql = checker.enforce_limit(sql)

            try:
                result = await self._executor.execute_read(tenant_schema=schema, sql=sql)
                results.append({
                    "name": name,
                    "sql": sql,
                    "columns": result.columns,
                    "rows": result.rows[:200],
                    "row_count": result.row_count,
                    "execution_ms": result.execution_ms,
                })
            except Exception as e:
                results.append({"name": name, "sql": sql, "error": str(e), "columns": [], "rows": [], "row_count": 0})

        return results

    @staticmethod
    def _format_query_results(results: list[dict]) -> str:
        parts = []
        for i, r in enumerate(results, 1):
            parts.append(f"### 查询 {i}: {r.get('name', '')}")
            parts.append(f"SQL: `{r.get('sql', '')}`")
            if r.get("error"):
                parts.append(f"错误: {r['error']}")
                continue
            parts.append(f"返回 {r.get('row_count', 0)} 行")
            cols = r.get("columns", [])
            rows = r.get("rows", [])[:20]
            if cols and rows:
                parts.append("| " + " | ".join(str(c) for c in cols) + " |")
                parts.append("|" + "|".join(["---"] * len(cols)) + "|")
                for row in rows:
                    cells = [str(v) if v is not None else "" for v in row]
                    parts.append("| " + " | ".join(cells) + " |")
            parts.append("")
        return "\n".join(parts)

    async def _call_llm(self, prompt: str, title: str) -> str:
        messages = [
            {"role": "system", "content": prompt},
            {"role": "user", "content": f"请生成标题为「{title}」的数据分析报告。"},
        ]
        content_parts: list[str] = []
        try:
            async for chunk in self._llm.stream(
                model_id=GENERATE_MODEL,
                messages=messages,
                thinking_enabled=False,
            ):
                if chunk.type == "content" and chunk.data:
                    content_parts.append(chunk.data)
        except Exception as e:
            logger.error("ReportGenerator LLM call failed: %s", e)
            return f"# {title}\n\n> 报告生成失败: {e}"

        return "".join(content_parts) if content_parts else f"# {title}\n\n> 未生成内容。"

    @staticmethod
    def _recommend_charts(results: list[dict]) -> list[dict]:
        """对查询结果进行简单图表推荐。"""
        charts = []
        for r in results:
            cols = r.get("columns", [])
            rows = r.get("rows", [])
            if len(cols) < 2 or not rows:
                continue

            numeric_cols = []
            category_cols = []
            for ci, col in enumerate(cols):
                sample_vals = [row[ci] for row in rows[:10] if ci < len(row) and row[ci] is not None]
                is_numeric = all(isinstance(v, (int, float)) for v in sample_vals) if sample_vals else False
                if is_numeric:
                    numeric_cols.append(col)
                else:
                    category_cols.append(col)

            chart_type = "table"
            if category_cols and numeric_cols:
                chart_type = "bar"
                first_cat_vals = [str(row[cols.index(category_cols[0])]) for row in rows[:10] if cols.index(category_cols[0]) < len(row)]
                for v in first_cat_vals:
                    if any(c in v for c in ["-", "/", "年", "月", "日", "Q"]):
                        chart_type = "line"
                        break
            elif len(numeric_cols) >= 2:
                chart_type = "scatter"

            charts.append({
                "query_name": r.get("name", ""),
                "chart_type": chart_type,
                "x_column": category_cols[0] if category_cols else cols[0],
                "y_columns": numeric_cols[:3] if numeric_cols else [cols[1]],
            })
        return charts
