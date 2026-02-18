"""数据管理 API — 数据源上传 / 列表 / 删除 / 表预览。

TODO (Phase 3a): 实现完整 CRUD 逻辑
"""
from fastapi import APIRouter

router = APIRouter(prefix="/data", tags=["data"])


@router.get("/sources")
async def list_sources():
    """列出当前用户的所有数据源。"""
    return {"status": "not_implemented"}


@router.post("/upload")
async def upload_file():
    """上传文件创建数据源。"""
    return {"status": "not_implemented"}


@router.get("/sources/{source_id}")
async def get_source(source_id: str):
    """获取数据源详情。"""
    return {"status": "not_implemented"}


@router.delete("/sources/{source_id}")
async def delete_source(source_id: str):
    """删除数据源。"""
    return {"status": "not_implemented"}


@router.get("/sources/{source_id}/tables")
async def list_tables(source_id: str):
    """列出数据源中的表。"""
    return {"status": "not_implemented"}


@router.get("/tables/{table_id}/preview")
async def preview_table(table_id: str):
    """预览表数据。"""
    return {"status": "not_implemented"}
