# KK Platform 架构演进方案

> 讨论日期: 2025-02-14
> 状态: 方案讨论阶段，暂不实施
> 基础项目: kk_gpt_aibot

---

## 一、背景与目标

### 现状

`kk_gpt_aibot` 是一个全栈 AI 对话平台，已具备：

- 多模型 LLM 路由 (DeepSeek / Qwen)
- RAG 知识库 (Milvus + Rerank)
- MCP 工具系统
- 长期记忆 (MemOS)
- 多租户 / RBAC / 审计 / 计费
- Docker Compose 一键部署

### 目标

以 `kk_gpt_aibot` 为内核，孵化多个垂直产品：

| 产品 | 侧重 | 差异化能力 |
|---|---|---|
| AIBot (原版) | 通用对话 | 多模型对话 + RAG + 工具 |
| Data Analyst | 数据分析 | NL2SQL + 图表可视化 + 数据源管理 |
| Doc Generator | 文档生成 | 模板引擎 + 长文档生成 + 格式导出 |
| Comic Creator | 漫剧生成 | 图像生成 + 分镜编排 + 多模态理解 |

**核心诉求：内核迭代一次，所有产品同步受益；产品之间互不干扰。**

---

## 二、架构选型

### 方案对比

| 方案 | 同步成本 | 灵活度 | 改造成本 | 评价 |
|---|---|---|---|---|
| Git Fork + cherry-pick | 极高 | 低 | 零 | 产品超过 2 个就崩溃，冲突地狱 |
| Git Subtree 嵌入 core | 中 | 中 | 低 | 短期可用，长期 subtree pull 会有 history 污染 |
| **Monorepo + Workspace Packages** | **低** | **高** | **中** | **推荐。版本天然同步，IDE 友好** |
| 独立 pip/npm 包发布 | 低 | 最高 | 高 | 需要 CI/CD 发版流程，适合多团队 |

### 选定方案：Monorepo + Workspace Packages

理由：
- 单人/小团队，monorepo 维护开销最低
- `uv workspace` (Python) + `pnpm workspace` (Node) 原生支持
- 改一个 package，所有依赖它的产品立即生效，零发版
- 日后如需拆分，每个 package 已是独立包，可无缝发布到 PyPI/npm

---

## 三、目标目录结构

