# Phase 2-B: 前端 UI — 过程展示面板 + 图表组件

**状态**: ✅ 已完成 (2026-02-18)

## 目标

在 Chat 页面增加右侧可折叠的过程展示面板 (Process Panel)，实现统一图表渲染组件 (ChartRenderer)，支持展示 Agent 执行过程和 SQL 查询结果的可视化。使用 Mock 数据驱动。

---

## 前置条件

- Phase 1 骨架搭建完成 ✅
- ChatPage 现有布局可正常工作 ✅

---

## 2B.1 ChatPage 布局改造

**文件**: `frontend/src/pages/ChatPage.tsx`

### 布局变更

```
从:
┌──────────────────────────────┐
│         MessageList          │
│         ChatInput            │
└──────────────────────────────┘

变为:
┌───────────────────┬──────────┐
│    MessageList    │ Process  │
│    ChatInput      │ Panel    │
│                   │ (可折叠)  │
└───────────────────┴──────────┘
```

### 功能

- [x] 右侧面板默认收起 (showProcessPanel: false)
- [x] 面板宽度: 展开 360px, 收起 translate-x-full
- [x] 过渡动画: 滑入/滑出 300ms ease-in-out (transform + will-change)
- [x] 面板开关按钮 (PanelRight 图标, 消息区右上角 absolute 定位)
- [x] 移动端: 面板 fixed overlay + backdrop blur + 点击遮罩关闭
- [x] 无过程数据时显示空状态 (ListChecks 图标 + "暂无过程信息")

---

## 2B.2 过程展示面板 (ProcessPanel)

**文件**: `frontend/src/components/chat/ProcessPanel.tsx`

### 展示内容 (基于 SSE 事件解析)

| 步骤类型 | 图标 | 展示内容 |
|----------|------|----------|
| 思考过程 (reasoning) | Brain | 思考内容摘要 (折叠) |
| 工具调用 (tool_call) | Wrench | 工具名 + 参数 |
| SQL 生成 (sql_generated) | Code | SQL 语句 (暗色代码块) |
| SQL 执行 (sql_result) | CheckCircle | 行数 + 耗时 + 数据预览表格 (3行) |
| 图表推荐 (chart_config) | BarChart3 | 推荐图表类型标签 |
| 知识库检索 (rag_source) | BookOpen | 引用来源 + 相关度分数 |
| 上下文压缩 (context_compressed) | Archive | JSON 详情 |

### 实际 UI

- 时间轴样式: 圆点 (w-7 h-7 rounded-full) + 竖线 (w-px bg-slate-200) 连接
- 每个步骤: 状态图标 + 标题 + 耗时(ms) + 可折叠详情 (ChevronDown 旋转动画)
- 进行中步骤: Loader2 animate-spin + 琥珀色背景
- 已完成步骤: 类型图标 + 翠绿色背景
- 失败步骤: XCircle + 红色背景
- Header: ListChecks 图标 + "执行过程" + 步骤计数标签 + 关闭按钮

---

## 2B.3 过程步骤项 (ProcessStepItem)

**文件**: `frontend/src/components/chat/ProcessStepItem.tsx`

### 组件接口

```typescript
interface ProcessStep {
  id: string;
  type: "reasoning" | "tool_call" | "tool_result" | "sql_generated" | "sql_result" | "chart_config" | "rag_source" | "context_compressed";
  title: string;
  status: "running" | "success" | "error";
  startTime: number;
  endTime?: number;
  data: any;
}
```

### 功能

- [x] 8 种步骤类型各有对应图标 (Brain/Wrench/Code/CheckCircle/BarChart3/BookOpen/Archive)
- [x] 运行中 spinner (Loader2 animate-spin) / 完成 (类型图标 emerald) / 失败 (XCircle red)
- [x] 耗时显示 (font-mono, ms 单位)
- [x] 详情内容折叠/展开 (click toggle + animate-fade-in)
- [x] SQL 语句暗色代码块 (bg-slate-900 text-emerald-300 font-mono)
- [x] sql_result 数据预览表格 (最多 3 行)
- [x] chart_config 显示图表类型标签 + "推荐" badge
- [x] tool_call 显示工具名 + 表名
- [x] rag_source 显示来源标题 + 相关度百分比

