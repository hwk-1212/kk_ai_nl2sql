"""数据管理 API — 数据源上传 / 列表 / 删除 / 表预览 / Schema 查询。

端点:
  POST   /upload              上传文件 (multipart)
  GET    /sources              列出数据源
  GET    /sources/{id}         数据源详情 (含表列表)
  DELETE /sources/{id}         删除数据源 (级联)
  GET    /tables               列出所有表
  GET    /tables/{id}          表详情
  GET    /tables/{id}/data     分页查询表数据
  PUT    /tables/{id}          更新表信息
  DELETE /tables/{id}          删除单表
  GET    /tables/{id}/schema   获取表结构 (供 Agent 使用)
"""
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.data import (
    DataSourceResponse,
    DataSourceDetailResponse,
    DataSourceListResponse,
    DataTableResponse,
    DataTableListResponse,
    TableDataResponse,
    TableSchemaResponse,
    UpdateTableRequest,
)

router = APIRouter(prefix="/data", tags=["data"])


def _get_data_manager(request: Request):
    dm = getattr(request.app.state, "data_manager", None)
    if dm is None:
        raise HTTPException(status_code=503, detail="DataManager not initialized")
    return dm


# ======================== Upload ========================

@router.post("/upload", response_model=DataSourceResponse, status_code=status.HTTP_201_CREATED)
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """上传文件创建数据源 (Excel / CSV / SQLite)。"""
    dm = _get_data_manager(request)

    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")

    try:
        ds = await dm.upload_and_parse(
            db=db,
            user_id=user.id,
            tenant_id=user.tenant_id,
            filename=file.filename,
            content=content,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if ds.status == "error":
        raise HTTPException(status_code=422, detail=ds.error_message or "Parse failed")

    return ds


# ======================== Sources CRUD ========================

@router.get("/sources", response_model=DataSourceListResponse)
async def list_sources(
    request: Request,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """列出当前用户的所有数据源。"""
    dm = _get_data_manager(request)
    items, total = await dm.list_sources(db, user.id, offset, limit)
    return DataSourceListResponse(items=items, total=total)


@router.get("/sources/{source_id}", response_model=DataSourceDetailResponse)
async def get_source(
    source_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """获取数据源详情 (含所属表列表)。"""
    dm = _get_data_manager(request)
    ds = await dm.get_source(db, user.id, source_id)
    if not ds:
        raise HTTPException(status_code=404, detail="DataSource not found")

    tables, _ = await dm.list_tables(db, user.id, offset=0, limit=100)
    source_tables = [DataTableResponse.model_validate(t) for t in tables if t.data_source_id == ds.id]

    return DataSourceDetailResponse(
        id=ds.id,
        name=ds.name,
        source_type=ds.source_type,
        file_name=ds.file_name,
        file_size=ds.file_size,
        file_type=ds.file_type,
        status=ds.status,
        table_count=ds.table_count,
        error_message=ds.error_message,
        created_at=ds.created_at,
        updated_at=ds.updated_at,
        tables=source_tables,
        minio_path=ds.minio_path,
    )


@router.delete("/sources/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_source(
    source_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """删除数据源 (级联删除所有 PG 表 + 记录)。"""
    dm = _get_data_manager(request)
    ok = await dm.delete_source(db, user.id, source_id)
    if not ok:
        raise HTTPException(status_code=404, detail="DataSource not found")


# ======================== Tables CRUD ========================

@router.get("/tables", response_model=DataTableListResponse)
async def list_tables(
    request: Request,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """列出当前用户的所有数据表。"""
    dm = _get_data_manager(request)
    items, total = await dm.list_tables(db, user.id, offset, limit)
    return DataTableListResponse(items=items, total=total)


@router.get("/tables/{table_id}", response_model=DataTableResponse)
async def get_table(
    table_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """获取数据表详情。"""
    dm = _get_data_manager(request)
    tbl = await dm.get_table(db, user.id, table_id)
    if not tbl:
        raise HTTPException(status_code=404, detail="DataTable not found")
    return tbl


@router.get("/tables/{table_id}/data", response_model=TableDataResponse)
async def get_table_data(
    table_id: uuid.UUID,
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """分页查询表数据。"""
    dm = _get_data_manager(request)
    result = await dm.get_table_data(db, user.id, table_id, page, page_size)
    if result is None:
        raise HTTPException(status_code=404, detail="DataTable not found")
    return result


@router.put("/tables/{table_id}", response_model=DataTableResponse)
async def update_table(
    table_id: uuid.UUID,
    body: UpdateTableRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """更新表信息 (display_name / description)。"""
    dm = _get_data_manager(request)
    tbl = await dm.update_table(
        db, user.id, table_id,
        display_name=body.display_name,
        description=body.description,
    )
    if not tbl:
        raise HTTPException(status_code=404, detail="DataTable not found")
    return tbl


@router.delete("/tables/{table_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_table(
    table_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """删除单张数据表 (PG 表 + 记录)。"""
    dm = _get_data_manager(request)
    ok = await dm.delete_table(db, user.id, table_id)
    if not ok:
        raise HTTPException(status_code=404, detail="DataTable not found")


@router.get("/tables/{table_id}/schema", response_model=TableSchemaResponse)
async def get_table_schema(
    table_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """获取表结构 (列名/类型/行数，供 Agent 工具使用)。"""
    dm = _get_data_manager(request)
    result = await dm.get_table_schema(db, user.id, table_id)
    if result is None:
        raise HTTPException(status_code=404, detail="DataTable not found")
    return result
