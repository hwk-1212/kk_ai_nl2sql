import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.api.v1 import health
from app.api.v1 import auth, conversations, chat, models as models_api
from app.api.v1 import knowledge, mcp as mcp_api, tools as tools_api
from app.api.v1 import admin as admin_api
from app.api.v1 import data as data_api, metrics as metrics_api, reports as reports_api, data_permissions as data_perm_api
from app.core.llm.router import llm_router
from app.core.llm.deepseek import DeepSeekProvider
from app.core.llm.qwen import QwenProvider
from app.core.memory.memos_client import MemosClient
from app.core.memory.manager import MemoryManager
from app.core.rag.embedder import Embedder
from app.core.rag.vector_store import VectorStore
from app.core.rag.document_processor import DocumentProcessor
from app.core.rag.retriever import RAGRetriever
from app.core.rag.file2md import File2Markdown
from app.core.tools.registry import ToolRegistry
from app.core.tools.builtin import (
    register_web_search,
    register_schema_tools,
    register_execute_sql,
    register_modify_user_data,
    register_chart_recommend,
)
from app.core.data.manager import DataManager
from app.core.data.isolated_executor import IsolatedSQLExecutor
from app.db.minio_client import minio_client as global_minio_client

from app.core.logging import setup_logging
setup_logging(level="INFO")
logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # === startup ===
    logger.info(f"🚀 {settings.app_name} v{settings.app_version} starting...")

    # 自动建表 (开发阶段使用，生产用 alembic)
    from app.models import Base
    from app.db.session import engine, async_session_maker
    from sqlalchemy import text as sa_text, select
    from app.models.tenant import Tenant, DEFAULT_TENANT_CONFIG
    from app.models.user import User

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Phase 6: 为已有表添加新字段 (create_all 不会 ALTER 已有表)
        for stmt in [
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL",
            "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL",
            "ALTER TABLE messages ADD COLUMN IF NOT EXISTS extra JSONB",
            "ALTER TABLE mcp_servers ADD COLUMN IF NOT EXISTS env JSONB",
        ]:
            try:
                await conn.execute(sa_text(stmt))
            except Exception:
                pass

        # Phase 3A: 数据管理模块新增字段
        for stmt in [
            "ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS file_type VARCHAR(20)",
            "ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS minio_path VARCHAR(1000)",
            "ALTER TABLE data_tables ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL",
            "ALTER TABLE data_tables ADD COLUMN IF NOT EXISTS display_name VARCHAR(255) NOT NULL DEFAULT ''",
            "ALTER TABLE data_tables ADD COLUMN IF NOT EXISTS is_writable BOOLEAN NOT NULL DEFAULT TRUE",
            "ALTER TABLE data_tables ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) NOT NULL DEFAULT 'private'",
            "ALTER TABLE data_tables ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()",
        ]:
            try:
                await conn.execute(sa_text(stmt))
            except Exception:
                pass

        # Phase 7: 关键查询索引
        index_stmts = [
            # 会话列表 (按用户 + 最近更新排序)
            "CREATE INDEX IF NOT EXISTS ix_conversations_user_updated ON conversations (user_id, updated_at DESC)",
            "CREATE INDEX IF NOT EXISTS ix_conversations_tenant_updated ON conversations (tenant_id, updated_at DESC)",
            # 消息列表 (会话内按时间排序)
            "CREATE INDEX IF NOT EXISTS ix_messages_conv_created ON messages (conversation_id, created_at)",
            # 用量记录 (conversation_id 外键补索引)
            "CREATE INDEX IF NOT EXISTS ix_usage_records_conv ON usage_records (conversation_id)",
            # 审计日志 (按用户+时间)
            "CREATE INDEX IF NOT EXISTS ix_audit_logs_user_created ON audit_logs (user_id, created_at DESC)",
            # 文档状态筛选
            "CREATE INDEX IF NOT EXISTS ix_documents_status ON documents (status)",
            # 用户创建时间
            "CREATE INDEX IF NOT EXISTS ix_users_created ON users (created_at DESC)",
        ]
        for stmt in index_stmts:
            try:
                await conn.execute(sa_text(stmt))
            except Exception:
                pass
    logger.info("✅ Database tables & indexes ensured")

    # 确保默认租户存在 + 分配孤儿用户
    async with async_session_maker() as db:
        result = await db.execute(select(Tenant).where(Tenant.name == "默认租户"))
        default_tenant = result.scalar_one_or_none()
        if not default_tenant:
            default_tenant = Tenant(name="默认租户", config=dict(DEFAULT_TENANT_CONFIG))
            db.add(default_tenant)
            await db.commit()
            await db.refresh(default_tenant)
            logger.info(f"✅ Default tenant created: {default_tenant.id}")
        # 分配无租户的用户到默认租户
        await db.execute(
            sa_text("UPDATE users SET tenant_id = :tid WHERE tenant_id IS NULL"),
            {"tid": default_tenant.id},
        )
        await db.execute(
            sa_text("UPDATE conversations SET tenant_id = :tid WHERE tenant_id IS NULL"),
            {"tid": default_tenant.id},
        )
        await db.commit()
        app.state.default_tenant_id = default_tenant.id
        logger.info(f"✅ Default tenant: {default_tenant.name} ({default_tenant.id})")

    # 注册 LLM Providers
    if settings.deepseek_api_key:
        llm_router.register_provider(
            "deepseek",
            DeepSeekProvider(api_key=settings.deepseek_api_key, base_url=settings.deepseek_base_url),
        )
    if settings.qwen_api_key:
        llm_router.register_provider(
            "qwen",
            QwenProvider(api_key=settings.qwen_api_key, base_url=settings.qwen_base_url),
        )
    logger.info(f"✅ LLM Providers: {list(llm_router.providers.keys())}")
    logger.info(f"✅ Available models: {list(llm_router.model_provider_map.keys())}")

    # 初始化 MemOS 记忆系统
    if settings.memos_api_key:
        memos_client = MemosClient(
            api_key=settings.memos_api_key,
            base_url=settings.memos_api_url,
        )
        app.state.memory_manager = MemoryManager(
            client=memos_client,
            recall_enabled=settings.memory_recall_enabled,
            save_enabled=settings.memory_save_enabled,
            relativity_threshold=settings.memory_relativity_threshold,
            recall_timeout=settings.memory_recall_timeout,
        )
        logger.info(f"✅ MemOS Memory: recall={settings.memory_recall_enabled}, save={settings.memory_save_enabled}")
    else:
        app.state.memory_manager = None
        logger.info("⚠️ MemOS Memory: disabled (no API key)")

    # 初始化 RAG 系统
    if settings.rag_enabled and settings.qwen_api_key:
        embedder = Embedder(
            api_key=settings.qwen_api_key,
            base_url=settings.qwen_base_url,
            model="text-embedding-v4",
            dim=1024,
        )
        vector_store = VectorStore(host=settings.milvus_host, port=settings.milvus_port)
        app.state.embedder = embedder
        app.state.vector_store = vector_store
        file2md = File2Markdown(
            minio_client=global_minio_client,
            bucket=settings.minio_bucket,
        )
        app.state.file2md = file2md
        app.state.doc_processor = DocumentProcessor(embedder=embedder, vector_store=vector_store, file2md=file2md)
        app.state.rag_retriever = RAGRetriever(
            embedder=embedder,
            vector_store=vector_store,
            rerank_api_key=settings.qwen_api_key,
            rerank_base_url="https://dashscope.aliyuncs.com/compatible-api/v1",
        )
        logger.info(f"✅ RAG: embedding=text-embedding-v4, rerank=qwen3-rerank, milvus={settings.milvus_host}:{settings.milvus_port}")
    else:
        app.state.embedder = None
        app.state.vector_store = None
        app.state.doc_processor = None
        app.state.rag_retriever = None
        logger.info("⚠️ RAG: disabled")

    # 初始化工具注册表 (内置工具 + MCP)
    tool_registry = ToolRegistry()
    register_web_search(tool_registry)
    register_schema_tools(tool_registry)
    register_execute_sql(tool_registry)
    register_modify_user_data(tool_registry)
    register_chart_recommend(tool_registry)
    app.state.tool_registry = tool_registry
    logger.info(f"✅ Tool Registry: {len(tool_registry.get_all_tools())} builtin tools registered")

    # 初始化数据管理模块
    app.state.data_manager = DataManager(engine=engine, minio_client=global_minio_client)
    app.state.isolated_executor = IsolatedSQLExecutor(engine=engine)
    logger.info("✅ DataManager & IsolatedSQLExecutor initialized")

    yield

    # === shutdown ===
    from app.db.session import engine
    from app.db.redis import redis_client
    if app.state.memory_manager:
        await app.state.memory_manager.client.close()
    await engine.dispose()
    await redis_client.close()
    logger.info("👋 Shutdown complete.")


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(health.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1")
app.include_router(conversations.router, prefix="/api/v1")
app.include_router(chat.router, prefix="/api/v1")
app.include_router(models_api.router, prefix="/api/v1")
app.include_router(knowledge.router, prefix="/api/v1")
app.include_router(knowledge.files_router, prefix="/api/v1")
app.include_router(mcp_api.router, prefix="/api/v1")
app.include_router(tools_api.router, prefix="/api/v1")
app.include_router(admin_api.router, prefix="/api/v1")
app.include_router(data_api.router, prefix="/api/v1", tags=["data"])
app.include_router(metrics_api.router, prefix="/api/v1", tags=["metrics"])
app.include_router(reports_api.router, prefix="/api/v1", tags=["reports"])
app.include_router(data_perm_api.router, prefix="/api/v1", tags=["data-permissions"])


@app.get("/")
async def root():
    return {"name": settings.app_name, "version": settings.app_version}
