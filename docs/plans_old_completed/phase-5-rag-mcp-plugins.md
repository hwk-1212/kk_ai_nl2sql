# Phase 5: RAG 知识库 + MCP 协议 + 插件系统

**状态: ✅ 已完成**
**完成日期: 2026-02-12**

---

## 目标

扩展系统能力边界：RAG 让 AI 理解私有文档，MCP 让 AI 调用外部工具，插件系统统一管理。

---

## 完成情况

### 验证结果

| 验证项 | 结果 | 说明 |
|--------|------|------|
| 上传文档 → 分块 → Embedding → Milvus | ✅ | 支持 PDF/DOCX/TXT/MD/CSV/XLSX，先转 Markdown 再分块 |
| 对话关联知识库 → 检索 → 注入回答 | ✅ | kb_ids 传入 → ANN search → rerank → prompt 注入 → 正确回答 |
| SSE rag_source 事件返回引用来源 | ✅ | 含文件名、页码、相关度 |
| 文档预览 (原件 + Markdown) | ✅ | 双 Tab 预览, 支持 PDF/DOCX/TXT/CSV/XLSX |
| 文档 chunk 查看 (按页码+索引排序) | ✅ | 前后端双重排序 |
| 失败文档重新处理 | ✅ | retry 接口 + 前端按钮 |
| 异步删除 (文档/知识库) | ✅ | DB 即时删除, Milvus+MinIO 后台清理 |
| MCP Server CRUD API | ✅ | create/list/toggle/delete/refresh 全部正常 |
| **MCP 工具自动发现** | ✅ | 注册服务器后自动连接发现工具, 支持手动刷新 |
| **MCP 工具运行时调用** | ✅ | LLM function calling → 路由到 MCP Server → 结果回注 |
| **内置 web_search 插件** | ✅ | DuckDuckGo 搜索, LLM 可自主决定调用 |
| **多轮工具调用循环** | ✅ | 支持最多 5 轮工具调用, LLM 基于结果继续对话 |
| **前端工具调用展示** | ✅ | ToolCallBlock 显示调用中/成功/失败, 可展开查看参数和结果 |
| **自定义 HTTP 工具** | ✅ | 用户可创建/编辑/删除/测试 HTTP webhook 工具 |
| **内置工具启用/禁用** | ✅ | 用户级 Redis 开关, 禁用后 LLM 不可调用, 前端 Toggle |
| **工具注册表用户隔离** | ✅ | 每次请求清除上一用户的 MCP/自定义工具, 防止跨用户泄漏 |
| **工具管理页面** | ✅ | 内置工具查看+开关 + 自定义工具 CRUD + 侧边栏入口 |
| 前端知识库页面 | ✅ | 创建/上传/预览/chunk查看/重试/删除 全功能 |
| 前端 MCP 页面 | ✅ | 注册/启用/禁用/刷新工具/工具浏览 |
| 前端 ChatInput 知识库选择器 | ✅ | 多选 KB → 随消息发送 kb_ids |
| 10 容器全部健康 | ✅ | backend healthy, 所有依赖 ok |

---

## 5.1 RAG 知识库

### 技术方案

| 组件 | 选型 | 说明 |
|------|------|------|
| Embedding | text-embedding-v4 (千问) | 1024 维, OpenAI SDK 兼容 |
| 向量存储 | Milvus 2.6.10 | HNSW 索引, COSINE 距离 |
| Rerank | qwen3-rerank | DashScope 兼容 API |
| 文档转换 | File2Markdown (自研) | PDF/DOCX/XLSX/TXT/CSV/MD → 统一 Markdown |
| 文本分块 | RecursiveCharacterTextSplitter | Markdown-aware 分隔符, 默认 1000/200 |
| 文件存储 | MinIO | kk-gpt-files bucket, kb_name/filename 路径 |
| 异步处理 | BackgroundTasks | 上传后异步转换→分块→向量化→存储 |

### 文档处理 Pipeline

