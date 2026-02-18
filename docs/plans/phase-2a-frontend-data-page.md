# Phase 2-A: 前端 UI — 数据管理页面

## 目标

实现完整的数据管理前端页面：文件上传组件、数据源列表、表详情/数据预览，以及对应的 Zustand store。使用 Mock 数据驱动，后续 Phase 3-A 实现后端后切换为真实 API。

---

## 前置条件

- Phase 1 骨架搭建完成
- `DataPage.tsx` 占位页面已存在
- `/data` 路由已注册

---

## 2A.1 数据管理页面 (DataPage)

**文件**: `frontend/src/pages/DataPage.tsx`

### 页面布局

```
┌─────────────────────────────────────────────┐
│ 📊 数据管理                    [上传数据] 按钮 │
├──────────────────┬──────────────────────────┤
│                  │                          │
│  数据源列表       │      表详情/数据预览       │
│  DataSourceList  │      TableDetail         │
│                  │                          │
│  - 数据源卡片     │   表名 / 描述 / Schema    │
│  - 展开显示表列表  │   数据表格 (分页)          │
│  - 状态标签       │   列类型信息              │
│                  │                          │
└──────────────────┴──────────────────────────┘
```

### 功能清单

- [ ] 页面标题 + 上传按钮
- [ ] 左右分栏响应式布局
- [ ] 空状态引导 (无数据源时显示上传引导)

---

## 2A.2 文件上传组件 (FileUpload)

**新增文件**: `frontend/src/components/data/FileUpload.tsx`

### 功能

- [ ] 拖拽上传区 (支持 .xlsx, .csv, .sqlite, .xls)
- [ ] 文件类型/大小校验 (前端预检, 最大 100MB)
- [ ] 上传进度条 (模拟)
- [ ] 多文件上传支持
- [ ] 上传状态反馈 (uploading → processing → ready / failed)
- [ ] Modal 弹窗式上传 (点击"上传数据"按钮触发)

### UI 风格

- 大圆角虚线边框拖拽区
- 渐变绿上传按钮
- 文件图标 + 文件名 + 大小 + 状态

---

## 2A.3 数据源列表 (DataSourceList)

**新增文件**: `frontend/src/components/data/DataSourceList.tsx`

### 功能

- [ ] 数据源卡片列表 (name, source_type, table_count, status, created_at)
- [ ] 状态标签: uploading (蓝) / processing (黄) / ready (绿) / failed (红)
- [ ] 文件类型图标 (Excel/CSV/SQLite)
- [ ] 展开/折叠显示所属表列表
- [ ] 点击表项 → 右侧显示表详情
- [ ] 删除数据源 (确认弹窗)
- [ ] 搜索/筛选

---

## 2A.4 表详情组件 (TableDetail)

**新增文件**: `frontend/src/components/data/TableDetail.tsx`

### 功能

- [ ] 表头信息: 表名、描述 (可编辑)、行数、列数
- [ ] Schema 信息: 列名、类型、是否可空、注释 (表格展示)
- [ ] 数据预览: 分页表格展示前 N 行数据 (mock 50 行/页)
- [ ] 分页控件 (上一页/下一页/总行数)
- [ ] 删除表 (确认弹窗)

### UI 风格

- 表格使用 Glass morphism 卡片
- Schema 列类型使用彩色标签 (varchar=蓝, int=绿, float=橙, date=紫, boolean=灰)
- 数据单元格超长文本省略 + tooltip

---

## 2A.5 数据管理 Store

**新增文件**: `frontend/src/stores/dataStore.ts`

### 状态

```typescript
interface DataStore {
  dataSources: DataSource[];
  selectedSourceId: string | null;
  selectedTableId: string | null;
  tables: DataTable[];
  tableData: Record<string, TableDataPage>;
  isUploading: boolean;
  isLoading: boolean;

  // Actions
  loadDataSources: () => Promise<void>;
  loadTables: (sourceId: string) => Promise<void>;
  loadTableData: (tableId: string, cursor?: string) => Promise<void>;
  uploadFile: (file: File) => Promise<void>;
  deleteDataSource: (id: string) => Promise<void>;
  deleteTable: (id: string) => Promise<void>;
  updateTable: (id: string, updates: Partial<DataTable>) => Promise<void>;
  selectSource: (id: string | null) => void;
  selectTable: (id: string | null) => void;
}
```

### Mock 数据

- 3 个数据源 (1 Excel, 1 CSV, 1 SQLite)
- 每个数据源 1-3 个表
- 每个表 5-8 列不同类型
- 每个表 50 行模拟数据

---

## 2A.6 类型定义

**修改文件**: `frontend/src/types/index.ts`

```typescript
interface DataSource {
  id: string;
  userId: string;
  name: string;
  sourceType: "excel" | "csv" | "sqlite";
  originalFilename: string;
  fileSize: number;
  tableCount: number;
  status: "uploading" | "processing" | "ready" | "failed";
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

interface DataTable {
  id: string;
  dataSourceId: string;
  userId: string;
  pgSchema: string;
  pgTableName: string;
  displayName: string;
  description?: string;
  columnSchema: ColumnInfo[];
  rowCount: number;
  isWritable: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  comment?: string;
}

interface TableDataPage {
  data: Record<string, any>[];
  totalCount: number;
  nextCursor: string | null;
  hasMore: boolean;
}
```

---

## 任务清单

- [ ] 定义 DataSource / DataTable / ColumnInfo / TableDataPage 类型
- [ ] 创建 Mock 数据 (数据源 + 表 + 模拟行数据)
- [ ] 实现 dataStore (Zustand)
- [ ] 实现 FileUpload 组件 (拖拽 + 进度 + Modal)
- [ ] 实现 DataSourceList 组件 (卡片 + 展开 + 状态)
- [ ] 实现 TableDetail 组件 (Schema + 数据预览 + 分页)
- [ ] 改造 DataPage 页面 (左右分栏 + 组件组合)
- [ ] 响应式适配 (移动端堆叠布局)
- [ ] 验证通过

---

## 验证标准

- [ ] `/data` 页面正常加载
- [ ] 数据源列表展示 3 个 mock 数据源
- [ ] 点击数据源展开表列表
- [ ] 点击表项右侧显示详情
- [ ] Schema 表格展示列信息
- [ ] 数据预览表格分页正常
- [ ] 上传 Modal 打开/关闭正常
- [ ] 拖拽上传 + 文件选择正常 (mock 模拟)
- [ ] 删除数据源/表确认弹窗正常
- [ ] TypeScript 编译 0 error
- [ ] 响应式布局正常

---

## 新增/修改文件列表

### 新增

| 文件 | 说明 |
|------|------|
| `src/components/data/FileUpload.tsx` | 文件上传组件 |
| `src/components/data/DataSourceList.tsx` | 数据源列表组件 |
| `src/components/data/TableDetail.tsx` | 表详情/数据预览组件 |
| `src/stores/dataStore.ts` | 数据管理 Zustand Store |
| `src/mocks/dataSources.ts` | Mock 数据 |

### 修改

| 文件 | 变更 |
|------|------|
| `src/pages/DataPage.tsx` | 从占位改为完整页面 |
| `src/types/index.ts` | 新增 DataSource/DataTable 等类型 |
