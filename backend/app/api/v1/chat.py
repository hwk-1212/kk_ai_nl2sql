"""SSE 流式 Chat API — 集成 MemOS 记忆 + RAG 知识库检索 + MCP/内置工具调用"""
import json
import uuid
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.db.session import get_db
from app.core.deps import get_current_user
from app.core.llm.router import llm_router
from app.core.memory.manager import MemoryManager
from app.core.memory.memos_client import MemorySearchResult
from app.core.rag.retriever import RAGRetriever
from app.core.tools.registry import ToolRegistry
from app.core.tools.mcp_client import MCPClient
from app.models.user import User
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.knowledge_base import KnowledgeBase
from app.models.mcp_server import MCPServer
from app.models.custom_tool import CustomTool
from app.schemas.chat import ChatRequest

router = APIRouter(tags=["chat"])
logger = logging.getLogger(__name__)

MAX_CONTEXT_MESSAGES = 20
MAX_TOOL_ROUNDS = 10  # 最多工具调用轮次, 防止无限循环

DEFAULT_SYSTEM_PROMPT = """你是 KK 智能数据分析助手。你可以:
1. 查询用户上传的数据表 (使用 inspect_tables / inspect_table_schema)
2. 执行 SQL 查询并返回结果 (使用 execute_sql)
3. 推荐合适的可视化图表 (使用 recommend_chart)
4. 对用户自建表进行数据修改 (使用 modify_user_data)
5. 搜索互联网获取实时信息 (使用 web_search)

工作流程:
- 先理解用户意图
- 如果用户询问数据相关问题，先用 inspect_tables 查看可用表
- 再用 inspect_table_schema 了解表结构
- 生成并执行 SQL (使用 execute_sql)
- 根据结果推荐可视化 (使用 recommend_chart)
- 用清晰的中文向用户展示结果

注意事项:
- SQL 中使用 pg_table_name (如 ud_xxxx_tablename)，不要使用 display_name
- SELECT 查询会自动限制最多 1000 行
- 写操作需要指定 table_name 并且表必须是用户自己上传的"""


def _get_memory_manager(request: Request) -> MemoryManager | None:
    return getattr(request.app.state, "memory_manager", None)


def _get_rag_retriever(request: Request) -> RAGRetriever | None:
    return getattr(request.app.state, "rag_retriever", None)


def _get_tool_registry(request: Request) -> ToolRegistry | None:
    return getattr(request.app.state, "tool_registry", None)


