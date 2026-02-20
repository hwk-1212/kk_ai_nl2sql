"""数据权限管理 API — DataRole CRUD / 表列行权限配置"""
import uuid
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.data_permission import (
    DataRole, DataRoleAssignment, TablePermission, ColumnPermission, RowFilter,
)
from app.models.data_table import DataTable

router = APIRouter(prefix="/data-permissions", tags=["data-permissions"])
logger = logging.getLogger(__name__)


# ========== DataRole CRUD ==========

@router.get("/roles")
async def list_roles(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """列出租户下数据角色"""
    if not current_user.tenant_id:
        return []
    result = await db.execute(
        select(DataRole).where(DataRole.tenant_id == current_user.tenant_id)
    )
    roles = result.scalars().all()
    return [{"id": str(r.id), "name": r.name, "description": r.description, "is_default": r.is_default} for r in roles]


@router.post("/roles")
async def create_role(
    name: str,
    description: Optional[str] = None,
    is_default: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """创建角色"""
    if not current_user.tenant_id:
        raise HTTPException(status_code=403, detail="Only tenant users can create roles")
    role = DataRole(
        tenant_id=current_user.tenant_id,
        name=name,
        description=description,
        is_default=is_default,
    )
    db.add(role)
    await db.commit()
    await db.refresh(role)
    return {"id": str(role.id), "name": role.name, "description": role.description, "is_default": role.is_default}


@router.put("/roles/{role_id}")
async def update_role(
    role_id: uuid.UUID,
    name: Optional[str] = None,
    description: Optional[str] = None,
    is_default: Optional[bool] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新角色"""
    result = await db.execute(
        select(DataRole).where(
            DataRole.id == role_id,
            DataRole.tenant_id == current_user.tenant_id if current_user.tenant_id else None,
        )
    )
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    if name:
        role.name = name
    if description is not None:
        role.description = description
    if is_default is not None:
        role.is_default = is_default
    await db.commit()
    await db.refresh(role)
    return {"id": str(role.id), "name": role.name, "description": role.description, "is_default": role.is_default}


@router.delete("/roles/{role_id}", status_code=204)
async def delete_role(
    role_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除角色"""
    result = await db.execute(
        select(DataRole).where(
            DataRole.id == role_id,
            DataRole.tenant_id == current_user.tenant_id if current_user.tenant_id else None,
        )
    )
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    await db.delete(role)
    await db.commit()


@router.post("/roles/{role_id}/assign/{user_id}", status_code=201)
async def assign_role(
    role_id: uuid.UUID,
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """给用户分配角色"""
    # 检查角色是否存在
    result = await db.execute(
        select(DataRole).where(
            DataRole.id == role_id,
            DataRole.tenant_id == current_user.tenant_id if current_user.tenant_id else None,
        )
    )
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    # 检查是否已分配
    result = await db.execute(
        select(DataRoleAssignment).where(
            DataRoleAssignment.data_role_id == role_id,
            DataRoleAssignment.user_id == user_id,
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Role already assigned")

    assignment = DataRoleAssignment(
        user_id=user_id,
        data_role_id=role_id,
        assigned_by=current_user.id,
    )
    db.add(assignment)
    await db.commit()
    return {"user_id": str(user_id), "role_id": str(role_id)}


@router.delete("/roles/{role_id}/assign/{user_id}", status_code=204)
async def unassign_role(
    role_id: uuid.UUID,
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """移除用户角色"""
    result = await db.execute(
        select(DataRoleAssignment).where(
            DataRoleAssignment.data_role_id == role_id,
            DataRoleAssignment.user_id == user_id,
        )
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    await db.delete(assignment)
    await db.commit()


@router.put("/roles/{role_id}/table-permissions")
async def set_table_permissions(
    role_id: uuid.UUID,
    table_id: uuid.UUID,
    permission: str,  # "read" | "write" | "admin"
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """设置表级权限"""
    if permission not in ["read", "write", "admin"]:
        raise HTTPException(status_code=400, detail="Invalid permission")

    result = await db.execute(
        select(TablePermission).where(
            TablePermission.data_role_id == role_id,
            TablePermission.data_table_id == table_id,
        )
    )
    perm = result.scalar_one_or_none()
    if perm:
        perm.permission = permission
    else:
        perm = TablePermission(
            data_role_id=role_id,
            data_table_id=table_id,
            permission=permission,
        )
        db.add(perm)
    await db.commit()
    return {"role_id": str(role_id), "table_id": str(table_id), "permission": permission}


@router.put("/roles/{role_id}/column-permissions")
async def set_column_permissions(
    role_id: uuid.UUID,
    table_id: uuid.UUID,
    column_name: str,
    visibility: str,  # "visible" | "masked" | "hidden"
    masking_rule: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """设置列级权限"""
    if visibility not in ["visible", "masked", "hidden"]:
        raise HTTPException(status_code=400, detail="Invalid visibility")

    result = await db.execute(
        select(ColumnPermission).where(
            ColumnPermission.data_role_id == role_id,
            ColumnPermission.data_table_id == table_id,
            ColumnPermission.column_name == column_name,
        )
    )
    perm = result.scalar_one_or_none()
    if perm:
        perm.visibility = visibility
        perm.masking_rule = masking_rule
    else:
        perm = ColumnPermission(
            data_role_id=role_id,
            data_table_id=table_id,
            column_name=column_name,
            visibility=visibility,
            masking_rule=masking_rule,
        )
        db.add(perm)
    await db.commit()
    return {"role_id": str(role_id), "table_id": str(table_id), "column_name": column_name, "visibility": visibility}


@router.put("/roles/{role_id}/row-filters")
async def set_row_filters(
    role_id: uuid.UUID,
    table_id: uuid.UUID,
    filter_expression: str,
    description: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """设置行级过滤"""
    result = await db.execute(
        select(RowFilter).where(
            RowFilter.data_role_id == role_id,
            RowFilter.data_table_id == table_id,
        )
    )
    row_filter = result.scalar_one_or_none()
    if row_filter:
        row_filter.filter_expression = filter_expression
        if description is not None:
            row_filter.description = description
    else:
        row_filter = RowFilter(
            data_role_id=role_id,
            data_table_id=table_id,
            filter_expression=filter_expression,
            description=description,
        )
        db.add(row_filter)
    await db.commit()
    return {"role_id": str(role_id), "table_id": str(table_id), "filter_expression": filter_expression}
