# KK NL2SQL AIBot — API 接口文档 v1

> Base URL: `http://localhost/api/v1`
> OpenAPI Docs: `http://localhost/docs`
> 更新日期: 2026-02-11

---

## 目录

- [1. 认证 (Auth)](#1-认证-auth)
- [2. 会话管理 (Conversations)](#2-会话管理-conversations)
- [3. 流式对话 (Chat SSE)](#3-流式对话-chat-sse)
- [4. 模型列表 (Models)](#4-模型列表-models)
- [5. 健康检查 (Health)](#5-健康检查-health)
- [6. SSE 事件协议](#6-sse-事件协议)
- [7. 错误码](#7-错误码)

---

## 1. 认证 (Auth)

所有需要登录的接口通过 `Authorization: Bearer <access_token>` 传递 JWT。

### 1.1 注册

```
POST /api/v1/auth/register
```

**Request Body:**

```json
{
  "email": "user@example.com",    // 必填, 合法邮箱
  "password": "123456",           // 必填, 6-128 位
  "nickname": "张三"              // 可选, 默认 "User", 最长 100 字符
}
```

**Response 201:**

```json
{
  "access_token": "eyJhbGciOi...",
  "refresh_token": "eyJhbGciOi...",
  "token_type": "bearer"
}
```

**Error 400:** `{"detail": "Email already registered"}`

---

### 1.2 登录

```
POST /api/v1/auth/login
```

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "123456"
}
```

**Response 200:**

```json
{
  "access_token": "eyJhbGciOi...",     // 有效期 15 分钟
  "refresh_token": "eyJhbGciOi...",    // 有效期 7 天
  "token_type": "bearer"
}
```

**Error 401:** `{"detail": "Invalid email or password"}`
**Error 403:** `{"detail": "Account is disabled"}`

---

### 1.3 刷新 Token

```
POST /api/v1/auth/refresh
```

**Request Body:**

```json
{
  "refresh_token": "eyJhbGciOi..."
}
```

**Response 200:** 同登录返回格式（新的 access_token + refresh_token）

> 旧的 refresh_token 自动加入 Redis 黑名单，不可复用。

**Error 401:** `{"detail": "Invalid refresh token"}` / `{"detail": "Token has been revoked"}`

---

### 1.4 获取当前用户

```
GET /api/v1/auth/me
Authorization: Bearer <access_token>
```

**Response 200:**

```json
{
  "id": "b068c9c1-d6f3-48c2-aea4-3d7d83871ba1",
  "email": "user@example.com",
  "nickname": "张三",
  "role": "user",          // "user" | "tenant_admin" | "super_admin"
  "is_active": true
}
```

---

### 1.5 登出

```
POST /api/v1/auth/logout
Authorization: Bearer <access_token>
```

**Request Body:**

```json
{
  "refresh_token": "eyJhbGciOi..."
}
```

**Response 204:** (无返回体)

---

## 2. 会话管理 (Conversations)

> 所有接口需要 `Authorization: Bearer <access_token>`

### 2.1 列出会话

```
GET /api/v1/conversations?page=1&page_size=50
```

**Query Parameters:**

| 参数 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `page` | int | 1 | 页码 (≥1) |
| `page_size` | int | 50 | 每页数量 (1-100) |

**Response 200:**

```json
[
  {
    "id": "a0f3e493-4018-4709-81e3-8172306ba854",
    "title": "FastAPI 项目架构设计",
    "model": "deepseek-chat",
    "created_at": "2026-02-11T08:55:46.911795+00:00",
    "updated_at": "2026-02-11T08:55:46.911801+00:00"
  }
]
```

> 按 `updated_at` 倒序排列。

---

### 2.2 创建会话

```
POST /api/v1/conversations
```

**Request Body:**

```json
{
  "title": "New Chat",           // 可选, 默认 "New Chat"
  "model": "deepseek-chat"      // 可选, 默认 "deepseek-chat"
}
```

**Response 201:** 同 ConversationResponse 格式

---

### 2.3 获取会话详情 (含消息)

```
GET /api/v1/conversations/{conversation_id}
```

**Response 200:**

```json
{
  "id": "a0f3e493-...",
  "title": "FastAPI 项目架构设计",
  "model": "deepseek-chat",
  "created_at": "2026-02-11T08:55:46+00:00",
  "updated_at": "2026-02-11T08:56:53+00:00",
  "messages": [
    {
      "id": "1efbd9f2-...",
      "role": "user",
      "content": "帮我设计一个 FastAPI 项目结构",
      "reasoning_content": null,
      "usage": null,
      "created_at": "2026-02-11T08:55:51+00:00"
    },
    {
      "id": "bad8371b-...",
      "role": "assistant",
      "content": "好的，这是推荐的项目结构...",
      "reasoning_content": "用户需要一个标准的FastAPI项目布局...",   // 思考模式才有值
      "usage": {
        "prompt_tokens": 33,
        "completion_tokens": 150,
        "total_tokens": 183,
        "reasoning_tokens": 120       // 思考模式才有值
      },
      "created_at": "2026-02-11T08:55:53+00:00"
    }
  ]
}
```

**Error 404:** `{"detail": "Conversation not found"}`

---

### 2.4 更新会话

```
PATCH /api/v1/conversations/{conversation_id}
```

**Request Body (partial update):**

```json
{
  "title": "新标题",      // 可选
  "model": "qwen-plus"   // 可选
}
```

**Response 200:** 同 ConversationResponse 格式

---

### 2.5 删除会话

```
DELETE /api/v1/conversations/{conversation_id}
```

**Response 204:** (无返回体)

> 级联删除所有关联消息。

---

## 3. 流式对话 (Chat SSE)

### 3.1 发送消息

```
POST /api/v1/chat
Content-Type: application/json
Authorization: Bearer <access_token>
→ Response: text/event-stream (SSE)
```

**Request Body:**

```json
{
  "conversation_id": "a0f3e493-...",  // 可选, null = 自动创建新会话
  "model": "deepseek-chat",           // "deepseek-chat" | "qwen-plus"
  "messages": [
    {
      "role": "user",
      "content": "你好，请介绍一下你自己"
    }
  ],
  "thinking_enabled": false            // true = 启用思考模式
}
```

**Response:** `text/event-stream` — 详见 [第 6 节 SSE 事件协议](#6-sse-事件协议)

---

### 3.2 前端调用示例

```typescript
const res = await fetch('/api/v1/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({
    conversation_id: convId,
    model: 'deepseek-chat',
    messages: [{ role: 'user', content: '你好' }],
    thinking_enabled: true,
  }),
})

const reader = res.body.getReader()
const decoder = new TextDecoder()
let buffer = ''

while (true) {
  const { done, value } = await reader.read()
  if (done) break

  buffer += decoder.decode(value, { stream: true })
  const lines = buffer.split('\n')
  buffer = lines.pop() || ''

  for (const line of lines) {
    if (!line.startsWith('data: ')) continue
    const event = JSON.parse(line.slice(6))

    switch (event.type) {
      case 'meta':      // { conversation_id: "..." }
      case 'reasoning': // { data: "思考过程片段..." }
      case 'content':   // { data: "回答内容片段..." }
      case 'done':      // { usage: {...}, model: "..." }
      case 'error':     // { data: "错误信息" }
    }
  }
}
```

---

## 4. 模型列表 (Models)

```
GET /api/v1/models
```

> 无需认证。

**Response 200:**

```json
{
  "models": [
    {
      "id": "deepseek-chat",
      "name": "DeepSeek V3.2 (对话)",
      "provider": "deepseek",
      "supports_thinking": true,
      "description": "DeepSeek v3.2 混合推理模型，支持普通对话和深度推理两种模式"
    },
    {
      "id": "qwen-plus",
      "name": "千问 Plus (对话)",
      "provider": "qwen",
      "supports_thinking": true,
      "description": "阿里千问 Plus 模型，支持普通对话和深度推理"
    }
  ]
}
```

**前端用法:** 用 `id` 作为 `ChatRequest.model` 的值；`supports_thinking` 控制是否显示思考开关。

---

## 5. 健康检查 (Health)

```
GET /api/v1/health
```

> 无需认证。

**Response 200:**

```json
{
  "status": "healthy",              // "healthy" | "degraded"
  "version": "0.1.0",
  "services": {
    "postgresql": "ok",
    "redis": "ok",
    "milvus": "ok",
    "minio": "ok"
  },
  "timestamp": "2026-02-11T08:53:34.999923+00:00"
}
```

---

## 6. SSE 事件协议

`POST /api/v1/chat` 返回 `text/event-stream`，每个事件格式为 `data: <JSON>\n\n`。

### 6.1 事件类型总览

| type | 时序 | 说明 | data 结构 |
|---|---|---|---|
| `meta` | 第1个 | 会话元信息 | `{ conversation_id: string }` |
| `memory_recall` | meta 之后 | 召回的记忆 (有记忆时才发) | `{ data: { memories: [...], preferences: [...] } }` |
| `reasoning` | 思考阶段 | 思考过程增量片段 | `{ data: string }` |
| `content` | 回答阶段 | 回答内容增量片段 | `{ data: string }` |
| `done` | 最后 | 完成信号 + token 统计 | `{ usage: object, model: string }` |
| `error` | 任意 | 错误信息 | `{ data: string }` |

### 6.2 memory_recall 事件 (Phase 4 新增)

当 MemOS 召回到相关记忆时发送，位于 `meta` 之后、`reasoning`/`content` 之前：

```
data: {"type":"memory_recall","data":{"memories":[{"id":"5ef51b01-...","content":"旅行准备建议: 助手建议...","relevance":0.574,"source":"旅行准备, 住宿建议"}],"preferences":[{"id":"15c9b9b6-...","type":"explicit_preference","content":"用户偏好于住在全季酒店。"}]}}
```

**memories 数组元素:**

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 记忆 UUID |
| `content` | string | "memory_key: memory_value" |
| `relevance` | number | 0-1 相关度 |
| `source` | string | 标签 (逗号分隔) |

**preferences 数组元素:**

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 偏好 UUID |
| `type` | string | "explicit_preference" / "implicit_preference" |
| `content` | string | 偏好描述 |

> 前端 `MemoryIndicator` 组件自动渲染。无记忆时不发送此事件。

### 6.3 普通对话模式 (`thinking_enabled: false`)

```
data: {"type":"meta","conversation_id":"a0f3e493-..."}

data: {"type":"content","data":"你好"}

data: {"type":"content","data":"，我是"}

data: {"type":"content","data":"KK NL2SQL AIBot"}

data: {"type":"done","usage":{"prompt_tokens":33,"completion_tokens":15,"total_tokens":48,"reasoning_tokens":null},"model":"deepseek-chat"}
```

### 6.3 思考模式 (`thinking_enabled: true`)

```
data: {"type":"meta","conversation_id":"45d0ba73-..."}

data: {"type":"reasoning","data":"首先"}

data: {"type":"reasoning","data":"，需要分析"}

data: {"type":"reasoning","data":"这个问题..."}

data: {"type":"content","data":"根据分析，"}

data: {"type":"content","data":"答案是 9.8 更大。"}

data: {"type":"done","usage":{"prompt_tokens":37,"completion_tokens":295,"total_tokens":332,"reasoning_tokens":282},"model":"deepseek-chat"}
```

### 6.6 前端状态机

```
                ┌─ memory_recall ─┐
                │  (渲染记忆指示器) │
                ▼                 │
  meta ──► [记忆召回] ───────────►│
                                  │
                ┌─ reasoning ─────┐
                │   (追加到       │
                │  思考区域)      │
                ▼                 │
            [思考阶段] ──────────►│
                                  │
                ┌─ content ───────┐
                │  (追加到        │
                │  回答区域)      │
                ▼                 │
            [回答阶段] ──────────►│
                                  │
            done ──► [完成] ──────┘
                                  │
            error ──► [错误] ─────┘
```

**判断逻辑:**
- 收到 `memory_recall` → 存储记忆数据，附加到 assistant 消息 (MemoryIndicator)
- 收到 `reasoning` → 追加到思考区域 (ThinkingBlock)
- 收到 `content` → 追加到回答区域 (MessageBubble)
- 收到 `done` → 流结束，保存完整消息
- 收到 `error` → 显示错误提示

---

## 7. 错误码

### 7.1 HTTP 状态码

| 状态码 | 说明 |
|---|---|
| 200 | 成功 |
| 201 | 创建成功 |
| 204 | 操作成功 (无返回体) |
| 400 | 请求参数错误 |
| 401 | 未授权 / Token 无效或过期 |
| 403 | 禁止访问 / 账户已禁用 |
| 404 | 资源不存在 |
| 422 | 请求体验证失败 (Pydantic) |
| 500 | 服务器内部错误 |

### 7.2 错误响应格式

```json
{
  "detail": "错误描述文字"
}
```

Pydantic 验证失败 (422):

```json
{
  "detail": [
    {
      "type": "string_too_short",
      "loc": ["body", "password"],
      "msg": "String should have at least 6 characters",
      "input": "123"
    }
  ]
}
```

---

## 8. 认证流程图

```
[注册/登录]
     │
     ▼
┌──────────────────┐
│ access_token     │ ← 15min 有效期
│ refresh_token    │ ← 7 天有效期
└──────────────────┘
     │
     ▼ (每次请求)
┌──────────────────┐
│ Authorization:   │
│ Bearer <access>  │
└──────────────────┘
     │
     ├─ 200 OK → 正常返回
     │
     └─ 401 Unauthorized
          │
          ▼ (自动刷新)
     POST /auth/refresh
     { refresh_token }
          │
          ├─ 200 → 新 tokens → 重试原请求
          │
          └─ 401 → 跳转 /login
```

**前端 token 存储:**
- `localStorage('kk-access-token')` — access token
- `localStorage('kk-refresh-token')` — refresh token
- 登出时两者同时清除

---

## 9. 可用模型速查

| model ID | Provider | 支持思考 | 说明 |
|---|---|---|---|
| `deepseek-chat` | DeepSeek | ✅ | v3.2 混合推理模型 |
| `qwen-plus` | 千问 | ✅ | 阿里千问 Plus 模型 |

**思考模式:** 通过 `thinking_enabled: true` 开启。两个模型均支持，由后端 Provider 内部处理参数差异，前端无需关心。

---

## 10. 数据库 ER 图

```
┌──────────┐     1:N     ┌────────────────┐     1:N     ┌──────────┐
│  users   │────────────▶│ conversations  │────────────▶│ messages │
├──────────┤             ├────────────────┤             ├──────────┤
│ id (PK)  │             │ id (PK)        │             │ id (PK)  │
│ email    │             │ user_id (FK)   │             │ conv_id  │
│ password │             │ title          │             │ role     │
│ nickname │             │ model          │             │ content  │
│ role     │             │ settings (JSON)│             │ reasoning│
│ is_active│             │ created_at     │             │ usage    │
│ created  │             │ updated_at     │             │ created  │
└──────────┘             └────────────────┘             └──────────┘
```

> 删除会话时级联删除所有消息 (`ondelete="CASCADE"`)。

---

## 11. 知识库 API (Phase 5)

### 知识库 CRUD

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/v1/knowledge-bases` | 列出当前用户的知识库 |
| POST | `/api/v1/knowledge-bases` | 创建知识库 |
| GET | `/api/v1/knowledge-bases/{id}` | 知识库详情 (含文档列表) |
| PATCH | `/api/v1/knowledge-bases/{id}` | 更新知识库 |
| DELETE | `/api/v1/knowledge-bases/{id}` | 删除知识库 |

**创建请求体:**

```json
{
  "name": "产品文档",
  "description": "产品相关文档",
  "embedding_model": "text-embedding-v4",
  "embedding_dim": 1024,
  "chunk_size": 1000,
  "chunk_overlap": 200
}
```

### 文档管理

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/v1/knowledge-bases/{id}/documents` | 列出文档 |
| POST | `/api/v1/knowledge-bases/{id}/documents` | 上传文档 (multipart/form-data) |
| DELETE | `/api/v1/knowledge-bases/{id}/documents/{doc_id}` | 删除文档 |

**上传:** `multipart/form-data`, field name: `file`
**支持格式:** PDF, DOCX, TXT, MD, CSV (最大 50MB)
**处理流程:** uploading → processing → ready / failed (前端轮询)

### 对话中使用知识库

ChatRequest 新增 `kb_ids` 字段:

```json
{
  "model": "deepseek-chat",
  "messages": [{"role": "user", "content": "..."}],
  "kb_ids": ["kb-uuid-1", "kb-uuid-2"]
}
```

### SSE 新增事件: rag_source

```json
{"type": "rag_source", "data": [
  {"content": "检索到的文本片段...", "score": 0.804, "source": "文件路径"}
]}
```

---

## 12. MCP 管理 API (Phase 5)

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/v1/mcp/servers` | 列出 MCP Server |
| POST | `/api/v1/mcp/servers` | 注册 MCP Server |
| DELETE | `/api/v1/mcp/servers/{id}` | 删除 |
| PATCH | `/api/v1/mcp/servers/{id}/toggle` | 启用/禁用 |
| GET | `/api/v1/mcp/servers/{id}/tools` | 列出工具 |
| GET | `/api/v1/mcp/tools` | 聚合所有可用工具 |

**注册请求体:**

```json
{
  "name": "Web Search",
  "transport_type": "sse",
  "config": "http://localhost:3100/sse"
}
```

---

## 13. 更新后的 ER 图

```
┌──────────┐     1:N     ┌────────────────┐     1:N     ┌──────────┐
│  users   │────────────▶│ conversations  │────────────▶│ messages │
├──────────┤             ├────────────────┤             ├──────────┤
│ id (PK)  │             │ id (PK)        │             │ id (PK)  │
│ email    │       ┌────▶│ user_id (FK)   │             │ conv_id  │
│ password │       │     │ title          │             │ role     │
│ nickname │       │     │ model          │             │ content  │
│ role     │       │     │ created_at     │             │ reasoning│
│ is_active│       │     │ updated_at     │             │ usage    │
│ created  │       │     └────────────────┘             │ created  │
└──────────┘       │                                    └──────────┘
      │            │
      │  1:N       │  1:N
      ▼            ▼
┌──────────────┐  ┌──────────────┐     1:N     ┌────────────┐
│knowledge_bases│  │ mcp_servers  │             │ documents   │
├──────────────┤  ├──────────────┤             ├────────────┤
│ id (PK)      │  │ id (PK)      │             │ id (PK)    │
│ user_id (FK) │  │ user_id (FK) │             │ kb_id (FK) │
│ name         │  │ name         │             │ filename   │
│ description  │  │ transport    │             │ file_type  │
│ embed_model  │  │ config       │             │ file_size  │
│ embed_dim    │  │ enabled      │             │ minio_path │
│ chunk_size   │  │ tools_cache  │             │ status     │
│ chunk_overlap│  │ created_at   │             │ chunk_count│
│ doc_count    │  └──────────────┘             │ error_msg  │
│ created_at   │◀────────────────────────────│ created_at │
│ updated_at   │         1:N                  └────────────┘
└──────────────┘
```
