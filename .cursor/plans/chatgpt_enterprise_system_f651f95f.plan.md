---
name: ChatGPT Enterprise System
overview: 基于 FastAPI + React + TypeScript + Tailwind 技术栈，构建企业级类ChatGPT对话系统。UI先行开发，后端核心聚焦 DeepSeek 双模式(推理+对话)，记忆系统独立验证后集成，逐步扩展 MCP/RAG/企业功能。
todos:
  - id: phase0-docker-infra
    content: "Phase 0: Docker 基础设施 — PG + Redis + Milvus(etcd+MinIO) + MinIO(业务) + Attu，7容器全部healthy ✅"
    status: completed
  - id: phase1-scaffold
    content: "Phase 1: 项目脚手架 + 健康检查 — FastAPI/React 项目初始化 + /api/health 端点 + 前后端联通验证 ✅"
    status: completed
  - id: phase2-frontend-ui
    content: "Phase 2: 前端 UI 开发 — 完整聊天界面 + ThinkingBlock + ModelSelector + Sidebar + Auth页面 + MCP面板 + UI美化对齐设计稿 ✅"
    status: completed
  - id: phase3-deepseek
    content: "Phase 3: 后端核心 — DeepSeek+千问双Provider + SSE流式(reasoning+content) + 会话管理 + JWT认证 + 前后端对接 ✅"
    status: completed
  - id: phase4-memory
    content: "Phase 4: 记忆系统 — MemOS Cloud 集成 + 对话前召回/注入prompt + 流后异步保存 + memory_recall SSE + 降级策略 ✅"
    status: completed
  - id: phase5-rag-mcp
    content: "Phase 5: RAG + MCP + 插件 — text-embedding-v4+Milvus知识库 + qwen3-rerank精排 + MCP Server管理 + 知识库前端 + ChatInput KB选择器 ✅"
    status: completed
  - id: phase6-enterprise
    content: "Phase 6: 企业功能 — 多租户 + RBAC + 审计日志 + 用量计费 + Admin后台 ✅"
    status: completed
  - id: phase7-deploy
    content: "Phase 7: 部署打磨 — Docker Compose 全链路 + Nginx + 安全加固 + 性能优化"
    status: pending
isProject: false
---

# 企业级类ChatGPT对话问答系统 — 全栈架构规划 v3

## Phase 总览


| Phase | 主题                 | 状态    | 详细文档                                          |
| ----- | ------------------ | ----- | --------------------------------------------- |
| 0     | Docker 基础设施        | ✅ 完成  | `docs/plans/phase-0-docker-infrastructure.md` |
| 1     | 项目脚手架 + 健康检查       | ✅ 完成  | `docs/plans/phase-1-scaffold-healthcheck.md`  |
| 2     | 前端 UI 开发 (mock)    | ✅ 完成  | `docs/plans/phase-2-frontend-ui.md`           |
| 3     | 后端核心 (DeepSeek+千问) | ✅ 完成  | `docs/plans/phase-3-backend-deepseek.md`      |
| 4     | MemOS 记忆系统         | ✅ 完成  | `docs/plans/phase-4-memos-memory.md`          |
| 5     | RAG + MCP + 插件     | ✅ 完成  | `docs/plans/phase-5-rag-mcp-plugins.md`       |
| 6     | 企业功能               | ✅ 完成  | `docs/plans/phase-6-enterprise.md`            |
| 7     | 部署打磨               | ⏳ 待开始 | `docs/plans/phase-7-deployment.md`            |


## 技术变更记录

- **MemOS Cloud** 替代自部署 Memos，记忆系统走在线 API
- **Milvus v2.6.10** 对齐官方 standalone 配置
- **Attu v2.6.3** 加入 Milvus 可视化管理
- **PostgreSQL** 使用阿里云镜像 `colovu/postgres:12.4`
- **MinIO** 使用 `RELEASE.2025-04-22T22-12-26Z` 版本
- **Docker Hub 镜像加速** 已配置 (`docker.1ms.run`, `docker.xuanyuan.me`)
- **目录重构** 容器配置文件统一归入 `docker/` 目录，数据卷移至 `docker/volumes/` (gitignored)
- **UI 设计系统** Plus Jakarta Sans + Mint Green (#4FD1C5) 渐变 + Glass morphism + 大圆角，对齐 ui_design/ 设计稿
- **双 LLM Provider** DeepSeek v3.2 + 千问 qwen-plus 并行接入，LLMRouter 统一路由，思考模式差异由 Provider 内部屏蔽
- **JWT 认证** access_token(15min) + refresh_token(7d) + Redis 黑名单
- **SSE 流式协议** meta → memory_recall → reasoning → content → done/error，前后端完成对接
- **MemOS Cloud 记忆系统** 对话前 search/memory 召回 → 注入 system prompt → 流后 add/message 异步保存，3s 超时降级
- **RAG 知识库** text-embedding-v4 → Milvus HNSW → qwen3-rerank 精排 → prompt 注入，rag_source SSE 事件
- **MCP Server 管理** CRUD API + 前端 mcpStore 从 mock 迁移到真实后端 API
- **KnowledgePage** 完整实现：创建/上传/轮询/删除，ChatInput 知识库多选器