---

## 2B.4 图表渲染组件 (ChartRenderer)

**文件**: `frontend/src/components/chart/ChartRenderer.tsx`

### 支持图表类型

| 类型 | Recharts 组件 | 适用场景 |
|------|---------------|----------|
| bar | BarChart + Bar | 对比分类数据 (radius=[6,6,0,0] 圆角柱) |
| line | LineChart + Line | 时间序列/趋势 (monotone 曲线 + dot) |
| pie | PieChart + Pie + Cell | 比例分布 (label 百分比 + labelLine) |
| area | AreaChart + Area | 面积趋势 (fillOpacity=0.15) |
| scatter | ScatterChart + Scatter | 两维关系 |
| table | DataTable 组件 | 数据表格 |

### 功能

- [x] 根据 chartType 自动渲染对应 Recharts 图表
- [x] 自适应容器宽度 (ResponsiveContainer width="100%" height={height})
- [x] 内置配色方案: `['#34d399','#60a5fa','#f472b6','#a78bfa','#fbbf24','#fb923c']`
- [x] Tooltip 交互 (圆角 borderRadius:12 + 阴影)
- [x] Legend 图例
- [x] CartesianGrid (strokeDasharray="3 3")
- [x] 表格类型 fallback 到 DataTable 组件
- [x] 自动推断 series fields (当 series 未指定时从 data keys 推断)

---

## 2B.5 图表类型切换器 (ChartTypeSelector)

**文件**: `frontend/src/components/chart/ChartTypeSelector.tsx`

### 功能

- [x] 6 种图标按钮组 (BarChart3/TrendingUp/PieChart/AreaChart/Circle/Table2)
- [x] 当前类型高亮 (btn-gradient text-white shadow-md)
- [x] 支持 availableTypes 控制可用类型
- [x] 每个按钮有 title 中文提示

---

## 2B.6 数据表格组件 (DataTable)

**文件**: `frontend/src/components/chart/DataTable.tsx`

### 功能

- [x] 通用数据表格 (列从 data[0] keys 自动推断)
- [x] 排序 (点击表头切换 asc/desc, ArrowUp/ArrowDown 图标)
- [x] 文本溢出省略 + title tooltip (max-w-[200px] truncate)
- [x] 斑马纹行 (奇偶交替 bg-white / bg-slate-50/50)
- [x] 响应式横向滚动 (overflow-x-auto)
- [x] hover 行高亮 (hover:bg-primary/5)
- [x] 空数据状态 "暂无数据"

---

## 2B.7 消息内图表集成

**文件**: `frontend/src/components/chat/MessageItem.tsx`

### 变更

- [x] Message 类型新增 `chartConfig?: ChartConfig` 字段
- [x] 当 assistant 消息包含 chartConfig 时，在消息正文下方渲染 ChartRenderer
- [x] 图表上方显示 ChartTypeSelector 允许用户动态切换类型
- [x] 图表卡片样式: bg-white + border + rounded-3xl + shadow-soft
- [x] chartType 本地 state 管理，默认使用 config 中的 chartType

---

## 2B.8 chatStore 扩展

**文件**: `frontend/src/stores/chatStore.ts`

新增状态 (保留所有原有字段不变):

```typescript
// 新增字段
processSteps: ProcessStep[]       // 默认 []
showProcessPanel: boolean         // 默认 false

// 新增 actions
addProcessStep: (step: ProcessStep) => void
updateProcessStep: (id: string, updates: Partial<ProcessStep>) => void
clearProcessSteps: () => void
toggleProcessPanel: () => void
```

