# Phase 4-A: 联调 — 数据管理 + NL2SQL 对话

## 目标

前后端全链路联调：文件上传 → 数据解析入库 → NL2SQL 对话查询 → 结果可视化。将 Phase 2-A/2-B 的 Mock 数据切换为真实 API 调用，打通完整的数据分析闭环。

---

## 前置条件

- Phase 2-A 数据管理前端 UI 已完成
- Phase 2-B 过程面板 + 图表组件已完成
- Phase 3-A 数据管理后端已完成
- Phase 3-B NL2SQL 工具集已完成
- Phase 3-C 上下文管理已完成

---

## 4A.1 数据管理前后端联调

### dataStore 切换为真实 API

**修改文件**: `frontend/src/stores/dataStore.ts`

替换所有 Mock 函数为真实 API 调用:

| 函数 | Mock → Real |
|------|-------------|
| `loadDataSources` | `GET /api/v1/data/sources` |
| `loadTables` | `GET /api/v1/data/tables` |
| `loadTableData` | `GET /api/v1/data/tables/{id}/data` |
| `uploadFile` | `POST /api/v1/data/upload` (multipart) |
| `deleteDataSource` | `DELETE /api/v1/data/sources/{id}` |
| `deleteTable` | `DELETE /api/v1/data/tables/{id}` |
| `updateTable` | `PUT /api/v1/data/tables/{id}` |

### API 服务层

**修改文件**: `frontend/src/services/api.ts`

新增数据管理 API:

```typescript
export const dataApi = {
  uploadFile: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient.post("/data/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) => { /* 进度回调 */ },
    });
  },
  getSources: () => apiClient.get("/data/sources"),
  getSource: (id: string) => apiClient.get(`/data/sources/${id}`),
  deleteSource: (id: string) => apiClient.delete(`/data/sources/${id}`),
  getTables: () => apiClient.get("/data/tables"),
  getTable: (id: string) => apiClient.get(`/data/tables/${id}`),
  getTableData: (id: string, cursor?: string) =>
    apiClient.get(`/data/tables/${id}/data`, { params: { cursor } }),
  updateTable: (id: string, data: any) => apiClient.put(`/data/tables/${id}`, data),
  deleteTable: (id: string) => apiClient.delete(`/data/tables/${id}`),
};
```

### 联调验证场景

1. **Excel 上传全流程**:
   - 选择文件 → 上传进度 → processing 状态 → ready
   - 数据源列表刷新 → 表列表展示
   - 点击表 → 右侧 Schema + 数据预览

2. **CSV 上传**:
   - 拖拽 CSV → 上传 → 单表解析 → 数据预览

3. **SQLite 上传**:
   - 上传 .sqlite → 多表解析 → 各表独立展示

4. **删除操作**:
   - 删除数据源 → 级联删除 → PG 表清理

---

## 4A.2 NL2SQL 对话联调

### 对话流程

```
用户: "我的销售数据表有哪些字段?"
  → Agent: inspect_table_schema("sales_orders")
  → ProcessPanel: 显示表结构检查步骤
  → 回复: 列出字段信息

用户: "查询销售额前10的产品"
  → Agent: execute_sql("SELECT product, SUM(amount) ...")
  → ProcessPanel: 显示 SQL 生成 + 执行步骤
  → Agent: recommend_chart(columns, sample_data)
  → ProcessPanel: 显示图表推荐步骤
  → 回复: 查询结果 + ChartRenderer 柱状图
```

### chatStore SSE 事件处理

**修改文件**: `frontend/src/stores/chatStore.ts`

增强 tool_call / tool_result 事件处理:

```typescript
// 收到 tool_call 事件
case "tool_call":
  addProcessStep({
    type: "tool_call",
    title: `调用工具: ${data.name}`,
    status: "running",
    data: data,
  });
  break;

// 收到 tool_result 事件
case "tool_result":
  updateProcessStep(data.id, { status: "success", data: data.result });

  // 如果是 recommend_chart，提取 ChartConfig
  if (data.name === "recommend_chart") {
    currentMessage.chartConfig = JSON.parse(data.result);
  }
  break;
```

