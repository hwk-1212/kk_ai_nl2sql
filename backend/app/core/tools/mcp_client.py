"""MCP 客户端 — 支持 stdio / Streamable HTTP 传输, JSON-RPC 2.0"""
import asyncio
import json
import logging
import uuid
from typing import Any

import httpx

logger = logging.getLogger(__name__)

# JSON-RPC 2.0 helpers
def _jsonrpc_request(method: str, params: dict | None = None) -> dict:
    return {
        "jsonrpc": "2.0",
        "id": str(uuid.uuid4()),
        "method": method,
        **({"params": params} if params else {}),
    }


def _jsonrpc_notification(method: str, params: dict | None = None) -> dict:
    return {
        "jsonrpc": "2.0",
        "method": method,
        **({"params": params} if params else {}),
    }


class MCPClient:
    """
    轻量级 MCP 客户端
    - HTTP 模式: MCP Streamable HTTP (JSON-RPC over HTTP with SSE support)
    - stdio 模式: 启动子进程, 通过 stdin/stdout 通信
    """

    def __init__(self, transport_type: str, config: str, timeout: float = 30.0, env: dict | None = None):
        self.transport_type = transport_type
        self.config = config
        self.timeout = timeout
        self.env = env  # 额外环境变量 (stdio 模式)
        # HTTP session
        self._session_id: str | None = None
        self._http_initialized: bool = False
        # stdio 进程
        self._process: asyncio.subprocess.Process | None = None

    # ======================== Streamable HTTP transport ========================

    async def _http_init(self):
        """MCP Streamable HTTP: initialize 握手"""
        if self._http_initialized:
            return

        payload = _jsonrpc_request("initialize", {
            "protocolVersion": "2025-03-26",
            "capabilities": {},
            "clientInfo": {"name": "kk-gpt-mcp-client", "version": "1.0.0"},
        })

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(
                self.config,
                json=payload,
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json, text/event-stream",
                },
            )
            resp.raise_for_status()

            # 提取 session ID
            self._session_id = resp.headers.get("mcp-session-id")
            logger.info(f"MCP HTTP init: session={self._session_id}, status={resp.status_code}")

            # 解析 initialize 响应
            body = self._parse_response(resp)
            if body and "error" in body:
                raise RuntimeError(f"MCP init error: {body['error']}")

            # 发送 initialized 通知
            notif = _jsonrpc_notification("notifications/initialized")
            headers = {
                "Content-Type": "application/json",
                "Accept": "application/json, text/event-stream",
            }
            if self._session_id:
                headers["Mcp-Session-Id"] = self._session_id
            await client.post(self.config, json=notif, headers=headers)

        self._http_initialized = True

    def _parse_response(self, resp: httpx.Response) -> dict | None:
        """解析响应: 支持 JSON 和 SSE 格式"""
        content_type = resp.headers.get("content-type", "")

        if "text/event-stream" in content_type:
            # SSE 格式: 解析 data 行
            for line in resp.text.split("\n"):
                line = line.strip()
                if line.startswith("data:"):
                    data_str = line[5:].strip()
                    if data_str:
                        try:
                            return json.loads(data_str)
                        except json.JSONDecodeError:
                            continue
            return None
        else:
            # JSON 格式
            return resp.json()

    async def _http_call(self, method: str, params: dict | None = None) -> Any:
        """Streamable HTTP: 发送 JSON-RPC 请求"""
        await self._http_init()

        payload = _jsonrpc_request(method, params)
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
        }
        if self._session_id:
            headers["Mcp-Session-Id"] = self._session_id

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(self.config, json=payload, headers=headers)
            resp.raise_for_status()

            body = self._parse_response(resp)
            if not body:
                return None
            if "error" in body:
                raise RuntimeError(f"MCP JSON-RPC error: {body['error']}")
            return body.get("result")

    # ======================== stdio transport ========================

    async def _ensure_process(self):
        if self._process is None or self._process.returncode is not None:
            import os, shlex
            parts = shlex.split(self.config)
            cmd, args = parts[0], parts[1:]
            # 合并系统 env + 用户自定义 env
            proc_env = {**os.environ}
            if self.env:
                proc_env.update(self.env)
            self._process = await asyncio.create_subprocess_exec(
                cmd, *args,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=proc_env,
            )
            # initialize
            await self._stdio_call("initialize", {
                "protocolVersion": "2025-03-26",
                "capabilities": {},
                "clientInfo": {"name": "kk-gpt-mcp-client", "version": "1.0.0"},
            })
            # initialized 通知
            notif = _jsonrpc_notification("notifications/initialized")
            self._process.stdin.write((json.dumps(notif) + "\n").encode())
            await self._process.stdin.drain()

    async def _stdio_call(self, method: str, params: dict | None = None) -> Any:
        await self._ensure_process()
        payload = _jsonrpc_request(method, params)
        line = json.dumps(payload) + "\n"
        self._process.stdin.write(line.encode())
        await self._process.stdin.drain()

        while True:
            raw = await asyncio.wait_for(self._process.stdout.readline(), timeout=self.timeout)
            if not raw:
                raise RuntimeError("MCP stdio: process closed stdout")
            try:
                body = json.loads(raw.decode())
            except json.JSONDecodeError:
                continue
            if "id" not in body:
                continue
            if "error" in body:
                raise RuntimeError(f"MCP JSON-RPC error: {body['error']}")
            return body.get("result")

    # ======================== 统一调用 ========================

    async def _call(self, method: str, params: dict | None = None) -> Any:
        if self.transport_type in ("http", "sse"):
            return await self._http_call(method, params)
        elif self.transport_type == "stdio":
            return await self._stdio_call(method, params)
        else:
            raise ValueError(f"Unsupported transport: {self.transport_type}")

    # ======================== MCP 协议方法 ========================

    async def list_tools(self) -> list[dict]:
        """调用 tools/list, 返回工具定义列表"""
        result = await self._call("tools/list")
        return result.get("tools", []) if result else []

    async def call_tool(self, name: str, arguments: dict | None = None) -> str:
        """调用 tools/call, 返回文本结果"""
        result = await self._call("tools/call", {"name": name, "arguments": arguments or {}})
        if not result:
            return ""
        # MCP tool result: { content: [{type: "text", text: "..."}, ...] }
        contents = result.get("content", [])
        texts = []
        for c in contents:
            if isinstance(c, dict) and c.get("type") == "text":
                texts.append(c["text"])
            elif isinstance(c, str):
                texts.append(c)
        return "\n".join(texts) if texts else json.dumps(result)

    async def close(self):
        """关闭连接"""
        if self._process and self._process.returncode is None:
            self._process.stdin.close()
            try:
                self._process.terminate()
                await asyncio.wait_for(self._process.wait(), timeout=5)
            except (ProcessLookupError, asyncio.TimeoutError):
                self._process.kill()
            self._process = None
        self._http_initialized = False
        self._session_id = None
