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
from app.api.v1 import data_audit as data_audit_api
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
    register_lookup_metrics,
)
from app.core.data.manager import DataManager
from app.core.data.isolated_executor import IsolatedSQLExecutor
from app.core.context.token_counter import TokenCounter
from app.core.context.summarizer import ContextSummarizer
from app.core.context.manager import ContextManager
from app.core.semantic.layer import SemanticLayer
from app.core.cache.query_cache import QueryCache
from app.core.cache.schema_cache import SchemaCache
from app.core.audit.data_auditor import DataAuditor
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

        # Phase 3D: 语义层模型新增字段
        for stmt in [
            "ALTER TABLE metrics ADD COLUMN IF NOT EXISTS english_name VARCHAR(255)",
            "ALTER TABLE metrics ADD COLUMN IF NOT EXISTS source_table VARCHAR(255)",
            "ALTER TABLE metrics ADD COLUMN IF NOT EXISTS dimensions JSONB",
            "ALTER TABLE metrics ADD COLUMN IF NOT EXISTS filters JSONB",
            "ALTER TABLE metrics ADD COLUMN IF NOT EXISTS time_granularity JSONB",
            "ALTER TABLE metrics ADD COLUMN IF NOT EXISTS category VARCHAR(100)",
            "ALTER TABLE metrics ADD COLUMN IF NOT EXISTS version VARCHAR(20) NOT NULL DEFAULT '1.0'",
            "ALTER TABLE dimensions ADD COLUMN IF NOT EXISTS english_name VARCHAR(255)",
            "ALTER TABLE business_terms ADD COLUMN IF NOT EXISTS term_type VARCHAR(20) NOT NULL DEFAULT 'metric'",
        ]:
            try:
                await conn.execute(sa_text(stmt))
            except Exception:
                pass

        # Phase 3E: 权限模型新增/修改字段
        for stmt in [
            "ALTER TABLE data_roles ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE",
            "ALTER TABLE data_role_assignments ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES users(id) ON DELETE SET NULL",
            "ALTER TABLE data_role_assignments RENAME COLUMN role_id TO data_role_id",
            "ALTER TABLE table_permissions ADD COLUMN IF NOT EXISTS permission VARCHAR(20) NOT NULL DEFAULT 'read'",
            "ALTER TABLE table_permissions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT now()",
            "ALTER TABLE table_permissions RENAME COLUMN role_id TO data_role_id",
            "ALTER TABLE table_permissions RENAME COLUMN table_id TO data_table_id",
            "ALTER TABLE column_permissions ADD COLUMN IF NOT EXISTS data_role_id UUID REFERENCES data_roles(id) ON DELETE CASCADE",
            "ALTER TABLE column_permissions ADD COLUMN IF NOT EXISTS data_table_id UUID REFERENCES data_tables(id) ON DELETE CASCADE",
            "ALTER TABLE column_permissions ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) NOT NULL DEFAULT 'visible'",
            "ALTER TABLE column_permissions ADD COLUMN IF NOT EXISTS masking_rule VARCHAR(50)",
            "ALTER TABLE column_permissions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT now()",
            "ALTER TABLE row_filters ADD COLUMN IF NOT EXISTS data_role_id UUID REFERENCES data_roles(id) ON DELETE CASCADE",
            "ALTER TABLE row_filters ADD COLUMN IF NOT EXISTS data_table_id UUID REFERENCES data_tables(id) ON DELETE CASCADE",
            "ALTER TABLE row_filters ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT now()",
        ]:
            try:
                await conn.execute(sa_text(stmt))
            except Exception:
                pass

        # Phase 3F: 审计日志新增字段
        for stmt in [
            "ALTER TABLE data_audit_logs ADD COLUMN IF NOT EXISTS conversation_id UUID",
            "ALTER TABLE data_audit_logs ADD COLUMN IF NOT EXISTS data_table_id UUID",
            "ALTER TABLE data_audit_logs ADD COLUMN IF NOT EXISTS sql_hash VARCHAR(64)",
            "ALTER TABLE data_audit_logs ADD COLUMN IF NOT EXISTS affected_rows INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE data_audit_logs ADD COLUMN IF NOT EXISTS result_row_count INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE data_audit_logs ADD COLUMN IF NOT EXISTS before_snapshot JSONB",
            "ALTER TABLE data_audit_logs ADD COLUMN IF NOT EXISTS after_snapshot JSONB",
            "ALTER TABLE data_audit_logs ADD COLUMN IF NOT EXISTS client_ip VARCHAR(45)",
            "ALTER TABLE data_audit_logs ADD COLUMN IF NOT EXISTS user_agent VARCHAR(500)",
        ]:
            try:
                await conn.execute(sa_text(stmt))
            except Exception:
                pass

        # Phase 3G: 报告模型新增字段
        for stmt in [
            "ALTER TABLE reports ADD COLUMN IF NOT EXISTS data_config JSONB",
            "ALTER TABLE reports ADD COLUMN IF NOT EXISTS charts JSONB",
            "ALTER TABLE reports ADD COLUMN IF NOT EXISTS minio_path VARCHAR(1000)",
            "ALTER TABLE reports ADD COLUMN IF NOT EXISTS error_message TEXT",
            "ALTER TABLE reports ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES report_schedules(id) ON DELETE SET NULL",
            "ALTER TABLE report_templates ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL",
            "ALTER TABLE report_templates ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL",
            "ALTER TABLE report_templates ALTER COLUMN template_content TYPE TEXT USING template_content::TEXT",
            "ALTER TABLE report_templates ADD COLUMN IF NOT EXISTS data_config JSONB",
            "ALTER TABLE report_templates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()",
            "ALTER TABLE report_schedules ADD COLUMN IF NOT EXISTS name VARCHAR(255) NOT NULL DEFAULT ''",
            "ALTER TABLE report_schedules ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL",
            "ALTER TABLE report_schedules ADD COLUMN IF NOT EXISTS data_config JSONB",
        ]:
            try:
                await conn.execute(sa_text(stmt))
            except Exception:
                pass

        # Phase 7: 关键查询索引
        index_stmts = [
            "CREATE INDEX IF NOT EXISTS ix_conversations_user_updated ON conversations (user_id, updated_at DESC)",
            "CREATE INDEX IF NOT EXISTS ix_conversations_tenant_updated ON conversations (tenant_id, updated_at DESC)",
            "CREATE INDEX IF NOT EXISTS ix_messages_conv_created ON messages (conversation_id, created_at)",
            "CREATE INDEX IF NOT EXISTS ix_usage_records_conv ON usage_records (conversation_id)",
            "CREATE INDEX IF NOT EXISTS ix_audit_logs_user_created ON audit_logs (user_id, created_at DESC)",
            "CREATE INDEX IF NOT EXISTS ix_documents_status ON documents (status)",
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
    register_lookup_metrics(tool_registry)
    app.state.tool_registry = tool_registry
    logger.info(f"✅ Tool Registry: {len(tool_registry.get_all_tools())} builtin tools registered")

    # 初始化语义层 (Phase 3D)
    if settings.rag_enabled and settings.qwen_api_key:
        from app.core.semantic.layer import COLLECTION_NAME, EMBEDDING_DIM
        semantic_layer = SemanticLayer(embedder=embedder, vector_store=vector_store)
        app.state.semantic_layer = semantic_layer
        vector_store.create_collection(COLLECTION_NAME, dim=EMBEDDING_DIM)
        logger.info(f"✅ SemanticLayer initialized (collection={COLLECTION_NAME})")
    else:
        app.state.semantic_layer = None
        logger.info("⚠️ SemanticLayer: disabled (RAG not enabled)")

    # 初始化数据管理模块
    app.state.data_manager = DataManager(engine=engine, minio_client=global_minio_client)
    app.state.isolated_executor = IsolatedSQLExecutor(engine=engine)
    logger.info("✅ DataManager & IsolatedSQLExecutor initialized")

    # 初始化上下文管理器
    token_counter = TokenCounter()
    summarizer = ContextSummarizer()
    context_manager = ContextManager(token_counter, summarizer)
    app.state.context_manager = context_manager
    logger.info("✅ ContextManager initialized (compress_threshold=60%, keep_recent=6 rounds)")

    # Phase 3F: 初始化缓存 + 审计
    from app.db.redis import redis_client
    app.state.query_cache = QueryCache(redis_client)
    app.state.schema_cache = SchemaCache(redis_client)
    app.state.data_auditor = DataAuditor()
    logger.info("✅ QueryCache (L1+L2) + SchemaCache + DataAuditor initialized")

    # Phase 3G: 初始化报告生成器
    app.state.report_generator = None
    try:
        from app.core.report.generator import ReportGenerator
        rg = ReportGenerator(llm_router=llm_router, executor=app.state.isolated_executor)
        app.state.report_generator = rg
        logger.info("✅ ReportGenerator initialized")
    except Exception as e:
        logger.warning("⚠️ ReportGenerator init failed: %s", e)

    # Phase 3G: 预置系统报告模板
    try:
        from app.models.report_template import ReportTemplate as RT
        async with async_session_maker() as db2:
            existing = await db2.execute(select(RT).where(RT.is_system.is_(True)).limit(1))
            if not existing.scalar_one_or_none():
                system_templates = [
                    RT(name="日报模板", description="按天统计关键指标，趋势对比", category="daily",
                       template_content="# {{title}}\n\n## 概述\n\n## 关键指标\n\n## 趋势分析\n\n## 建议", is_system=True),
                    RT(name="周报模板", description="按周汇总，环比分析", category="weekly",
                       template_content="# {{title}}\n\n## 本周概况\n\n## 关键指标\n\n## 环比分析\n\n## 下周展望", is_system=True),
                    RT(name="月报模板", description="月度总结 + 环比同比", category="monthly",
                       template_content="# {{title}}\n\n## 月度总结\n\n## 关键指标\n\n## 环比同比\n\n## 趋势洞察\n\n## 建议", is_system=True),
                    RT(name="自定义查询报告", description="自由配置查询和图表", category="custom",
                       template_content="# {{title}}\n\n## 数据分析\n\n## 关键发现\n\n## 建议", is_system=True),
                ]
                for t in system_templates:
                    db2.add(t)
                await db2.commit()
                logger.info("✅ System report templates created (4 templates)")
            else:
                logger.info("✅ System report templates already exist")
    except Exception as e:
        logger.warning("⚠️ System templates init: %s", e)

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
app.include_router(data_audit_api.router, prefix="/api/v1", tags=["data-audit"])


@app.get("/")
async def root():
    return {"name": settings.app_name, "version": settings.app_version}