async def _get_or_create_conversation(
    db: AsyncSession, user: User, conversation_id: str | None, model: str
) -> Conversation:
    if conversation_id:
        try:
            conv_uuid = uuid.UUID(conversation_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid conversation_id")

        result = await db.execute(
            select(Conversation)
            .options(selectinload(Conversation.messages))
            .where(Conversation.id == conv_uuid, Conversation.user_id == user.id)
        )
        conv = result.scalar_one_or_none()
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found")
        return conv
    else:
        conv = Conversation(user_id=user.id, tenant_id=user.tenant_id, title="New Chat", model=model)
        db.add(conv)
        await db.commit()
        await db.refresh(conv, ["messages"])
        return conv


def _build_messages(
    conversation: Conversation,
    user_content: str,
    memory_prompt: str = "",
    rag_prompt: str = "",
) -> list[dict]:
    system_content = DEFAULT_SYSTEM_PROMPT
    if memory_prompt:
        system_content += f"\n\n{memory_prompt}"
    if rag_prompt:
        system_content += f"\n\n{rag_prompt}"

    messages = [{"role": "system", "content": system_content}]

    history = list(conversation.messages)[-MAX_CONTEXT_MESSAGES:]
    for msg in history:
        m = {"role": msg.role, "content": msg.content}
        messages.append(m)

    messages.append({"role": "user", "content": user_content})
    return messages


async def _save_memory_background(
    memory_manager: MemoryManager,
    user_id: str,
    conversation_id: str,
    user_content: str,
    assistant_content: str,
):
    try:
        messages = [
            {"role": "user", "content": user_content},
            {"role": "assistant", "content": assistant_content},
        ]
        task_id = await memory_manager.save(
            user_id=user_id,
            conversation_id=conversation_id,
            messages=messages,
        )
        if task_id:
            logger.info(f"MemOS save queued: task={task_id}, conv={conversation_id}")
    except Exception as e:
        logger.warning(f"MemOS background save failed: {e}")


async def _resolve_kb_collections(
    db: AsyncSession, user: User, kb_ids: list[str] | None
) -> list[str]:
    if not kb_ids:
        return []
    collection_names = []
    for kid in kb_ids:
        try:
            uid = uuid.UUID(kid)
        except ValueError:
            continue
        result = await db.execute(
            select(KnowledgeBase)
            .options(selectinload(KnowledgeBase.documents))
            .where(KnowledgeBase.id == uid, KnowledgeBase.user_id == user.id)
        )
        kb = result.scalar_one_or_none()
        if kb:
            # 用实际 ready 文档数判断, 不依赖 doc_count 冗余字段
            ready_docs = [d for d in kb.documents if d.status == "ready"]
            if ready_docs:
                collection_names.append(kb.collection_name)
                logger.info(f"KB {kb.name}: {len(ready_docs)} ready docs -> {kb.collection_name}")
    return collection_names


async def _load_user_tools(db: AsyncSession, user: User, registry: ToolRegistry):
    """加载用户启用的 MCP 工具 + 自定义工具到注册表"""
    from app.core.tools.registry import ToolDef

    # 先清除上一次请求残留的用户级工具 (防止跨用户泄漏)
    registry.clear_user_tools()

    # MCP 工具
    result = await db.execute(
        select(MCPServer).where(MCPServer.user_id == user.id, MCPServer.enabled == True)
    )
    servers = result.scalars().all()
    for srv in servers:
        if srv.tools_cache:
            tool_defs = []
            for t in srv.tools_cache:
                tool_defs.append(ToolDef(
                    name=t.get("name", ""),
                    description=t.get("description", ""),
                    parameters=t.get("inputSchema") or t.get("parameters") or {"type": "object", "properties": {}},
                    source=f"mcp:{srv.id}",
                ))
            registry.set_mcp_tools(str(srv.id), tool_defs)

    # 自定义工具
    result = await db.execute(
        select(CustomTool).where(CustomTool.user_id == user.id, CustomTool.enabled == True)
    )
    custom_tools = result.scalars().all()
    for ct in custom_tools:
        registry.register_custom(
            name=ct.name,
            description=ct.description,
            parameters=ct.parameters or {"type": "object", "properties": {}},
            tool_id=str(ct.id),
        )


async def _execute_tool(
    tool_name: str, arguments: dict, registry: ToolRegistry,
    db: AsyncSession, user: User, raw_request: Request | None = None,
) -> tuple[bool, str]:
    """
    执行工具: 内置 / MCP / 自定义
    Returns: (success, result_text)
    """
    source = registry.get_tool_source(tool_name)
    if not source:
        return False, f"Unknown tool: {tool_name}"

    if source == "builtin":
        context = {"user": user, "db": db, "request": raw_request}
        result = await registry.execute_builtin(tool_name, arguments, context=context)
        return result.success, result.content if result.success else (result.error or "Unknown error")

    # MCP 工具: mcp:{server_id}
    if source.startswith("mcp:"):
        server_id = source[4:]
        try:
            srv_uuid = uuid.UUID(server_id)
        except ValueError:
            return False, f"Invalid MCP server ID: {server_id}"

        result = await db.execute(
            select(MCPServer).where(MCPServer.id == srv_uuid, MCPServer.user_id == user.id)
        )
        srv = result.scalar_one_or_none()
        if not srv:
            return False, f"MCP Server not found: {server_id}"

        client = MCPClient(
            transport_type=srv.transport_type,
            config=srv.config,
            env=srv.env,
        )
        try:
            result_text = await client.call_tool(tool_name, arguments)
            return True, result_text
        except Exception as e:
            logger.error(f"MCP tool call failed: {tool_name} -> {e}")
            return False, str(e)
        finally:
            await client.close()

    # 自定义工具: custom:{tool_id}
    if source.startswith("custom:"):
        tool_id = source[7:]
        try:
            tool_uuid = uuid.UUID(tool_id)
        except ValueError:
            return False, f"Invalid custom tool ID: {tool_id}"

        result = await db.execute(
            select(CustomTool).where(CustomTool.id == tool_uuid, CustomTool.user_id == user.id)
        )
        ct = result.scalar_one_or_none()
        if not ct:
            return False, f"Custom tool not found: {tool_id}"

        from app.core.tools.executor import execute_http_tool
        try:
            result_text = await execute_http_tool(ct, arguments)
            return True, result_text
        except Exception as e:
            logger.error(f"Custom tool call failed: {tool_name} -> {e}")
            return False, str(e)

    return False, f"Unknown tool source: {source}"


def _sse(data: dict) -> str:
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"


@router.post("/chat")
async def chat_stream(
    request: ChatRequest,
    raw_request: Request,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """SSE 流式对话 — 带记忆召回、RAG 检索、工具调用"""
    if not request.messages or not request.messages[0].content.strip():
        raise HTTPException(status_code=400, detail="Message content is required")

    user_content = request.messages[0].content
    memory_manager = _get_memory_manager(raw_request)
    rag_retriever = _get_rag_retriever(raw_request)
    tool_registry = _get_tool_registry(raw_request)

    # 1. 获取/创建会话
    conv = await _get_or_create_conversation(db, current_user, request.conversation_id, request.model)
    conversation_id = str(conv.id)
    user_id = str(current_user.id)

    # 2. 记忆召回
    memory_result = MemorySearchResult()
    if memory_manager:
        memory_result = await memory_manager.recall(
            user_id=user_id,
            query=user_content,
            conversation_id=conversation_id,
        )

    # 3. RAG 检索
    rag_chunks = []
    rag_prompt = ""
    if rag_retriever and request.kb_ids:
        collection_names = await _resolve_kb_collections(db, current_user, request.kb_ids)
        if collection_names:
            try:
                from app.config import get_settings
                s = get_settings()
                rag_chunks = await rag_retriever.retrieve(
                    query=user_content,
                    collection_names=collection_names,
                    top_k=s.rag_top_k,
                    ann_top_k=s.rag_ann_top_k,
                    use_rerank=s.rag_use_rerank,
                )
                rag_prompt = RAGRetriever.build_rag_prompt(rag_chunks)
                logger.info(f"RAG retrieved {len(rag_chunks)} chunks for conv={conversation_id}")
            except Exception as e:
                logger.warning(f"RAG retrieval failed: {e}")

    # 4. 加载工具 (MCP + 自定义 + 过滤禁用的内置工具)
    openai_tools: list[dict] | None = None
    if tool_registry:
        await _load_user_tools(db, current_user, tool_registry)
        # 过滤用户禁用的内置工具
        from app.api.v1.tools import get_user_enabled_builtins
        enabled_builtins = await get_user_enabled_builtins(str(current_user.id), tool_registry)
        tools_list = tool_registry.to_openai_tools(enabled_builtins=enabled_builtins)
        if tools_list:
            openai_tools = tools_list
            logger.info(f"Loaded {len(tools_list)} tools for conv={conversation_id}")

    # 4.5 额度检查
    from app.core.billing import check_quota
    if current_user.tenant_id:
        from sqlalchemy import select as _select
        from app.models.tenant import Tenant
        _t_result = await db.execute(_select(Tenant).where(Tenant.id == current_user.tenant_id))
        _tenant = _t_result.scalar_one_or_none()
        if _tenant:
            allowed, quota_msg = await check_quota(str(_tenant.id), _tenant.config)
            if not allowed:
                raise HTTPException(status_code=429, detail=quota_msg)

    # 5. 保存用户消息
    user_msg = Message(conversation_id=conv.id, role="user", content=user_content)
    db.add(user_msg)
    await db.commit()

    # 6. 构建 LLM messages
    memory_prompt = MemoryManager.build_memory_prompt(memory_result) if memory_manager else ""
    llm_messages = _build_messages(conv, user_content, memory_prompt, rag_prompt)

    # 7. 检测模型可用
    try:
        llm_router.get_provider(request.model)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    async def generate_sse():
        """SSE 事件生成器 — 支持多轮工具调用"""
        reasoning_full = ""
        content_full = ""
        usage_data = None

        # ---- 用于持久化的 metadata 收集器 ----
        _meta_tool_calls: list[dict] = []
        _meta_memories: list[dict] = []
        _meta_rag_sources: list[dict] = []

        # meta
        yield _sse({"type": "meta", "conversation_id": conversation_id})

        # memory recall
        if memory_result.memories or memory_result.preferences:
            payload = MemoryManager.to_sse_payload(memory_result)
            yield _sse({"type": "memory_recall", "data": payload})
            # 收集 memory 到 metadata
            for m in payload.get("memories", []):
                _meta_memories.append({
                    "id": m.get("id", ""),
                    "content": m.get("content", ""),
                    "relevance": m.get("relevance", 0),
                    "source": m.get("source", ""),
                })

        # rag sources
        if rag_chunks:
            rag_payload = RAGRetriever.to_sse_payload(rag_chunks)
            yield _sse({"type": "rag_source", "data": rag_payload})
            # 收集 rag 到 metadata
            for s in rag_payload:
                _meta_rag_sources.append({
                    "content": s.get("content", "")[:500],
                    "score": s.get("score", 0),
                    "source": s.get("source", ""),
                })

        # =============== 多轮工具调用循环 ===============
        messages = llm_messages[:]
        tool_round = 0

        try:
            while tool_round < MAX_TOOL_ROUNDS:
                tool_round += 1
                round_content = ""
                round_reasoning = ""
                done_chunk = None

                async for chunk in llm_router.stream(
                    model_id=request.model,
                    messages=messages,
                    thinking_enabled=request.thinking_enabled,
                    tools=openai_tools,
                ):
                    if chunk.type == "reasoning":
                        round_reasoning += chunk.data
                        reasoning_full += chunk.data
                        yield _sse({"type": "reasoning", "data": chunk.data})

                    elif chunk.type == "content":
                        round_content += chunk.data
                        content_full += chunk.data
                        yield _sse({"type": "content", "data": chunk.data})

                    elif chunk.type == "done":
                        done_chunk = chunk
                        usage_data = chunk.usage

                    elif chunk.type == "error":
                        yield _sse({"type": "error", "data": chunk.data})
                        return

                if not done_chunk:
                    break

                # 检查是否有 tool_calls
                if done_chunk.finish_reason == "tool_calls" and done_chunk.tool_calls:
                    # 先添加 assistant message (包含所有 tool_calls)
                    messages.append({
                        "role": "assistant",
                        "content": round_content or None,
                        "tool_calls": done_chunk.tool_calls,
                    })

                    # 逐个执行工具并发送 SSE 事件
                    for tc in done_chunk.tool_calls:
                        func = tc.get("function", {})
                        tc_id = tc.get("id", str(uuid.uuid4()))
                        tc_name = func.get("name", "")
                        try:
                            tc_args = json.loads(func.get("arguments", "{}"))
                        except json.JSONDecodeError:
                            tc_args = {}

                        # SSE: tool_call (calling)
                        yield _sse({
                            "type": "tool_call",
                            "data": {
                                "id": tc_id,
                                "name": tc_name,
                                "arguments": tc_args,
                                "status": "calling",
                            },
                        })

                        # 执行工具
                        success, result_text = await _execute_tool(
                            tc_name, tc_args, tool_registry, db, current_user, raw_request
                        )

                        # SSE: tool_result
                        tc_status = "success" if success else "error"
                        yield _sse({
                            "type": "tool_result",
                            "data": {
                                "id": tc_id,
                                "name": tc_name,
                                "status": tc_status,
                                "result": result_text[:2000] if success else None,
                                "error": result_text[:500] if not success else None,
                            },
                        })

                        # 收集 tool_call 到 metadata
                        _meta_tool_calls.append({
                            "id": tc_id,
                            "name": tc_name,
                            "arguments": tc_args,
                            "status": tc_status,
                            "result": result_text[:2000] if success else None,
                            "error": result_text[:500] if not success else None,
                        })

                        # 添加 tool result message
                        messages.append({
                            "role": "tool",
                            "tool_call_id": tc_id,
                            "content": result_text[:4000],
                        })

                    # 继续循环, LLM 将处理工具结果
                    continue

                # 没有 tool_calls, 正常结束
                yield _sse({"type": "done", "usage": done_chunk.usage, "model": done_chunk.model})
                break

            else:
                # 超过最大轮次
                logger.warning(f"Max tool rounds ({MAX_TOOL_ROUNDS}) exceeded for conv={conversation_id}")
                yield _sse({"type": "done", "usage": usage_data, "model": request.model})

        except Exception as e:
            logger.error(f"SSE stream error: {e}")
            yield _sse({"type": "error", "data": str(e)})

        # =============== 保存 assistant 消息 ===============
        try:
            # 构建 extra metadata
            _metadata = {}
            if _meta_tool_calls:
                _metadata["tool_calls"] = _meta_tool_calls
            if _meta_memories:
                _metadata["memories"] = _meta_memories
            if _meta_rag_sources:
                _metadata["rag_sources"] = _meta_rag_sources

            # 用独立 session 避免和 SSE 流中已有事务冲突
            from app.db.session import async_session_maker
            async with async_session_maker() as save_db:
                assistant_msg = Message(
                    conversation_id=conv.id,
                    role="assistant",
                    content=content_full,
                    reasoning_content=reasoning_full if reasoning_full else None,
                    usage=usage_data,
                    extra=_metadata if _metadata else None,
                )
                save_db.add(assistant_msg)

                # 更新会话标题和时间
                from sqlalchemy import select as sa_select, update as sa_update
                if conv.title == "New Chat" and user_content:
                    await save_db.execute(
                        sa_update(Conversation)
                        .where(Conversation.id == conv.id)
                        .values(
                            title=user_content[:50] + ("..." if len(user_content) > 50 else ""),
                            updated_at=datetime.now(timezone.utc),
                        )
                    )
                else:
                    await save_db.execute(
                        sa_update(Conversation)
                        .where(Conversation.id == conv.id)
                        .values(updated_at=datetime.now(timezone.utc))
                    )
                await save_db.commit()
        except Exception as e:
            logger.error(f"Failed to save assistant message: {e}", exc_info=True)

        # =============== 记录用量 ===============
        if usage_data and (usage_data.get("prompt_tokens") or usage_data.get("completion_tokens")):
            try:
                from app.core.billing import record_usage
                from app.db.session import async_session_maker
                async with async_session_maker() as billing_db:
                    await record_usage(
                        db=billing_db,
                        user_id=user_id,
                        tenant_id=str(current_user.tenant_id) if current_user.tenant_id else None,
                        model=request.model,
                        input_tokens=usage_data.get("prompt_tokens", 0),
                        output_tokens=usage_data.get("completion_tokens", 0),
                        trigger_type="chat",
                        conversation_id=conversation_id,
                    )
            except Exception as e:
                logger.error(f"Failed to record usage: {e}")

        # =============== 异步保存记忆 ===============
        if memory_manager and memory_manager.save_enabled and content_full:
            background_tasks.add_task(
                _save_memory_background,
                memory_manager,
                user_id,
                conversation_id,
                user_content,
                content_full,
            )

    return StreamingResponse(
        generate_sse(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
