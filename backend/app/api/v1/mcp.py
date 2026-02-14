"""MCP Server 管理 API — CRUD + 工具发现 + 工具调用"""
import uuid
import json
import logging
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.mcp_server import MCPServer
from app.schemas.mcp import MCPServerCreate, MCPServerUpdate, MCPServerResponse, MCPImportRequest
from app.core.tools.mcp_client import MCPClient

router = APIRouter(prefix="/mcp", tags=["mcp"])
logger = logging.getLogger(__name__)


def _parse_standard_mcp_config(raw_json: str) -> list[dict]:
    """
    解析标准 MCP 配置 JSON (兼容 Claude Desktop / Cursor / VSCode 等格式)

    支持格式:
    1. { "mcpServers": { "name": { "command": "...", "args": [...], "env": {...} } } }
    2. { "mcpServers": { "name": { "url": "..." } } }
    3. 直接 { "name": { "command": "..." } }  (省略 mcpServers 包裹)
    """
    data = json.loads(raw_json)
    if not isinstance(data, dict):
        raise ValueError("JSON 必须是一个对象")

    # 提取 servers 字典
    servers_dict = data.get("mcpServers") or data.get("mcp_servers") or data.get("servers")
    if not servers_dict:
        # 检查是否直接就是 { "name": { "command/url": ... } }
        first_val = next(iter(data.values()), None) if data else None
        if isinstance(first_val, dict) and ("command" in first_val or "url" in first_val):
            servers_dict = data
        else:
            raise ValueError('找不到 mcpServers 字段，请检查 JSON 格式')

    results = []
    for name, cfg in servers_dict.items():
        if not isinstance(cfg, dict):
            continue

        env = cfg.get("env") or None
        # 过滤空 env
        if env and not any(v for v in env.values()):
            env = None

        if "url" in cfg:
            # HTTP / Streamable HTTP
            results.append({
                "name": name,
                "transport_type": "http",
                "config": cfg["url"],
                "env": env,
            })
        elif "command" in cfg:
            # stdio
            cmd_parts = [cfg["command"]]
            if "args" in cfg and isinstance(cfg["args"], list):
                cmd_parts.extend(str(a) for a in cfg["args"])
            results.append({
                "name": name,
                "transport_type": "stdio",
                "config": " ".join(cmd_parts),
                "env": env,
            })
        else:
            logger.warning(f"MCP import: skip '{name}', no command/url found")

    if not results:
        raise ValueError("未找到有效的 MCP Server 配置")
    return results


def _serialize_server(srv: MCPServer) -> dict:
    return {
        "id": str(srv.id),
        "name": srv.name,
        "transport_type": srv.transport_type,
        "config": srv.config,
        "env": srv.env,
        "enabled": srv.enabled,
        "tools_cache": srv.tools_cache,
        "created_at": srv.created_at.isoformat() if srv.created_at else "",
    }


async def _discover_tools_background(server_id: str, transport_type: str, config: str, env: dict | None = None):
    """后台任务: 连接 MCP Server, 发现工具并缓存"""
    from app.db.session import async_session_maker as async_session_factory
    client = MCPClient(transport_type=transport_type, config=config, timeout=15.0, env=env)
    try:
        tools = await client.list_tools()
        logger.info(f"MCP discover: server={server_id}, found {len(tools)} tools")

        # 更新 DB
        async with async_session_factory() as db:
            async with db.begin():
                result = await db.execute(
                    select(MCPServer).where(MCPServer.id == uuid.UUID(server_id))
                )
                srv = result.scalar_one_or_none()
                if srv:
                    srv.tools_cache = tools
    except Exception as e:
        logger.warning(f"MCP discover failed for server={server_id}: {e}")
    finally:
        await client.close()


