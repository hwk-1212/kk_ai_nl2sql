# Phase 4-B: 联调 — 指标 + 权限 + 审计 + 报告

## 目标

完成剩余模块的前后端联调：指标管理 → 语义查询 → 权限拦截 → 审计记录 → 报告生成。将 Phase 2-C 的所有 Mock 数据切换为真实 API，打通企业级功能全链路。

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

| 函数 | Mock → Real |
|------|-------------|
| `loadMetrics` | `GET /api/v1/metrics` |
| `createMetric` | `POST /api/v1/metrics` |
| `updateMetric` | `PUT /api/v1/metrics/{id}` |
| `deleteMetric` | `DELETE /api/v1/metrics/{id}` |
| `loadDimensions` | `GET /api/v1/metrics/dimensions` |
| `loadTerms` | `GET /api/v1/metrics/terms` |
| CRUD dimensions | 对应 API |
| CRUD terms | 对应 API |

### API 服务层

**修改文件**: `frontend/src/services/api.ts`

```typescript
export const metricApi = {
  getMetrics: (params?) => apiClient.get("/metrics", { params }),
  createMetric: (data) => apiClient.post("/metrics", data),
  updateMetric: (id, data) => apiClient.put(`/metrics/${id}`, data),
  deleteMetric: (id) => apiClient.delete(`/metrics/${id}`),
  searchMetrics: (q) => apiClient.get("/metrics/search", { params: { q } }),
  // dimensions, terms...
};
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
| 加载角色列表 | `GET /api/v1/data-permissions/roles` |
| 创建角色 | `POST /api/v1/data-permissions/roles` |
| 设置表权限 | `PUT /api/v1/data-permissions/roles/{id}/table-permissions` |
| 设置列权限 | `PUT /api/v1/data-permissions/roles/{id}/column-permissions` |
| 设置行过滤 | `PUT /api/v1/data-permissions/roles/{id}/row-filters` |
| 分配用户 | `POST /api/v1/data-permissions/roles/{id}/assign` |

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
| 系统审计 | `GET /api/v1/admin/audit-logs` (现有) |
| 数据审计 | `GET /api/v1/admin/data-audit` (新增) |

### 数据审计展示

- 时间线列表: 用户名, 操作类型 (query/insert/update/delete/upload/drop), 表名, SQL 摘要, 耗时, 状态
- 点击展开: 完整 SQL, 影响行数, 前后快照 (写操作)
- 筛选: 操作类型 / 用户 / 表名 / 时间范围

### 审计统计仪表板

- 查询量趋势 (日折线图)
- 高频表 Top 5 (柱状图)
- 高频用户 Top 5
- 拒绝操作数统计

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

| 函数 | Mock → Real |
|------|-------------|
| `loadReports` | `GET /api/v1/reports` |
| `createReport` | `POST /api/v1/reports` |
| `generateReport` | `POST /api/v1/reports/{id}/generate` |
| `loadTemplates` | `GET /api/v1/reports/templates` |
| `loadSchedules` | `GET /api/v1/reports/schedules` |
| CRUD templates | 对应 API |
| CRUD schedules | 对应 API |

### API 服务层

**修改文件**: `frontend/src/services/api.ts`

```typescript
export const reportApi = {
  getReports: (params?) => apiClient.get("/reports", { params }),
  createReport: (data) => apiClient.post("/reports", data),
  getReport: (id) => apiClient.get(`/reports/${id}`),
  generateReport: (id) => apiClient.post(`/reports/${id}/generate`),
  exportReport: (id, format) => apiClient.get(`/reports/${id}/export`, { params: { format } }),
  // templates, schedules...
};
```

### ReportEditor 联调

- 创建报告 → 配置数据查询 → 点击 "AI 生成"
- 轮询报告状态: draft → generating → ready
- ready 后展示生成的 Markdown 内容 + 图表
- Markdown 渲染使用现有 MarkdownContent 组件
- 嵌入图表使用 ChartRenderer

### ScheduleManager 联调

- 创建定时任务 → 选择模板 → 配置 Cron
- 启用/停用切换
- 手动触发运行 → 查看生成的报告
- 显示上次运行/下次运行时间

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
   → execute_sql → 行过滤生效 (仅销售部)
   → recommend_chart → 柱状图
   → 结果展示 (phone 字段已脱敏)

9. user_A 对话: "帮我生成月度报告"
   → 生成报告 → Markdown + 图表

10. tenant_admin 查看审计日志
    → 看到 user_A 的所有查询记录
    → 查看统计趋势
```

---

## 任务清单

- [ ] metricStore 切换真实 API
- [ ] api.ts 新增 metricApi
- [ ] MetricPage 联调 (CRUD + Milvus 同步验证)
- [ ] DataPermissionPage 切换真实 API
- [ ] 权限配置联调 (表/列/行三级)
- [ ] 权限拦截联调 (对话中验证)
- [ ] 脱敏效果联调
- [ ] AuditLogsPage 增加数据审计 Tab
- [ ] 审计日志联调 (query/write/denied/upload)
- [ ] 审计统计仪表板
- [ ] reportStore 切换真实 API
- [ ] api.ts 新增 reportApi
- [ ] ReportEditor 联调 (AI 生成 + 状态轮询)
- [ ] ScheduleManager 联调 (Celery Beat)
- [ ] Sidebar 全导航验证
- [ ] 端到端完整场景测试
- [ ] 验证通过

---

## 验证标准

- [ ] 指标 CRUD → Milvus 同步 → 对话语义查询命中
- [ ] 术语映射 → "营收" → lookup_metrics 返回 "销售额"
- [ ] 角色权限设置 → 对话中行过滤/列脱敏/表拦截生效
- [ ] 审计日志完整记录所有数据操作
- [ ] 审计统计图表正确
- [ ] 报告生成: AI 生成 Markdown + 推荐图表
- [ ] 定时任务: 到点自动生成报告
- [ ] 报告导出 PDF/HTML
- [ ] 所有页面导航正常
- [ ] 端到端场景完整跑通
- [ ] 12 容器全部 healthy
- [ ] TypeScript 编译 0 error

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

### 后端 (微调)

| 文件 | 变更 |
|------|------|
| `app/api/v1/chat.py` | System Prompt 最终版 (含所有工具说明) |
| `app/api/v1/reports.py` | 状态轮询优化 |
| `app/api/v1/admin.py` | 数据审计 API 联调修复 |