```
kk-platform/
├── packages/                          # ── 中台能力层 ──
│   ├── core/                          # 基础框架
│   │   ├── src/kk/core/
│   │   │   ├── security.py            # JWT / 密码哈希
│   │   │   ├── deps.py                # FastAPI 依赖注入
│   │   │   ├── audit.py               # 审计日志
│   │   │   ├── billing.py             # 用量计费
│   │   │   ├── plugin.py              # 插件注册机制
│   │   │   ├── models/                # User, Tenant 等基础 ORM
│   │   │   ├── schemas/               # 基础 Pydantic 模型
│   │   │   ├── middleware/            # Auth, CORS, RateLimit
│   │   │   └── db/                    # PG/Redis 连接管理
│   │   └── pyproject.toml             # package: kk-core
│   │
│   ├── llm-router/                    # LLM 多模型路由
│   │   ├── src/kk/llm/
│   │   │   ├── router.py             # 模型分发
│   │   │   ├── providers/             # deepseek.py, qwen.py, ...
│   │   │   ├── streaming.py          # SSE 流式封装
│   │   │   └── tool_calling.py       # Tool Call 标准化
│   │   └── pyproject.toml             # package: kk-llm
│   │
│   ├── rag-engine/                    # RAG 检索增强
│   │   ├── src/kk/rag/
│   │   │   ├── parser/               # 文档解析 (PDF/Word/Excel/MD)
│   │   │   ├── chunker.py            # 文本切分
│   │   │   ├── embedding.py          # 向量化
│   │   │   ├── retriever.py          # 检索 + Rerank
│   │   │   └── store.py              # Milvus 向量存储
│   │   └── pyproject.toml             # package: kk-rag
│   │
│   ├── tools-engine/                  # MCP + 工具系统
│   │   ├── src/kk/tools/
│   │   │   ├── mcp/                   # MCP 协议实现
│   │   │   ├── builtin/              # 内置工具 (web_search 等)
│   │   │   └── registry.py           # 工具注册表
│   │   └── pyproject.toml             # package: kk-tools
│   │
│   ├── memory/                        # 长期记忆
│   │   ├── src/kk/memory/
│   │   │   └── memos_client.py       # MemOS 封装
│   │   └── pyproject.toml             # package: kk-memory
│   │
│   ├── sql-engine/                    # SQL 执行引擎 (新增)
│   │   ├── src/kk/sql/
│   │   │   ├── engine.py             # 查询执行 (连接池/超时/限制)
│   │   │   ├── introspect.py         # Schema 自省
│   │   │   ├── adapters/             # pg.py, mysql.py, clickhouse.py
│   │   │   └── result.py             # 结果序列化
│   │   └── pyproject.toml             # package: kk-sql
│   │
│   └── ui-kit/                        # 共享 React 组件
│       ├── src/
│       │   ├── components/
│       │   │   ├── chat/              # ChatPanel, MessageBubble, InputBar
│       │   │   ├── sidebar/           # Sidebar, ConversationList
│       │   │   ├── layout/            # AppLayout, Header
│       │   │   ├── settings/          # SettingsPanel
│       │   │   ├── admin/             # TenantManager, BillingDashboard
│       │   │   └── common/            # Button, Modal, Toast, ...
│       │   ├── hooks/                 # useSSE, useAuth, useChat, ...
│       │   └── stores/                # 共享 Zustand stores
│       └── package.json               # package: @kk/ui-kit
│
├── products/                          # ── 产品层 (前台) ──
│   ├── aibot/                         # 通用 AI 对话 (原 kk_gpt_aibot)
│   │   ├── backend/
│   │   │   ├── app/
│   │   │   │   ├── main.py           # 组装 core + llm + rag + tools + memory
│   │   │   │   ├── api/              # 产品特有路由 (极少)
│   │   │   │   └── services/         # 产品特有服务 (极少)
│   │   │   └── pyproject.toml        # 依赖: kk-core, kk-llm, kk-rag, kk-tools, kk-memory
│   │   ├── frontend/
│   │   │   ├── src/
│   │   │   └── package.json          # 依赖: @kk/ui-kit
│   │   └── docker-compose.yml
│   │
│   ├── data-analyst/                  # 数据分析产品
│   │   ├── backend/
│   │   │   ├── app/
│   │   │   │   ├── main.py
│   │   │   │   ├── api/routes.py     # NL2SQL 路由, 数据源管理路由
│   │   │   │   └── services/
│   │   │   │       ├── nl2sql.py     # NL → SQL 转换 (Prompt + 校验)
│   │   │   │       ├── datasource.py # 数据源 CRUD
│   │   │   │       └── chart.py      # 图表推荐
│   │   │   └── pyproject.toml        # 依赖: kk-core, kk-llm, kk-sql
│   │   ├── frontend/
│   │   │   ├── src/
│   │   │   │   ├── pages/DataDashboard.tsx
│   │   │   │   └── components/ChartPanel.tsx
│   │   │   └── package.json          # 依赖: @kk/ui-kit
│   │   └── docker-compose.yml
│   │
│   └── doc-gen/                       # 文档生成产品
│       └── ...
│
├── docker/                            # 共享基础设施
│   ├── postgres/init.sql
│   └── nginx/
│
├── scripts/
│   ├── backup.sh
│   └── restore.sh
│
├── pyproject.toml                     # Python workspace 根配置 (uv)
├── pnpm-workspace.yaml                # Node workspace 配置
└── turbo.json                         # 构建编排
```

---

## 四、核心设计

### 4.1 后端插件注册机制

每个产品通过 `ProductPlugin` 向平台注册自己的能力，平台负责组装成完整 FastAPI 应用。

