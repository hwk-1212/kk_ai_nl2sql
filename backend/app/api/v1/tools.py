"""工具管理 API — 内置工具 + 自定义工具 CRUD"""
import uuid
import json
import re
import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.db.redis import redis_client
from app.core.deps import get_current_user
from app.models.user import User
from app.models.custom_tool import CustomTool

router = APIRouter(prefix="/tools", tags=["tools"])
logger = logging.getLogger(__name__)


# ======================== Schemas ========================

class CustomToolCreate(BaseModel):
    name: str
    description: str = ""
    tool_type: str = "http"
    parameters: dict = {"type": "object", "properties": {}, "required": []}
    http_url: str = ""
    http_method: str = "POST"
    http_headers: dict = {}
    http_body_template: str = ""


class CustomToolUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    parameters: dict | None = None
    http_url: str | None = None
    http_method: str | None = None
    http_headers: dict | None = None
    http_body_template: str | None = None
    enabled: bool | None = None


# ======================== Serializers ========================

def _serialize_custom_tool(t: CustomTool) -> dict:
    return {
        "id": str(t.id),
        "name": t.name,
        "description": t.description,
        "tool_type": t.tool_type,
        "parameters": t.parameters,
        "http_url": t.http_url,
        "http_method": t.http_method,
        "http_headers": t.http_headers,
        "http_body_template": t.http_body_template,
        "enabled": t.enabled,
        "source": "custom",
        "created_at": t.created_at.isoformat() if t.created_at else "",
    }


def _serialize_builtin_tool(name: str, desc: str, params: dict) -> dict:
    return {
        "id": f"builtin:{name}",
        "name": name,
        "description": desc,
        "tool_type": "builtin",
        "parameters": params,
        "enabled": True,
        "source": "builtin",
    }


# ======================== 内置工具开关 (Redis) ========================

def _builtin_disabled_key(user_id: str) -> str:
    return f"user:{user_id}:builtin_tools_disabled"


async def _get_disabled_builtins(user_id: str) -> set[str]:
    """获取用户禁用的内置工具名称集合"""
    members = await redis_client.smembers(_builtin_disabled_key(user_id))
    return set(members) if members else set()


async def get_user_enabled_builtins(user_id: str, registry) -> list[str]:
    """获取用户启用的内置工具名称列表 (chat.py 用)"""
    disabled = await _get_disabled_builtins(user_id)
    all_builtin = list(registry._builtin_tools.keys()) + list(registry._context_tools.keys())
    return [name for name in all_builtin if name not in disabled]


# ======================== 内置工具 ========================

@router.get("/builtin")
async def list_builtin_tools(
    raw_request: Request,
    current_user: User = Depends(get_current_user),
):
    """列出所有内置工具 (含启用状态)"""
    registry = getattr(raw_request.app.state, "tool_registry", None)
    if not registry:
        return []

    disabled = await _get_disabled_builtins(str(current_user.id))
    result = []
    for td, _ in registry._builtin_tools.values():
        item = _serialize_builtin_tool(td.name, td.description, td.parameters)
        item["enabled"] = td.name not in disabled
        result.append(item)
    for td, _ in registry._context_tools.values():
        item = _serialize_builtin_tool(td.name, td.description, td.parameters)
        item["enabled"] = td.name not in disabled
        result.append(item)
    return result


@router.patch("/builtin/{tool_name}/toggle")
async def toggle_builtin_tool(
    tool_name: str,
    raw_request: Request,
    current_user: User = Depends(get_current_user),
):
    """启用/禁用内置工具"""
    registry = getattr(raw_request.app.state, "tool_registry", None)
    if not registry or tool_name not in registry._builtin_tools:
        raise HTTPException(404, f"Builtin tool not found: {tool_name}")

    key = _builtin_disabled_key(str(current_user.id))
    is_disabled = await redis_client.sismember(key, tool_name)

    if is_disabled:
        await redis_client.srem(key, tool_name)
        enabled = True
    else:
        await redis_client.sadd(key, tool_name)
        enabled = False

    td, _ = registry._builtin_tools[tool_name]
    item = _serialize_builtin_tool(td.name, td.description, td.parameters)
    item["enabled"] = enabled
    return item