### ProcessPanel 真实数据渲染

**修改文件**: `frontend/src/components/chat/ProcessPanel.tsx`

从 Mock 数据切换为 chatStore 中的真实 processSteps:

- 每条消息关联一组 processSteps
- 切换消息时更新面板
- SQL 语句使用语法高亮
- 查询结果使用 DataTable 展示

### MessageItem 图表渲染

**修改文件**: `frontend/src/components/chat/MessageItem.tsx`

- 当 message 包含 chartConfig → 渲染 ChartRenderer
- 支持 ChartTypeSelector 切换图表类型
- 图表下方显示数据表格 (可折叠)
- **增强**: 支持 `chartConfig.imageUrl`（MinIO 图片）优先展示，可切换为 Recharts 交互图

### Chat 输出格式（Coze 风格交错）

**修改文件**: `frontend/src/stores/chatStore.ts`, `frontend/src/components/chat/MessageItem.tsx`, `frontend/src/components/tools/ToolCallBlock.tsx`

- **交错块结构**: 文本 → 工具调用 → 文本 → 工具调用 → …
- `chatStore` 维护 `streamingBlocks` / `message.blocks`，按 SSE 事件顺序构建
- `onContent` 累积文本；`onToolCall` 时 flush 文本块并追加工具块；模型未先输出文本时插入占位「正在执行分析…」
- **ToolCallBlock**: Coze 风格可折叠卡片，默认显示工具名+状态，点击展开参数/结果
- **执行过程面板**: 展示详细参数和结果；Chat 界面仅展示简要工具调用

### 图表增强（MinIO 图片 + Markdown 内嵌）

**修改文件**: `backend/app/core/tools/builtin/chart_recommend.py`, `frontend/src/components/chat/MarkdownContent.tsx`

- **recommend_chart**: 使用 matplotlib 渲染 PNG → 上传 MinIO → 返回 `image_url`
- **MarkdownContent**: `json` 代码块若为有效 ChartConfig → 渲染为内嵌图表（支持 imageUrl 或 Recharts）
- **ChartConfig**: 新增 `imageUrl` 字段，有则优先展示图片

---

## 4A.3 SSE 事件流增强

**修改文件**: `backend/app/api/v1/chat.py`

确保以下事件正确推送:

| 事件 | 数据 | 触发时机 |
|------|------|----------|
| `tool_call` | name, arguments, status:"calling" | Agent 决定调用工具 |
| `tool_result` | name, result, status:"success"/"error" | 工具执行完成 |
| `context_compressed` | original_tokens, compressed_tokens | 上下文被压缩 |

工具执行结果中需包含结构化数据 (而非纯文本)，便于前端渲染:

```json
// execute_sql 结果
{
  "type": "sql_result",
  "sql": "SELECT ...",
  "columns": [...],
  "data": [...],
  "row_count": 10,
  "execution_time_ms": 45
}

// recommend_chart 结果
{
  "type": "chart_config",
  "chartType": "bar",
  "xAxis": {"field": "product"},
  "yAxis": {"field": "amount"},
  "data": [...]
}
```

---

## 4A.4 端到端测试场景

### 场景 1: 首次使用

1. 新用户登录
2. 进入数据管理页 → 上传 Excel 文件 (含"销售订单"Sheet)
3. 等待解析完成 → 查看表结构 → 预览数据
4. 进入对话页 → "查看我的数据表" → Agent 列出表
5. "查询本月销售额" → Agent 检查表结构 → 生成 SQL → 执行 → 返回结果 + 图表

### 场景 2: 多表关联

1. 上传包含多个 Sheet 的 Excel (订单表 + 产品表)
2. "哪些产品卖得最好?" → Agent 检查两张表结构 → JOIN 查询 → 结果 + 柱状图

### 场景 3: 数据修改

