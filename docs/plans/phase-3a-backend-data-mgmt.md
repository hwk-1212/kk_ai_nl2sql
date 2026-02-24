# Phase 3-A: 后端 — 数据管理模块 + 多租户隔离

> **状态**: ✅ 已完成  
> **完成时间**: 2026-02-18

## 目标

实现数据管理核心后端：文件上传 → 解析入库 (Excel/CSV/SQLite) → 表级 CRUD API，以及多租户 schema 隔离和 `IsolatedSQLExecutor`。

---

## 前置条件

- ✅ Phase 0 Docker 更新完成 (user_data schema 存在)
- ✅ Phase 1 骨架搭建完成 (ORM 模型空壳 + API stub 就绪)

---

## 3A.1 文件解析器 (Parsers) ✅

**文件**: `backend/app/core/data/parsers.py`

### 支持格式

| 格式 | 解析库 | 逻辑 |
|------|--------|------|
| Excel (.xlsx/.xls) | `openpyxl` | 每个 Sheet → 一张表 |
| CSV (.csv) | `csv` (标准库) | 整个文件 → 一张表 |
| SQLite (.sqlite/.db) | `sqlite3` (标准库) | 每个 table → 一张表 |

### 核心接口

```python
class ParseResult:
    tables: list[ParsedTable]

class ParsedTable:
    name: str                       # 原始表名/Sheet名
    columns: list[ColumnInfo]       # 列定义
    data: list[dict]                # 行数据
    row_count: int

class FileParser:
    async def parse(self, file_path: str, file_type: str) -> ParseResult:
        """解析上传文件，返回表结构和数据"""

    async def parse_excel(self, file_path: str) -> ParseResult:
    async def parse_csv(self, file_path: str) -> ParseResult:
    async def parse_sqlite(self, file_path: str) -> ParseResult:
```

### 类型推断

- ✅ 自动推断列类型: varchar / integer / float / boolean / date / timestamp
- ✅ 基于数据采样前 100 行进行推断
- ✅ 空列默认 varchar
- ✅ `coerce_value()` 将原始值转换为 Python 对象 (asyncpg 严格类型匹配)
- ✅ 日期/时间戳支持多种格式解析 (`YYYY-MM-DD`, `YYYY/MM/DD`, ISO 8601 等)

### 实现细节

- `sanitize_column_name()` / `sanitize_table_name()` 确保 PG 标识符安全
- Excel: 自动处理重复列名 (追加 `_1`, `_2`)
- CSV: 自动检测分隔符 (Sniffer)，UTF-8-BOM 兼容
- SQLite: 读取 PRAGMA table_info 获取类型信息 + 数据采样双重推断

---

## 3A.2 数据管理器 (DataManager) ✅

**文件**: `backend/app/core/data/manager.py`

### 核心功能

```python
class DataManager:
    async def upload_and_parse(
        self, db, user_id, tenant_id, filename, content
    ) -> DataSource:
        """
        1. 验证文件类型和大小
        2. 创建 DataSource 记录 (status=parsing)
        3. 保存临时文件 → FileParser 解析
        4. 确保租户 schema 存在
        5. 对每个 ParsedTable:
           a. 生成 pg_table_name: ud_{uid8}_{sanitized_name}
           b. CREATE TABLE (类型映射到 PG 类型)
           c. 批量 INSERT (500 行/批, coerce_value 类型转换)
           d. 创建 DataTable 记录
        6. 更新 DataSource 状态为 ready
        7. 异步备份到 MinIO (非阻塞)
        """
```

### 表命名规则 (实际实现)

- 租户用户: `ud_tenant_{tenant_id_short8}` schema + `ud_{uid8}_{table_name}` 表名
- 无租户用户: `user_data` schema + `ud_{uid8}_{table_name}` 表名
- `{xxx_short8}` = UUID 去掉横线后前 8 位

### CRUD 方法

- `list_sources()` / `get_source()` / `delete_source()` — 数据源管理
- `list_tables()` / `get_table()` / `update_table()` / `delete_table()` — 表管理
- `get_table_data()` — 分页查询 (page + page_size)
- `get_table_schema()` — 返回表结构供 Agent 使用
- `drop_pg_table()` — DDL 级删除物理表

---

## 3A.3 多租户 Schema 隔离 ✅

### Schema 策略

```sql
-- 租户用户: 每个租户独立 schema (动态创建)
CREATE SCHEMA IF NOT EXISTS ud_tenant_{tenant_id_short8};
GRANT ALL ON SCHEMA ... TO kk_nl2sql;

-- 个人用户 (无租户): 使用统一 user_data schema (init.sql 已创建)
```

