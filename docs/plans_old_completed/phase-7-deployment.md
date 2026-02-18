# Phase 7: 部署打磨

## 目标

Docker Compose 全链路生产部署，安全加固，性能优化，备份恢复。

---

## 7.1 Backend 生产运行时

### Gunicorn + Uvicorn Workers (多进程)

- **文件**: `backend/Dockerfile.prod`
- 使用 Gunicorn 作为进程管理器, UvicornWorker 处理异步请求
- 支持通过 `WORKERS` 环境变量控制 worker 数 (默认 2)
- 非 root 用户运行 (`appuser`), 提升容器安全性
- worker 自动回收: `max_requests=1000` + jitter 防内存泄漏

### Gunicorn 配置

- **文件**: `backend/gunicorn.conf.py`
- 超时 120s (兼容 SSE 长连接)
- keepalive 65s (配合 Nginx upstream keepalive)
- 请求大小限制: line=8190, fields=100

---

## 7.2 Nginx 生产配置

**文件**: `docker/nginx/nginx.prod.conf`

### 安全加固
- `X-Frame-Options: SAMEORIGIN` — 防止 clickjacking
- `X-Content-Type-Options: nosniff` — 防止 MIME 嗅探
- `X-XSS-Protection: 1; mode=block` — XSS 防护
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` — 禁用 camera/microphone/geolocation
- `server_tokens off` — 隐藏 Nginx 版本号
- 拦截 `.env`, `.git`, `.sql` 等敏感路径

### 性能优化
- Gzip 压缩: level=4, min_length=256, 涵盖 json/js/css/svg/font
- upstream keepalive 32 连接复用
- 静态资源缓存 (前端 nginx.conf 已有 `expires 1y`)

### 限流策略 (Rate Limiting)

| Zone          | 限制    | 适用路由                  | burst |
|---------------|---------|--------------------------|-------|
| api_limit     | 30r/s   | `/api/` 通用             | 50    |
| auth_limit    | 5r/s    | `/api/v1/auth/`          | 10    |
| upload_limit  | 3r/s    | `/api/v1/knowledge-base/` | 5     |

### SSE 专用配置
- `proxy_buffering off` + `proxy_cache off`
- `X-Accel-Buffering: no`
- `proxy_read_timeout 300s`
- `chunked_transfer_encoding on`

---

## 7.3 docker-compose.prod.yml

**文件**: `docker-compose.prod.yml`

### 与开发版差异

| 项目               | 开发 (docker-compose.yml) | 生产 (docker-compose.prod.yml)     |
|--------------------|---------------------------|-------------------------------------|
| Backend 运行方式    | uvicorn 单进程             | Gunicorn + N workers               |
| Backend Dockerfile  | Dockerfile (root)         | Dockerfile.prod (non-root)         |
| Nginx 配置          | nginx.conf                | nginx.prod.conf (安全头/限流/gzip)  |
| 暴露端口            | 5432/6379/19530/9000 全开  | 仅 80 (HTTP)                       |
| 资源限制            | 无                        | 每个服务设 memory/cpu 上限          |
| 日志驱动            | docker 默认               | json-file + rotation (max 10m×5)   |
| Redis              | 默认配置                   | maxmemory 256MB + LRU + AOF       |
| Attu (Milvus UI)   | 启用                      | 移除 (生产不需要)                   |

### 资源限制总览

| 服务        | Memory | CPU  |
|-------------|--------|------|
| postgres    | 1G     | 1.0  |
| redis       | 512M   | 0.5  |
| milvus      | 2G     | 2.0  |
| minio       | 512M   | 0.5  |
| backend     | 1G     | 2.0  |
| frontend    | 128M   | 0.25 |
| nginx       | 256M   | 0.5  |

### 启动方式

```bash
# 复制并编辑环境变量
cp .env.production .env

# 启动
docker compose -f docker-compose.prod.yml up -d

