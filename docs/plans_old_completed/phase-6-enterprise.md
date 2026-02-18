# Phase 6: 企业功能 — 多租户 + RBAC + 审计 + 计费

**状态: ✅ 已完成**
**完成日期: 2026-02-12**

---

## 目标

为系统增加企业级能力：数据隔离、权限控制、操作追踪、用量管控。

---

## 完成情况

### 验证结果

| 验证项 | 结果 | 说明 |
|--------|------|------|
| 多租户数据隔离 | ✅ | User/Conversation 表添加 tenant_id，启动自动创建默认租户 |
| 默认租户自动分配 | ✅ | 新注册用户自动分配默认租户，孤儿数据自动修补 |
| RBAC 三级角色 | ✅ | super_admin / tenant_admin / user，require_role 依赖 |
| tenant_admin 只管本租户 | ✅ | 用户列表/审计日志/计费数据自动过滤 tenant_id |
| user 无法访问 admin API | ✅ | require_role 403 拒绝 |
| 审计日志记录 | ✅ | login/register/admin 操作自动记录 (IP+UA+detail) |
| Token 用量实时统计 | ✅ | 每次 LLM 调用后记录 UsageRecord + Redis 月度计数器 |
| 额度检查 | ✅ | 聊天前 check_quota()，超额返回 429 |
| 模型单价计费 | ✅ | 4 个模型定价，自动计算费用 |
| Dashboard 总览 | ✅ | 用户数/消息数/Token/租户数 + Recharts 7日趋势图 |
| 用户管理 CRUD | ✅ | 列表/搜索/创建/角色修改/启停/分页 |
| 租户管理 CRUD | ✅ | 列表/创建/编辑配额/禁用 |
| 计费仪表盘 | ✅ | 日趋势(BarChart) + 模型分布(PieChart) + Top用户 + 配额进度 |
| 审计日志页面 | ✅ | 时间线 + 按 action 过滤 + 分页 |
| Sidebar Admin 入口 | ✅ | tenant_admin+ 才显示管理后台按钮 |
| 前端零 TS 错误 | ✅ | Recharts 类型兼容处理 |
| 历史会话消息持久化 | ✅ | Message.extra JSONB 存储 tool_calls/memories/ragSources |
| 历史会话跳转 | ✅ | 点击侧边栏历史会话自动 navigate('/') |
| MCP 标准 JSON 导入 | ✅ | 粘贴 Claude Desktop/Cursor 配置直接导入 |
| MCP 编辑/删除 | ✅ | 编辑弹窗 (JSON/字段双模式) + 删除确认 |
| MCP env 环境变量 | ✅ | MCPServer.env JSON 列, stdio 启动时注入 |

---

## 6.1 多租户 (Multi-Tenant)

### 隔离策略

共享数据库 + `tenant_id` 行级过滤:

- `users` 表添加 `tenant_id` FK → `tenants.id`
- `conversations` 表添加 `tenant_id` FK → `tenants.id`
- 启动时自动创建「默认租户」，分配孤儿用户
- 新注册用户自动绑定 `app.state.default_tenant_id`
- Admin 查询自动按 tenant_id 过滤 (tenant_admin 只看本租户)

### 数据库迁移

开发阶段使用 `ALTER TABLE ADD COLUMN IF NOT EXISTS`，在 `lifespan` 中执行:

```python
async with engine.begin() as conn:
    await conn.run_sync(Base.metadata.create_all)
    # Phase 6: 为已有表添加新字段
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL"
    "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL"
```

### 租户模型

```python
class Tenant(Base):
    __tablename__ = "tenants"
    id: UUID
    name: str (unique)
    config: JSON  # allowed_models, token_quota, storage_quota_mb, max_users
    is_active: bool
    created_at / updated_at: datetime
```

默认租户配置:
```python
DEFAULT_TENANT_CONFIG = {
    "allowed_models": ["deepseek-chat", "deepseek-reasoner", "qwen-plus"],
    "token_quota": 0,            # 0 = 无限制
    "storage_quota_mb": 10240,
    "max_users": 100,
}
```

---

## 6.2 RBAC 权限管理

### 三级角色

| 角色 | 权限范围 |
|------|---------|
| `super_admin` | 全局: 租户 CRUD、全部用户管理、计费配额、系统配置 |
| `tenant_admin` | 本租户: 用户管理(仅 user 角色)、用量查看、审计日志 |
| `user` | 本人: 对话、文件上传、使用已配置的功能 |

### 权限依赖

```python
def require_role(*roles: str):
    """用法: user: User = Depends(require_role("super_admin", "tenant_admin"))"""
    async def _check(current_user: User = Depends(get_current_user)):
        if current_user.role not in roles:
            raise HTTPException(403, "Insufficient permissions")
        return current_user
    return _check
```

### 管理 API