### DataTable 模型完善

```python
class DataTable(Base):
    __tablename__ = "data_tables"
    id: UUID
    data_source_id: UUID            # FK data_sources.id
    user_id: UUID                   # FK users.id
    tenant_id: UUID?                # FK tenants.id
    pg_schema: str                  # "ud_tenant_{tid8}" 或 "user_data"
    pg_table_name: str              # ud_{uid8}_{name}
    name: str                       # 原始表名
    display_name: str               # 可编辑的显示名
    description: str?
    columns_meta: JSONB             # [{name, type, nullable, comment}]
    column_count: int
    row_count: int
    is_writable: bool = True
    visibility: str = "private"     # "private" | "tenant" | "public"
    created_at / updated_at
```

### DataSource 模型完善

新增字段: `file_type`, `minio_path`, `tables` relationship

---

## 3A.4 租户隔离 SQL 执行器 ✅

**文件**: `backend/app/core/data/isolated_executor.py`

```python
class IsolatedSQLExecutor:
    """租户隔离的 SQL 执行器 — 强制 search_path"""

    async def execute_read(
        self, tenant_schema: str, sql: str,
        params: dict | None, timeout: int = 30
    ) -> QueryResult:
        """
        1. SET LOCAL search_path TO {tenant_schema}, public
        2. SET LOCAL statement_timeout TO '{timeout}s'
        3. SET LOCAL lock_timeout TO '5s'
        4. 执行 SQL
        5. 返回结果 (限制 SQL_MAX_RESULT_ROWS=1000 行)
        """

    async def execute_write(
        self, tenant_schema: str, sql: str,
        user_id, table_pg_schema, table_pg_name, is_writable
    ) -> WriteResult:
        """
        1. 验证 is_writable
        2. 验证 table_pg_schema == tenant_schema (跨租户写入阻断)
        3. 开启事务 (engine.begin)
        4. SET LOCAL search_path + timeout
        5. 执行写 SQL
        6. 返回影响行数 + 执行耗时
        """

    @staticmethod
    def get_user_schema(tenant_id) -> str:
        """根据 tenant_id 返回 schema 名"""
```

---

## 3A.5 数据管理 API ✅

**文件**: `backend/app/api/v1/data.py`

| 端点 | 方法 | 功能 | 状态 |
|------|------|------|------|
| `/upload` | POST | 上传文件 (multipart) | ✅ |
| `/sources` | GET | 列出数据源 (分页) | ✅ |
| `/sources/{id}` | GET | 数据源详情 (含表列表) | ✅ |
| `/sources/{id}` | DELETE | 删除数据源 (级联) | ✅ |
| `/tables` | GET | 列出所有表 (分页) | ✅ |
| `/tables/{id}` | GET | 表详情 | ✅ |
| `/tables/{id}/data` | GET | 分页查询数据 | ✅ |
| `/tables/{id}` | PUT | 更新表信息 | ✅ |
| `/tables/{id}` | DELETE | 删除单表 | ✅ |
| `/tables/{id}/schema` | GET | 获取表结构 | ✅ |

### Pydantic Schemas ✅

**文件**: `backend/app/schemas/data.py`

- `ColumnSchema` — 列定义 (name, type, nullable, comment)
- `DataSourceResponse`, `DataSourceDetailResponse`, `DataSourceListResponse`
- `DataTableResponse`, `DataTableListResponse`
- `TableDataResponse` (含 columns, column_types, rows, total_count, page, page_size, has_more)
- `TableSchemaResponse` (供 Agent 工具使用)
- `UpdateTableRequest` (display_name, description)

---

## 3A.6 MinIO 文件备份 ✅

上传文件异步存储到 MinIO (非阻塞, best-effort):

```
kk-nl2sql-files/
└── user-data/
    └── {user_id}/
        └── {data_source_id}/
            └── {original_filename}
```

自动创建 bucket (如不存在)，使用 `asyncio.to_thread` 封装同步 MinIO 客户端。

---

## 任务清单

- [x] 实现 FileParser (Excel/CSV/SQLite 解析 + 类型推断)
- [x] 实现 DataManager (上传→解析→建表→导入全流程)
- [x] 实现多租户 schema 创建/管理逻辑
- [x] 实现 IsolatedSQLExecutor (search_path 隔离 + 超时保护)
- [x] 完善 DataSource / DataTable ORM 模型 (从空壳到完整实现)
- [x] 实现 Pydantic schemas
- [x] 实现数据管理 API (10 个端点)
- [x] 实现 MinIO 文件备份
- [x] 实现分页查询 (page + page_size)
- [ ] 编写单元测试 (后续 Phase 补充)
- [x] 验证通过

