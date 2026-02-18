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

- [ ] dataStore 从 Mock 切换为真实 API
- [ ] api.ts 新增数据管理 API 函数
- [ ] 文件上传 multipart + 进度回调
- [ ] DataPage 联调 (上传→列表→详情→删除)
- [ ] chatStore 增强 tool_call/tool_result 处理
- [ ] ProcessPanel 切换为真实 processSteps
- [ ] MessageItem 集成真实 ChartConfig 渲染
- [ ] SSE 事件流结构化数据确认
- [ ] 端到端场景 1-4 测试
- [ ] 错误处理 (上传失败/查询超时/权限拒绝)
- [ ] 验证通过

---

## 验证标准

- [ ] 上传 Excel → 解析成功 → 数据源列表展示 → 表详情可查看
- [ ] 对话 "查看表" → Agent 工具调用 → ProcessPanel 展示步骤 → 正确回复
- [ ] 对话 "查询数据" → SQL 执行 → 结果 + 图表渲染
- [ ] 图表类型切换正常
- [ ] ProcessPanel 实时展示 Agent 思考/工具调用过程
- [ ] 长对话上下文压缩后仍可继续分析
- [ ] 数据修改操作正常
- [ ] 错误场景有友好提示 (超时/权限)
- [ ] 12 容器全部 healthy

---

## 修改文件列表

| 文件 | 变更 |
|------|------|
| `src/stores/dataStore.ts` | Mock → 真实 API |
| `src/stores/chatStore.ts` | 增强工具调用处理 + ChartConfig 提取 |
| `src/services/api.ts` | 新增 dataApi |
| `src/pages/DataPage.tsx` | 联调调整 |
| `src/components/data/FileUpload.tsx` | 真实上传 + 进度 |
| `src/components/data/DataSourceList.tsx` | 状态轮询 (processing) |
| `src/components/data/TableDetail.tsx` | 真实分页 |
| `src/components/chat/ProcessPanel.tsx` | 真实数据 |
| `src/components/chat/MessageItem.tsx` | 真实图表 |
| `backend/app/api/v1/chat.py` | SSE 结构化数据增强 |