```python
# packages/core — 提供机制
@dataclass
class ProductPlugin:
    name: str
    version: str
    router: APIRouter                    # 产品路由
    models: list[type] = field(...)      # 产品 ORM Models (自动建表)
    on_startup: Callable | None = None   # 初始化钩子
    on_shutdown: Callable | None = None
    middlewares: list[tuple] = field(...)

class Platform:
    def register(self, plugin: ProductPlugin): ...
    def build_app(self) -> FastAPI: ...
```

```python
# products/data-analyst — 使用机制
platform = Platform()
platform.register(ProductPlugin(
    name="data-analyst",
    router=router,
    models=[DataSource, QueryHistory],
    on_startup=init_datasource_pool,
))
app = platform.build_app()
```

**好处**：core 不需要知道有哪些产品，产品自己声明自己需要什么。

### 4.2 中台只封装机制，不封装策略

这是最重要的设计原则。

| 层级 | 封装内容 | 举例 |
|---|---|---|
| 中台（机制） | **How** — 怎么执行 | SQL 引擎执行查询、LLM 路由调用模型、RAG 检索文档 |
| 产品（策略） | **What** — 执行什么 | NL2SQL 用什么 Prompt、允许哪些 SQL 操作、用哪个模型 |

**反例**：如果 `kk-sql` 里写死了 `"只允许 SELECT"`，那文档生成产品想用 `CREATE TEMP TABLE` 就被卡死了。安全策略应由产品层通过配置注入。

```python
# 正确做法：机制提供 hook，策略由产品注入
result = await sql_engine.execute(
    sql,
    datasource_id=ds_id,
    validator=product_specific_validator,  # 产品决定什么 SQL 合法
)
```

### 4.3 前端组件复用

共享 UI Kit 通过 `exports` 暴露组件，产品按需引入：

```tsx
// 产品只关心差异
import { ChatPanel } from '@kk/ui-kit/chat'       // 核心对话面板
import { AppLayout } from '@kk/ui-kit/layout'     // 通用布局

// 产品自定义
import { ChartPanel } from './components/ChartPanel'

<AppLayout sidebar={<DataSidebar />}>
  <ChatPanel extra={<ChartPanel />} />     {/* 基于核心扩展 */}
</AppLayout>
```

**关键**：`@kk/ui-kit` 的组件要支持 slot/render props 模式，让产品能注入自定义区域，而不是硬编码布局。

### 4.4 版本同步机制

Monorepo 内部依赖走 workspace link，不需要发版。

```
packages/core 改了一行代码
  → 保存
  → 所有 products 的 import 自动拿到最新代码
  → 无需 npm publish / pip install / 版本号
```

只有 **Breaking Change** 时需要协调：

```
packages/core v0.x → v0.y (非破坏性)
  → 产品无感，自动同步

packages/core v0.x → v1.0 (破坏性)
  → 在 CHANGELOG 里标注 breaking
  → 逐个产品适配 → 统一提交
  → Monorepo 的好处：一个 PR 就能改 core + 所有产品
```

---

## 五、迁移路径（渐进式）

不需要一步到位，分阶段来。**每个阶段结束后项目都是可运行状态**。

### Step 1：建仓 + 拆 core（优先级最高）

**目标**：把当前 `kk_gpt_aibot` 搬进 monorepo 结构，先拆出 `packages/core`。

| 动作 | 具体内容 |
|---|---|
| 建 monorepo 根目录 | `pyproject.toml` (uv workspace) + `pnpm-workspace.yaml` |
| 移动现有项目 | `kk_gpt_aibot` → `products/aibot/` |
| 提取 core | `security.py`, `deps.py`, `audit.py`, `billing.py`, `models/`(基础模型), `middleware/`, `db/` → `packages/core/` |
| aibot 改为依赖 core | `from kk.core.security import ...` |
| 验证 | docker compose up 能正常跑 |

**预计工作量**：1-2 天

### Step 2：拆 llm-router + rag-engine