1. "在销售表中添加一条记录" → Agent 确认表结构 → modify_user_data → 成功
2. "验证新增的记录" → Agent 查询 → 返回包含新记录的结果

### 场景 4: 长对话上下文

1. 连续 20+ 轮数据分析对话
2. 观察上下文压缩触发
3. 压缩后 Agent 仍能理解之前的分析上下文

---

## 任务清单

- [x] dataStore 从 Mock 切换为真实 API
- [x] api.ts 新增数据管理 API 函数
- [x] 文件上传 multipart + 进度回调
- [x] DataPage 联调 (上传→列表→详情→删除)
- [x] chatStore 增强 tool_call/tool_result 处理
- [x] ProcessPanel 切换为真实 processSteps
- [x] MessageItem 集成真实 ChartConfig 渲染
- [x] SSE 事件流结构化数据确认
- [x] 端到端场景 1-4 测试
- [x] 错误处理 (上传失败/查询超时/权限拒绝)
- [x] 验证通过
- [x] Chat 输出格式：文本→工具→文本 交错结构（streamingBlocks / blocks）
- [x] ToolCallBlock Coze 风格可折叠展示
- [x] 执行过程面板详细参数/结果，Chat 界面简要展示
- [x] recommend_chart 渲染 PNG 上传 MinIO 返回 image_url
- [x] MarkdownContent json 代码块解析为内嵌图表

---

## 验证标准

- [x] 上传 Excel → 解析成功 → 数据源列表展示 → 表详情可查看
- [x] 对话 "查看表" → Agent 工具调用 → ProcessPanel 展示步骤 → 正确回复
- [x] 对话 "查询数据" → SQL 执行 → 结果 + 图表渲染
- [x] 图表类型切换正常
- [x] ProcessPanel 实时展示 Agent 思考/工具调用过程
- [x] 长对话上下文压缩后仍可继续分析
- [x] 数据修改操作正常
- [x] 错误场景有友好提示 (超时/权限)
- [x] 12 容器全部 healthy
- [x] Chat 输出为「文本→工具→文本」交错结构（Coze 风格）
- [x] 工具调用可折叠，执行过程面板展示详细参数/结果
- [x] 图表支持 MinIO 图片展示，分析报告内 json 代码块渲染为图表

---

## 修改文件列表

| 文件 | 变更 |
|------|------|
| `frontend/src/services/api.ts` | 新增 dataApi: 10 个 API 函数 (含 XHR multipart upload + progress 回调) |
| `frontend/src/stores/dataStore.ts` | 完全重写: Mock → 真实 API, 新增 snake_case→camelCase 映射函数 (mapSource/mapTable/mapTableData) |
| `frontend/src/stores/chatStore.ts` | 增强 sendMessage: tool_call→ProcessStep 实时推送, tool_result→SQL/Chart 结构化解析; 新增 streamingBlocks/blocks 交错结构, 占位文本 |
| `frontend/src/components/chat/MessageItem.tsx` | ChartConfig 渲染; blocks 交错渲染; imageUrl 优先展示 |
| `frontend/src/components/chat/MessageList.tsx` | 传递 streamingBlocks 给流式 MessageItem |
| `frontend/src/components/chat/ProcessStepItem.tsx` | 执行过程面板展示详细参数/结果 |
| `frontend/src/components/chat/MarkdownContent.tsx` | json 代码块解析为 ChartConfig 内嵌图表 |
| `frontend/src/components/tools/ToolCallBlock.tsx` | Coze 风格可折叠卡片 (工具名+状态, 展开参数/结果) |
| `frontend/src/components/chart/ChartRenderer.tsx` | 修复 pie nameKey、空数据判断 |
| `frontend/src/types/index.ts` | MessageBlock 类型; ChartConfig.imageUrl |
| `backend/app/api/v1/chat.py` | tool_result 限制 8000 字符, _extract_structured_data; 强化 system prompt「先输出文字再调用工具」 |
| `backend/app/core/tools/builtin/chart_recommend.py` | matplotlib 渲染 PNG → MinIO 上传 → 返回 image_url |
| `backend/requirements.txt` | 新增 matplotlib |

