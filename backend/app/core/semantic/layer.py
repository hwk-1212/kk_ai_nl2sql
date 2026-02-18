"""语义层检索服务 — 将用户自然语言中的业务术语映射到 SQL 表达式。

维护 指标 / 维度 / 业务术语 三类语义对象，供 NL2SQL 引擎使用。

TODO (Phase 3d): 实现完整检索与注入逻辑
"""
from __future__ import annotations
import uuid
import logging

logger = logging.getLogger(__name__)


class SemanticLayer:
    """提供业务语义信息给 NL2SQL Prompt 构造器。"""

    def __init__(self, db_session):
        self.db = db_session

    async def get_context(self, user_id: uuid.UUID, query: str) -> dict:
        """根据用户查询语句检索相关的指标、维度、业务术语。
        返回结构: {metrics: [...], dimensions: [...], terms: [...]}
        TODO (Phase 3d): 基于关键词或向量相似度检索
        """
        raise NotImplementedError("Phase 3d")

    async def resolve_term(self, user_id: uuid.UUID, term: str) -> str | None:
        """将业务术语解析为标准名称或 SQL 表达式。
        TODO (Phase 3d): 查询 BusinessTerm 表
        """
        raise NotImplementedError("Phase 3d")

    async def build_schema_prompt(self, user_id: uuid.UUID, table_ids: list[uuid.UUID] | None = None) -> str:
        """构建含列注释、指标定义的 Schema Prompt 文本。
        TODO (Phase 3d): 整合 DataTable + Metric + Dimension 信息
        """
        raise NotImplementedError("Phase 3d")
