# Phase 2-B: 前端 UI — 过程展示面板 + 图表组件

## 目标

在 Chat 页面增加右侧可折叠的过程展示面板 (Process Panel)，实现统一图表渲染组件 (ChartRenderer)，支持展示 Agent 执行过程和 SQL 查询结果的可视化。使用 Mock 数据驱动。

---

## 前置条件

- Phase 1 骨架搭建完成
- ChatPage 现有布局可正常工作

---

## 2B.1 ChatPage 布局改造

**修改文件**: `frontend/src/pages/ChatPage.tsx`

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

- [ ] 右侧面板默认收起
- [ ] 面板宽度: 展开 360px, 收起 0px
- [ ] 过渡动画: 滑入/滑出 300ms
- [ ] 面板开关按钮 (消息区右上角)
- [ ] 移动端: 面板覆盖全屏 (overlay 模式)
- [ ] 无过程数据时显示空状态

---

## 2B.2 过程展示面板 (ProcessPanel)

**新增文件**: `frontend/src/components/chat/ProcessPanel.tsx`

### 展示内容 (基于 SSE 事件解析)

| 步骤类型 | 图标 | 展示内容 |
|----------|------|----------|
| 思考过程 (reasoning) | 🧠 Brain | 思考内容摘要 (折叠) |
| 表结构检查 (inspect_table) | 📋 Table | 表名 + 列数 |
| 指标检索 (lookup_metrics) | 📊 BarChart | 匹配指标列表 |
| SQL 生成 (sql_generated) | ⚡ Code | SQL 语句 (语法高亮) |
| SQL 执行 (sql_result) | ✅ CheckCircle | 行数 + 耗时 + 数据预览 |
| 图表推荐 (chart_config) | 📈 LineChart | 推荐图表类型 + 预览 |
| 知识库检索 (rag_source) | 📚 Book | 引用来源 |
| 上下文压缩 (context_compressed) | 🗜️ Archive | 压缩前后 token 数 |

### UI 设计

- 时间轴样式 (竖线 + 圆点连接)
- 每个步骤: 图标 + 标题 + 耗时 + 可折叠详情
- 进行中步骤: spinner 动画
- 已完成步骤: 绿色对勾
- 失败步骤: 红色叉号
- 步骤间淡灰竖线连接

---

## 2B.3 过程步骤项 (ProcessStepItem)

**新增文件**: `frontend/src/components/chat/ProcessStepItem.tsx`

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

interface ProcessStepItemProps {
  step: ProcessStep;
  isLast: boolean;
}
```

### 功能

- [ ] 不同类型步骤的图标和颜色
- [ ] 运行中 spinner / 完成对勾 / 失败叉号
- [ ] 耗时显示 (ms)
- [ ] 详情内容折叠/展开
- [ ] SQL 语法高亮 (轻量 Prism.js 或 复用现有 highlight.js)
- [ ] 数据预览表格 (最多 5 行)

---

## 2B.4 图表渲染组件 (ChartRenderer)

**新增文件**: `frontend/src/components/chart/ChartRenderer.tsx`

### 支持图表类型

| 类型 | Recharts 组件 | 适用场景 |
|------|---------------|----------|
| bar | BarChart | 对比分类数据 |
| line | LineChart | 时间序列/趋势 |
| pie | PieChart | 比例分布 |
| area | AreaChart | 面积趋势 |
| scatter | ScatterChart | 两维关系 |
| table | 自定义 DataTable | 数据表格 |

### 组件接口

```typescript
interface ChartConfig {
  chartType: "bar" | "line" | "pie" | "area" | "scatter" | "table";
  title?: string;
  xAxis?: { field: string; label?: string };
  yAxis?: { field: string; label?: string };
  series?: { field: string; label?: string; color?: string }[];
  colorMapping?: Record<string, string>;
  data: Record<string, any>[];
}

