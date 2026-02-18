# Phase 1: 现有项目验证 + 新增骨架

**状态**: ✅ 已完成 (2026-02-18)

## 目标

验证 Phase 0 更新后 12 容器全部跑通，搭建后端新增模块的目录结构和空壳文件，新增 ORM 模型空壳，注册 API 路由 stub，前端新增路由占位页面。

---

## 前置条件

- Phase 0 Docker 更新已完成
- 12 容器全部 healthy

---

## 1.1 验证现有系统

| 验证项 | 预期结果 | 实际结果 |
|--------|----------|----------|
| 12 容器全部启动 | `docker ps` 全部 Up/healthy | ✅ 12/12 全部 Up (6 个 healthy) |
| `GET /api/v1/health` | 返回 healthy, 所有服务 ok | ✅ status=healthy, pg/redis/milvus/minio 全 ok |
| 前端 `http://localhost` | 正常加载 | ✅ frontend 容器 build + 运行正常 |
| Celery Worker ping | 返回 pong | ✅ `celery@...: OK pong` |
| Celery Beat 运行 | 日志无报错 | ✅ 运行中，inspect active 无异常 |
| `user_data` schema 存在 | psql `\dn` 确认 | ✅ public + user_data 两个 schema |

---

## 1.2 后端新增目录结构

```
backend/app/
├── core/
│   ├── data/                      # 数据管理模块
│   │   ├── __init__.py
│   │   ├── manager.py             # 数据管理核心逻辑 (空壳)
│   │   ├── parsers.py             # Excel/CSV/SQLite 解析器 (空壳)
│   │   └── isolated_executor.py   # 租户隔离 SQL 执行器 (空壳)
│   ├── context/                   # 上下文管理模块
│   │   ├── __init__.py
│   │   ├── manager.py             # 上下文管理核心 (空壳)
│   │   ├── token_counter.py       # Token 计算器 (空壳)
│   │   └── summarizer.py          # 上下文摘要器 (空壳)
│   ├── semantic/                  # 语义层模块
│   │   ├── __init__.py
│   │   └── layer.py               # 语义层检索服务 (空壳)
│   ├── security/                  # 数据安全模块
│   │   ├── __init__.py
│   │   ├── data_access.py         # 数据访问控制引擎 (空壳)
│   │   ├── masking.py             # 字段脱敏引擎 (空壳)
│   │   └── sql_checker.py         # SQL 安全检查器 (空壳)
│   ├── cache/                     # 缓存模块
│   │   ├── __init__.py
│   │   ├── query_cache.py         # 查询结果缓存 (空壳)
│   │   └── schema_cache.py        # 表结构缓存 (空壳)
│   ├── report/                    # 报告模块
│   │   ├── __init__.py
│   │   ├── generator.py           # 报告生成引擎 (空壳)
│   │   └── scheduler.py           # 定时任务管理 (空壳)
│   ├── audit/                     # 数据审计模块
│   │   ├── __init__.py
│   │   ├── data_auditor.py        # 数据审计服务 (空壳)
│   │   └── middleware.py          # 审计中间件 (空壳)
│   └── tools/builtin/
│       ├── data_query.py          # SQL 查询执行工具 (空壳)
│       ├── schema_inspect.py      # 表结构检查工具 (空壳)
│       ├── metric_lookup.py       # 指标检索工具 (空壳)
│       ├── chart_recommend.py     # 图表推荐工具 (空壳)
│       └── data_modify.py         # 数据修改工具 (空壳)
├── models/
│   ├── data_source.py             # DataSource ORM (空壳)
│   ├── data_table.py              # DataTable ORM (空壳)
│   ├── metric.py                  # Metric ORM (空壳)
│   ├── dimension.py               # Dimension ORM (空壳)
│   ├── business_term.py           # BusinessTerm ORM (空壳)
│   ├── report.py                  # Report ORM (空壳)
│   ├── report_template.py         # ReportTemplate ORM (空壳)
│   ├── report_schedule.py         # ReportSchedule ORM (空壳)
│   ├── data_permission.py         # DataRole + 权限 ORM (空壳)
│   └── data_audit_log.py          # DataAuditLog ORM (空壳)
├── schemas/
│   ├── data.py                    # 数据管理 Pydantic schemas (空壳)
│   ├── metric.py                  # 指标 Pydantic schemas (空壳)
│   └── report.py                  # 报告 Pydantic schemas (空壳)
├── api/v1/
│   ├── data.py                    # 数据管理 API stub
│   ├── metrics.py                 # 指标管理 API stub
│   ├── reports.py                 # 报告 API stub
│   └── data_permissions.py        # 权限管理 API stub
└── tasks/
    └── report_tasks.py            # 报告 Celery 任务 (空壳)
```