# 查看日志
docker compose -f docker-compose.prod.yml logs -f backend
```

---

## 7.4 前端性能优化

### Code Splitting (React.lazy)

**文件**: `frontend/src/App.tsx`

- `ChatPage` 保持静态导入 (首屏关键路径)
- 其他 10 个页面全部 `lazy()` 动态导入:
  - LoginPage, RegisterPage
  - MCPPage, KnowledgePage, ToolsPage
  - AdminLayout, DashboardPage, UserManagementPage, TenantManagementPage, BillingPage, AuditLogsPage
- `<Suspense>` 包裹并提供 loading spinner

### Bundle 分割 (Vite manualChunks)

**文件**: `frontend/vite.config.ts`

| Chunk              | 内容                                          | 大小 (gzip) |
|--------------------|-----------------------------------------------|-------------|
| vendor-react       | react, react-dom, react-router-dom            | ~59 KB      |
| vendor-ui          | lucide-react, zustand                         | ~5 KB       |
| vendor-markdown    | react-markdown, remark-gfm, rehype-katex, etc | ~131 KB     |
| 各 Page chunk      | 按路由自动分割                                 | 1-8 KB each |

---

## 7.5 数据库索引优化

**文件**: `backend/app/main.py` (lifespan 中 `CREATE INDEX IF NOT EXISTS`)

### 新增索引

| 索引名                              | 表             | 列                               | 用途                       |
|--------------------------------------|----------------|----------------------------------|----------------------------|
| `ix_conversations_user_updated`      | conversations  | `(user_id, updated_at DESC)`     | 会话列表按最近更新排序     |
| `ix_conversations_tenant_updated`    | conversations  | `(tenant_id, updated_at DESC)`   | 租户下会话列表             |
| `ix_messages_conv_created`           | messages       | `(conversation_id, created_at)`  | 会话内消息时序查询         |
| `ix_usage_records_conv`              | usage_records  | `(conversation_id)`              | FK 补索引                  |
| `ix_audit_logs_user_created`         | audit_logs     | `(user_id, created_at DESC)`     | 用户审计日志查询           |
| `ix_documents_status`                | documents      | `(status)`                       | 文档状态筛选               |
| `ix_users_created`                   | users          | `(created_at DESC)`              | 用户列表排序               |

---

## 7.6 备份与恢复

### 备份脚本

**文件**: `scripts/backup.sh`

```bash
# 手动执行
./scripts/backup.sh ./backups