# ======================== 自定义工具 CRUD ========================

@router.get("")
async def list_tools(
    raw_request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """列出所有工具 (内置 + 自定义)"""
    tools = []

    # 内置工具 (含启用状态)
    registry = getattr(raw_request.app.state, "tool_registry", None)
    if registry:
        disabled = await _get_disabled_builtins(str(current_user.id))
        for td, _ in registry._builtin_tools.values():
            item = _serialize_builtin_tool(td.name, td.description, td.parameters)
            item["enabled"] = td.name not in disabled
            tools.append(item)

    # 自定义工具
    result = await db.execute(
        select(CustomTool)
        .where(CustomTool.user_id == current_user.id)
        .order_by(CustomTool.created_at.desc())
    )
    custom_tools = result.scalars().all()
    for t in custom_tools:
        tools.append(_serialize_custom_tool(t))

    return tools


@router.post("", status_code=201)
async def create_tool(
    payload: CustomToolCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """创建自定义工具"""
    if not payload.name.strip():
        raise HTTPException(400, "Tool name is required")
    if payload.tool_type == "http" and not payload.http_url.strip():
        raise HTTPException(400, "HTTP URL is required for http tools")

    tool = CustomTool(
        user_id=current_user.id,
        name=payload.name.strip(),
        description=payload.description.strip(),
        tool_type=payload.tool_type,
        parameters=payload.parameters,
        http_url=payload.http_url.strip(),
        http_method=payload.http_method.upper(),
        http_headers=payload.http_headers,
        http_body_template=payload.http_body_template,
    )
    db.add(tool)
    await db.commit()
    await db.refresh(tool)
    return _serialize_custom_tool(tool)


@router.patch("/{tool_id}")
async def update_tool(
    tool_id: str,
    payload: CustomToolUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新自定义工具"""
    try:
        uid = uuid.UUID(tool_id)
    except ValueError:
        raise HTTPException(400, "Invalid tool ID")

    result = await db.execute(
        select(CustomTool).where(CustomTool.id == uid, CustomTool.user_id == current_user.id)
    )
    tool = result.scalar_one_or_none()
    if not tool:
        raise HTTPException(404, "Tool not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(tool, field, value)

    await db.commit()
    await db.refresh(tool)
    return _serialize_custom_tool(tool)


@router.delete("/{tool_id}", status_code=204)
async def delete_tool(
    tool_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除自定义工具"""
    try:
        uid = uuid.UUID(tool_id)
    except ValueError:
        raise HTTPException(400, "Invalid tool ID")

    result = await db.execute(
        select(CustomTool).where(CustomTool.id == uid, CustomTool.user_id == current_user.id)
    )
    tool = result.scalar_one_or_none()
    if not tool:
        raise HTTPException(404, "Tool not found")

    await db.delete(tool)
    await db.commit()


@router.patch("/{tool_id}/toggle")
async def toggle_tool(
    tool_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """启用/禁用自定义工具"""
    try:
        uid = uuid.UUID(tool_id)
    except ValueError:
        raise HTTPException(400, "Invalid tool ID")

    result = await db.execute(
        select(CustomTool).where(CustomTool.id == uid, CustomTool.user_id == current_user.id)
    )
    tool = result.scalar_one_or_none()
    if not tool:
        raise HTTPException(404, "Tool not found")

    tool.enabled = not tool.enabled
    await db.commit()
    await db.refresh(tool)
    return _serialize_custom_tool(tool)


@router.post("/{tool_id}/test")
async def test_tool(
    tool_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """测试自定义工具 (用空参数调用)"""
    try:
        uid = uuid.UUID(tool_id)
    except ValueError:
        raise HTTPException(400, "Invalid tool ID")

    result = await db.execute(
        select(CustomTool).where(CustomTool.id == uid, CustomTool.user_id == current_user.id)
    )
    tool = result.scalar_one_or_none()
    if not tool:
        raise HTTPException(404, "Tool not found")

    from app.core.tools.executor import execute_http_tool
    try:
        result_text = await execute_http_tool(tool, {})
        return {"success": True, "result": result_text[:2000]}
    except Exception as e:
        return {"success": False, "error": str(e)}
