"""工具注册表 — 聚合 MCP 工具 + 内置工具，生成 OpenAI function calling 格式"""
import logging
from typing import Any, Callable, Coroutine
from pydantic import BaseModel

logger = logging.getLogger(__name__)


class ToolDef(BaseModel):
    """工具定义 (OpenAI function calling 兼容)"""
    name: str
    description: str
    parameters: dict  # JSON Schema
    # 运行时路由信息
    source: str = "builtin"  # "builtin" | "mcp:{server_id}"


class ToolResult(BaseModel):
    """工具执行结果"""
    name: str
    success: bool
    content: str
    error: str | None = None


# 内置工具函数签名: async (arguments: dict) -> str
BuiltinToolFn = Callable[[dict], Coroutine[Any, Any, str]]
# 上下文感知工具签名: async (arguments: dict, context: dict) -> str
ContextToolFn = Callable[[dict, dict], Coroutine[Any, Any, str]]


class ToolRegistry:
    """管理所有可用工具 — 内置 + MCP + 自定义"""

    def __init__(self):
        self._builtin_tools: dict[str, tuple[ToolDef, BuiltinToolFn]] = {}
        self._context_tools: dict[str, tuple[ToolDef, ContextToolFn]] = {}
        self._mcp_tools: dict[str, ToolDef] = {}  # name → ToolDef
        self._custom_tools: dict[str, ToolDef] = {}  # name → ToolDef

    # ======================== 内置工具注册 ========================

    def register_builtin(self, name: str, description: str, parameters: dict, fn: BuiltinToolFn):
        tool_def = ToolDef(name=name, description=description, parameters=parameters, source="builtin")
        self._builtin_tools[name] = (tool_def, fn)
        logger.info(f"Registered builtin tool: {name}")

    def register_context_tool(self, name: str, description: str, parameters: dict, fn: ContextToolFn):
        """注册需要 user/db 上下文的内置工具。"""
        tool_def = ToolDef(name=name, description=description, parameters=parameters, source="builtin")
        self._context_tools[name] = (tool_def, fn)
        logger.info(f"Registered context-aware builtin tool: {name}")

    # ======================== MCP 工具管理 ========================

    def set_mcp_tools(self, server_id: str, tools: list[ToolDef]):
        """设置某个 MCP 服务器的工具列表"""
        # 先清除该 server 旧的工具
        to_remove = [n for n, t in self._mcp_tools.items() if t.source == f"mcp:{server_id}"]
        for n in to_remove:
            del self._mcp_tools[n]
        # 注册新的
        for t in tools:
            t.source = f"mcp:{server_id}"
            self._mcp_tools[t.name] = t
        logger.info(f"Set {len(tools)} MCP tools from server {server_id}")

    def remove_mcp_server_tools(self, server_id: str):
        to_remove = [n for n, t in self._mcp_tools.items() if t.source == f"mcp:{server_id}"]
        for n in to_remove:
            del self._mcp_tools[n]

    # ======================== 自定义工具管理 ========================

    def register_custom(self, name: str, description: str, parameters: dict, tool_id: str):
        tool_def = ToolDef(name=name, description=description, parameters=parameters, source=f"custom:{tool_id}")
        self._custom_tools[name] = tool_def

    def clear_custom_tools(self):
        self._custom_tools.clear()

    def clear_mcp_tools(self):
        self._mcp_tools.clear()

    def clear_user_tools(self):
        """清除所有用户级工具 (MCP + 自定义), 保留内置工具"""
        self._mcp_tools.clear()
        self._custom_tools.clear()

    # ======================== 查询 ========================

    def get_all_tools(self) -> list[ToolDef]:
        """返回所有可用工具定义"""
        tools = [td for td, _ in self._builtin_tools.values()]
        tools.extend(td for td, _ in self._context_tools.values())
        tools.extend(self._mcp_tools.values())
        tools.extend(self._custom_tools.values())
        return tools

    def to_openai_tools(self, enabled_builtins: list[str] | None = None) -> list[dict]:
        """转为 OpenAI function calling 格式, 可过滤内置工具"""
        tools = []
        for t in self.get_all_tools():
            # 过滤被禁用的内置工具
            if t.source == "builtin" and enabled_builtins is not None:
                if t.name not in enabled_builtins:
                    continue
            tools.append({
                "type": "function",
                "function": {
                    "name": t.name,
                    "description": t.description,
                    "parameters": t.parameters,
                },
            })
        return tools

    def get_tool_source(self, tool_name: str) -> str | None:
        """获取工具来源 (builtin / mcp:xxx / custom:xxx)"""
        if tool_name in self._builtin_tools or tool_name in self._context_tools:
            return "builtin"
        if tool_name in self._mcp_tools:
            return self._mcp_tools[tool_name].source
        if tool_name in self._custom_tools:
            return self._custom_tools[tool_name].source
        return None

    async def execute_builtin(self, name: str, arguments: dict, context: dict | None = None) -> ToolResult:
        """执行内置工具。上下文感知工具会收到 context dict (含 user, db, request)。"""
        if name in self._context_tools:
            _, fn = self._context_tools[name]
            try:
                result = await fn(arguments, context or {})
                return ToolResult(name=name, success=True, content=result)
            except Exception as e:
                logger.exception("Context tool %s failed", name)
                return ToolResult(name=name, success=False, content="", error=str(e))

        if name in self._builtin_tools:
            _, fn = self._builtin_tools[name]
            try:
                result = await fn(arguments)
                return ToolResult(name=name, success=True, content=result)
            except Exception as e:
                return ToolResult(name=name, success=False, content="", error=str(e))

        return ToolResult(name=name, success=False, content="", error=f"Unknown builtin tool: {name}")
