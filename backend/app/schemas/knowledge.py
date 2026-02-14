"""知识库 + 文档 Pydantic Schema"""
from pydantic import BaseModel, Field


class KBCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str = ""
    embedding_model: str = "text-embedding-v4"
    embedding_dim: int = 1024
    chunk_size: int = 1000
    chunk_overlap: int = 200


class KBUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class KBResponse(BaseModel):
    id: str
    name: str
    description: str
    embedding_model: str
    embedding_dim: int
    chunk_size: int
    chunk_overlap: int
    doc_count: int
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


class DocumentResponse(BaseModel):
    id: str
    kb_id: str
    filename: str
    file_type: str
    file_size: int
    status: str  # uploading / processing / ready / failed
    chunk_count: int
    error_message: str | None = None
    created_at: str

    model_config = {"from_attributes": True}


class KBDetail(KBResponse):
    documents: list[DocumentResponse]
