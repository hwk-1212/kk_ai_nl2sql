from pydantic import BaseModel, Field
from typing import Literal


class MessageCreate(BaseModel):
    role: Literal["user"] = "user"
    content: str = Field(min_length=1)


class ChatRequest(BaseModel):
    conversation_id: str | None = None  # None = 新建会话
    model: str = "deepseek-chat"
    messages: list[MessageCreate]
    thinking_enabled: bool = False
    kb_ids: list[str] | None = None  # 关联知识库 ID (Phase 5 RAG)


class ConversationCreate(BaseModel):
    title: str = "New Chat"
    model: str = "deepseek-chat"


class ConversationUpdate(BaseModel):
    title: str | None = None
    model: str | None = None


class ConversationResponse(BaseModel):
    id: str
    title: str
    model: str
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


class MessageResponse(BaseModel):
    id: str
    role: str
    content: str
    reasoning_content: str | None = None
    usage: dict | None = None
    metadata: dict | None = None
    created_at: str

    model_config = {"from_attributes": True}


class ConversationDetail(BaseModel):
    id: str
    title: str
    model: str
    created_at: str
    updated_at: str
    messages: list[MessageResponse]

    model_config = {"from_attributes": True}
