# KK NL2SQL AIBot

全栈 AI 对话平台 — 集成 LLM 多模型路由、RAG 知识库、MCP 工具协议、长期记忆、多租户企业管理，开箱即用。

## 功能特性

**对话核心**
- 多模型接入: DeepSeek (R1/V3)、Qwen (Plus/Turbo/Max/Long) — 统一路由，一键切换
- SSE 流式输出，支持思维链 (reasoning) 实时展示
- Markdown / LaTeX / 代码高亮渲染
- 会话管理: 历史记录、多轮上下文、标题自动生成

**RAG 知识库**
- 文档上传: PDF / Word / Excel / CSV / Markdown / TXT → 自动转 Markdown
- 向量存储: Milvus + text-embedding-v4 (1024d)
- 语义检索 + Rerank (qwen3-rerank) 二阶段召回
- 知识库隔离，按用户独立管理

**工具系统**
- MCP (Model Context Protocol): 注册外部工具服务，支持 stdio / HTTP / SSE 三种传输
- 标准 MCP JSON 一键导入，支持 env 环境变量注入
- 内置工具: Web Search (DuckDuckGo)
- 自定义 HTTP 工具: 配置 URL / Method / Headers / Body 模板即可注册
- 工具启用/禁用控制，按用户隔离

**长期记忆**
- MemOS Cloud 集成，对话自动存储 & 召回相关记忆
- 可配置相关性阈值和超时

**企业功能 (Phase 6)**
- 多租户隔离 (数据 / 配额 / 配置)
- RBAC 角色: super_admin / tenant_admin / user
- 审计日志 (操作追踪)
- 用量计费 (token 统计 / 月度报表)
- Admin 后台: 租户管理、用户管理、计费看板、审计日志

## 技术栈

| 层级     | 技术                                                   |
|----------|--------------------------------------------------------|
| Frontend | React 18 + TypeScript + Tailwind CSS + Zustand + Vite |
| Backend  | FastAPI + SQLAlchemy 2.0 (async) + Pydantic v2        |
| Database | PostgreSQL 12 + Redis 7 + Milvus 2.6                  |
| Storage  | MinIO (文件) + Milvus (向量)                           |
| Memory   | MemOS Cloud                                            |
| LLM      | DeepSeek API + Qwen (DashScope) API                   |
| Deploy   | Docker Compose + Nginx + Gunicorn                      |

## 项目结构

```
kk_nl2sql_aibot/
├── backend/                   # FastAPI 后端
│   ├── app/
│   │   ├── api/v1/            # REST API 路由
│   │   ├── core/
│   │   │   ├── llm/           # LLM 多模型路由
│   │   │   ├── memory/        # MemOS 记忆管理
│   │   │   ├── rag/           # RAG 检索增强
│   │   │   └── tools/         # MCP + 内置工具
│   │   ├── db/                # 数据库连接 (PG/Redis/Milvus/MinIO)
│   │   ├── models/            # SQLAlchemy ORM
│   │   ├── schemas/           # Pydantic 请求/响应模型
│   │   ├── config.py          # 配置 (pydantic-settings)
│   │   └── main.py            # 应用入口 + 生命周期
│   ├── Dockerfile             # 开发镜像
│   ├── Dockerfile.prod        # 生产镜像 (Gunicorn + non-root)
│   └── gunicorn.conf.py       # Gunicorn 配置
├── frontend/                  # React 前端
│   ├── src/
│   │   ├── components/        # UI 组件 (chat/mcp/knowledge/admin/tools)
│   │   ├── pages/             # 页面 (含 admin/)
│   │   ├── stores/            # Zustand 状态管理
│   │   ├── services/          # API 客户端
│   │   └── App.tsx            # 路由 + Code Splitting
│   ├── Dockerfile             # 多阶段构建 (Node build → Nginx)
│   └── vite.config.ts         # Vite 配置 + Bundle 分割
├── docker/
│   ├── nginx/                 # Nginx 配置 (dev + prod)
│   └── postgres/init.sql      # 数据库初始化
├── scripts/
│   ├── backup.sh              # 全量备份
│   └── restore.sh             # 数据恢复
├── docs/plans/                # 各阶段设计文档
├── docker-compose.yml         # 开发环境
├── docker-compose.prod.yml    # 生产环境
├── .env.example               # 环境变量模板 (开发)
└── .env.production            # 环境变量模板 (生产)
```

