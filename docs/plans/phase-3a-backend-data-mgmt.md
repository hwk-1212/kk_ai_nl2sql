# Phase 3-A: 后端 — 数据管理模块 + 多租户隔离

## 目标

实现数据管理核心后端：文件上传 → 解析入库 (Excel/CSV/SQLite) → 表级 CRUD API，以及多租户 schema 隔离和 `IsolatedSQLExecutor`。

---

## 前置条件

- Phase 0 Docker 更新完成 (user_data schema 存在)
- Phase 1 骨架搭建完成 (ORM 模型空壳 + API stub 就绪)

---

## 3A.1 文件解析器 (Parsers)

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

- 自动推断列类型: varchar / integer / float / boolean / date / timestamp
- 基于数据采样前 100 行进行推断
- 空列默认 varchar

---

## 3A.2 数据管理器 (DataManager)

**文件**: `backend/app/core/data/manager.py`

### 核心功能

```python
class DataManager:
    async def upload_and_parse(
        self, file: UploadFile, user: User, db: AsyncSession
    ) -> DataSource:
        """
        1. 保存文件到 MinIO (备份)
        2. 保存临时文件
        3. 调用 FileParser 解析
        4. 创建 DataSource 记录
        5. 对每个 ParsedTable:
           a. 生成 pg_table_name: ud_{tenant_id_short8}_{user_id_short8}_{name}
           b. 在 user_data schema 下 CREATE TABLE
           c. 批量 INSERT 数据
           d. 创建 DataTable 记录
        6. 更新 DataSource 状态为 ready
        """

    async def create_pg_table(
        self, schema: str, table_name: str, columns: list[ColumnInfo]
    ):
        """在指定 schema 下创建 PG 表"""

    async def insert_data(
        self, schema: str, table_name: str, columns: list[ColumnInfo], data: list[dict]
    ):
        """批量插入数据 (使用 COPY 或批量 INSERT)"""

    async def drop_table(self, schema: str, table_name: str):
        """删除用户数据表"""

    async def get_table_data(
        self, table: DataTable, cursor: str | None, page_size: int
    ) -> PageResult:
        """游标分页查询表数据"""
```

### 表命名规则

- 个人用户: `ud_personal_{user_id_short8}`schema + `ud_{uid8}_{table_name}` 表名
- 租户用户: `ud_tenant_{tenant_id_short8}` schema + `ud_{tid8}_{uid8}_{table_name}` 表名
- `{xxx_short8}` = UUID 前 8 位

---

## 3A.3 多租户 Schema 隔离

### Schema 策略

```sql
-- 租户用户: 每个租户独立 schema
CREATE SCHEMA IF NOT EXISTS ud_tenant_{tenant_id_short8};

-- 个人用户 (无租户): 使用统一 user_data schema
-- 或: ud_personal_{user_id_short8}
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
    pg_table_name: str              # ud_{tid8}_{uid8}_{name}
    display_name: str
    description: str?
    column_schema: JSON             # [{name, type, nullable, comment}]
    row_count: int
    is_writable: bool = True
    visibility: str = "private"     # "private" | "tenant" | "public"
    created_at / updated_at
```

---

## 3A.4 租户隔离 SQL 执行器

**文件**: `backend/app/core/data/isolated_executor.py`

```python
class IsolatedSQLExecutor:
    """租户隔离的 SQL 执行器 — 强制 search_path"""

    async def execute_read(
        self, tenant_schema: str, sql: str, user: User,
        timeout: int = 30
    ) -> QueryResult:
        """
        1. SET search_path TO {tenant_schema}, public
        2. SET statement_timeout TO '{timeout}s'
        3. SET lock_timeout TO '5s'
        4. 执行 SQL
        5. 返回结果 (限制 1000 行)
        """

    async def execute_write(
        self, tenant_schema: str, sql: str, user: User, table: DataTable
    ) -> WriteResult:
        """
        1. 验证 table.user_id == user.id (或 table.is_writable)
        2. 验证 table.pg_schema == tenant_schema
        3. 开启事务 + savepoint
        4. 记录变更前快照 (审计用)
        5. 执行写 SQL
        6. 返回影响行数
        """
```