```
上传文件 → MinIO 存储 → File2Markdown 转换 → Markdown 分块 → text-embedding-v4 → Milvus 存储
                                          ↓
                                   Markdown 存 MinIO (预览用)
                                   图片提取 → MinIO (内嵌引用)
```

### 检索流程

```
用户 Query → Embedding → Milvus ANN Search (top-20) → qwen3-rerank (top-5) → 注入 System Prompt
```

### 知识库管理 API

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/v1/knowledge-bases` | GET | 列出知识库 (动态统计文档数) |
| `/api/v1/knowledge-bases` | POST | 创建知识库 (同时创建 Milvus collection) |
| `/api/v1/knowledge-bases/{id}` | GET | 知识库详情 (含文档列表) |
| `/api/v1/knowledge-bases/{id}` | PATCH | 更新知识库信息 |
| `/api/v1/knowledge-bases/{id}` | DELETE | 删除知识库 (异步清理 Milvus + MinIO) |
| `/api/v1/knowledge-bases/{id}/documents` | GET | 列出文档 |
| `/api/v1/knowledge-bases/{id}/documents` | POST | 上传文档 (multipart, 异步处理) |
| `/api/v1/knowledge-bases/{id}/documents/{doc_id}` | DELETE | 删除文档 (异步清理向量) |
| `/api/v1/knowledge-bases/{id}/documents/{doc_id}/retry` | POST | 重新处理失败文档 |
| `/api/v1/knowledge-bases/{id}/documents/{doc_id}/preview` | GET | 流式预览原件 |
| `/api/v1/knowledge-bases/{id}/documents/{doc_id}/markdown` | GET | 获取 Markdown 转换内容 |
| `/api/v1/knowledge-bases/{id}/documents/{doc_id}/chunks` | GET | 查看文档切片 (按页码+索引排序) |
| `/api/v1/files/{bucket}/{path}` | GET | 代理 MinIO 文件 (图片引用) |

### SSE 新增事件

```json
{"type": "rag_source", "data": [
  {"content": "...", "score": 0.804, "source": "文件名.pdf", "page": 3}
]}
```

---

## 5.2 MCP 协议支持

### 架构

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   LLM       │────▶│  ToolRegistry │────▶│ MCPClient       │
│ (tool_call) │     │  (路由分发)    │     │ (HTTP/stdio)    │
└─────────────┘     └──────┬───────┘     └────────┬────────┘
                           │                       │
                    ┌──────┴───────┐        ┌──────┴────────┐
                    │ 内置工具      │        │ MCP Server    │
                    │ (web_search) │        │ (外部服务)     │
                    └──────────────┘        └───────────────┘
```

### MCP Client (完整实现)

- **传输层**: 支持 HTTP (JSON-RPC 2.0) 和 stdio (子进程通信)
- **协议**: MCP 2025-03-26, 完整 initialize → tools/list → tools/call 流程
- **连接管理**: stdio 进程自动启动/关闭, HTTP 无状态请求

### 工具注册表 (ToolRegistry)

- 聚合内置工具 + MCP 工具 + 自定义工具
- 自动转换为 OpenAI function calling 格式
- 按 source 路由执行 (`builtin` / `mcp:{server_id}` / `custom:{tool_id}`)

### 工具发现

- 注册 MCP Server 时自动后台发现工具 (BackgroundTasks)
- 支持手动刷新 (`POST /servers/{id}/refresh`)
- 工具缓存到 DB `tools_cache` 字段

### LLM 工具调用流程

```
1. 加载用户启用的 MCP 工具 + 自定义工具 → 合并内置工具 → 转 OpenAI tools 格式
2. 发送 messages + tools 给 LLM
3. LLM 返回 tool_call → SSE 发送 tool_call 事件 (status: calling)
4. 路由到正确的工具执行 (内置 / MCP Server / 自定义 HTTP)
5. SSE 发送 tool_result 事件 (result / error)
6. 将 tool result 注入 messages, 继续 LLM 对话
7. 重复 2-6, 最多 5 轮 (MAX_TOOL_ROUNDS)
8. LLM 输出最终回答
```