| 端点 | 方法 | 权限 | 功能 |
|------|------|------|------|
| `/api/v1/admin/dashboard` | GET | tenant_admin+ | 总览统计 |
| `/api/v1/admin/tenants` | GET | super_admin | 列出所有租户 (含用户计数) |
| `/api/v1/admin/tenants` | POST | super_admin | 创建租户 |
| `/api/v1/admin/tenants/{id}` | PATCH | super_admin | 更新租户配置 |
| `/api/v1/admin/tenants/{id}` | DELETE | super_admin | 禁用租户 (软删除) |
| `/api/v1/admin/users` | GET | tenant_admin+ | 列出用户 (分页+搜索, 租户过滤) |
| `/api/v1/admin/users` | POST | tenant_admin+ | 创建用户 |
| `/api/v1/admin/users/{id}` | PATCH | tenant_admin+ | 修改角色/状态/租户 |
| `/api/v1/admin/users/{id}` | DELETE | tenant_admin+ | 禁用用户 (软删除) |
| `/api/v1/admin/audit-logs` | GET | tenant_admin+ | 查询审计日志 (分页+action过滤) |
| `/api/v1/admin/billing/summary` | GET | tenant_admin+ | 用量汇总 (日/模型/Top用户) |
| `/api/v1/admin/billing/details` | GET | tenant_admin+ | 明细查询 |
| `/api/v1/admin/billing/quota` | GET/PATCH | super_admin | 查看/修改配额 |

---

## 6.3 审计日志

### 数据模型

```python
class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: UUID
    tenant_id: UUID (nullable, FK)
    user_id: UUID (nullable, FK)
    action: str       # login, register, chat, upload, create_user, update_user, ...
    resource: str     # "user:xxx", "tenant:xxx"
    detail: JSON      # 变更详情
    ip: str           # 客户端 IP (X-Forwarded-For)
    user_agent: str
    created_at: datetime (indexed)
```

### 记录方式

通过 `audit_log()` 函数在关键操作后显式调用:
- `auth.py`: login, register
- `admin.py`: create_user, update_user, delete_user, create_tenant, update_tenant, delete_tenant, update_quota

---

## 6.4 用量计费

### 数据模型

```python
class UsageRecord(Base):
    __tablename__ = "usage_records"
    id: UUID
    tenant_id: UUID (nullable)
    user_id: UUID
    model: str
    input_tokens: int
    output_tokens: int
    total_tokens: int
    cost: float
    trigger_type: str    # "chat" | "memory_extract" | "rag_embedding"
    conversation_id: UUID (nullable)
    created_at: datetime
```

### 模型单价 (¥/1K tokens)

| 模型 | 输入 | 输出 |
|------|------|------|
| deepseek-chat | 0.001 | 0.002 |
| deepseek-reasoner | 0.004 | 0.016 |
| qwen-plus | 0.0008 | 0.002 |
| qwen3-235b-a22b | 0.004 | 0.016 |

### 计费流程

```
1. 聊天前: check_quota(tenant_id, config) → 超额返回 429
2. LLM 调用: 正常流式对话
3. 完成后: record_usage(db, user_id, tenant_id, model, tokens, ...)
   → DB 插入 UsageRecord
   → Redis INCRBY tenant:{id}:monthly_tokens:{YYYY-MM} (35天TTL)
```

### 额度控制

- Redis 缓存 `tenant:{id}:monthly_tokens:{YYYY-MM}` 当月已用量
- `check_quota()`: 对比 `tenant.config.token_quota`
- `token_quota=0` 表示无限制
- 超额时返回 HTTP 429 + 中文提示

---

## 6.5 Admin 前端

### Dashboard

- 4 张 StatCard: 用户数 / 今日消息 / 租户数 / 月Token
- Recharts BarChart 7 日趋势图 (Token 用量)

### UserManagementPage

- 搜索框 (email/nickname 模糊搜索)
- 创建用户 Modal (email, password, nickname, role, tenant 选择)
- 表格: 用户名/邮箱, 角色(可切换 select), 租户, 状态(可toggle), 操作(禁用)
- 分页

### TenantManagementPage

- 卡片式布局 (租户名, 用户数, Token额度, 最大用户)
- 新建租户 Modal
- 编辑配置 Modal (名称, Token额度, 最大用户)

### BillingPage

- 周/月 切换
- 3 张 StatCard: 请求数 / Token用量 / 费用
- 配额进度条 (有额度限制时)
- Recharts BarChart 日趋势
- Recharts PieChart 模型分布
- Top 5 用户排行
- 模型单价表

### AuditLogsPage

- action 下拉过滤 (全部/登录/注册/对话/上传/用户管理/租户管理)
- 时间线列表 (用户名, action badge, resource, detail, IP, 时间)
- 分页

### 入口