### 空壳文件规范

每个空壳文件应包含:
- 模块 docstring 说明职责
- 核心类/函数签名 + `pass` / `raise NotImplementedError`
- TODO 注释标明将在哪个 Phase 实现

---

## 1.3 ORM 模型空壳

在各模型文件中定义基本字段结构，确保 `create_all` 能成功建表:

- `DataSource` — 含 id, user_id, tenant_id, name, source_type, status 等
- `DataTable` — 含 id, data_source_id, user_id, pg_schema, pg_table_name 等
- `Metric` — 含 id, user_id, name, formula, status 等
- `Dimension` — 含 id, user_id, name, source_column 等
- `BusinessTerm` — 含 id, user_id, term, canonical_name 等
- `Report` — 含 id, user_id, title, content, status 等
- `ReportTemplate` — 含 id, name, template_content 等
- `ReportSchedule` — 含 id, cron_expression, is_active 等
- `DataRole` / `DataRoleAssignment` / `TablePermission` / `ColumnPermission` / `RowFilter`
- `DataAuditLog` — 含 id, user_id, action, sql_text, status 等

**注意**: 在 `models/__init__.py` 中导出所有新模型，确保 `Base.metadata.create_all` 能识别。

---

## 1.4 API 路由 Stub

每个 API 文件注册基本路由，返回 `{"status": "not_implemented"}`:

| 路由前缀 | 文件 | 端点示例 |
|----------|------|----------|
| `/api/v1/data` | `data.py` | `GET /sources`, `POST /upload` |
| `/api/v1/metrics` | `metrics.py` | `GET /`, `POST /` |
| `/api/v1/reports` | `reports.py` | `GET /`, `POST /` |
| `/api/v1/data-permissions` | `data_permissions.py` | `GET /roles` |

在 `main.py` 中注册新路由 (router 自带 prefix，main 只加 `/api/v1`):

```python
from app.api.v1 import data as data_api, metrics as metrics_api, reports as reports_api, data_permissions as data_perm_api

app.include_router(data_api.router, prefix="/api/v1", tags=["data"])
app.include_router(metrics_api.router, prefix="/api/v1", tags=["metrics"])
app.include_router(reports_api.router, prefix="/api/v1", tags=["reports"])
app.include_router(data_perm_api.router, prefix="/api/v1", tags=["data-permissions"])
```

---

## 1.5 前端路由占位

### 新增页面文件 (占位组件)

- `frontend/src/pages/DataPage.tsx` — 数据管理占位
- `frontend/src/pages/MetricPage.tsx` — 指标管理占位
- `frontend/src/pages/ReportPage.tsx` — 报告中心占位
- `frontend/src/pages/DataPermissionPage.tsx` — 数据权限管理占位

### App.tsx 路由注册

```tsx
<Route path="/data" element={<DataPage />} />
<Route path="/metrics" element={<MetricPage />} />
<Route path="/reports" element={<ReportPage />} />
<Route path="/data-permissions" element={<DataPermissionPage />} />
```

### Sidebar 新增导航项

- 数据管理 (Database 图标)
- 指标管理 (BarChart3 图标)
- 报告中心 (FileText 图标)
- 数据权限 (ShieldCheck 图标, tenant_admin+ 可见)

---

## 任务清单

- [x] 验证 12 容器全部 healthy
- [x] 验证现有功能全链路正常
- [x] 创建后端新目录结构 + `__init__.py`
- [x] 创建所有 ORM 模型空壳 (10 个文件)
- [x] 更新 `models/__init__.py` 导出
- [x] 创建 Pydantic schemas 空壳 (3 个文件)
- [x] 创建 API 路由 stub (4 个文件)
- [x] `main.py` 注册新路由 + 新模型建表
- [x] 创建核心模块空壳 (data/context/semantic/security/cache/report/audit)
- [x] 创建 Agent 工具空壳 (5 个文件)
- [x] 创建 Celery 任务空壳
- [x] 创建前端占位页面 (4 个文件)
- [x] 更新 App.tsx 路由
- [x] 更新 Sidebar 导航
- [x] 验证通过

