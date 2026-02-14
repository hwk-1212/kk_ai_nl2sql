"""MCP Server Pydantic Schema"""
from pydantic import BaseModel, Field


class MCPServerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    transport_type: str = Field(pattern="^(stdio|sse|http)$")
    config: str = Field(min_length=1, max_length=2000)
    env: dict[str, str] | None = None


class MCPServerResponse(BaseModel):
    id: str
    name: str
    transport_type: str
    config: str
    env: dict[str, str] | None = None
    enabled: bool
    tools_cache: dict | None = None
    created_at: str

    model_config = {"from_attributes": True}


class MCPServerUpdate(BaseModel):
    name: str | None = None
    transport_type: str | None = Field(default=None, pattern="^(stdio|sse|http)$")
    config: str | None = None
    env: dict[str, str] | None = None


class MCPImportRequest(BaseModel):
    """标准 MCP JSON 配置导入 — 兼容 Claude Desktop / Cursor 格式"""
    config_json: str = Field(min_length=2, max_length=10000)


class MCPToolDef(BaseModel):
    name: str
    description: str
    input_schema: dict
    server_id: str
    server_name: str
