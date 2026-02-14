"""内置 web_search 工具 — 使用 DuckDuckGo 搜索"""
import logging
import json
from app.core.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)

WEB_SEARCH_PARAMS = {
    "type": "object",
    "properties": {
        "query": {
            "type": "string",
            "description": "搜索关键词",
        },
        "max_results": {
            "type": "integer",
            "description": "最大返回结果数, 默认 5",
            "default": 5,
        },
    },
    "required": ["query"],
}


async def _web_search(arguments: dict) -> str:
    """执行 DuckDuckGo 搜索"""
    query = arguments.get("query", "")
    max_results = arguments.get("max_results", 5)

    if not query:
        return "Error: query is required"

    try:
        from duckduckgo_search import DDGS

        results = []
        with DDGS() as ddgs:
            for r in ddgs.text(query, max_results=max_results):
                results.append({
                    "title": r.get("title", ""),
                    "url": r.get("href", ""),
                    "snippet": r.get("body", ""),
                })

        if not results:
            return f"No results found for: {query}"

        return json.dumps(results, ensure_ascii=False, indent=2)

    except ImportError:
        return "Error: duckduckgo-search package not installed"
    except Exception as e:
        logger.error(f"Web search error: {e}")
        return f"Search error: {str(e)}"


def register_web_search(registry: ToolRegistry):
    """注册 web_search 工具到注册表"""
    registry.register_builtin(
        name="web_search",
        description="搜索互联网获取最新信息。当用户询问实时信息、新闻、或你不确定的事实时使用此工具。",
        parameters=WEB_SEARCH_PARAMS,
        fn=_web_search,
    )
    logger.info("Registered builtin tool: web_search")