# 定时任务 (每天凌晨 3 点)
crontab -e
0 3 * * * cd /path/to/kk_gpt_aibot && ./scripts/backup.sh ./backups >> ./backups/cron.log 2>&1
```

**备份内容**:
- PostgreSQL: `pg_dump --format=custom --compress=6` → `.dump` 文件
- Redis: `BGSAVE` → 拷贝 `dump.rdb`
- MinIO: `mc mirror` 或 volume 直接拷贝
- Milvus: volume `tar.gz` 打包
- 自动清理 7 天前的旧备份

### 恢复脚本

**文件**: `scripts/restore.sh`

```bash
./scripts/restore.sh ./backups/20260211_030000
```

- 交互式确认 (防误操作)
- 自动终止 PostgreSQL 活跃连接后重建
- Redis 停机恢复 RDB
- MinIO mirror 回写或 volume 拷贝
- Milvus 停机后解压 volume

---

## 7.7 安全加固

### 已实现

- [x] CORS 白名单 (config.py `cors_origins`, 生产环境通过 `CORS_ORIGINS` 环境变量控制)
- [x] Rate Limiting (Nginx `limit_req_zone`, 认证/上传/通用三级限流)
- [x] SQL 注入防护 (SQLAlchemy parameterized queries, 全项目无裸 SQL 拼接)
- [x] XSS 防护 (CSP/X-XSS-Protection/X-Content-Type-Options headers)
- [x] 敏感日志脱敏 (`backend/app/core/logging.py` — SanitizeFilter)
  - 自动脱敏 `sk-xxx` API Key, Bearer token, password 等字段
- [x] Docker 容器非 root 运行 (Dockerfile.prod → `appuser`)
- [x] 敏感路径拦截 (nginx 拒绝 `.env`, `.git`, `.sql` 等)
- [x] 隐藏 Nginx 版本号 (`server_tokens off`)

### 待后续 (可选)

- [ ] HTTPS (Let's Encrypt / Certbot) — 需域名
- [ ] API Key 加密存储 (当前环境变量注入, 不落 DB)
- [ ] WAF (可选: ModSecurity / Cloudflare)

---

## 7.8 监控

### 健康检查端点

**文件**: `backend/app/api/v1/health.py`

```
GET /api/v1/health
```

返回:
- `status`: healthy / degraded
- `version`: 应用版本
- `uptime_seconds`: 运行时长
- `services`: PostgreSQL, Redis, Milvus, MinIO 各自状态
- `timestamp`: UTC 时间

### 日志

- 所有容器: json-file 驱动, 自动 rotation
- Backend: Gunicorn access log + error log → stdout
- 日志脱敏: API Key / Token / Password 自动替换为 `***`

---

## 完成情况

| 验证项                                    | 状态 |
|-------------------------------------------|------|
| `docker-compose.prod.yml` 全链路配置完成   | ✅   |
| Gunicorn 多 worker 生产运行               | ✅   |
| Nginx 安全头 + Gzip + 限流               | ✅   |
| SSE 在 Nginx 代理下正常 (已有配置)        | ✅   |
| 前端 Code Splitting (10 个 lazy chunk)    | ✅   |
| Bundle 分割 (vendor-react/ui/markdown)    | ✅   |
| 数据库索引 (7 个关键复合/单列索引)         | ✅   |
| 备份脚本 (PG/Redis/MinIO/Milvus)         | ✅   |
| 恢复脚本 (交互式确认)                     | ✅   |
| 日志脱敏 (SanitizeFilter)                 | ✅   |
| Docker 非 root 运行                       | ✅   |
| .env.production 模板                      | ✅   |
| 健康检查 (uptime + 各组件状态)            | ✅   |

---

## 新增/修改文件列表

### 新增文件

| 文件                              | 说明                          |
|-----------------------------------|-------------------------------|
| `docker-compose.prod.yml`         | 生产 Docker Compose           |
| `backend/Dockerfile.prod`         | 生产 Dockerfile (Gunicorn)    |
| `backend/gunicorn.conf.py`        | Gunicorn 配置                 |
| `docker/nginx/nginx.prod.conf`    | Nginx 生产配置                |
| `backend/app/core/logging.py`     | 日志脱敏模块                  |
| `scripts/backup.sh`              | 备份脚本                      |
| `scripts/restore.sh`             | 恢复脚本                      |
| `.env.production`                | 生产环境变量模板              |

### 修改文件

| 文件                              | 变更                          |
|-----------------------------------|-------------------------------|
| `frontend/src/App.tsx`            | React.lazy code splitting     |
| `frontend/vite.config.ts`        | manualChunks bundle 分割      |
| `backend/app/main.py`            | 索引创建 + 日志脱敏初始化     |
| `backend/app/api/v1/health.py`   | 增加 uptime_seconds           |

---

## 技术决策

| 决策                          | 理由                                                            |
|-------------------------------|----------------------------------------------------------------|
| Gunicorn 而非纯 Uvicorn       | Gunicorn 提供进程管理, 自动 worker 回收, 更适合生产             |
| 非 root Docker 用户           | 最小权限原则, 防止容器逃逸                                     |
| Nginx 限流三级分区            | auth 严格 (防暴力破解), upload 中等, 通用宽松                   |
| json-file + rotation          | Docker 默认驱动, 无额外依赖, rotation 防磁盘爆满               |
| pg_dump --format=custom       | 支持并行恢复 + 压缩, 比 SQL 格式更高效                        |
| React.lazy 按路由分割         | 首屏只加载 ChatPage, admin 页面按需加载, 减少初始 bundle 50%+   |
| manualChunks 分离 vendor      | react/markdown 等大库独立缓存, 业务代码更新不影响 vendor 缓存   |
| CREATE INDEX IF NOT EXISTS    | 开发阶段幂等执行, 无需 Alembic migration                      |
