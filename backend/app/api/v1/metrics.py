"""指标管理 API — 指标 / 维度 / 业务术语 CRUD。

TODO (Phase 3d): 实现完整 CRUD 逻辑
"""
from fastapi import APIRouter

router = APIRouter(prefix="/metrics", tags=["metrics"])


@router.get("/")
async def list_metrics():
    """列出当前用户的所有指标。"""
    return {"status": "not_implemented"}


@router.post("/")
async def create_metric():
    """创建指标。"""
    return {"status": "not_implemented"}


@router.get("/dimensions")
async def list_dimensions():
    """列出维度。"""
    return {"status": "not_implemented"}


@router.post("/dimensions")
async def create_dimension():
    """创建维度。"""
    return {"status": "not_implemented"}


@router.get("/terms")
async def list_terms():
    """列出业务术语。"""
    return {"status": "not_implemented"}


@router.post("/terms")
async def create_term():
    """创建业务术语。"""
    return {"status": "not_implemented"}