**目标**：两个最高复用率的能力包独立。

| 动作 | 具体内容 |
|---|---|
| 提取 llm | `core/llm/` → `packages/llm-router/` |
| 提取 rag | `core/rag/` → `packages/rag-engine/` |
| 提取 tools | `core/tools/` → `packages/tools-engine/` |
| 提取 memory | `core/memory/` → `packages/memory/` |

**预计工作量**：1 天

### Step 3：开第 2 个产品

**目标**：以 data-analyst 为例，验证架构可行性。

| 动作 | 具体内容 |
|---|---|
| 新建 `packages/sql-engine` | Schema 自省 + 查询执行 |
| 新建 `products/data-analyst` | NL2SQL 产品，依赖 core + llm + sql |
| 提取 `packages/ui-kit` | 从 aibot 前端提取共享组件 |

**这一步是关键验证点** — 如果第 2 个产品能在 1-2 天内跑通基础功能（靠复用中台），说明架构是对的。

### Step 4：完善工程化

| 动作 | 具体内容 |
|---|---|
| turbo.json | 配置 build/test/lint 任务依赖图 |
| CI/CD | GitHub Actions: 变更检测 → 只构建受影响的产品 |
| Docker | 共享 base image + 产品 overlay |

---

## 六、潜在问题与应对

### 6.1 数据库 Schema 冲突

**问题**：多个产品共用一个 PostgreSQL 实例，ORM model 可能有表名/字段冲突。

**应对**：

```
方案 A（推荐）：Schema 隔离
  - core 的表放 public schema
  - 每个产品用自己的 schema: data_analyst.query_history
  - PostgreSQL 原生支持，零性能损失

方案 B：表名前缀
  - data_analyst_query_history
  - 简单但不够优雅

方案 C：每个产品独立数据库
  - 隔离最彻底，但运维成本高
  - 跨产品查询需要 dblink 或应用层处理
```

### 6.2 前端 UI Kit 的粒度问题

**问题**：`@kk/ui-kit` 封装太细（Button 级别）没意义，封装太粗（整页）没灵活性。

**应对**：

```
正确粒度：按「业务组件」而非「原子组件」
  ✅ ChatPanel (完整对话面板，支持 slot 扩展)
  ✅ ConversationList (会话列表 + 搜索)
  ✅ SettingsForm (设置表单框架)
  ❌ Button, Input, Modal (用 shadcn/ui 等现成的)
  ❌ FullChatPage (整页封装，产品无法定制)
```

### 6.3 中台过度抽象

**问题**：还没做第 2 个产品就开始拆中台，结果拆出来的抽象和实际需求对不上。

**应对**：

```
Rule of Three:
  - 第 1 次出现 → 直接写
  - 第 2 次出现 → 复制但标记 TODO
  - 第 3 次出现 → 提取到 packages/

Step 1-2 只拆"已经被证明是通用的"（auth, llm, rag）
新的 package（如 sql-engine）等到真正做产品时才创建
```

### 6.4 Docker Compose 多产品编排

**问题**：每个产品有自己的 `docker-compose.yml`，但共享基础设施（PG/Redis/Milvus）不应重复定义。

**应对**：

```yaml
# docker/docker-compose.infra.yml — 共享基础设施
services:
  postgres:
    image: postgres:16
  redis:
    image: redis:7
  milvus:
    image: milvusdb/milvus:v2.6

# products/data-analyst/docker-compose.yml — 产品服务
services:
  backend:
    build: ./backend
    depends_on: [postgres, redis]
  frontend:
    build: ./frontend

# 启动命令：
docker compose -f docker/docker-compose.infra.yml \
               -f products/data-analyst/docker-compose.yml \
               up -d
```

### 6.5 Alembic 数据库迁移

**问题**：多个 package 各有自己的 ORM model，migration 谁来管？

**应对**：

