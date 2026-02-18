# Phase 3-B: 后端 — NL2SQL Agent 工具集 + SQL 安全

## 目标

实现 NL2SQL Agent 核心工具集 (inspect_tables, inspect_table_schema, execute_sql, modify_user_data, recommend_chart)，以及 SQL 安全检查器 (SQLSecurityChecker)。工具注册到现有 `ToolRegistry`，通过 Agent function calling 驱动。

---

## 前置条件

- Phase 3-A 数据管理模块已完成 (DataTable 模型 + IsolatedSQLExecutor 可用)
- 现有 ToolRegistry + Agent 工具调用流程可用 (Phase 5 老)

---

## 3B.1 SQL 安全检查器

**文件**: `backend/app/core/security/sql_checker.py`

```python
class SQLSecurityChecker:
    """SQL 安全检查器 — 在执行前拦截危险操作"""

    BLOCKED_PATTERNS = [
        r"DROP\s+DATABASE",
        r"ALTER\s+SYSTEM",
        r"CREATE\s+ROLE",
        r"GRANT\s+",
        r"pg_read_file",
        r"pg_write_file",
        r"COPY\s+.*\s+TO\s+PROGRAM",
        r";\s*(DROP|DELETE|TRUNCATE|ALTER)",  # SQL 注入
    ]

    WRITE_ONLY_PATTERNS = [
        r"INSERT\s+INTO",
        r"UPDATE\s+",
        r"DELETE\s+FROM",
        r"TRUNCATE\s+",
    ]

    def check(self, sql: str, allow_write: bool = False) -> SecurityResult:
        """返回 (is_safe, blocked_reason)"""

    def enforce_limit(self, sql: str, max_rows: int = 1000) -> str:
        """如果 SQL 没有 LIMIT，自动追加"""

    def extract_table_names(self, sql: str) -> list[str]:
        """从 SQL 中提取引用的表名 (用于权限校验)"""
```

---

## 3B.2 Agent 工具: inspect_tables

**文件**: `backend/app/core/tools/builtin/schema_inspect.py`

### 功能

列出用户可用的所有数据表及摘要。

```python
TOOL_DEFINITION = {
    "name": "inspect_tables",
    "description": "列出用户上传的所有数据表。可选按关键词过滤。",
    "parameters": {
        "type": "object",
        "properties": {
            "keyword": {
                "type": "string",
                "description": "可选的过滤关键词，按表名或描述搜索"
            }
        }
    }
}

async def execute(arguments: dict, user: User, db: AsyncSession) -> str:
    """查询 DataTable 列表，返回表名+描述+行数摘要"""
```

### inspect_table_schema

同文件内第二个工具:

```python
TOOL_DEFINITION_SCHEMA = {
    "name": "inspect_table_schema",
    "description": "获取指定数据表的完整结构信息，包含列名、类型、注释和示例数据。",
    "parameters": {
        "type": "object",
        "properties": {
            "table_name": {
                "type": "string",
                "description": "表名 (pg_table_name 或 display_name)"
            }
        },
        "required": ["table_name"]
    }
}

async def execute_schema(arguments: dict, user: User, db: AsyncSession) -> str:
    """返回列名、类型、注释、前 3 行示例数据"""
```

---

## 3B.3 Agent 工具: execute_sql

**文件**: `backend/app/core/tools/builtin/data_query.py`

### 功能

执行只读 SQL 查询，返回结果集。

```python
TOOL_DEFINITION = {
    "name": "execute_sql",
    "description": "在用户数据表上执行只读 SQL 查询。自动限制返回行数。",
    "parameters": {
        "type": "object",
        "properties": {
            "sql": {
                "type": "string",
                "description": "要执行的 SQL SELECT 查询"
            }
        },
        "required": ["sql"]
    }
}
```

### 执行流程

```
1. SQLSecurityChecker.check(sql, allow_write=False) — 安全检查
2. SQLSecurityChecker.extract_table_names(sql) — 提取表名
3. 验证用户对每个表的访问权限
4. SQLSecurityChecker.enforce_limit(sql, 1000) — 强制 LIMIT
5. IsolatedSQLExecutor.execute_read(tenant_schema, sql, user) — 执行
6. 格式化结果为 JSON 字符串返回
```

---

## 3B.4 Agent 工具: modify_user_data

**文件**: `backend/app/core/tools/builtin/data_modify.py`

### 功能

对用户自建表执行写操作 (INSERT/UPDATE/DELETE)。

```python
TOOL_DEFINITION = {
    "name": "modify_user_data",
    "description": "对用户数据表执行写操作(INSERT/UPDATE/DELETE)。仅限用户自己上传的表。单次最多影响1000行。",
    "parameters": {
        "type": "object",
        "properties": {
            "sql": {
                "type": "string",
                "description": "要执行的写 SQL 语句"
            },
            "table_name": {
                "type": "string",
                "description": "目标表名"
            }
        },
        "required": ["sql", "table_name"]
    }
}
```

### 安全限制

