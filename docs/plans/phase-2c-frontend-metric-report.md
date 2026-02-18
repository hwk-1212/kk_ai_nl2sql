# Phase 2-C: 前端 UI — 指标管理 + 报告中心 + 数据权限管理

**状态**: ✅ 已完成 (2026-02-18)

## 目标

实现指标管理页面 (MetricPage)、报告中心页面 (ReportPage)、数据权限管理页面 (DataPermissionPage) 的完整前端 UI。使用 Mock 数据驱动。

---

## 前置条件

- Phase 1 骨架搭建完成 ✅
- Phase 2-A 数据管理页面已完成 (复用部分组件风格) ✅
- `/metrics`, `/reports`, `/data-permissions` 路由及占位页面已存在 ✅

---

## 2C.1 指标管理页面 (MetricPage)

**文件**: `frontend/src/pages/MetricPage.tsx`

### 页面布局

```
┌────────────────────────────────────────────┐
│ 📊 指标管理           [新建指标] [新建维度]  │
├──────────────────────────────────────────────┤
│ Tab: [指标] [维度] [业务术语]               │
├──────────────────────────────────────────────┤
│                                              │
│  指标卡片网格 / 维度表格 / 术语表格          │
│                                              │
└──────────────────────────────────────────────┘
```

### 指标列表 (MetricList)

**文件**: `frontend/src/components/metric/MetricList.tsx`

- [x] 卡片网格布局 (1/2/3 列响应式)
- [x] 卡片内容: 指标名、英文名 (font-mono)、公式 (bg-slate-50 代码块)、关联表、维度标签、状态
- [x] 状态标签: active (绿) / draft (灰) / deprecated (红)
- [x] 标签彩色 pill (blue/violet/amber/pink 循环)
- [x] 操作: 编辑 / 删除
- [x] 搜索框 (按名称/英文名/标签模糊搜索)
- [x] 空状态 (EmptyState + "新建指标" 按钮)

### 指标表单 (MetricForm)

**文件**: `frontend/src/components/metric/MetricForm.tsx`

- [x] Modal 弹窗式表单
- [x] 字段: 指标名、英文名、描述 (textarea)、公式 (font-mono 暗色输入框)、聚合方式 (SUM/AVG/COUNT/MAX/MIN)、单位、标签 (逗号分隔)、状态
- [x] 创建/编辑模式切换 (metric prop 有则编辑)
- [x] 表单校验 (名称/英文名必填)

### 维度管理

- [x] Tab 切换: 指标 | 维度 | 业务术语
- [x] 维度列表: 表格展示 (名称 font-mono、显示名称、来源列、数据表、类型标签)
- [x] 维度 CRUD: 新建/编辑 Modal + 删除
- [x] 维度类型标签: categorical=分类、temporal=时间、numeric=数值

### 业务术语管理

- [x] 术语列表: 表格展示 (术语、标准名称、描述 truncate、SQL 表达式 font-mono)
- [x] 术语 CRUD: 新建/编辑 Modal (含同义词字段) + 删除

---

## 2C.2 报告中心页面 (ReportPage)

**文件**: `frontend/src/pages/ReportPage.tsx`

### 页面布局 — 三种视图模式

| 模式 | 触发方式 | 说明 |
|---|---|---|
| 列表 (list) | 默认 | 三 Tab: 我的报告 / 模板库 / 定时任务 |
| 编辑 (edit) | 点击"新建报告"或卡片编辑按钮 | 全页面目录树 + 章节编辑器 |
| 查看 (view) | 点击已完成报告的查看按钮 | 全页面目录导航 + Markdown 渲染 + 导出 |

### 报告列表 (ReportList)

**文件**: `frontend/src/components/report/ReportList.tsx`

- [x] 卡片网格布局 (1/2/3 列响应式)
- [x] 卡片内容: 标题、类型 badge (手动/定时)、状态 badge、章节数、更新时间
- [x] 状态标签: draft (灰) / generating (蓝 animate-pulse) / ready (绿) / failed (红)
- [x] 操作: 查看 (仅 ready) / 编辑 / 删除

### 报告编辑器 (ReportEditor) — 超出原计划

**文件**: `frontend/src/components/report/ReportEditor.tsx`

- [x] 全页面 (非 Modal)，顶栏: 返回 + 标题输入 + "AI 填充内容" + 保存
- [x] 左侧 264px 目录树 (ReportOutlineTree 编辑模式): 添加/删除/重命名章节
- [x] 右侧章节 Markdown 编辑器 (monospace textarea)
- [x] AI 生成: 2.5s 模拟，自动填充所有空章节内容 (MOCK_AI_SECTIONS_CONTENT)
- [x] 支持从模板创建 (自动填充 outline 目录骨架)

### 报告查看器 (ReportViewer) — 超出原计划

