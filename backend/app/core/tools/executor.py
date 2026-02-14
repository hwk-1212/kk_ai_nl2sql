"""自定义工具执行器 — HTTP webhook 调用"""
import json
import re
import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)


async def execute_http_tool(tool: Any, arguments: dict, timeout: float = 30.0) -> str:
    """
    执行 HTTP 类型的自定义工具

    Args:
        tool: CustomTool 实例
        arguments: LLM 传入的参数
        timeout: HTTP 超时
    Returns:
        响应文本
    """
    url = tool.http_url
    method = (tool.http_method or "POST").upper()
    headers = dict(tool.http_headers or {})

    # 构建请求体
    if tool.http_body_template:
        # 模板模式: 替换 {{key}} 占位符
        body_str = tool.http_body_template
        for key, value in arguments.items():
            placeholder = "{{" + key + "}}"
            if isinstance(value, str):
                body_str = body_str.replace(placeholder, value)
            else:
                body_str = body_str.replace(placeholder, json.dumps(value, ensure_ascii=False))
        # 尝试解析为 JSON
        try:
            body = json.loads(body_str)
        except json.JSONDecodeError:
            body = body_str
    else:
        # 默认: 直接发送 arguments 作为 JSON body
        body = arguments

    # URL 中的 {{key}} 替换
    for key, value in arguments.items():
        placeholder = "{{" + key + "}}"
        if isinstance(value, str):
            url = url.replace(placeholder, value)
        else:
            url = url.replace(placeholder, str(value))

    logger.info(f"HTTP tool call: {method} {url}")

    async with httpx.AsyncClient(timeout=timeout) as client:
        if method == "GET":
            resp = await client.get(url, headers=headers, params=arguments if not tool.http_body_template else None)
        elif method == "POST":
            if isinstance(body, dict):
                if "Content-Type" not in headers:
                    headers["Content-Type"] = "application/json"
                resp = await client.post(url, json=body, headers=headers)
            else:
                resp = await client.post(url, content=str(body), headers=headers)
        elif method == "PUT":
            resp = await client.put(url, json=body if isinstance(body, dict) else None, headers=headers)
        elif method == "DELETE":
            resp = await client.delete(url, headers=headers)
        else:
            raise ValueError(f"Unsupported HTTP method: {method}")

        resp.raise_for_status()

        # 尝试返回 JSON, 否则返回文本
        content_type = resp.headers.get("content-type", "")
        if "json" in content_type:
            try:
                return json.dumps(resp.json(), ensure_ascii=False, indent=2)
            except Exception:
                pass
        return resp.text[:4000]
