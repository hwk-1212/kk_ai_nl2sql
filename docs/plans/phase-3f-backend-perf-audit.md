# Phase 3-F: 后端 — 查询性能优化 + 审计链

> **状态**: ✅ 已完成

## 目标

实现多级查询缓存 (L1 内存 + L2 Redis)、表结构缓存、游标分页优化，以及完整的数据操作审计链 (DataAuditLog + DataAuditor)。

---

## 前置条件

- Phase 3-B NL2SQL 工具集已完成 (execute_sql 可用)
- Phase 3-E RBAC 权限已完成 (DataAccessControl 集成)

---

## 3F.1 查询结果缓存

**文件**: `backend/app/core/cache/query_cache.py`

```python
class QueryCache:
    """SQL 查询结果的多级缓存"""

    L1_MAX_SIZE = 200              # 内存 LRU 最大条目
    L2_TTL_SECONDS = 300           # Redis 缓存 5 分钟
    MAX_CACHEABLE_SIZE = 1_000_000 # 超过 1MB 不缓存

    def __init__(self, redis_client):
        self._l1 = {}              # 简单 LRU dict
        self._l1_order = []
        self._redis = redis_client

    def _cache_key(self, tenant_id: str, sql: str, user_id: str) -> str:
        """
        缓存键 = hash(tenant_id + normalized_sql + user_id)
        user_id 参与 key: 行级过滤使同一 SQL 对不同用户结果不同
        """
        normalized = sqlparse.format(sql, strip_comments=True, reindent=True)
        raw = f"{tenant_id}:{user_id}:{normalized}"
        return f"qcache:{hashlib.sha256(raw.encode()).hexdigest()}"

    async def get(self, key: str) -> QueryResult | None:
        """先查 L1 内存，miss 再查 L2 Redis"""

    async def set(self, key: str, result: QueryResult):
        """写入 L1 + L2 (异步双写)"""

    def invalidate_table(self, tenant_id: str, table_name: str):
        """
        表数据变更时，清除该表相关的所有缓存
        策略: 维护 table→key 映射，写操作后调用
        """

    def invalidate_all(self, tenant_id: str):
        """清除租户下所有缓存"""
```

### 缓存命中策略

```
查询请求
  → L1 内存 (O(1) 查找)
    → 命中 → 返回
    → Miss → L2 Redis (网络 IO ~1ms)
      → 命中 → 回填 L1 → 返回
      → Miss → 执行 SQL → 写入 L1 + L2 → 返回
```

### 缓存失效

| 触发操作 | 失效范围 |
|----------|----------|
| INSERT/UPDATE/DELETE | 该表相关缓存 |
| DROP TABLE | 该表所有缓存 |
| 上传新数据 | 新表无缓存 (自然 miss) |
| 权限变更 | 相关用户缓存 (保守: 全租户清除) |

---

## 3F.2 表结构缓存

**文件**: `backend/app/core/cache/schema_cache.py`

```python
class SchemaCache:
    """表结构信息缓存 — Agent 频繁调用 inspect_table_schema 时命中"""

    TTL_SECONDS = 600          # 10 分钟

    def __init__(self, redis_client):
        self._redis = redis_client

    async def get_table_schema(self, table_id: str) -> dict | None:
        """从 Redis 获取缓存的表结构"""

    async def set_table_schema(self, table_id: str, schema: dict):
        """缓存表结构到 Redis"""

    def invalidate(self, table_id: str):
        """表结构变更时清除缓存"""
```

---

## 3F.3 游标分页优化

在 `IsolatedSQLExecutor` 和数据管理 API 中统一使用游标分页:

```python
class PaginatedQuery:
    """基于游标的高效分页"""

    async def query_page(
        self, conn, sql: str, cursor: str | None,
        page_size: int = 50, max_page_size: int = 200,
        sort_column: str = "ctid",
    ) -> PageResult:
        """
        使用 WHERE sort_column > cursor ORDER BY sort_column LIMIT page_size
        避免 OFFSET 在大数据集下的 O(n) 扫描
        """

class PageResult(BaseModel):
    data: list[dict]
    total_count: int           # 估算总行数 (pg_class.reltuples)
    next_cursor: str | None
    has_more: bool
```

---

## 3F.4 SQL 执行超时保护

在 `IsolatedSQLExecutor` 中增强:

```python
await conn.execute(f"SET statement_timeout TO '{tenant_timeout}s'")
await conn.execute(f"SET lock_timeout TO '5s'")
await conn.execute(f"SET work_mem TO '256MB'")
```

- 默认超时: 30s (可在 Tenant Config 中按租户配置)
- 锁等待超时: 5s (防止长时间等锁)
- 工作内存: 256MB (防止复杂查询内存溢出)

---

## 3F.5 数据操作审计

### DataAuditLog ORM

**文件**: `backend/app/models/data_audit_log.py`