### MCP Server 管理 API

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/v1/mcp/servers` | GET | 列出已注册 MCP Server |
| `/api/v1/mcp/servers` | POST | 注册新 MCP Server (自动发现工具) |
| `/api/v1/mcp/servers/{id}` | DELETE | 删除 |
| `/api/v1/mcp/servers/{id}/toggle` | PATCH | 启用/禁用 |
| `/api/v1/mcp/servers/{id}/refresh` | POST | 手动刷新工具列表 |
| `/api/v1/mcp/servers/{id}/tools` | GET | 列出该服务器工具 |
| `/api/v1/mcp/tools` | GET | 聚合所有可用工具 (内置+MCP) |

### SSE 新增事件

```json
// 工具调用开始
{"type": "tool_call", "data": {
  "id": "call_xxx", "name": "web_search",
  "arguments": {"query": "北京天气"}, "status": "calling"
}}

// 工具执行结果
{"type": "tool_result", "data": {
  "id": "call_xxx", "name": "web_search",
  "status": "success", "result": "[{...}]"
}}
```

### 数据模型

```python
class MCPServer(Base):
    id: UUID
    user_id: UUID       # 所属用户
    name: str           # 显示名称
    transport_type: str  # "stdio" | "sse" | "http"
    config: str         # 命令或 URL
    enabled: bool
    tools_cache: JSON   # 缓存的工具列表 (自动发现)
    created_at: datetime
```

---

## 5.3 工具系统 (内置 + 自定义)

### 工具分类

| 类型 | 来源 | 执行方式 | 管理方式 |
|------|------|----------|----------|
| **内置工具** (builtin) | 代码内置, 启动自动注册 | Python async 函数直接执行 | 系统预设, 用户可启用/禁用 (Redis) |
| **自定义工具** (custom) | 用户通过 UI 创建 | HTTP webhook 调用 | 前端 CRUD, 支持启用/禁用/测试 |
| **MCP 工具** (mcp) | MCP Server 自动发现 | MCPClient 远程调用 | MCP 页面管理 |

### 内置工具

| 工具 | 说明 | 实现 |
|------|------|------|
| web_search | 搜索互联网获取实时信息 | DuckDuckGo Search API |

### 自定义工具 (HTTP)

用户可注册自定义 HTTP 工具, LLM 自动决策调用:

```python
class CustomTool(Base):
    id: UUID
    user_id: UUID
    name: str              # 工具名称 (LLM 可见)
    description: str       # 功能描述 (LLM 用于决策)
    tool_type: str         # "http"
    parameters: JSON       # JSON Schema (LLM 参数生成)
    http_url: str          # 请求 URL (支持 {{key}} 占位符)
    http_method: str       # GET/POST/PUT/DELETE
    http_headers: JSON     # 自定义请求头
    http_body_template: str # Body 模板 (支持 {{key}} 占位符)
    enabled: bool
```

执行流程:
1. LLM 根据 `parameters` JSON Schema 生成参数
2. 替换 URL 和 Body 模板中的 `{{key}}` 占位符
3. 发送 HTTP 请求到目标 URL
4. 返回响应内容给 LLM

### 工具管理 API

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/v1/tools` | GET | 列出所有工具 (内置+自定义) |
| `/api/v1/tools/builtin` | GET | 列出内置工具 (含 enabled 状态) |
| `/api/v1/tools/builtin/{name}/toggle` | PATCH | 启用/禁用内置工具 (Redis) |
| `/api/v1/tools` | POST | 创建自定义工具 |
| `/api/v1/tools/{id}` | PATCH | 更新自定义工具 |
| `/api/v1/tools/{id}` | DELETE | 删除自定义工具 |
| `/api/v1/tools/{id}/toggle` | PATCH | 启用/禁用 |
| `/api/v1/tools/{id}/test` | POST | 测试自定义工具 |

### 工具注册架构