```
方案：每个产品维护自己的 alembic 目录

products/aibot/backend/alembic/
  - 管理 core 表 + aibot 特有表的 migration

products/data-analyst/backend/alembic/
  - 管理 core 表 + data-analyst 特有表的 migration

core 表的 migration 可以用 alembic 的 --autogenerate 自动检测变更。
多个产品的 migration 不会冲突，因为操作的是不同的 schema/表。

更进一步：core 自带 base migration 脚本，产品 alembic 依赖它。
```

### 6.6 产品间能力依赖

**问题**：如果 doc-gen 产品想用 data-analyst 的 NL2SQL 能力怎么办？

**应对**：

```
原则：产品之间不直接依赖

如果出现需求：
  1. 判断这个能力是否通用 → 是 → 下沉到 packages/
  2. 不通用 → 通过 API 调用（HTTP），产品之间走服务间通信
  3. 绝不 import 另一个产品的代码
```

### 6.7 环境变量管理

**问题**：不同产品需要不同的环境变量，但有大量重叠（DB 连接、Redis、LLM Key）。

**应对**：

```
.env.shared          # 共享：DB_URL, REDIS_URL, LLM_API_KEY, ...
.env.aibot           # 产品特有：MEMOS_API_KEY, ...
.env.data-analyst    # 产品特有：DEFAULT_DATASOURCE, ...

启动时合并：
docker compose --env-file .env.shared --env-file .env.data-analyst up
```

### 6.8 测试策略

**问题**：packages 和 products 的测试职责划分。

**应对**：

```
packages/ 下的测试 → 单元测试 + 集成测试
  - kk-sql: 测试各 adapter 能正确执行 SQL
  - kk-llm: 测试路由逻辑 (mock LLM API)
  - kk-rag: 测试检索流程 (mock Milvus)

products/ 下的测试 → E2E 测试
  - data-analyst: 给一个 question → 验证完整流程 → 返回正确图表
  - aibot: 模拟对话 → 验证 SSE 流式 + RAG 召回

turbo.json 配置依赖：
  products/aibot#test 依赖 packages/core#build
  → turbo run test 自动按拓扑序执行
```

---

## 七、技术选型确认

| 层面 | 选型 | 理由 |
|---|---|---|
| Python 包管理 | uv workspace | 比 poetry workspace 快 10x，原生 monorepo 支持 |
| Node 包管理 | pnpm workspace | 硬链接省磁盘，strict 模式防幽灵依赖 |
| 构建编排 | Turborepo | 增量构建 + 远程缓存，配置简单 |
| Python namespace | `src/kk/xxx/` 布局 | 所有 package 共享 `kk` 命名空间，import 统一 |
| 前端组件 | 源码引用 (不预编译) | monorepo 内 Vite 直接 resolve 源码，HMR 不受影响 |
| DB Migration | Alembic per product | 各产品独立管理自己的表结构演进 |

---

## 八、时间线预估

| 阶段 | 内容 | 预计耗时 | 前置条件 |
|---|---|---|---|
| Step 1 | 建仓 + 拆 core | 1-2 天 | 无 |
| Step 2 | 拆 llm / rag / tools / memory | 1 天 | Step 1 |
| Step 3 | 第 2 个产品 (data-analyst) | 3-5 天 | Step 2 |
| Step 4 | CI/CD + Docker 编排 | 1-2 天 | Step 3 |
| 里程碑 | **两个产品并行运行，共享内核** | **约 1.5 周** | — |

---

## 九、决策记录

| # | 决策 | 理由 | 日期 |
|---|---|---|---|
| 1 | 选 Monorepo 而非多仓 | 小团队，版本同步零成本 | 2025-02-14 |
| 2 | 自底向上提取中台，不预设 | 避免过度抽象，Rule of Three | 2025-02-14 |
| 3 | 中台封装机制不封装策略 | 保持产品层灵活性 | 2025-02-14 |
| 4 | 插件注册模式组装 FastAPI | 产品自治，core 无需感知产品 | 2025-02-14 |
| 5 | 暂不做前端 UI Kit 拆分 | 等第 2 个前端产品时再提取 | 2025-02-14 |