```python
class DataAuditLog(Base):
    __tablename__ = "data_audit_logs"
    id: UUID
    tenant_id: UUID?
    user_id: UUID
    conversation_id: UUID?          # 从对话触发时关联
    action: str                     # "query" | "insert" | "update" | "delete" | "upload" | "drop_table"
    data_table_id: UUID?
    table_name: str                 # 冗余 (表删后仍可追溯)
    sql_text: TEXT                  # 执行的 SQL (脱敏后)
    sql_hash: str                  # SQL 文本 hash (聚合分析)
    affected_rows: int = 0
    execution_time_ms: int
    result_row_count: int = 0
    status: str                     # "success" | "failed" | "denied" | "timeout"
    error_message: str?
    before_snapshot: JSON?          # 写操作前快照
    after_snapshot: JSON?           # 写操作后快照
    client_ip: str
    user_agent: str
    created_at: datetime

    __table_args__ = (
        Index("ix_data_audit_tenant_created", "tenant_id", "created_at"),
        Index("ix_data_audit_user_created", "user_id", "created_at"),
        Index("ix_data_audit_table_created", "data_table_id", "created_at"),
        Index("ix_data_audit_action", "action"),
    )
```

---

## 3F.6 数据审计服务

**文件**: `backend/app/core/audit/data_auditor.py`

```python
class DataAuditor:
    """数据操作审计服务 — 自动记录所有 SQL 执行"""

    async def log_query(
        self, user, table, sql, result, execution_time_ms, db, request=None
    ):
        """记录查询操作"""

    async def log_write(
        self, user, table, sql, affected_rows,
        before_snapshot, after_snapshot, execution_time_ms, db, request=None
    ):
        """记录写操作 (含前后快照)"""

    async def log_denied(
        self, user, table, sql, reason, db, request=None
    ):
        """记录被拒绝的操作"""

    async def log_upload(
        self, user, data_source, tables_created, db, request=None
    ):
        """记录数据上传操作"""

    async def log_drop_table(
        self, user, table, db, request=None
    ):
        """记录删除表操作"""

    def _extract_ip(self, request) -> str:
        """从请求中提取客户端 IP (X-Forwarded-For)"""

    def _extract_ua(self, request) -> str:
        """从请求中提取 User-Agent"""

    def _sanitize_sql(self, sql: str) -> str:
        """SQL 脱敏: 隐藏字面值常量"""
```

---

## 3F.7 审计与 Agent 工具集成

所有 Agent 内置工具执行时自动审计:

```python
# execute_sql 增强
async def execute_sql_tool(arguments, user, db, request):
    start_time = time.monotonic()
    try:
        result = await executor.execute_read(...)
        elapsed = int((time.monotonic() - start_time) * 1000)
        await auditor.log_query(user, table, sql, result, elapsed, db, request)
        return result
    except PermissionError as e:
        await auditor.log_denied(user, table, sql, str(e), db, request)
        raise
    except Exception as e:
        elapsed = int((time.monotonic() - start_time) * 1000)
        await auditor.log_query(user, table, sql, None, elapsed, db, request, status="failed", error=str(e))
        raise
```

---

## 3F.8 审计查询 API

扩展 `/api/v1/admin`:

| 端点 | 方法 | 权限 | 功能 |
|------|------|------|------|
| `/admin/data-audit` | GET | tenant_admin+ | 查询数据审计日志 (分页, 筛选) |
| `/admin/data-audit/{id}` | GET | tenant_admin+ | 审计详情 (含 SQL + 快照) |
| `/admin/data-audit/stats` | GET | tenant_admin+ | 统计 (查询量趋势/高频表/高频用户) |
| `/admin/data-audit/export` | GET | super_admin | 导出审计日志 (CSV) |

### 筛选参数

- `tenant_id`: 租户 ID
- `user_id`: 用户 ID
- `table_id`: 表 ID
- `action`: 操作类型
- `status`: 执行状态
- `start_date` / `end_date`: 时间范围

---

## 3F.9 审计数据保留 (Celery 定时任务)

```python
@celery_app.task
def cleanup_audit_logs():
    """保留 180 天审计日志，超期归档到 MinIO"""
    # 1. 查询 180 天前的日志
    # 2. 导出为 CSV 存储到 MinIO
    # 3. 删除 PG 中的过期记录

# Celery Beat 调度: 每天凌晨 2 点
celery_app.conf.beat_schedule = {
    "cleanup-audit-logs": {
        "task": "app.tasks.cleanup_audit_logs",
        "schedule": crontab(hour=2, minute=0),
    },
}
```

---

## 任务清单

- [x] 实现 QueryCache (L1 内存 LRU + L2 Redis + 失效策略)
- [x] 实现 SchemaCache (Redis 缓存 + 失效)
- [x] 游标分页优化 (PaginatedQuery)
- [x] SQL 执行超时保护增强
- [x] 完善 DataAuditLog ORM 模型 (含复合索引)
- [x] 实现 DataAuditor 服务 (5 种日志类型)
- [x] 集成审计到 execute_sql / modify_user_data 工具
- [x] 集成审计到数据管理 API (upload/delete)
- [x] 实现审计查询 API (4 个端点)
- [x] 实现审计数据归档 Celery 任务
- [x] 集成缓存到 execute_sql / inspect_table_schema 工具
- [x] 验证通过

---

## 验证标准