```python
# 启动时注册内置工具
registry = ToolRegistry()
register_web_search(registry)

# 每次对话:
# 1. 清除上一请求残留的用户级工具 (防止跨用户泄漏)
registry.clear_user_tools()
# 2. 加载当前用户工具
await _load_user_tools(db, user, registry)
# → MCP 工具 (从 tools_cache)
# → 自定义工具 (从 custom_tools 表)

# 3. 过滤禁用的内置工具 (Redis 存储用户级开关)
enabled_builtins = await get_user_enabled_builtins(user_id, registry)
# 4. 统一转为 OpenAI function calling 格式
openai_tools = registry.to_openai_tools(enabled_builtins=enabled_builtins)
```

### 内置工具开关

- 存储: Redis Set `user:{uid}:builtin_tools_disabled`
- 默认: 全部启用 (Set 为空)
- 禁用: SADD 工具名到集合
- 启用: SREM 工具名
- 聊天时: 从 Set 取禁用列表, 过滤后传给 LLM

---

## 5.4 前端

### KnowledgePage 功能

- 知识库列表: 卡片式布局, 动态文档数
- 创建知识库: Modal 表单
- 文档上传: 支持 PDF/DOCX/TXT/MD/CSV/XLSX
- 文档预览: Drawer 抽屉, 双 Tab (原件/Markdown)
- Chunk 查看: Modal, 按页码+索引排序
- 失败重试: 重新处理按钮
- 处理状态轮询: 每 3 秒刷新 processing 文档

### MCPPage 功能

- MCP Server 注册: 支持 stdio/http/sse 传输
- 启用/禁用: Toggle 开关
- 工具浏览: 查看 Server 发现的工具列表
- 工具刷新: 手动重新发现工具
- 删除: 移除 Server

### ChatInput 知识库选择器

- 知识库按钮 → 下拉弹窗多选
- 选中知识库显示为标签 (可删除)
- 发送消息时携带 `kb_ids`

### 工具调用展示

- ToolCallBlock: 展示调用中(蓝色旋转)/成功(绿色)/失败(红色)
- 可展开查看参数 JSON 和返回结果
- 集成在 MessageItem 中, 显示在正文上方

### RAGSourceIndicator

- 展示检索到的知识片段数量
- 展开查看各片段内容、文件名、页码和相关度

---

## 新增/修改文件列表

### Backend 新增

| 文件 | 说明 |
|------|------|
| `app/models/knowledge_base.py` | KnowledgeBase ORM 模型 |
| `app/models/document.py` | Document ORM 模型 (含 minio_md_path) |
| `app/models/mcp_server.py` | MCPServer ORM 模型 |
| `app/schemas/knowledge.py` | 知识库 Pydantic Schema |
| `app/schemas/mcp.py` | MCP Pydantic Schema |
| `app/core/rag/__init__.py` | RAG 模块入口 |
| `app/core/rag/embedder.py` | Embedding 服务 (text-embedding-v4) |
| `app/core/rag/vector_store.py` | Milvus 向量存储操作 |
| `app/core/rag/document_processor.py` | 文档处理 Pipeline |
| `app/core/rag/retriever.py` | RAG 检索 + Rerank |
| `app/core/rag/file2md.py` | 文档 → Markdown 转换器 |
| `app/core/tools/__init__.py` | 工具系统入口 |
| `app/core/tools/registry.py` | 工具注册表 (内置+MCP 统一管理) |
| `app/core/tools/mcp_client.py` | MCP 客户端 (HTTP/stdio 传输) |
| `app/core/tools/builtin/__init__.py` | 内置工具入口 |
| `app/core/tools/builtin/web_search.py` | web_search 插件 (DuckDuckGo) |
| `app/core/tools/executor.py` | 自定义 HTTP 工具执行器 |
| `app/models/custom_tool.py` | CustomTool ORM 模型 |
| `app/api/v1/knowledge.py` | 知识库 CRUD + 文档上传/预览 API |
| `app/api/v1/mcp.py` | MCP Server 管理 + 工具发现 API |
| `app/api/v1/tools.py` | 工具管理 API (内置+自定义 CRUD) |

### Backend 修改