---

## 验证标准

- [x] `POST /api/v1/data/upload` 上传 Excel 文件 → 解析成功 (2 sheets → 2 tables) → 状态 "ready"
- [x] `POST /api/v1/data/upload` 上传 CSV 文件 → 成功，类型推断正确 (integer/varchar/float/date/boolean)
- [x] `POST /api/v1/data/upload` 上传 SQLite 文件 → 多表解析成功 (2 tables)
- [x] PG 租户 schema 下表已创建 (`\dt ud_tenant_fcd60b81.*` → 多张表)
- [x] `GET /api/v1/data/sources` 列出数据源正确 (分页, total)
- [x] `GET /api/v1/data/sources/{id}` 返回详情含关联表列表
- [x] `GET /api/v1/data/tables/{id}/data` 分页查询数据正确 (page_size=3 → 3 rows, has_more=true)
- [x] `PUT /api/v1/data/tables/{id}` 更新 display_name/description 成功
- [x] `DELETE /api/v1/data/sources/{id}` 级联删除 PG 表 + ORM 记录
- [x] `DELETE /api/v1/data/tables/{id}` 删除单表 + 自动更新 source.table_count
- [x] `GET /api/v1/data/tables/{id}/schema` 返回列定义供 Agent 使用
- [x] MinIO 中备份文件存在 (mc ls 验证 3 个文件)
- [x] 租户 schema 隔离 — `ud_tenant_{tid8}` 动态创建成功
- [x] IsolatedSQLExecutor 支持 search_path + statement_timeout + lock_timeout
- [x] 所有容器运行中, backend healthy

---

## 新增/修改文件列表

### 新增/完善

| 文件 | 说明 |
|------|------|
| `app/core/data/parsers.py` | 完整实现 Excel/CSV/SQLite 解析器 + 类型推断 + 值转换 |
| `app/core/data/manager.py` | 完整实现数据管理器 (上传/解析/建表/导入/CRUD/分页/MinIO) |
| `app/core/data/isolated_executor.py` | 完整实现隔离 SQL 执行器 (read/write + search_path + timeout) |
| `app/core/data/__init__.py` | 模块导出 FileParser, DataManager, IsolatedSQLExecutor |
| `app/models/data_source.py` | 完善 DataSource ORM: +file_type, +minio_path, +tables relationship |
| `app/models/data_table.py` | 完善 DataTable ORM: +tenant_id, +display_name, +is_writable, +visibility, +updated_at, +data_source relationship |
| `app/schemas/data.py` | 完善 Pydantic schemas: 7 个 Response/Request model + ColumnSchema |
| `app/api/v1/data.py` | 完整实现 10 个 API 端点 (JWT 认证 + 权限校验) |

### 修改

| 文件 | 变更 |
|------|------|
| `app/main.py` | 初始化 DataManager/IsolatedSQLExecutor, ALTER TABLE 迁移新字段 |

---

## 实现备注

1. **asyncpg 严格类型**: CSV 解析的所有值为字符串, 需要 `coerce_value()` 转换为 Python int/float/bool/date 对象才能通过 asyncpg 类型校验
2. **表名安全**: 所有 PG 标识符使用 `"双引号"` 包裹 (`_pg_identifier()`), 防止 SQL 注入
3. **批量插入**: 每 500 行一批, 避免单次 INSERT 过大
4. **MinIO 异步**: `asyncio.create_task` 非阻塞备份, 失败不影响上传结果
5. **ORM lazy load**: DataSourceDetailResponse 手动构造, 避免 greenlet 错误

---

## 代码审查修复 (2026-02-24)

| # | 严重度 | 文件 | 问题 | 修复 |
|---|--------|------|------|------|
| 1 | 🔴严重 | `parsers.py` | `sanitize_table_name` 只允许 `[a-z0-9_]`，中文文件名全部变为 `unnamed` | 正则增加 `\u4e00-\u9fff` 中文范围，与 `sanitize_column_name` 一致 |
| 2 | 🟡性能 | `manager.py` | `_insert_data` 逐行 `conn.execute()` 500 次 DB 往返 | 改为 `conn.execute(sa_text(insert_sql), params_list)` 批量提交 |
| 3 | 🟠边界 | `manager.py` | `upload_and_parse` 的 `finally` 块引用 `tmp_path`，若 `NamedTemporaryFile` 异常则 `UnboundLocalError` | 在 `try` 前声明 `tmp_path: str | None = None`，`finally` 加 `if tmp_path` 判断 |
