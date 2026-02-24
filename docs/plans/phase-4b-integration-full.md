# Phase 4-B: 联调 — 指标 + 权限 + 审计 + 报告

## 目标

完成剩余模块的前后端联调：指标管理 → 语义查询 → 权限拦截 → 审计记录 → 报告生成。将 Phase 2-C 的所有 Mock 数据切换为真实 API，打通企业级功能全链路。

---

## 实现状态（2026-02-24）

| 模块 | 状态 | 说明 |
|------|------|------|
| 4B.1 指标管理 | ✅ 完成 | metricStore + metricApi + MetricPage 已联调 |
| 4B.2 数据权限 | ✅ 完成 | DataPermissionPage 全 API 联调，含 GET 角色详情、删除表/行权限 |
| 4B.3 审计日志 | ✅ 完成 | 数据审计 Tab + 统计 (adminApi.dataAudit) |
| 4B.4 报告中心 | ✅ 完成 | reportStore + reportApi + ReportEditor(AI 生成+轮询) + ScheduleManager |
| 4B.5 Sidebar | ✅ 完成 | 全导航已验证 |
| 4B.6 端到端 | ⏳ 待验证 | 需手动跑完整流程 |

**API 路径说明**：所有路径相对于 `/api/v1`，如 `/reports` 即 `GET /api/v1/reports`。

---

## 前置条件

- Phase 4-A 数据管理 + NL2SQL 联调已完成
- Phase 3-D 语义层已完成
- Phase 3-E RBAC 权限已完成
- Phase 3-F 性能+审计已完成
- Phase 3-G 报告+Celery 已完成
- Phase 2-C 前端 UI 已完成

---

## 4B.1 指标管理联调

### metricStore 切换为真实 API

**修改文件**: `frontend/src/stores/metricStore.ts`

| 函数 | API |
|------|-----|
| `loadAll` | `GET /metrics` + `GET /metrics/dimensions` + `GET /metrics/terms` |
| `createMetric` / `updateMetric` / `deleteMetric` | `POST` / `PUT` / `DELETE /metrics/{id}` |
| `createDimension` / `updateDimension` / `deleteDimension` | `POST` / `PUT` / `DELETE /metrics/dimensions/{id}` |
| `createTerm` / `updateTerm` / `deleteTerm` | `POST` / `PUT` / `DELETE /metrics/terms/{id}` |
| `searchMetrics` | `GET /metrics/search?q=...` |

### API 服务层

**修改文件**: `frontend/src/services/api.ts`

```typescript
// frontend/src/services/api.ts - metricApi
getMetrics, getMetric, createMetric, updateMetric, deleteMetric, searchMetrics
getDimensions, createDimension, updateDimension, deleteDimension
getTerms, createTerm, updateTerm, deleteTerm
```

### 联调验证

1. 创建指标 "销售额" (公式: SUM(orders.amount)) → Milvus 同步
2. 创建术语 "营收" → 映射到 "sales_amount"
3. 对话 "查询营收" → lookup_metrics 命中 "销售额" → 生成精确 SQL
4. 指标编辑/删除 → Milvus 同步更新

---

## 4B.2 权限管理联调

### DataPermissionPage 切换为真实 API

**修改文件**: `frontend/src/pages/DataPermissionPage.tsx`

| 操作 | API |
|------|-----|
| 加载角色列表 | `GET /data-permissions/roles` |
| 获取角色详情 | `GET /data-permissions/roles/{id}`（含表/列/行权限、已分配用户） |
| 创建/更新/删除角色 | `POST` / `PUT` / `DELETE /data-permissions/roles/{id}` |
| 设置表权限 | `PUT /data-permissions/roles/{id}/table-permissions?table_id=&permission=` |
| 移除表权限 | `DELETE /data-permissions/roles/{id}/table-permissions?table_id=` |
| 设置列权限 | `PUT /data-permissions/roles/{id}/column-permissions?table_id=&column_name=&visibility=&masking_rule=` |
| 设置行过滤 | `PUT /data-permissions/roles/{id}/row-filters?table_id=&filter_expression=&description=` |
| 删除行过滤 | `DELETE /data-permissions/roles/{id}/row-filters?table_id=` |
| 分配/移除用户 | `POST` / `DELETE /data-permissions/roles/{id}/assign/{user_id}` |

**DataPermissionPage 依赖**：表列表来自 `dataApi.getTables()`，用户列表来自 `adminApi.listUsers()`。

### 联调验证

1. 创建数据角色 "销售部分析师"
2. 设置表权限: 订单表 read, 客户表 read
3. 设置列脱敏: 客户表.phone → masked (phone), 客户表.id_card → hidden
4. 设置行过滤: 订单表 WHERE department = '销售部'
5. 分配给测试用户
6. 以测试用户登录 → 对话查询:
   - 查询订单表 → 只返回销售部数据 (行过滤生效)
   - 查询客户表 → phone 显示 138****1234 (脱敏生效)
   - 查询客户表 → 无 id_card 列 (hidden 生效)
   - 尝试查询无权限表 → 返回 "权限不足"