| 文件 | 变更 |
|------|------|
| `app/models/__init__.py` | 导出 KnowledgeBase, Document, MCPServer |
| `app/schemas/__init__.py` | 导出 knowledge, mcp schemas |
| `app/schemas/chat.py` | ChatRequest 新增 kb_ids 字段 |
| `app/config.py` | 新增 RAG 配置项 |
| `app/main.py` | 初始化 RAG + ToolRegistry + 注册 web_search |
| `app/api/v1/chat.py` | 集成 RAG 检索 + 多轮工具调用循环 |
| `app/core/llm/base.py` | StreamChunk 新增 tool_calls 字段 |
| `app/core/llm/deepseek.py` | 累积 tool_call 增量, 正确 finish_reason |
| `app/core/llm/qwen.py` | 累积 tool_call 增量, 正确 finish_reason |
| `requirements.txt` | 新增 duckduckgo-search, PyMuPDF 等 |

### Frontend 新增

| 文件 | 说明 |
|------|------|
| `src/stores/knowledgeStore.ts` | 知识库 Zustand store |
| `src/stores/toolStore.ts` | 工具管理 Zustand store |
| `src/pages/ToolsPage.tsx` | 工具管理页面 (内置+自定义) |
| `src/components/tools/RAGSourceIndicator.tsx` | RAG 引用指示器 |
| `src/components/tools/ToolCallBlock.tsx` | 工具调用展示块 |
| `src/components/common/Drawer.tsx` | 通用抽屉组件 |
| `src/components/knowledge/DocumentPreviewDrawer.tsx` | 文档预览抽屉 |

### Frontend 修改

| 文件 | 变更 |
|------|------|
| `src/types/index.ts` | 新增 RAGSource, ToolCall, KnowledgeBase 等类型 |
| `src/services/api.ts` | 新增 tool_call/tool_result SSE 事件处理, MCP refresh API |
| `src/stores/chatStore.ts` | 新增 toolCalls 追踪, onToolCall/onToolResult 回调 |
| `src/stores/mcpStore.ts` | 新增 refreshServer 方法 |
| `src/pages/KnowledgePage.tsx` | 完整实现 (预览/chunk/重试/排序) |
| `src/pages/MCPPage.tsx` | 自动 loadServers |
| `src/components/mcp/MCPServerList.tsx` | 新增刷新工具按钮 |
| `src/components/chat/ChatInput.tsx` | 知识库选择器 |
| `src/components/chat/MessageItem.tsx` | 渲染 ToolCallBlock + RAGSourceIndicator |
| `src/components/chat/MarkdownContent.tsx` | LaTeX 预处理 (公式渲染) |

---

## 配置参数

```env
# RAG
RAG_ENABLED=true
RAG_TOP_K=5
RAG_ANN_TOP_K=20
RAG_USE_RERANK=true
MINIO_BUCKET=kk-gpt-files
```

---

## 技术决策

| 决策 | 原因 |
|------|------|
| 用 text-embedding-v4 而非 OpenAI embedding | 已有千问 API Key, 1024 维度足够 |
| 用 pymilvus 而非 langchain-milvus | 更轻量, 不引入额外封装层 |
| 用 BackgroundTasks 而非 Celery | 开发阶段足够, 不增加基础设施复杂度 |
| 自研 File2Markdown 替代 LangChain loaders | 统一输出格式, 支持图片提取, 更可控 |
| 自研轻量 MCP Client 而非 MCP SDK | SDK 版本变动快, 核心协议简单 (JSON-RPC 2.0) |
| 内置工具 + MCP 统一注册表 | 统一路由分发, 对 LLM 透明 |
| LLM Provider 累积 tool_call 增量 | 避免 chat.py 处理流式 tool_call 拼装的复杂性 |
| 最多 5 轮工具调用 | 防止无限循环, 兼顾复杂任务 |
| DuckDuckGo 作为默认搜索 | 免费无 API Key, 开箱即用 |
| Rerank 走 httpx 直接调用 | qwen3-rerank 不在 OpenAI SDK embeddings API 中 |
| 内置工具开关用 Redis Set | 轻量无需加表, 读写 O(1), 天然支持默认全启用 |
| 每次请求清除用户级工具 | 全局 Registry 共享, 必须隔离避免跨用户工具泄漏 |