---

## 3A.5 数据管理 API

**文件**: `backend/app/api/v1/data.py`

| 端点 | 方法 | 功能 | 说明 |
|------|------|------|------|
| `/upload` | POST | 上传文件 | multipart, 异步解析入库 |
| `/sources` | GET | 列出数据源 | 当前用户，支持分页 |
| `/sources/{id}` | GET | 数据源详情 | 含所属表列表 |
| `/sources/{id}` | DELETE | 删除数据源 | 级联删除所有表 + PG 表 |
| `/tables` | GET | 列出所有表 | 当前用户 |
| `/tables/{id}` | GET | 表详情 | 含 schema 信息 |
| `/tables/{id}/data` | GET | 分页查询数据 | 游标分页 |
| `/tables/{id}` | PUT | 更新表信息 | 修改 display_name/description |
| `/tables/{id}` | DELETE | 删除单表 | 删除 PG 表 + 记录 |
| `/tables/{id}/schema` | GET | 获取表结构 | 供 Agent 工具使用 |

### Pydantic Schemas

**文件**: `backend/app/schemas/data.py`

- `DataSourceResponse`, `DataSourceListResponse`
- `DataTableResponse`, `DataTableListResponse`
- `TableDataResponse` (含 data, total_count, next_cursor, has_more)
- `UpdateTableRequest` (display_name, description)

---

## 3A.6 MinIO 文件备份

上传文件同时存储到 MinIO:

```
kk-gpt-files/
└── user-data/
    └── {user_id}/
        └── {data_source_id}/
            └── {original_filename}
```

---

## 任务清单

- [ ] 实现 FileParser (Excel/CSV/SQLite 解析 + 类型推断)
- [ ] 实现 DataManager (上传→解析→建表→导入全流程)
- [ ] 实现多租户 schema 创建/管理逻辑
- [ ] 实现 IsolatedSQLExecutor (search_path 隔离 + 超时保护)
- [ ] 完善 DataSource / DataTable ORM 模型 (从空壳到完整实现)
- [ ] 实现 Pydantic schemas
- [ ] 实现数据管理 API (10 个端点)
- [ ] 实现 MinIO 文件备份
- [ ] 实现游标分页查询
- [ ] 编写单元测试
- [ ] 验证通过

---

## 验证标准

- [ ] `POST /api/v1/data/upload` 上传 Excel 文件 → 解析成功 → 数据源状态 "ready"
- [ ] `POST /api/v1/data/upload` 上传 CSV 文件 → 成功
- [ ] `POST /api/v1/data/upload` 上传 SQLite 文件 → 多表解析成功
- [ ] PG `user_data` schema 下表已创建 (`\dt user_data.*`)
- [ ] `GET /api/v1/data/sources` 列出数据源正确
- [ ] `GET /api/v1/data/tables/{id}/data` 分页查询数据正确
- [ ] `DELETE /api/v1/data/sources/{id}` 级联删除 PG 表 + 记录
- [ ] MinIO 中备份文件存在
- [ ] 不同租户 schema 隔离 (A 租户无法查询 B 租户数据)
- [ ] SQL 执行超时保护生效 (30s)
- [ ] 12 容器全部 healthy

---

## 新增/修改文件列表

### 新增/完善

| 文件 | 说明 |
|------|------|
| `app/core/data/parsers.py` | 完整实现 Excel/CSV/SQLite 解析器 |
| `app/core/data/manager.py` | 完整实现数据管理器 |
| `app/core/data/isolated_executor.py` | 完整实现隔离 SQL 执行器 |
| `app/models/data_source.py` | 完善 DataSource ORM |
| `app/models/data_table.py` | 完善 DataTable ORM |
| `app/schemas/data.py` | 完善 Pydantic schemas |
| `app/api/v1/data.py` | 完整实现 10 个 API 端点 |

### 修改

| 文件 | 变更 |
|------|------|
| `app/main.py` | 初始化 DataManager, 注册路由 |
| `app/config.py` | 新增数据管理相关配置 |