---

## 4B.3 审计日志联调

### Admin 审计页面增强

**修改文件**: `frontend/src/pages/admin/AuditLogsPage.tsx`

增加 "数据操作审计" Tab:

| Tab | 数据源 |
|-----|--------|
| 系统审计 | `GET /admin/audit-logs` |
| 数据审计 | `GET /admin/data-audit/`（列表）、`GET /admin/data-audit/stats`（统计）、`GET /admin/data-audit/{id}`（详情） |

### 数据审计展示

- 时间线列表: user_id, 操作类型 (query/write/denied/upload/drop_table), 表名, SQL 摘要, 耗时, 状态
- 点击展开: 完整 SQL, 影响行数, 错误信息（`GET /admin/data-audit/{log_id}`）
- 筛选: 操作类型 / 状态 / 开始日期 / 结束日期

### 审计统计仪表板

- `GET /admin/data-audit/stats?days=7` 返回: total_operations, avg_execution_ms, failure_rate, daily_trend, top_tables
- 前端展示: 近 N 天操作量、平均耗时、失败/拒绝率、高频表 Top 1

### 联调验证

1. 执行数据查询 → 审计日志记录 (status: success)
2. 权限拒绝 → 审计日志记录 (status: denied)
3. 数据修改 → 审计日志记录 (含 before/after 快照)
4. 上传数据 → 审计日志记录 (action: upload)
5. 删除表 → 审计日志记录 (action: drop_table)
6. 审计查询 API 筛选和分页正常
7. 审计统计数据正确

---

## 4B.4 报告中心联调

### reportStore 切换为真实 API

**修改文件**: `frontend/src/stores/reportStore.ts`

| 函数 | API |
|------|-----|
| `loadAll` | `GET /reports` + `GET /reports/templates/list` + `GET /reports/schedules/list` |
| `createReport` / `updateReport` / `deleteReport` | `POST` / `PUT` / `DELETE /reports/{id}` |
| `generateReport` | `POST /reports/{id}/generate`（异步 Celery，返回 status: generating） |
| `getReport` | `GET /reports/{id}`（用于状态轮询） |
| `exportReport` | `GET /reports/{id}/export?format=html|pdf` |
| CRUD templates | `POST` / `PUT` / `DELETE /reports/templates` 或 `/reports/templates/{id}` |
| CRUD schedules | `POST` / `PUT` / `DELETE /reports/schedules` 或 `/reports/schedules/{id}` |
| `toggleSchedule` / `runSchedule` | `PATCH /reports/schedules/{id}/toggle`、`POST /reports/schedules/{id}/run` |

### API 服务层

**修改文件**: `frontend/src/services/api.ts`

```typescript
// frontend/src/services/api.ts - reportApi
listReports, createReport, getReport, updateReport, deleteReport
generateReport, exportReport
listTemplates, createTemplate, updateTemplate, deleteTemplate
listSchedules, createSchedule, updateSchedule, deleteSchedule, toggleSchedule, runSchedule
```

### ReportEditor 联调（已实现）

- 创建报告（保存）→ `createReport` 或 `updateReport`（content 由 sections 转 Markdown）
- 点击「AI 生成报告」→ 若无 reportId 先创建 → `generateReport(id)` → 每 2s 轮询 `getReport(id)` 直至 status 为 ready/failed
- ready 后调用 `onGenerated()` 切换至 ReportViewer 查看
- ReportViewer 使用 MarkdownContent 渲染 content；report.charts 暂未单独渲染（Markdown 内嵌图表由 MarkdownContent 解析）

### ScheduleManager 联调（已实现）

- 新建定时任务 → `createSchedule`（name, cron_expression, template_id）
- 启用/停用 → `toggleSchedule`，用返回结果更新本地
- 立即运行 → `runSchedule`
- 删除 → `deleteSchedule`

### 联调验证

1. 创建报告 → AI 生成 → 状态轮询 → Markdown 内容展示
2. 报告包含自动推荐的图表
3. 导出 PDF/HTML
4. 创建定时任务 "每天 9 点" → 到点自动生成
5. 模板 CRUD 正常
6. 手动触发生成正常

---

## 4B.5 Sidebar 全导航联调

确保所有页面导航正常:

| 导航项 | 路由 | 权限 |
|--------|------|------|
| 对话 | `/` | 所有用户 |
| 数据管理 | `/data` | 所有用户 |
| 指标管理 | `/metrics` | 所有用户 |
| 报告中心 | `/reports` | 所有用户 |
| 知识库 | `/knowledge` | 所有用户 |
| MCP | `/mcp` | 所有用户 |
| 工具管理 | `/tools` | 所有用户 |
| 数据权限 | `/data-permissions` | tenant_admin+ |
| 管理后台 | `/admin/*` | tenant_admin+ |

---