---

## 验证标准

- [x] 12 容器全部 healthy
- [x] `GET /api/v1/health` 返回 healthy (所有服务 ok)
- [x] `GET /api/v1/data/sources` 返回 `{"status": "not_implemented"}`
- [x] `GET /api/v1/metrics` 返回 `{"status": "not_implemented"}`
- [x] `GET /api/v1/reports` 返回 `{"status": "not_implemented"}`
- [x] `GET /api/v1/data-permissions/roles` 返回 `{"status": "not_implemented"}`
- [x] PostgreSQL 新增表全部创建成功 (24 张表, psql `\dt` 验证)
- [x] 前端 `/data`, `/metrics`, `/reports`, `/data-permissions` 页面可访问
- [x] Sidebar 显示新导航项 (数据管理/指标管理/报告中心 + admin 区域的数据权限)
- [x] Vite build 成功 (frontend 容器重建正常)
- [x] 原有功能不受影响 (health 全绿)

---

## 实施说明

- `app/core/security.py` 和 `app/core/audit.py` 原为单文件模块，升级为目录包后将原有代码合并到 `__init__.py`，旧单文件已删除，所有现有 import 保持不变
- 所有新 ORM 模型由 `Base.metadata.create_all` 自动建表，共新增 14 张表 (总计 24 张)
- API stub: 每个 router 文件自带 `prefix="/data"` 等，`main.py` 统一加 `prefix="/api/v1"`，最终路径如 `/api/v1/data/sources`
- 空壳文件均包含: 模块 docstring、类/函数签名、`raise NotImplementedError("Phase Xx")` 标注实现阶段
- Backend 容器使用 `COPY . .` 构建镜像 (非 volume mount)，代码变更后需 `docker compose build backend` 重建

---

## 新增/修改文件列表

### 后端新增 (~30 files)

```
backend/app/
├── core/data/{__init__, manager, parsers, isolated_executor}.py
├── core/context/{__init__, manager, token_counter, summarizer}.py
├── core/semantic/{__init__, layer}.py
├── core/security/{__init__, data_access, masking, sql_checker}.py
├── core/cache/{__init__, query_cache, schema_cache}.py
├── core/report/{__init__, generator, scheduler}.py
├── core/audit/{__init__, data_auditor, middleware}.py
├── core/tools/builtin/{data_query, schema_inspect, metric_lookup, chart_recommend, data_modify}.py
├── models/{data_source, data_table, metric, dimension, business_term, report, report_template, report_schedule, data_permission, data_audit_log}.py
├── schemas/{data, metric, report}.py
├── api/v1/{data, metrics, reports, data_permissions}.py
└── tasks/report_tasks.py
```

### 后端修改

| 文件 | 变更 |
|------|------|
| `app/models/__init__.py` | 导出所有新模型 (15 个类) |
| `app/main.py` | 注册 4 个新路由 |
| `app/core/security/__init__.py` | 原 `security.py` 升级为包，合并 JWT/password 功能 |
| `app/core/audit/__init__.py` | 原 `audit.py` 升级为包，合并审计日志功能 |

### 后端删除

| 文件 | 说明 |
|------|------|
| `app/core/security.py` | 已迁移到 `security/__init__.py`，避免与目录包冲突 |
| `app/core/audit.py` | 已迁移到 `audit/__init__.py`，避免与目录包冲突 |

### 前端新增

| 文件 | 说明 |
|------|------|
| `src/pages/DataPage.tsx` | 数据管理占位 |
| `src/pages/MetricPage.tsx` | 指标管理占位 |
| `src/pages/ReportPage.tsx` | 报告中心占位 |
| `src/pages/DataPermissionPage.tsx` | 数据权限管理占位 |

### 前端修改

| 文件 | 变更 |
|------|------|
| `src/App.tsx` | 新增 4 个路由 |
| `src/layouts/Sidebar.tsx` | 新增 4 个导航项 |