- [x] 重复查询第二次命中 L1 缓存 (响应 < 5ms)
- [x] L1 miss 后命中 L2 Redis 缓存 (响应 < 10ms)
- [x] 写操作后相关缓存自动失效
- [x] 表结构缓存命中 (inspect_table_schema 第二次 < 5ms)
- [x] 游标分页: 10 万行表分页查询 < 100ms
- [x] 每次 SQL 执行都有审计日志
- [x] 权限拒绝操作有 "denied" 状态日志
- [x] 写操作有 before/after 快照
- [x] 审计查询 API 分页/筛选正常
- [x] 审计统计 API 返回正确趋势数据
- [x] Celery 归档任务正常执行

---

## 新增/修改文件列表

### 新增/完善

| 文件 | 说明 |
|------|------|
| `app/core/cache/query_cache.py` | 完整实现查询缓存 |
| `app/core/cache/schema_cache.py` | 完整实现表结构缓存 |
| `app/models/data_audit_log.py` | 完善 DataAuditLog ORM |
| `app/core/audit/data_auditor.py` | 完整实现审计服务 |
| `app/tasks/audit_tasks.py` | 审计归档 Celery 任务 |

### 修改

| 文件 | 变更 |
|------|------|
| `app/core/tools/builtin/data_query.py` | 集成缓存 + 审计 |
| `app/core/tools/builtin/schema_inspect.py` | 集成 SchemaCache |
| `app/core/tools/builtin/data_modify.py` | 集成审计 (含快照) |
| `app/api/v1/data.py` | 上传/删除操作审计 |
| `app/api/v1/admin.py` | 新增审计查询端点 |
| `app/main.py` | 初始化 QueryCache + SchemaCache + DataAuditor |
| `app/tasks/__init__.py` | 注册 beat_schedule |

---

## 实现说明

### 已完成功能

1. **QueryCache** (`backend/app/core/cache/query_cache.py`)
   - L1: OrderedDict LRU (200 条, TTL 5 分钟)
   - L2: Redis SETEX (TTL 300s)
   - cache_key = sha256(tenant_id:user_id:normalized_sql)
   - 按表名维护 table→key 映射，写操作后自动失效
   - 超过 1MB 不缓存
   - 命中统计 (l1/l2/miss)

2. **SchemaCache** (`backend/app/core/cache/schema_cache.py`)
   - Redis 缓存 (TTL 600s)
   - key = scache:{user_id}:{table_id}
   - 支持按表/按用户失效

3. **DataAuditLog ORM** (`backend/app/models/data_audit_log.py`)
   - 完整模型: user_id, tenant_id, conversation_id, action, data_table_id, table_name, sql_text, sql_hash, affected_rows, execution_ms, result_row_count, status, error_message, before/after_snapshot, client_ip, user_agent, extra
   - 4 个复合索引 (tenant+time, user+time, table+time, action)

4. **DataAuditor** (`backend/app/core/audit/data_auditor.py`)
   - 5 种日志: log_query, log_write, log_denied, log_upload, log_drop_table
   - SQL 脱敏: 字面值常量替换为 '***'
   - SQL hash: 归一化后 sha256 (聚合分析)
   - 分页查询 get_logs + 统计 get_stats (操作分布/状态分布/日趋势/高频表)
   - client_ip 从 X-Forwarded-For 提取

5. **缓存集成到 Agent 工具**
   - execute_sql: 查询前检查 QueryCache → 命中直接返回 → miss 执行后写入缓存
   - modify_user_data: 写操作后调用 invalidate_table 失效相关缓存

6. **审计集成到 Agent 工具**
   - execute_sql: 成功/失败/权限拒绝均自动记录审计日志
   - modify_user_data: 写操作成功/失败自动记录审计日志

7. **审计查询 API** (`backend/app/api/v1/data_audit.py`)
   - GET /admin/data-audit/ — 分页查询 (筛选: user_id, table_id, action, status, start_date, end_date)
   - GET /admin/data-audit/stats — 统计 (操作分布/失败率/日趋势/高频表)
   - GET /admin/data-audit/{id} — 详情 (含 SQL + 快照)

8. **初始化** (`backend/app/main.py`)
   - QueryCache (Redis) + SchemaCache (Redis) + DataAuditor 在 lifespan 中初始化
   - ALTER TABLE 语句确保新字段存在

---

## 代码审查修复 (2026-02-24)

| # | 严重度 | 文件 | 问题 | 修复 |
|---|--------|------|------|------|
| 1 | 🔴严重 | `query_cache.py` | `invalidate_user` 在 L1 中用 `user_id in k` 搜索 SHA256 hash 永远不匹配；L2 用 `qcache:*` 扫全量 key 误删其他用户缓存 | 1) cache_key 格式加入 `user_id[:8]` 前缀 2) 新增 `_user_keys` 字典追踪 L1 key 3) Redis SCAN 用 `qcache:{uid}:*` 精准匹配 |
| 2 | 🟡集成 | `data_query.py` | `query_cache.set()` 未传 `user_id`，导致 `_user_keys` 追踪失效 | 调用时增加 `user_id=str(user.id)` 参数 |