- 仅允许 `user_data` (或租户 schema) 下的表
- 验证 `table.is_writable == True`
- 验证 `table.user_id == user.id`
- 单次影响行数限制 1000 行
- 事务 + savepoint 保护

---

## 3B.5 Agent 工具: recommend_chart

**文件**: `backend/app/core/tools/builtin/chart_recommend.py`

### 功能

根据查询结果的列类型和数据特征，推荐合适的可视化图表类型。

```python
TOOL_DEFINITION = {
    "name": "recommend_chart",
    "description": "根据SQL查询结果推荐合适的可视化图表类型和配置。",
    "parameters": {
        "type": "object",
        "properties": {
            "columns": {
                "type": "array",
                "items": {"type": "object"},
                "description": "列信息列表 [{name, type}]"
            },
            "sample_data": {
                "type": "array",
                "items": {"type": "object"},
                "description": "样例数据 (前 5 行)"
            },
            "query_intent": {
                "type": "string",
                "description": "用户查询意图描述"
            }
        },
        "required": ["columns", "sample_data"]
    }
}
```

### 推荐规则

| 数据特征 | 推荐图表 |
|----------|----------|
| 1 时间列 + 1 数值列 | line (折线图) |
| 1 分类列 + 1 数值列 | bar (柱状图) |
| 1 分类列 + 1 占比列 | pie (饼图) |
| 1 时间列 + N 数值列 | area (面积图) |
| 2 数值列 | scatter (散点图) |
| 其他 | table (数据表格) |

返回 ChartConfig JSON (与前端 ChartRenderer 兼容)。

---

## 3B.6 工具注册

**修改文件**: `backend/app/main.py`

```python
from app.core.tools.builtin.schema_inspect import register as register_schema_tools
from app.core.tools.builtin.data_query import register as register_query_tools
from app.core.tools.builtin.chart_recommend import register as register_chart_tools
from app.core.tools.builtin.data_modify import register as register_modify_tools

register_schema_tools(tool_registry)
register_query_tools(tool_registry)
register_chart_tools(tool_registry)
register_modify_tools(tool_registry)
```

---

## 3B.7 System Prompt 增强

**修改文件**: `backend/app/api/v1/chat.py`

```python
DEFAULT_SYSTEM_PROMPT = """你是 KK 智能数据分析助手。你可以:
1. 查询用户上传的数据表 (使用 inspect_tables / inspect_table_schema)
2. 执行 SQL 查询并返回结果 (使用 execute_sql)
3. 推荐合适的可视化图表 (使用 recommend_chart)
4. 对用户自建表进行数据修改 (使用 modify_user_data)

工作流程:
- 先理解用户意图
- 检查可用的表和结构
- 生成并执行 SQL
- 返回结果并推荐可视化
"""
```

---

## 任务清单

- [ ] 实现 SQLSecurityChecker (安全检查 + LIMIT 强制 + 表名提取)
- [ ] 实现 inspect_tables 工具
- [ ] 实现 inspect_table_schema 工具
- [ ] 实现 execute_sql 工具 (含安全检查 + 隔离执行)
- [ ] 实现 modify_user_data 工具 (含所有权验证 + 行数限制)
- [ ] 实现 recommend_chart 工具 (规则推荐 + ChartConfig 输出)
- [ ] 工具注册到 ToolRegistry
- [ ] 更新 System Prompt
- [ ] 端到端测试: 对话 → 工具调用 → SQL 执行 → 结果返回
- [ ] 验证通过

---

## 验证标准

- [ ] 对话 "我有哪些数据表?" → Agent 调用 inspect_tables → 返回表列表
- [ ] 对话 "查看销售表的结构" → Agent 调用 inspect_table_schema → 返回列信息 + 示例数据
- [ ] 对话 "查询销售额前 10" → Agent 调用 execute_sql → 返回查询结果
- [ ] 对话 "帮我生成图表" → Agent 调用 recommend_chart → 返回 ChartConfig
- [ ] 对话 "在表里新增一行" → Agent 调用 modify_user_data → 成功执行
- [ ] 危险 SQL 被拦截 (DROP DATABASE 等)
- [ ] 无 LIMIT 的 SQL 自动追加 LIMIT 1000
- [ ] 跨租户查询被阻止
- [ ] 非自有表写操作被拒绝

---

## 新增/修改文件列表

### 新增/完善

| 文件 | 说明 |
|------|------|
| `app/core/security/sql_checker.py` | 完整实现 SQL 安全检查器 |
| `app/core/tools/builtin/schema_inspect.py` | inspect_tables + inspect_table_schema |
| `app/core/tools/builtin/data_query.py` | execute_sql |
| `app/core/tools/builtin/data_modify.py` | modify_user_data |
| `app/core/tools/builtin/chart_recommend.py` | recommend_chart |

### 修改

| 文件 | 变更 |
|------|------|
| `app/main.py` | 注册 5 个新内置工具 |
| `app/api/v1/chat.py` | 更新 System Prompt |
