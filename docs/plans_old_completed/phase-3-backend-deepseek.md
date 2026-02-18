# Phase 3: 后端核心 — DeepSeek + 千问 双模式 + SSE + 会话 + 认证

## 状态: ✅ 已完成 (2026-02-11)

## 目标

实现后端核心功能：**DeepSeek (v3.2) + 千问 (qwen-plus) 双 Provider**，统一思考/对话双模式，SSE 流式输出包含思考过程，会话持久化，JWT 认证，完成与 Phase 2 前端的真实对接。

---

## 完成清单

### 3.1 LLM 抽象层

- [x] `BaseLLMProvider` 抽象基类 (`app/core/llm/base.py`)
- [x] `StreamChunk` 统一流式数据块 (type: reasoning/content/tool_call/usage/done/error)
- [x] `ModelInfo` 模型元信息
- [x] `DeepSeekProvider` — 对接 DeepSeek v3.2 (`app/core/llm/deepseek.py`)
  - 统一使用 `deepseek-chat` 入口
  - 思考模式通过 `extra_body={"thinking": {"type": "enabled"}}` 开启
- [x] `QwenProvider` — 对接千问 qwen-plus (`app/core/llm/qwen.py`)
  - 思考模式通过 `extra_body={"enable_thinking": True}` 开启
  - 流式 usage 通过 `stream_options={"include_usage": True}` 获取
- [x] `LLMRouter` — 按 model_id 自动路由到对应 Provider (`app/core/llm/router.py`)

### 3.2 SSE 流式 Chat API

- [x] `POST /api/v1/chat` → `text/event-stream`
- [x] SSE 事件类型: `meta` → `reasoning` → `content` → `done` / `error`
- [x] 消息持久化: user + assistant 消息保存到 DB
- [x] `reasoning_content` + `usage` (含 reasoning_tokens) 完整持久化
- [x] 上下文窗口: 自动加载最近 20 条历史消息
- [x] 首条消息自动更新会话标题

### 3.3 会话管理

- [x] `GET /api/v1/conversations` — 分页列表
- [x] `POST /api/v1/conversations` — 创建
- [x] `GET /api/v1/conversations/{id}` — 详情 + 消息
- [x] `PATCH /api/v1/conversations/{id}` — 更新标题/模型
- [x] `DELETE /api/v1/conversations/{id}` — 删除 (级联删除消息)

### 3.4 认证系统

- [x] `POST /api/v1/auth/register` — 注册
- [x] `POST /api/v1/auth/login` — 登录 (JWT access + refresh)
- [x] `POST /api/v1/auth/refresh` — 刷新 token (旧 token 加黑名单)
- [x] `GET /api/v1/auth/me` — 当前用户信息
- [x] `POST /api/v1/auth/logout` — 登出 (黑名单 refresh token)
- [x] JWT access token 15min, refresh token 7d
- [x] bcrypt 密码哈希
- [x] Redis 存储 token 黑名单

### 3.5 模型列表

- [x] `GET /api/v1/models` — 返回所有可用模型

### 3.6 前后端对接

- [x] `src/services/api.ts` — 统一 HTTP 客户端 + SSE 流式解析
- [x] `src/stores/authStore.ts` — 对接真实 JWT 认证
- [x] `src/stores/chatStore.ts` — 对接真实 SSE 流式 API
- [x] `src/components/deepseek/ModelSelector.tsx` — DeepSeek + 千问切换 + 思考开关
- [x] `src/types/index.ts` — ModelId 更新 (deepseek-chat / qwen-plus)

### 3.7 数据模型

- [x] `User` — id(UUID), email, password_hash, nickname, role, is_active, created_at
- [x] `Conversation` — id(UUID), user_id(FK), title, model, settings(JSON), created_at, updated_at
- [x] `Message` — id(UUID), conversation_id(FK), role, content, reasoning_content, usage(JSON), created_at
- [x] 自动建表 (开发阶段 `Base.metadata.create_all`)

---

## 验证结果

| 验证项 | 状态 | 备注 |
|---|---|---|
| DeepSeek 思考模式 SSE (reasoning → content) | ✅ | 先流式 reasoning 再 content |
| DeepSeek 对话模式 SSE (content only) | ✅ | 直接流式 content |
| 千问 qwen-plus SSE (normal + thinking) | ✅ | 同 DeepSeek 行为一致 |
| 模型切换 (deepseek-chat ↔ qwen-plus) | ✅ | LLMRouter 自动路由 |
| 会话 CRUD (新建/列表/详情/更新/删除) | ✅ | 全部测试通过 |
| 消息持久化 (user + assistant + reasoning + usage) | ✅ | 包含 reasoning_tokens |
| 认证全流程 (注册/登录/刷新/me/登出) | ✅ | JWT + Redis 黑名单 |
| 未授权访问 → 401 | ✅ | HTTPBearer 自动拦截 |
| 前端路由全部 200 | ✅ | /, /login, /register, /mcp, /knowledge, /admin |
| 10 容器全部 healthy | ✅ | docker ps 确认 |

---

## 新增文件列表

### 后端 (14 files)

```
backend/app/
├── models/
│   ├── user.py              # User ORM
│   ├── conversation.py      # Conversation ORM
│   └── message.py           # Message ORM
├── schemas/
│   ├── auth.py              # Register/Login/Token/User Schema
│   └── chat.py              # Chat/Conv/Message Schema
├── core/
│   ├── security.py          # JWT + bcrypt
│   ├── deps.py              # get_current_user 依赖注入
│   └── llm/
│       ├── base.py          # BaseLLMProvider + StreamChunk
│       ├── deepseek.py      # DeepSeek Provider
│       ├── qwen.py          # Qwen Provider
│       └── router.py        # LLMRouter
└── api/v1/
    ├── auth.py              # 认证 API
    ├── conversations.py     # 会话管理 API
    ├── chat.py              # SSE Chat API
    └── models.py            # 模型列表 API
```

### 前端 (1 new + 6 modified)

```
frontend/src/
├── services/
│   └── api.ts               # [NEW] 统一 HTTP + SSE 客户端
├── stores/
│   ├── authStore.ts          # [MOD] 对接真实 JWT
│   └── chatStore.ts          # [MOD] 对接真实 SSE
├── components/deepseek/
│   └── ModelSelector.tsx     # [MOD] 双 Provider + 思考开关
├── types/index.ts            # [MOD] ModelId 更新
├── App.tsx                   # [MOD] auth init
└── pages/
    ├── LoginPage.tsx         # [MOD] 错误提示
    └── RegisterPage.tsx      # [MOD] 错误提示
```

---

## 技术决策记录

1. **DeepSeek v3.2 混合推理**: 统一用 `deepseek-chat` 入口，通过 `thinking` 参数切换模式（不再分 `deepseek-reasoner`）
2. **双 Provider 架构**: DeepSeek + 千问并行，LLMRouter 统一路由
3. **bcrypt 直接使用**: 弃用 passlib（与 bcrypt>=4.1 不兼容），直接使用 bcrypt 库
4. **PG 12 UUID**: `uuid_generate_v4()` 替代 `gen_random_uuid()`（PG 12 不原生支持后者）
5. **开发阶段自动建表**: `create_all` 替代 Alembic（降低开发复杂度，生产再切换）