- Sidebar 仅 `super_admin` / `tenant_admin` 显示「管理后台」按钮
- AdminLayout 左侧导航: Overview / Users / Tenants / Usage Metrics / System Logs

---

## 6.6 消息过程信息持久化

### 问题
对话中的工具调用、记忆召回、知识库检索等过程信息只存在前端内存，刷新/切换会话后丢失。

### 方案
Message 模型新增 `extra` JSONB 列 (注: `metadata` 是 SQLAlchemy 保留字)：

```python
class Message(Base):
    # ...
    extra: Mapped[dict | None] = mapped_column("extra", JSON, default=None)
    # extra: {
    #   "tool_calls": [{"id": "...", "name": "...", "arguments": {...}, "status": "success", "result": "..."}],
    #   "memories": [{"id": "...", "content": "...", "relevance": 0.8, "source": "..."}],
    #   "rag_sources": [{"content": "...", "score": 0.9, "source": "file.pdf"}],
    # }
```

### 数据流
```
SSE 生成期间 → 收集 _meta_tool_calls / _meta_memories / _meta_rag_sources
           → 保存到 assistant Message.extra (独立 session)
加载历史会话 → GET /conversations/{id} 返回 messages[].metadata
           → 前端 convDetailToConversation() 恢复 toolCalls/memories/ragSources
```

---

## 6.7 MCP 标准配置导入与管理

### 标准 JSON 导入
用户可直接粘贴 Claude Desktop / Cursor 等工具的标准 MCP 配置 JSON：

```json
{
  "mcpServers": {
    "tavily-remote-mcp": {
      "command": "npx -y mcp-remote https://mcp.tavily.com/mcp/?tavilyApiKey=xxx",
      "env": {}
    },
    "amap-maps": {
      "url": "https://mcp.amap.com/mcp?key=xxx"
    }
  }
}
```

自动解析规则:
- `command` (+ 可选 `args` 数组) → `transport_type: "stdio"`
- `url` → `transport_type: "http"`
- 兼容 `mcpServers` / `mcp_servers` / `servers` / 裸对象

### MCP Server 编辑/删除
- **编辑**: JSON 配置模式 + 字段编辑模式, 配置变更后自动重新发现工具
- **删除**: 确认弹窗后删除

### env 环境变量
- MCPServer 模型新增 `env` JSONB 列
- stdio 启动子进程时通过 `os.environ` 合并注入
- 支持标准配置 JSON 中的 `env` 字段

### API

| 端点 | 方法 | 功能 |
|------|------|------|
| `POST /mcp/servers/import` | POST | 批量导入标准 JSON 配置 |
| `PATCH /mcp/servers/{id}` | PATCH | 编辑 Server 配置 (名称/传输/命令/env) |
| `DELETE /mcp/servers/{id}` | DELETE | 删除 Server |

---

## 新增/修改文件列表

### Backend 新增

| 文件 | 说明 |
|------|------|
| `app/models/tenant.py` | Tenant ORM 模型 + DEFAULT_TENANT_CONFIG |
| `app/models/audit_log.py` | AuditLog ORM 模型 (复合索引) |
| `app/models/usage_record.py` | UsageRecord ORM 模型 (复合索引) |
| `app/core/billing.py` | 计费服务: MODEL_PRICING + record_usage + check_quota |
| `app/core/audit.py` | 审计服务: audit_log() 函数 |
| `app/api/v1/admin.py` | Admin API: dashboard/tenants/users/audit/billing |

### Backend 修改

| 文件 | 变更 |
|------|------|
| `app/models/user.py` | 新增 tenant_id FK + tenant relationship |
| `app/models/conversation.py` | 新增 tenant_id FK |
| `app/models/message.py` | 新增 extra JSONB 列 (tool_calls/memories/ragSources) |
| `app/models/mcp_server.py` | 新增 env JSONB 列 |
| `app/models/__init__.py` | 导出 Tenant, AuditLog, UsageRecord |
| `app/core/deps.py` | 新增 require_role() 权限依赖 |
| `app/schemas/auth.py` | UserResponse 新增 tenant_id |
| `app/schemas/chat.py` | MessageResponse 新增 metadata 字段 |
| `app/schemas/mcp.py` | MCPServerCreate 新增 env, 新增 MCPServerUpdate, MCPImportRequest |
| `app/api/v1/auth.py` | register 分配默认租户 + login/register 记录审计 |
| `app/api/v1/chat.py` | 额度检查 + 用量记录 + extra metadata 收集/保存 + 独立 session 修复 |
| `app/api/v1/conversations.py` | _msg_to_response 返回 extra→metadata |
| `app/api/v1/mcp.py` | 新增 import/update 端点, env 透传, _parse_standard_mcp_config() |
| `app/core/tools/mcp_client.py` | 构造函数支持 env, stdio 子进程注入 env, shlex.split 解析命令 |
| `app/core/memory/manager.py` | recall_timeout 3s→15s |
| `app/core/memory/memos_client.py` | httpx timeout 10s→30s |
| `app/main.py` | 注册 admin router + 默认租户创建 + ALTER TABLE 迁移 (messages.extra, mcp_servers.env) |