**文件**: `frontend/src/components/report/ReportViewer.tsx`

- [x] 全页面，顶栏: 返回 + 标题/日期 + 编辑 + 导出按钮组
- [x] 左侧 264px 目录导航 (ReportOutlineTree 只读模式): 点击章节滚动定位
- [x] 右侧 Markdown 渲染 (复用 MarkdownContent 组件): 章节化渲染 (h2/h3/h4 层级)
- [x] 导出: PDF (window.print 新窗口) / Word (.doc HTML下载) / Markdown (.md 下载)

### 目录树组件 (ReportOutlineTree) — 超出原计划

**文件**: `frontend/src/components/report/ReportOutlineTree.tsx`

- [x] 编辑模式: 添加子章节 / 删除章节 / 双击重命名 / GripVertical 拖拽占位
- [x] 只读模式: 点击导航, 选中高亮
- [x] 内容状态指示: 有内容=primary FileText / 空=灰色 FileText
- [x] 无限层级嵌套 (递归 TreeNode)

### 模板库

- [x] 卡片网格: 模板名、描述、分类标签、系统 badge、章节数标签
- [x] "使用模板" 按钮 → 创建报告时自动填充目录骨架

### 模板选择器

- [x] 新建报告时弹出 Modal: 空白报告 + 有 outline 的模板列表
- [x] 选择后进入编辑器

### 定时任务管理 (ScheduleManager)

**文件**: `frontend/src/components/report/ScheduleManager.tsx`

- [x] 任务列表表格: 模板名、调度规则 (Cron + 可读描述)、状态 toggle switch、上次/下次运行、操作
- [x] 创建任务 Modal: 模板选择下拉 + Cron 预设网格 (每天9:00/每周一/每月1号/自定义)
- [x] 启用/停用 Toggle switch (圆角滑块)
- [x] 手动触发运行 (模拟更新 lastRunAt)
- [x] 删除

---

## 2C.3 数据权限管理页面 (DataPermissionPage)

**文件**: `frontend/src/pages/DataPermissionPage.tsx`

> 仅 `tenant_admin` / `super_admin` 可访问 (Sidebar isAdmin 控制)

### 页面布局

```
┌────────────────────────────────────────────┐
│ 🛡️ 数据权限管理              [新建角色]     │
├──────────┬─────────────────────────────────┤
│ 角色列表  │        角色权限详情              │
│          │                                 │
│ - 销售分析│  Tab: 表级 | 列级 | 行过滤 | 用户│
│ - 财务只读│                                 │
│ - 管理员  │  (根据 Tab 显示对应配置)          │
│          │                                 │
└──────────┴─────────────────────────────────┘
```

### 功能

- [x] 角色列表 (左侧 320px): 卡片式，名称、描述、用户数，选中高亮 (primary/10)
- [x] 角色 CRUD: 新建 Modal (名称+描述) / 选中查看
- [x] 表级权限: 表格 + 读取/写入 checkbox (自定义 SVG 对勾)
- [x] 列级权限: 选择表下拉 → 字段列表 + 可见性 toggle + 脱敏规则下拉
- [x] 行级过滤: 过滤表达式列表 (code 块) + 描述 + 新增/删除
- [x] 用户分配: 搜索框 + 用户列表 (头像 + 名称 + 邮箱) + 移除按钮
- [x] 脱敏规则选项: none/phone/email/id_card/full_mask/last4
- [x] 空状态: "请选择角色" (EmptyState + ShieldCheck)

### Mock 数据 (组件内置)

- 3 角色: 销售分析师(3表3用户)、财务只读(1表+列脱敏)、数据管理员(5表全读写)
- 列权限: 财务汇总表的 revenue/cost/profit/contact_phone 各有不同脱敏设置
- 行过滤: 销售分析师的华东地区 + 2026年数据过滤规则
- 用户: 6 个中文名 mock 用户

---

## 2C.4 Store 定义

### metricStore (`frontend/src/stores/metricStore.ts`)

- metrics, dimensions, businessTerms 数组
- selectedMetricId, activeTab ('metrics'|'dimensions'|'terms'), searchQuery
- loadAll() 加载 mock 数据 (300ms 延迟)
- CRUD: addMetric/updateMetric/deleteMetric + addDimension/updateDimension/deleteDimension + addTerm/updateTerm/deleteTerm

### reportStore (`frontend/src/stores/reportStore.ts`)

- reports, templates, schedules 数组
- selectedReportId, activeTab ('reports'|'templates'|'schedules')
- loadAll() 加载 mock 数据 (300ms 延迟)
- CRUD: addReport/updateReport/deleteReport + addSchedule/updateSchedule/deleteSchedule

---

## 2C.5 类型定义

**文件**: `frontend/src/types/index.ts`

