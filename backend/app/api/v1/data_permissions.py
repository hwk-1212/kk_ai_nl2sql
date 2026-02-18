"""数据权限管理 API — DataRole CRUD / 表列行权限配置。

TODO (Phase 3e): 实现完整 RBAC 数据权限逻辑
"""
from fastapi import APIRouter

router = APIRouter(prefix="/data-permissions", tags=["data-permissions"])


@router.get("/roles")
async def list_roles():
    """列出数据角色。"""
    return {"status": "not_implemented"}


@router.post("/roles")
async def create_role():
    """创建数据角色。"""
    return {"status": "not_implemented"}


@router.get("/roles/{role_id}")
async def get_role(role_id: str):
    """获取角色详情及权限配置。"""
    return {"status": "not_implemented"}


@router.post("/roles/{role_id}/assign")
async def assign_role(role_id: str):
    """将角色分配给用户。"""
    return {"status": "not_implemented"}
