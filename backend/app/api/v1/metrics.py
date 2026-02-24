"""指标管理 API — 指标 / 维度 / 业务术语 CRUD + 语义检索"""
import uuid
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.metric import Metric
from app.models.dimension import Dimension
from app.models.business_term import BusinessTerm
from app.schemas.metric import (
    MetricCreate, MetricUpdate, MetricResponse,
    DimensionCreate, DimensionUpdate, DimensionResponse,
    BusinessTermCreate, BusinessTermUpdate, BusinessTermResponse,
    MetricSearchResponse,
)

router = APIRouter(prefix="/metrics", tags=["metrics"])
logger = logging.getLogger(__name__)


# ========== Metric Search (must be before /{metric_id} to avoid route conflict) ==========

@router.get("/search", response_model=list[MetricSearchResponse])
async def search_metrics(
    q: str = Query(..., min_length=1),
    top_k: int = Query(5, ge=1, le=20),
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """语义检索指标（供 Agent 使用）"""
    semantic_layer = getattr(request.app.state, "semantic_layer", None)
    if not semantic_layer:
        raise HTTPException(status_code=500, detail="Semantic layer not initialized")

    results = await semantic_layer.search(
        query=q,
        user_id=str(current_user.id),
        tenant_id=str(current_user.tenant_id) if current_user.tenant_id else None,
        top_k=top_k,
    )

    return [
        MetricSearchResponse(
            metric_id=r.metric_id,
            name=r.name,
            english_name=r.english_name,
            formula=r.formula,
            description=r.description,
            dimensions=r.dimensions,
            filters=r.filters,
            source_table=r.source_table,
            category=r.category,
            score=r.score,
        )
        for r in results
    ]


# ========== Metric CRUD ==========

@router.get("/", response_model=list[MetricResponse])
async def list_metrics(
    category: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """列出当前用户的所有指标（分页，分类筛选）"""
    query = select(Metric).where(Metric.user_id == current_user.id)
    if category:
        query = query.where(Metric.category == category)
    if status:
        query = query.where(Metric.status == status)
    query = query.order_by(Metric.created_at.desc()).offset(skip).limit(limit)

    result = await db.execute(query)
    metrics = result.scalars().all()
    return [MetricResponse.model_validate(m) for m in metrics]


@router.post("/", response_model=MetricResponse, status_code=201)
async def create_metric(
    data: MetricCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """创建指标（同步写入 Milvus）"""
    metric = Metric(
        user_id=current_user.id,
        tenant_id=current_user.tenant_id,
        **data.model_dump(),
    )
    db.add(metric)
    await db.commit()
    await db.refresh(metric)

    semantic_layer = getattr(request.app.state, "semantic_layer", None)
    if semantic_layer:
        try:
            await semantic_layer.index_metric(metric)
        except Exception as e:
            logger.warning(f"Failed to index metric to Milvus: {e}")

    return MetricResponse.model_validate(metric)


@router.get("/{metric_id}", response_model=MetricResponse)
async def get_metric(
    metric_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取指标详情"""
    result = await db.execute(
        select(Metric).where(Metric.id == metric_id, Metric.user_id == current_user.id)
    )
    metric = result.scalar_one_or_none()
    if not metric:
        raise HTTPException(status_code=404, detail="Metric not found")
    return MetricResponse.model_validate(metric)


@router.put("/{metric_id}", response_model=MetricResponse)
async def update_metric(
    metric_id: uuid.UUID,
    data: MetricUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新指标（更新 Milvus）"""
    result = await db.execute(
        select(Metric).where(Metric.id == metric_id, Metric.user_id == current_user.id)
    )
    metric = result.scalar_one_or_none()
    if not metric:
        raise HTTPException(status_code=404, detail="Metric not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(metric, key, value)

    await db.commit()
    await db.refresh(metric)

    semantic_layer = getattr(request.app.state, "semantic_layer", None)
    if semantic_layer:
        try:
            await semantic_layer.remove_metric(str(metric_id))
            await semantic_layer.index_metric(metric)
        except Exception as e:
            logger.warning(f"Failed to update metric in Milvus: {e}")

    return MetricResponse.model_validate(metric)


@router.delete("/{metric_id}", status_code=204)
async def delete_metric(
    metric_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除指标（删除 Milvus）"""
    result = await db.execute(
        select(Metric).where(Metric.id == metric_id, Metric.user_id == current_user.id)
    )
    metric = result.scalar_one_or_none()
    if not metric:
        raise HTTPException(status_code=404, detail="Metric not found")

    await db.delete(metric)
    await db.commit()

    semantic_layer = getattr(request.app.state, "semantic_layer", None)
    if semantic_layer:
        try:
            await semantic_layer.remove_metric(str(metric_id))
        except Exception as e:
            logger.warning(f"Failed to remove metric from Milvus: {e}")


# ========== Dimension CRUD ==========

@router.get("/dimensions", response_model=list[DimensionResponse])
async def list_dimensions(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """列出维度"""
    result = await db.execute(
        select(Dimension)
        .where(Dimension.user_id == current_user.id)
        .order_by(Dimension.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    dimensions = result.scalars().all()
    return [DimensionResponse.model_validate(d) for d in dimensions]


@router.post("/dimensions", response_model=DimensionResponse, status_code=201)
async def create_dimension(
    data: DimensionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """创建维度"""
    dimension = Dimension(
        user_id=current_user.id,
        tenant_id=current_user.tenant_id,
        **data.model_dump(),
    )
    db.add(dimension)
    await db.commit()
    await db.refresh(dimension)
    return DimensionResponse.model_validate(dimension)


@router.put("/dimensions/{dimension_id}", response_model=DimensionResponse)
async def update_dimension(
    dimension_id: uuid.UUID,
    data: DimensionUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新维度"""
    result = await db.execute(
        select(Dimension).where(Dimension.id == dimension_id, Dimension.user_id == current_user.id)
    )
    dimension = result.scalar_one_or_none()
    if not dimension:
        raise HTTPException(status_code=404, detail="Dimension not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(dimension, key, value)

    await db.commit()
    await db.refresh(dimension)
    return DimensionResponse.model_validate(dimension)


@router.delete("/dimensions/{dimension_id}", status_code=204)
async def delete_dimension(
    dimension_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除维度"""
    result = await db.execute(
        select(Dimension).where(Dimension.id == dimension_id, Dimension.user_id == current_user.id)
    )
    dimension = result.scalar_one_or_none()
    if not dimension:
        raise HTTPException(status_code=404, detail="Dimension not found")

    await db.delete(dimension)
    await db.commit()


# ========== BusinessTerm CRUD ==========

@router.get("/terms", response_model=list[BusinessTermResponse])
async def list_terms(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """列出业务术语"""
    result = await db.execute(
        select(BusinessTerm)
        .where(BusinessTerm.user_id == current_user.id)
        .order_by(BusinessTerm.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    terms = result.scalars().all()
    return [BusinessTermResponse.model_validate(t) for t in terms]


@router.post("/terms", response_model=BusinessTermResponse, status_code=201)
async def create_term(
    data: BusinessTermCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """创建业务术语（同步写入 Milvus）"""
    term = BusinessTerm(
        user_id=current_user.id,
        tenant_id=current_user.tenant_id,
        **data.model_dump(),
    )
    db.add(term)
    await db.commit()
    await db.refresh(term)

    # 如果关联到指标，同步写入 Milvus
    if term.term_type == "metric":
        result = await db.execute(
            select(Metric).where(Metric.english_name == term.canonical_name, Metric.user_id == current_user.id)
        )
        metric = result.scalar_one_or_none()
        if metric:
            semantic_layer = getattr(request.app.state, "semantic_layer", None)
            if semantic_layer:
                try:
                    await semantic_layer.index_term(term, metric)
                except Exception as e:
                    logger.warning(f"Failed to index term to Milvus: {e}")

    return BusinessTermResponse.model_validate(term)


@router.put("/terms/{term_id}", response_model=BusinessTermResponse)
async def update_term(
    term_id: uuid.UUID,
    data: BusinessTermUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新业务术语"""
    result = await db.execute(
        select(BusinessTerm).where(BusinessTerm.id == term_id, BusinessTerm.user_id == current_user.id)
    )
    term = result.scalar_one_or_none()
    if not term:
        raise HTTPException(status_code=404, detail="Term not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(term, key, value)

    await db.commit()
    await db.refresh(term)
    return BusinessTermResponse.model_validate(term)


@router.delete("/terms/{term_id}", status_code=204)
async def delete_term(
    term_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除业务术语"""
    result = await db.execute(
        select(BusinessTerm).where(BusinessTerm.id == term_id, BusinessTerm.user_id == current_user.id)
    )
    term = result.scalar_one_or_none()
    if not term:
        raise HTTPException(status_code=404, detail="Term not found")

    await db.delete(term)
    await db.commit()