---

## 任务清单

- [x] 定义 ProcessStep / ChartConfig 类型
- [x] 改造 ChatPage 布局 (左右分栏 + 可折叠)
- [x] 实现 ProcessPanel 组件 (时间轴)
- [x] 实现 ProcessStepItem 组件 (单步骤展示)
- [x] 实现 ChartRenderer 组件 (6 种图表)
- [x] 实现 ChartTypeSelector 组件
- [x] 实现 DataTable 组件
- [x] MessageItem 集成 ChartRenderer
- [x] chatStore 新增过程步骤状态
- [x] 创建 Mock 过程数据 + Mock 图表数据
- [x] 响应式适配
- [x] 验证通过

---

## 验证标准

- [x] ChatPage 右侧面板展开/收起动画正常 (translate-x + duration-300)
- [x] ProcessPanel 时间轴展示 mock 步骤 (6 步 NL2SQL 流程)
- [x] 各类步骤 (思考/工具调用/SQL/图表/知识库) 正确渲染
- [x] 步骤详情折叠/展开正常 (ChevronDown 旋转 + animate-fade-in)
- [x] ChartRenderer 6 种图表类型渲染正常
- [x] 图表类型切换正常 (ChartTypeSelector 6 种图标)
- [x] 消息内图表正确展示 (MessageItem 集成 ChartRenderer + ChartTypeSelector)
- [x] DataTable 排序/滚动正常 (click header toggle, zebra stripe, overflow-x-auto)
- [x] 移动端面板 overlay 模式正常 (fixed + backdrop-blur + click-to-close)
- [x] TypeScript 编译 0 error

---

## Mock 数据

### processSteps (src/mocks/processSteps.ts)

6 步模拟 NL2SQL 完整流程:
1. reasoning (500ms) — 分析用户查询意图
2. tool_call (200ms) — 检查表结构 (schema_inspect → sales_2024)
3. sql_generated (800ms) — 生成 SQL (SELECT category, SUM(amount) ... GROUP BY ...)
4. sql_result (300ms) — 执行查询 (8行, 45ms, 3行预览)
5. chart_config (100ms) — 推荐柱状图
6. rag_source (150ms) — 知识库检索 (销售分析报告 92%)

### chartData (src/mocks/chartData.ts)

3 种图表配置:
- barChartConfig: 各品类销售总额 (8 品类)
- lineChartConfig: 月度销售趋势 (12 个月, 营收+成本双线)
- pieChartConfig: 客户来源分布 (5 来源)

---

## 新增/修改文件列表

### 新增

| 文件 | 说明 |
|------|------|
| `src/components/chat/ProcessPanel.tsx` | 过程展示面板 (时间轴 + header + 空状态) |
| `src/components/chat/ProcessStepItem.tsx` | 单步骤展示 (8种类型 + 3状态 + 折叠详情) |
| `src/components/chart/ChartRenderer.tsx` | 统一图表渲染 (6种 Recharts 图表 + DataTable) |
| `src/components/chart/ChartTypeSelector.tsx` | 图表类型切换按钮组 |
| `src/components/chart/DataTable.tsx` | 通用可排序数据表格 |
| `src/mocks/processSteps.ts` | Mock 过程数据 (6步 NL2SQL 流程) |
| `src/mocks/chartData.ts` | Mock 图表数据 (bar/line/pie) |

### 修改

| 文件 | 变更 |
|------|------|
| `src/pages/ChatPage.tsx` | 布局改造 (flex-row + ProcessPanel + PanelRight 切换按钮) |
| `src/components/chat/MessageItem.tsx` | 集成 ChartRenderer + ChartTypeSelector (chartConfig 检测) |
| `src/stores/chatStore.ts` | 新增 processSteps/showProcessPanel + 4 个 actions |
| `src/types/index.ts` | 新增 ProcessStep / ChartConfig 类型, Message 增加 chartConfig 字段 |