@router.get("/servers")
async def list_servers(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """列出当前用户的 MCP Server"""
    result = await db.execute(
        select(MCPServer)
        .where(MCPServer.user_id == current_user.id)
        .order_by(MCPServer.created_at.desc())
    )
    servers = result.scalars().all()
    return [_serialize_server(s) for s in servers]


@router.post("/servers", status_code=201)
async def create_server(
    payload: MCPServerCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """注册新 MCP Server (注册后自动发现工具)"""
    srv = MCPServer(
        user_id=current_user.id,
        name=payload.name,
        transport_type=payload.transport_type,
        config=payload.config,
        env=payload.env if payload.env else None,
    )
    db.add(srv)
    await db.commit()
    await db.refresh(srv)

    # 后台自动发现工具
    background_tasks.add_task(
        _discover_tools_background,
        str(srv.id),
        srv.transport_type,
        srv.config,
        srv.env,
    )

    return _serialize_server(srv)


@router.post("/servers/import", status_code=201)
async def import_servers(
    payload: MCPImportRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """导入标准 MCP JSON 配置 (兼容 Claude Desktop / Cursor 格式)"""
    try:
        parsed = _parse_standard_mcp_config(payload.config_json)
    except (json.JSONDecodeError, ValueError) as e:
        raise HTTPException(400, detail=str(e))

    created = []
    for item in parsed:
        srv = MCPServer(
            user_id=current_user.id,
            name=item["name"],
            transport_type=item["transport_type"],
            config=item["config"],
            env=item.get("env"),
        )
        db.add(srv)
        await db.flush()
        await db.refresh(srv)
        created.append(srv)

        background_tasks.add_task(
            _discover_tools_background,
            str(srv.id),
            srv.transport_type,
            srv.config,
            srv.env,
        )

    await db.commit()
    return [_serialize_server(s) for s in created]


@router.delete("/servers/{server_id}", status_code=204)
async def delete_server(
    server_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除 MCP Server"""
    try:
        uid = uuid.UUID(server_id)
    except ValueError:
        raise HTTPException(400, "Invalid server ID")

    result = await db.execute(
        select(MCPServer).where(MCPServer.id == uid, MCPServer.user_id == current_user.id)
    )
    srv = result.scalar_one_or_none()
    if not srv:
        raise HTTPException(404, "MCP Server not found")

    await db.delete(srv)
    await db.commit()


@router.patch("/servers/{server_id}")
async def update_server(
    server_id: str,
    payload: MCPServerUpdate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """编辑 MCP Server 配置"""
    try:
        uid = uuid.UUID(server_id)
    except ValueError:
        raise HTTPException(400, "Invalid server ID")

    result = await db.execute(
        select(MCPServer).where(MCPServer.id == uid, MCPServer.user_id == current_user.id)
    )
    srv = result.scalar_one_or_none()
    if not srv:
        raise HTTPException(404, "MCP Server not found")

    config_changed = False
    if payload.name is not None:
        srv.name = payload.name
    if payload.transport_type is not None and payload.transport_type != srv.transport_type:
        srv.transport_type = payload.transport_type
        config_changed = True
    if payload.config is not None and payload.config != srv.config:
        srv.config = payload.config
        config_changed = True
    if payload.env is not None:
        srv.env = payload.env if payload.env else None

    await db.commit()
    await db.refresh(srv)

    # 配置变了，重新发现工具
    if config_changed:
        srv.tools_cache = None
        await db.commit()
        background_tasks.add_task(
            _discover_tools_background,
            str(srv.id),
            srv.transport_type,
            srv.config,
            srv.env,
        )

    return _serialize_server(srv)


@router.patch("/servers/{server_id}/toggle")
async def toggle_server(
    server_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """启用/禁用 MCP Server"""
    try:
        uid = uuid.UUID(server_id)
    except ValueError:
        raise HTTPException(400, "Invalid server ID")

    result = await db.execute(
        select(MCPServer).where(MCPServer.id == uid, MCPServer.user_id == current_user.id)
    )
    srv = result.scalar_one_or_none()
    if not srv:
        raise HTTPException(404, "MCP Server not found")

    srv.enabled = not srv.enabled
    await db.commit()
    await db.refresh(srv)
    return _serialize_server(srv)


@router.post("/servers/{server_id}/refresh")
async def refresh_server_tools(
    server_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """手动刷新 MCP Server 工具列表"""
    try:
        uid = uuid.UUID(server_id)
    except ValueError:
        raise HTTPException(400, "Invalid server ID")

    result = await db.execute(
        select(MCPServer).where(MCPServer.id == uid, MCPServer.user_id == current_user.id)
    )
    srv = result.scalar_one_or_none()
    if not srv:
        raise HTTPException(404, "MCP Server not found")

    background_tasks.add_task(
        _discover_tools_background,
        str(srv.id),
        srv.transport_type,
        srv.config,
        srv.env,
    )

    return {"message": "Tool refresh started", "server_id": server_id}


@router.get("/servers/{server_id}/tools")
async def list_server_tools(
    server_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """列出某个 MCP Server 的工具"""
    try:
        uid = uuid.UUID(server_id)
    except ValueError:
        raise HTTPException(400, "Invalid server ID")

    result = await db.execute(
        select(MCPServer).where(MCPServer.id == uid, MCPServer.user_id == current_user.id)
    )
    srv = result.scalar_one_or_none()
    if not srv:
        raise HTTPException(404, "MCP Server not found")

    return srv.tools_cache or []


@router.get("/tools")
async def list_all_tools(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """聚合所有已启用 MCP Server 的工具 + 内置工具"""
    result = await db.execute(
        select(MCPServer).where(MCPServer.user_id == current_user.id, MCPServer.enabled == True)
    )
    servers = result.scalars().all()

    all_tools = []

    # 内置工具
    all_tools.append({
        "name": "web_search",
        "description": "搜索互联网获取最新信息",
        "source": "builtin",
    })

    # MCP 工具
    for srv in servers:
        if srv.tools_cache:
            for tool in srv.tools_cache:
                all_tools.append({
                    **tool,
                    "server_id": str(srv.id),
                    "server_name": srv.name,
                    "source": f"mcp:{srv.id}",
                })
    return all_tools