新增类型:
- `ReportSection` — 报告章节树节点 (id, title, content, children?)
- `Metric` — 指标 (name, displayName, formula, aggregation, unit, tags, status)
- `Dimension` — 维度 (name, displayName, sourceColumn, dimType)
- `BusinessTerm` — 业务术语 (term, canonicalName, sqlExpression, synonyms)
- `Report` — 报告 (title, reportType, status, sections: ReportSection[])
- `ReportTemplate` — 报告模板 (name, outline: ReportSection[])
- `ReportSchedule` — 定时任务 (cronExpression, cronDescription, isActive)
- `DataRole` — 数据角色 (name, description, userCount)
- `RoleTablePermission` — 表级权限 (canRead, canWrite)
- `RoleColumnPermission` — 列级权限 (visible, maskType)
- `RoleRowFilter` — 行过滤规则 (filterExpression, description)

---

## 任务清单

- [x] 定义 Metric / Dimension / BusinessTerm 类型
- [x] 定义 Report / ReportTemplate / ReportSchedule / ReportSection 类型
- [x] 定义 DataRole / TablePermission / ColumnPermission / RowFilter 类型
- [x] 创建各模块 Mock 数据 (metrics.ts + reports.ts)
- [x] 实现 metricStore
- [x] 实现 MetricList + MetricForm 组件
- [x] 实现指标/维度/术语 Tab 切换 + CRUD
- [x] 改造 MetricPage 页面
- [x] 实现 reportStore
- [x] 实现 ReportList + ReportEditor + ReportViewer + ReportOutlineTree + ScheduleManager
- [x] 改造 ReportPage 页面 (列表/编辑/查看 三模式)
- [x] 实现 DataPermissionPage (角色 + 表/列/行/用户 四级权限配置)
- [x] 响应式适配
- [x] 验证通过

---

## 验证标准

- [x] `/metrics` 页面: 指标卡片展示 + 搜索 + CRUD (新建/编辑/删除)
- [x] `/metrics` 页面: 维度/术语 Tab 切换和展示 + CRUD
- [x] `/reports` 页面: 报告列表 + 模板库 + 定时任务 三 Tab
- [x] `/reports` 页面: 报告编辑器 — 目录树 + 章节编辑双栏
- [x] `/reports` 页面: AI 生成按钮 mock 工作 (2.5s 填充所有空章节)
- [x] `/reports` 页面: 报告查看器 — 目录导航 + Markdown 渲染 + PDF/Word/MD 导出
- [x] `/data-permissions` 页面: 角色列表 + 权限配置
- [x] `/data-permissions` 页面: 表/列/行 三级权限配置 UI + 用户分配
- [x] 非 admin 用户无法访问 `/data-permissions` (Sidebar isAdmin 控制)
- [x] TypeScript 编译 0 error
- [x] 响应式布局正常

---

## 新增/修改文件列表

### 新增

| 文件 | 说明 |
|------|------|
| `src/components/metric/MetricList.tsx` | 指标卡片网格 (搜索 + 状态标签 + 标签 pill) |
| `src/components/metric/MetricForm.tsx` | 指标表单 Modal (创建/编辑) |
| `src/components/report/ReportList.tsx` | 报告卡片网格 (章节数 + 查看/编辑/删除) |
| `src/components/report/ReportEditor.tsx` | 全页面报告编辑器 (目录树 + 章节编辑 + AI 填充) |
| `src/components/report/ReportViewer.tsx` | 全页面报告查看器 (目录导航 + Markdown + 导出) |
| `src/components/report/ReportOutlineTree.tsx` | 目录树组件 (编辑/只读模式) |
| `src/components/report/ScheduleManager.tsx` | 定时任务管理 (表格 + toggle + Cron 预设 Modal) |
| `src/stores/metricStore.ts` | 指标 Zustand Store (metrics/dimensions/terms CRUD) |
| `src/stores/reportStore.ts` | 报告 Zustand Store (reports/templates/schedules CRUD) |
| `src/mocks/metrics.ts` | Mock 数据 (6指标 + 4维度 + 3术语) |
| `src/mocks/reports.ts` | Mock 数据 (4报告含完整 sections + 3模板含 outline + 2定时任务 + 3角色 + AI内容映射) |

### 修改

| 文件 | 变更 |
|------|------|
| `src/pages/MetricPage.tsx` | 从占位改为完整页面 (3 Tab + MetricList/Form + 维度/术语表格 CRUD) |
| `src/pages/ReportPage.tsx` | 从占位改为三模式页面 (list/edit/view) + 模板选择器 Modal |
| `src/pages/DataPermissionPage.tsx` | 从占位改为完整页面 (角色列表 + 表/列/行/用户 4级权限) |
| `src/types/index.ts` | 新增 ReportSection + Metric/Dimension/BusinessTerm + Report/Template/Schedule + DataRole/Permission 等 11 个类型 |
