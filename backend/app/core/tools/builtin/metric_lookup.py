"""指标语义检索工具 — lookup_metrics"""
import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.user import User
    from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

TOOL_DEFINITION = {
    "name": "lookup_metrics",
    "description": "根据用户查询语义检索匹配的业务指标。返回指标名称、计算公式、维度和过滤条件，帮助生成精确的SQL。",
    "parameters": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "搜索查询，如'销售额'、'用户增长率'、'订单转化'"
            }
        },
        "required": ["query"]
    }
}


async def _lookup_metrics(
    arguments: dict,
    context: dict,
) -> str:
    """
    1. 调用 SemanticLayer.search(query, user_id, tenant_id)
    2. 格式化匹配结果
    3. 返回: 指标列表 (name, formula, dimensions, filters, source_table)
    """
    query = arguments.get("query", "").strip()
    if not query:
        return "错误: 查询参数不能为空"

    user: "User" = context.get("user")
    db: "AsyncSession" = context.get("db")
    request = context.get("request")

    if not user:
        return "错误: 用户上下文缺失"

    if not request:
        return "错误: 请求上下文缺失"

    semantic_layer = getattr(request.app.state, "semantic_layer", None)
    if not semantic_layer:
        return "错误: 语义层服务未初始化"

    try:
        results = await semantic_layer.search(
            query=query,
            user_id=str(user.id),
            tenant_id=str(user.tenant_id) if user.tenant_id else None,
            top_k=5,
        )

        if not results:
            return f"未找到与 '{query}' 相关的指标。请尝试其他关键词或创建新指标。"

        lines = [f"找到 {len(results)} 个相关指标:\n"]
        for idx, r in enumerate(results, 1):
            lines.append(f"{idx}. **{r.name}** ({r.english_name})")
            lines.append(f"   - 公式: {r.formula}")
            if r.description:
                lines.append(f"   - 说明: {r.description}")
            if r.dimensions:
                lines.append(f"   - 维度: {', '.join(r.dimensions)}")
            if r.filters:
                lines.append(f"   - 过滤条件: {', '.join(r.filters)}")
            lines.append(f"   - 数据表: {r.source_table}")
            lines.append(f"   - 相似度: {r.score:.3f}\n")

        return "\n".join(lines)

    except Exception as e:
        logger.exception(f"lookup_metrics failed: {e}")
        return f"检索指标时出错: {str(e)}"


def register_lookup_metrics(tool_registry):
    """注册 lookup_metrics 工具"""
    from app.core.tools.registry import ContextToolFn

    tool_registry.register_context_tool(
        name=TOOL_DEFINITION["name"],
        description=TOOL_DEFINITION["description"],
        parameters=TOOL_DEFINITION["parameters"],
        fn=_lookup_metrics,
    )
    logger.info("Registered context-aware builtin tool: lookup_metrics")