## 4B.6 端到端完整场景

### 场景: 企业数据分析全流程

```
1. tenant_admin 登录
2. 上传企业销售数据 (Excel)
3. 创建指标: "销售额" = SUM(amount), "订单数" = COUNT(*)
4. 创建术语映射: "营收" → "销售额"
5. 创建数据角色 "销售部":
   - 订单表: read 权限
   - 行过滤: department = '销售部'
   - 客户表 phone 列: masked
6. 分配角色给 user_A

7. user_A 登录
8. 对话: "查看我的营收数据"
   → lookup_metrics → 命中 "销售额"
   → execute_sql → 行过滤生效 (仅销售部，需后端 RBAC)
   → recommend_chart → 柱状图
   → 结果展示 (phone 字段已脱敏)

9. user_A 对话: "帮我生成月度报告"
   → 报告中心 → 新建报告 → AI 生成 → 轮询至 ready

10. tenant_admin 查看审计日志
    → 数据审计 Tab → 看到 user_A 的查询记录
    → 统计卡片: 操作量、耗时、失败率、高频表
```

### 手动验证步骤

1. 登录 → 数据管理上传 → 指标管理创建指标/术语
2. 数据权限 → 新建角色 → 配置表/列/行权限 → 分配用户
3. 对话「查看营收」→ 检查返回数据
4. 管理后台 → 审计日志 → 数据审计 Tab → 检查列表与统计
5. 报告中心 → 新建报告 → 保存 → AI 生成报告 → 等待 ready → 查看内容
6. 报告中心 → 定时任务 → 新建 → 选择模板 + Cron → 启用 → 立即运行
7. 侧栏逐项点击确认导航正常

---

## 任务清单

- [x] metricStore 切换真实 API
- [x] api.ts 新增 metricApi
- [x] MetricPage 联调 (CRUD + Milvus 同步验证)
- [x] DataPermissionPage 切换真实 API
- [x] 权限配置联调 (表/列/行三级)
- [ ] 权限拦截联调 (对话中验证，依赖后端 RBAC 执行层)
- [ ] 脱敏效果联调
- [x] AuditLogsPage 增加数据审计 Tab
- [x] 审计日志联调 (query/write/denied/upload/drop_table)
- [x] 审计统计仪表板
- [x] reportStore 切换真实 API
- [x] api.ts 新增 reportApi
- [x] ReportEditor 联调 (AI 生成 + 状态轮询)
- [x] ScheduleManager 联调 (Celery Beat)
- [x] Sidebar 全导航验证
- [ ] 端到端完整场景测试
- [ ] 验证通过

---

## 验证标准

- [x] 指标 CRUD → Milvus 同步 → 对话语义查询命中
- [x] 术语映射 → "营收" → lookup_metrics 返回 "销售额"
- [ ] 角色权限设置 → 对话中行过滤/列脱敏/表拦截生效（需后端 execute_sql 集成 DataAccessControl）
- [x] 审计日志完整记录所有数据操作
- [x] 审计统计图表正确
- [x] 报告生成: AI 生成 Markdown + 状态轮询
- [x] 定时任务: 创建/启用/停用/立即运行
- [x] 报告导出 (export API 返回 content，前端可下载)
- [x] 所有页面导航正常
- [ ] 端到端场景完整跑通
- [ ] 12 容器全部 healthy
- [x] TypeScript 编译 0 error

---

## 修改文件列表

### 前端

| 文件 | 变更 |
|------|------|
| `src/stores/metricStore.ts` | Mock → 真实 API |
| `src/stores/reportStore.ts` | Mock → 真实 API |
| `src/services/api.ts` | 新增 metricApi + reportApi + dataPermissionApi + dataAuditApi |
| `src/pages/MetricPage.tsx` | 联调调整 |
| `src/pages/ReportPage.tsx` | 联调调整 |
| `src/pages/DataPermissionPage.tsx` | 真实 API + 权限验证 |
| `src/components/metric/MetricList.tsx` | 真实数据 |
| `src/components/metric/MetricForm.tsx` | 真实 CRUD |
| `src/components/report/ReportList.tsx` | 真实数据 |
| `src/components/report/ReportEditor.tsx` | AI 生成 + 状态轮询 |
| `src/components/report/ScheduleManager.tsx` | 真实 Celery 任务 |
| `src/pages/admin/AuditLogsPage.tsx` | 新增数据审计 Tab |
| `src/layouts/Sidebar.tsx` | 验证全导航 |

### 后端

| 文件 | 变更 |
|------|------|
| `app/api/v1/data_permissions.py` | 新增 `GET /roles/{id}` 角色详情；`DELETE /table-permissions`、`DELETE /row-filters` |
| `app/api/v1/data_audit.py` | 已有 `GET /admin/data-audit/`、`GET /admin/data-audit/stats`、`GET /admin/data-audit/{id}` |
| `app/api/v1/reports.py` | 已有 Report/Template/Schedule CRUD、generate、export |
