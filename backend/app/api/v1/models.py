"""Models API — 列出可用模型"""
from fastapi import APIRouter
from app.core.llm.router import llm_router

router = APIRouter(tags=["models"])


@router.get("/models")
async def list_models():
    """返回所有可用的 LLM 模型列表"""
    models = llm_router.list_all_models()
    return {
        "models": [m.model_dump() for m in models],
    }
