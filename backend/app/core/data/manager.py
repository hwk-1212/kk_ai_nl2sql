"""数据管理核心服务 — 负责数据源 CRUD、文件解析调度、表注册到 user_data schema。

TODO (Phase 3a): 实现全部方法
"""
from __future__ import annotations
import uuid
import logging

logger = logging.getLogger(__name__)


class DataManager:
    """协调文件解析、user_data schema 写入、DataSource / DataTable 持久化。"""

    def __init__(self, db_session, minio_client=None):
        self.db = db_session
        self.minio = minio_client

    async def upload_file(
        self,
        user_id: uuid.UUID,
        filename: str,
        content: bytes,
        source_type: str = "upload",
    ) -> dict:
        """上传文件并触发解析流程，返回 DataSource 信息。
        TODO (Phase 3a): 调用 parsers.py 解析 → 写入 user_data schema → 创建 ORM 记录
        """
        raise NotImplementedError("Phase 3a")

    async def list_sources(self, user_id: uuid.UUID) -> list[dict]:
        """列出用户的所有数据源。
        TODO (Phase 3a): 查询 DataSource ORM
        """
        raise NotImplementedError("Phase 3a")

    async def delete_source(self, user_id: uuid.UUID, source_id: uuid.UUID) -> None:
        """删除数据源及对应 user_data schema 中的表。
        TODO (Phase 3a): DROP TABLE + 删除 ORM 记录
        """
        raise NotImplementedError("Phase 3a")

    async def preview_table(
        self, user_id: uuid.UUID, table_id: uuid.UUID, limit: int = 50
    ) -> dict:
        """预览表数据，返回 columns + rows。
        TODO (Phase 3a): 通过 IsolatedExecutor 执行 SELECT ... LIMIT
        """
        raise NotImplementedError("Phase 3a")
