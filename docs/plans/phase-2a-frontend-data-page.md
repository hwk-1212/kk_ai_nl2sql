# Phase 2-A: 前端 UI — 数据管理页面

**状态**: ✅ 已完成 (2026-02-18)

## 目标

实现完整的数据管理前端页面：文件上传组件、数据源列表、表详情/数据预览，以及对应的 Zustand store。使用 Mock 数据驱动，后续 Phase 3-A 实现后端后切换为真实 API。

---

## 前置条件

- Phase 1 骨架搭建完成 ✅
- `DataPage.tsx` 占位页面已存在 ✅
- `/data` 路由已注册 ✅

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

- [x] 页面标题 + 上传按钮 (btn-gradient 渐变绿 + Upload 图标)
- [x] 左右分栏响应式布局 (左 320px DataSourceList, 右 flex-1 TableDetail, 移动端堆叠)
- [x] 空状态引导 (无数据源时显示 EmptyState + "上传数据" 按钮)

---

## 2A.2 文件上传组件 (FileUpload)

**文件**: `frontend/src/components/data/FileUpload.tsx`

### 功能

- [x] 拖拽上传区 (支持 .xlsx, .csv, .sqlite, .xls)
- [x] 文件类型/大小校验 (前端预检, 最大 100MB)
- [x] 上传进度条 (模拟 2s)
- [x] 多文件上传支持
- [x] 上传状态反馈 (uploading → processing → ready / failed)
- [x] Modal 弹窗式上传 (使用通用 Modal 组件)

### 实际 UI

- 大圆角虚线边框拖拽区 (border-dashed border-2 rounded-2xl)
- 渐变绿上传按钮 (btn-gradient)
- 文件图标 (xlsx=green, csv=blue, sqlite=purple) + 文件名 + 大小 + 状态

---

## 2A.3 数据源列表 (DataSourceList)

**文件**: `frontend/src/components/data/DataSourceList.tsx`

### 功能

- [x] 数据源卡片列表 (name, source_type, table_count, status, created_at)
- [x] 状态标签: uploading (蓝) / processing (黄) / ready (绿) / failed (红)
- [x] 文件类型图标 (Excel/CSV/SQLite)
- [x] 展开/折叠显示所属表列表
- [x] 点击表项 → 右侧显示表详情
- [x] 删除数据源 (确认弹窗)
- [x] 搜索/筛选

---

## 2A.4 表详情组件 (TableDetail)

**文件**: `frontend/src/components/data/TableDetail.tsx`

### 功能

- [x] 表头信息: 表名、描述 (可编辑占位)、行数、列数
- [x] Schema 信息: 列名、类型、是否可空、注释 (表格展示)
- [x] 数据预览: 分页表格展示前 N 行数据 (mock 50 行/页)
- [x] 分页控件 (上一页/下一页/总行数)
- [x] 删除表 (确认弹窗)

### 实际 UI

- 两个 Tab: "Schema" / "数据预览"
- Schema 列类型使用彩色标签 (varchar=蓝, int=绿, float=橙, date=紫, boolean=灰, timestamp=靛蓝)
- 数据单元格超长文本省略 + title tooltip
- Glass morphism 卡片 (bg-white/80 backdrop-blur)

---

## 2A.5 数据管理 Store

**文件**: `frontend/src/stores/dataStore.ts`

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

### Mock 数据 (`src/mocks/dataSources.ts`)

- 3 个数据源: 销售数据2024.xlsx (Excel, ready, 3表), 客户信息.csv (CSV, ready, 1表), 产品库存.sqlite (SQLite, processing, 2表)
- 每个表 5-8 列不同类型 (varchar, int4, float8, date, bool, timestamp)
- `getMockTableData(tableId, page)` 生成 50 行/页模拟数据

---

## 2A.6 类型定义

**文件**: `frontend/src/types/index.ts`

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

- [x] 定义 DataSource / DataTable / ColumnInfo / TableDataPage 类型
- [x] 创建 Mock 数据 (数据源 + 表 + 模拟行数据)
- [x] 实现 dataStore (Zustand)
- [x] 实现 FileUpload 组件 (拖拽 + 进度 + Modal)
- [x] 实现 DataSourceList 组件 (卡片 + 展开 + 状态)
- [x] 实现 TableDetail 组件 (Schema + 数据预览 + 分页)
- [x] 改造 DataPage 页面 (左右分栏 + 组件组合)
- [x] 响应式适配 (移动端堆叠布局)
- [x] 验证通过

---

## 验证标准

- [x] `/data` 页面正常加载
- [x] 数据源列表展示 3 个 mock 数据源
- [x] 点击数据源展开表列表
- [x] 点击表项右侧显示详情
- [x] Schema 表格展示列信息
- [x] 数据预览表格分页正常
- [x] 上传 Modal 打开/关闭正常
- [x] 拖拽上传 + 文件选择正常 (mock 模拟)
- [x] 删除数据源/表确认弹窗正常
- [x] TypeScript 编译 0 error
- [x] 响应式布局正常

---

## 新增/修改文件列表

### 新增

| 文件 | 说明 |
|------|------|
| `src/components/data/FileUpload.tsx` | 文件上传组件 (Modal + 拖拽 + 进度模拟) |
| `src/components/data/DataSourceList.tsx` | 数据源列表组件 (卡片 + 展开 + 搜索 + 删除确认) |
| `src/components/data/TableDetail.tsx` | 表详情/数据预览组件 (Schema Tab + 数据预览 Tab + 分页) |
| `src/stores/dataStore.ts` | 数据管理 Zustand Store |
| `src/mocks/dataSources.ts` | Mock 数据 (3 数据源, 6 表, 50行/页模拟数据) |

### 修改

| 文件 | 变更 |
|------|------|
| `src/pages/DataPage.tsx` | 从占位改为完整页面 (Header + 左右分栏 + 空状态 + 上传Modal) |
| `src/types/index.ts` | 新增 DataSource / ColumnInfo / DataTable / TableDataPage 类型 |