## 快速开始

### 前置要求

- Docker + Docker Compose
- LLM API Key (DeepSeek 或 Qwen 至少一个)

### 1. 克隆 & 配置

```bash
git clone <repo-url> && cd kk_nl2sql_aibot

# 复制环境变量并编辑
cp .env.example .env
# 必填: DEEPSEEK_API_KEY 或 QWEN_API_KEY, MEMOS_API_KEY (可选)
```

### 2. 启动 (开发环境)

```bash
docker compose up -d

# 等待所有服务 healthy (约 1-2 分钟)
docker compose ps

# 访问
# 前端: http://localhost
# API:  http://localhost/api/v1/health
# Docs: http://localhost/docs
```

### 3. 创建账号

访问 `http://localhost` → 注册页面创建账号。

首个用户需手动提升为超级管理员:

```bash
docker exec -it kk_nl2sql_postgres psql -U kk_nl2sql -d kk_nl2sql \
  -c "UPDATE users SET role='super_admin' WHERE email='your@email.com';"
```

### 4. 启动 (生产环境)

```bash
cp .env.production .env
# 编辑 .env, 填入真实密码和 API Key

docker compose -f docker-compose.prod.yml up -d
```

## 生产部署

| 项目            | 开发                    | 生产                             |
|-----------------|------------------------|----------------------------------|
| Backend         | Uvicorn 单进程          | Gunicorn + N workers (non-root)  |
| Nginx           | 基础反代                | gzip + 安全头 + 三级限流          |
| 端口            | 5432/6379/19530 全开    | 仅 80                           |
| 资源限制        | 无                      | 每服务 memory/cpu 上限           |
| 日志            | 默认                    | json-file + rotation             |
| Redis           | 默认                    | maxmemory 256MB + LRU + AOF     |

### 备份 & 恢复

```bash
# 手动备份
./scripts/backup.sh ./backups

# 定时备份 (每天凌晨 3 点)
crontab -e
0 3 * * * cd /path/to/kk_nl2sql_aibot && ./scripts/backup.sh ./backups

# 恢复
./scripts/restore.sh ./backups/20260211_030000
```

## API 概览

| 模块        | 端点                          | 说明                    |
|-------------|-------------------------------|-------------------------|
| Auth        | `POST /api/v1/auth/register`  | 注册                    |
|             | `POST /api/v1/auth/login`     | 登录 (JWT)              |
| Chat        | `POST /api/v1/chat`           | 发送消息 (SSE 流式)     |
| Conversations | `GET /api/v1/conversations` | 会话列表                |
| Models      | `GET /api/v1/models`          | 可用模型列表            |
| Knowledge   | `POST /api/v1/knowledge-base` | 创建知识库              |
|             | `POST /api/v1/files/upload`   | 上传文档                |
| MCP         | `POST /api/v1/mcp/servers`    | 注册 MCP 服务           |
|             | `POST /api/v1/mcp/servers/import` | 批量导入 MCP JSON   |
| Tools       | `GET /api/v1/tools`           | 工具列表                |
| Admin       | `GET /api/v1/admin/tenants`   | 租户管理                |
|             | `GET /api/v1/admin/billing/summary` | 用量统计          |
| Health      | `GET /api/v1/health`          | 健康检查                |

完整 API 文档: 启动后访问 `http://localhost/docs`

## 开发阶段

| Phase | 内容                                   | 状态 |
|-------|----------------------------------------|------|
| 0     | Docker 基础设施 (PG/Redis/Milvus/MinIO) | ✅   |
| 1     | 项目脚手架 + 健康检查                    | ✅   |
| 2     | 前端 UI (对话界面)                       | ✅   |
| 3     | LLM 接入 (DeepSeek/Qwen) + JWT 认证     | ✅   |
| 4     | MemOS 长期记忆                          | ✅   |
| 5     | RAG 知识库 + MCP + 工具系统              | ✅   |
| 6     | 企业功能 (多租户/RBAC/审计/计费)         | ✅   |
| 7     | 部署打磨 (生产配置/安全/性能/备份)       | ✅   |

## License

MIT