### Frontend 新增/修改

| 文件 | 说明 |
|------|------|
| `package.json` | 新增 recharts 依赖 |
| `src/types/index.ts` | MCPServer 新增 env 字段 |
| `src/services/api.ts` | adminApi + mcpApi.importServers/updateServer + ConvDetail.metadata + 错误解析优化 |
| `src/stores/chatStore.ts` | convDetailToConversation 恢复 toolCalls/memories/ragSources |
| `src/stores/mcpStore.ts` | updateServer + importServers actions, toServer 映射 env |
| `src/stores/authStore.ts` | tenant_id 从 /me 获取 |
| `src/components/chat/ConversationList.tsx` | 点击历史会话 navigate('/') 跳转 |
| `src/components/mcp/MCPRegisterForm.tsx` | 双 tab: 粘贴配置 (JSON) / 手动填写 |
| `src/components/mcp/MCPServerList.tsx` | 编辑弹窗 (JSON/字段双模式) + 删除确认 + 刷新 |
| `src/components/mcp/MCPToolBrowser.tsx` | 配置摘要 + 刷新/删除操作 |
| `src/pages/admin/DashboardPage.tsx` | Recharts 趋势图, 真实数据 |
| `src/pages/admin/UserManagementPage.tsx` | 搜索/创建/角色切换/启停/分页 |
| `src/pages/admin/TenantManagementPage.tsx` | 卡片/创建/编辑配额 (Modal 提取修复) |
| `src/pages/admin/BillingPage.tsx` | BarChart+PieChart+Top用户+单价 |
| `src/pages/admin/AuditLogsPage.tsx` | action过滤+时间线+分页 |
| `src/layouts/Sidebar.tsx` | Admin 入口 (role guard) |

---

## 配置参数

```env
# 无新增环境变量, 所有配置存储在 Tenant.config 中
# MODEL_PRICING 硬编码在 app/core/billing.py
```

---

## 已发现问题与修复

### P6-BUG-1: 前端租户创建输入卡顿
- **现象**: 创建租户 Modal 输入名称时严重卡顿
- **原因**: Modal 组件定义在父组件内部，每次 re-render 导致整个 Modal 重建、失去焦点
- **修复**: 提取 TenantModal 为独立顶层组件

### P6-BUG-2: 创建用户报错 `[object Object],[object Object]`
- **现象**: 创建用户时只显示 `[object Object],[object Object]`
- **原因**: FastAPI Pydantic 校验错误的 `detail` 是 array，前端直接 `new Error(detail)` 导致 toString
- **修复**: `api.ts` 解析 detail 数组，提取每项 `.msg` 拼接成可读字符串

### P6-BUG-3: SSE 流中 assistant 消息保存失败
- **现象**: 历史会话只有用户消息，标题始终为 "New Chat"
- **原因**: `async with db.begin()` 和 SSE 生成器中已有的隐式事务冲突，报 `A transaction is already begun`
- **修复**: 使用独立 `async_session_maker()` 新建 session 保存 assistant 消息

### P6-BUG-4: MemOS 记忆召回超时
- **现象**: 对话不再检索记忆
- **原因**: MemOS Cloud search/memory 接口响应变慢 (>10s)，3s 超时直接降级
- **修复**: httpx timeout 10s→30s, recall_timeout 3s→15s

---

## 技术决策

| 决策 | 原因 |
|------|------|
| tenant_id nullable + 默认租户 | 向后兼容已有数据, 无需强制迁移 |
| ALTER TABLE IF NOT EXISTS | 避免 Alembic 复杂性, create_all 不 ALTER 已有表 |
| 软删除 (is_active=False) | 保留数据完整性, 可恢复 |
| require_role 返回 User | 避免 dependencies= 用法, 直接获取 admin user |
| Redis 月度 Token 计数器 | O(1) 额度检查, 35天 TTL 自动过期 |
| audit_log 显式调用 | 比中间件更精确, 只记录关键操作 |
| 前端 Admin 无独立 Store | 各页面独立管理状态, 减少全局耦合 |
| Recharts + `as any` | Recharts v2 TypeScript 类型不稳定, 显式 bypass |
| 创建会话时设置 tenant_id | 方便 admin 按租户统计消息数 |
| Message.extra JSONB | 持久化 tool_calls/memories/ragSources，`metadata` 是 SQLAlchemy 保留字故用 `extra` |
| assistant 消息独立 session | SSE 生成器中原 session 有隐式事务，嵌套 begin() 冲突 |