interface ChartRendererProps {
  config: ChartConfig;
  height?: number;
  className?: string;
}
```

### 功能

- [ ] 根据 chartType 自动渲染对应 Recharts 图表
- [ ] 自适应容器宽度 (ResponsiveContainer)
- [ ] 内置配色方案 (Mint Green 主题)
- [ ] Tooltip 交互
- [ ] Legend 图例
- [ ] 表格类型使用 DataTable 组件

---

## 2B.5 图表类型切换器 (ChartTypeSelector)

**新增文件**: `frontend/src/components/chart/ChartTypeSelector.tsx`

### 功能

- [ ] 图标按钮组切换图表类型
- [ ] 当前类型高亮 (渐变绿)
- [ ] 支持禁用不适用的类型 (根据数据维度自动判断)

---

## 2B.6 数据表格组件 (DataTable)

**新增文件**: `frontend/src/components/chart/DataTable.tsx`

### 功能

- [ ] 通用数据表格 (列自动推断)
- [ ] 排序 (点击表头)
- [ ] 文本溢出省略 + tooltip
- [ ] 斑马纹行
- [ ] 响应式横向滚动

---

## 2B.7 消息内图表集成

**修改文件**: `frontend/src/components/chat/MessageItem.tsx`

### 变更

- 当 assistant 消息包含 `chartConfig` 字段时，在消息正文下方渲染 `ChartRenderer`
- 图表上方显示 `ChartTypeSelector` 允许用户切换类型
- 图表卡片样式: 白色背景 + 圆角 + 阴影

---

## 2B.8 chatStore 扩展

**修改文件**: `frontend/src/stores/chatStore.ts`

新增状态:

```typescript
interface ChatStore {
  // ... 现有字段
  processSteps: ProcessStep[];          // 当前消息的过程步骤
  showProcessPanel: boolean;            // 面板开关

  addProcessStep: (step: ProcessStep) => void;
  updateProcessStep: (id: string, updates: Partial<ProcessStep>) => void;
  clearProcessSteps: () => void;
  toggleProcessPanel: () => void;
}
```

---

## 任务清单

- [ ] 定义 ProcessStep / ChartConfig 类型
- [ ] 改造 ChatPage 布局 (左右分栏 + 可折叠)
- [ ] 实现 ProcessPanel 组件 (时间轴)
- [ ] 实现 ProcessStepItem 组件 (单步骤展示)
- [ ] 实现 ChartRenderer 组件 (6 种图表)
- [ ] 实现 ChartTypeSelector 组件
- [ ] 实现 DataTable 组件
- [ ] MessageItem 集成 ChartRenderer
- [ ] chatStore 新增过程步骤状态
- [ ] 创建 Mock 过程数据 + Mock 图表数据
- [ ] 响应式适配
- [ ] 验证通过

---

## 验证标准

- [ ] ChatPage 右侧面板展开/收起动画正常
- [ ] ProcessPanel 时间轴展示 mock 步骤
- [ ] 各类步骤 (思考/工具调用/SQL/图表) 正确渲染
- [ ] 步骤详情折叠/展开正常
- [ ] ChartRenderer 6 种图表类型渲染正常
- [ ] 图表类型切换正常
- [ ] 消息内图表正确展示
- [ ] DataTable 排序/滚动正常
- [ ] 移动端面板 overlay 模式正常
- [ ] TypeScript 编译 0 error

---

## 新增/修改文件列表

### 新增

| 文件 | 说明 |
|------|------|
| `src/components/chat/ProcessPanel.tsx` | 过程展示面板主组件 |
| `src/components/chat/ProcessStepItem.tsx` | 单个步骤展示 |
| `src/components/chart/ChartRenderer.tsx` | 统一图表渲染入口 |
| `src/components/chart/ChartTypeSelector.tsx` | 图表类型切换 |
| `src/components/chart/DataTable.tsx` | 数据表格展示 |
| `src/mocks/processSteps.ts` | Mock 过程数据 |
| `src/mocks/chartData.ts` | Mock 图表数据 |

### 修改

| 文件 | 变更 |
|------|------|
| `src/pages/ChatPage.tsx` | 布局改造 (左右分栏 + 面板) |
| `src/components/chat/MessageItem.tsx` | 集成 ChartRenderer |
| `src/stores/chatStore.ts` | 新增 processSteps 状态 |
| `src/types/index.ts` | 新增 ProcessStep / ChartConfig 类型 |