---

## 实现说明

### 1. dataApi (frontend/src/services/api.ts)

新增 `dataApi` 对象，包含:
- `uploadFile(file, onProgress?)`: 使用 XMLHttpRequest 支持 upload progress 事件
- `getSources/getSource/deleteSource`: 数据源 CRUD
- `getTables/getTable/getTableData/getTableSchema`: 数据表 CRUD + 分页查询
- `updateTable/deleteTable`: 表操作

类型接口: `DataSourceRaw`, `DataTableRaw`, `TableDataRaw` (匹配后端 snake_case 响应)

### 2. dataStore 重写 (frontend/src/stores/dataStore.ts)

- 完全移除 mock 依赖 (`MOCK_DATA_SOURCES`, `MOCK_DATA_TABLES`, `getMockTableData`)
- 三个映射函数处理后端→前端类型转换:
  - `mapSource()`: `source_type/file_name/file_size` → `sourceType/originalFilename/fileSize`
  - `mapTable()`: `data_source_id/display_name/columns_meta` → `dataSourceId/displayName/columnSchema`
  - `mapTableData()`: `rows[][]` + `columns[]` → `Record<string,any>[]` 对象数组
- `loadTables()` 优先使用 `getSource()` (含 tables), fallback 到 `getTables()` 全量过滤
- `uploadFile()` 上传成功后自动刷新数据源列表

### 3. chatStore 增强 (frontend/src/stores/chatStore.ts)

- `sendMessage()` 内新增:
  - `clearProcessSteps()` 每次发送前清空
  - `onToolCall` → `addProcessStep(type='tool_call', status='running')`
  - `onToolResult` → `updateProcessStep(status)` + 按工具名解析:
    - `execute_sql` → 解析 JSON 并创建 `sql_result` ProcessStep (含 preview 数据)
    - `recommend_chart` → 解析 ChartConfig 并创建 `chart_config` ProcessStep
  - `onRAGSource` → 创建 `rag_source` ProcessStep
  - 优先使用后端 `structured_data` 字段, fallback 到 JSON 文本解析
- 新增辅助函数: `_tryParseToolJson()`, `_rowsToRecords()`, `_mapChartConfig()`
- **交错块结构**: `blocks` / `streamingBlocks` 维护「文本→工具→文本」顺序；`onContent` 时 flush 到 blocks；`onToolCall` 时若无前置文本则插入占位「正在执行分析…」

### 4. 后端 SSE 增强 (backend/app/api/v1/chat.py)

- `tool_result` 事件的 `result` 截断限制从 2000 → 8000
- 新增 `_extract_structured_data(tool_name, result_text)`:
  - `execute_sql` → `{type:"sql_result", columns, rows, total_rows, execution_ms}`
  - `recommend_chart` → `{type:"chart_config", ...config}`
  - `inspect_tables/inspect_table_schema` → `{type:"schema_info", text}`
- SSE `tool_result` 事件新增 `structured_data` 字段 (当解析成功时)
- **System prompt 强化**: 要求「先输出文字说明再调用工具」，禁止无文字直接调用

### 5. recommend_chart 图表渲染 (backend/app/core/tools/builtin/chart_recommend.py)

- `_render_chart_png(config)`: 使用 matplotlib Agg 渲染 bar/line/area/pie/scatter 为 PNG
- `_upload_png_to_minio(png_bytes)`: 上传至 MinIO `charts` bucket，返回公开 URL
- 返回 JSON 中增加 `image_url` 字段，前端优先展示图片

### 6. 验证结果

- 12 容器全部 healthy
- 后端 API 端到端: 注册 → 登录 → 上传 CSV → 列出数据源 → 列出表 → 查询数据 (全部通过)
- SSE 对话: "查看我的数据表" → tool_call(inspect_tables) → tool_result(含 structured_data) → 正确回复
- 前后端 nginx 代理全链路通畅
