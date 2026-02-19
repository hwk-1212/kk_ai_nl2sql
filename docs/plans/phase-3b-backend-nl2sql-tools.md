# Phase 3-B: 后端 — NL2SQL Agent 工具集 + SQL 安全

> **状态**: ✅ 已完成
> **完成时间**: 2026-02-18

## 目标

实现 NL2SQL Agent 核心工具集 (inspect_tables, inspect_table_schema, execute_sql, modify_user_data, recommend_chart)，以及 SQL 安全检查器 (SQLSecurityChecker)。工具注册到现有 `ToolRegistry`，通过 Agent function calling 驱动。

---

## 前置条件

- ✅ Phase 3-A 数据管理模块已完成 (DataTable 模型 + IsolatedSQLExecutor 可用)
- ✅ 现有 ToolRegistry + Agent 工具调用流程可用

---

## 3B.1 SQL 安全检查器 ✅

**文件**: `backend/app/core/security/sql_checker.py`

### 实现细节

- `check(sql, allow_write)` — 正则匹配 20+ 危险模式 (DROP DATABASE, ALTER SYSTEM, GRANT, pg_read_file, SQL 注入等)，区分只读/写模式
- `enforce_limit(sql, max_rows=1000)` — SELECT/WITH 查询无 LIMIT 时自动追加
- `extract_table_names(sql)` — 正则提取 FROM/JOIN/INTO/UPDATE 引用的表名 (含 schema.table 格式)
- `SecurityResult` dataclass 返回 `(is_safe, blocked_reason)`
- 使用 `sqlparse` 做语句类型校验 (SELECT/INSERT/UPDATE/DELETE)
- 多语句 (含分号) 直接拦截

---

## 3B.2 Agent 工具: inspect_tables + inspect_table_schema ✅

**文件**: `backend/app/core/tools/builtin/schema_inspect.py`

### inspect_tables
- 查询用户所有 DataTable，返回表名 + pg_table_name + 列数 + 行数 + 描述
- 支持可选 `keyword` 参数按名称/描述过滤
- 无表时返回友好提示

### inspect_table_schema
- 按 pg_table_name 或 display_name 模糊匹配目标表
- 返回完整列结构 (列名/类型/可空/备注) + 前 3 行示例数据
- 通过 DataManager.get_table_data 获取实际数据

---

## 3B.3 Agent 工具: execute_sql ✅

**文件**: `backend/app/core/tools/builtin/data_query.py`

### 执行流程

```
1. SQLSecurityChecker.check(sql, allow_write=False) — 安全检查
2. SQLSecurityChecker.enforce_limit(sql) — 强制 LIMIT 1000
3. SQLSecurityChecker.extract_table_names(sql) — 提取引用的表名
4. 验证每个表属于当前用户 (user.id 匹配)
5. IsolatedSQLExecutor.execute_read(tenant_schema, sql) — 隔离执行
6. 返回 JSON (columns, rows, total_rows, truncated, execution_ms)
```

- 超时返回友好提示
- 空结果返回提示 + SQL 回显

---

## 3B.4 Agent 工具: modify_user_data ✅

**文件**: `backend/app/core/tools/builtin/data_modify.py`

### 安全限制

- ✅ 按 pg_table_name 精确匹配，验证 `table.user_id == user.id`
- ✅ 验证 `table.is_writable == True`
- ✅ SQLSecurityChecker.check(sql, allow_write=True) 安全检查
- ✅ IsolatedSQLExecutor.execute_write 验证 schema 一致性
- ✅ 大批量写操作 (>1000 行) 记录 warning 日志
- ✅ 事务保护

---

## 3B.5 Agent 工具: recommend_chart ✅

**文件**: `backend/app/core/tools/builtin/chart_recommend.py`

### 推荐规则

| 数据特征 | 推荐图表 | 状态 |
|----------|----------|------|
| 1 时间列 + 1 数值列 | line (折线图) | ✅ |
| 1 分类列 + 1 数值列 | bar (柱状图) | ✅ |
| 1 分类列 + 1 占比列 | pie (饼图) | ✅ |
| 1 时间列 + N 数值列 | area (面积图) | ✅ |
| 2 数值列 | scatter (散点图) | ✅ |
| 其他 | table (数据表格) | ✅ |

- 支持用户 query_intent 意图覆盖 (如 "饼图" → pie)
- 占比列检测: 值之和接近 1 或 100
- 输出与前端 ChartRenderer 兼容的 ChartConfig JSON
- 包含 COLOR_PALETTE (10 色)

---

## 3B.6 工具注册 + ToolRegistry 扩展 ✅

### ToolRegistry 架构升级

为支持需要 `user/db/request` 上下文的 NL2SQL 工具，扩展了 ToolRegistry:

- 新增 `ContextToolFn` 类型: `async (arguments: dict, context: dict) -> str`
- 新增 `register_context_tool()` 方法
- 新增 `_context_tools` 字典存储上下文感知工具
- `execute_builtin(name, arguments, context=None)` 自动区分普通/上下文工具
- `get_all_tools()` / `get_tool_source()` / `to_openai_tools()` 均包含 context_tools
- 完全向后兼容: web_search 等普通工具不受影响

### 注册代码 (main.py)

```python
register_web_search(tool_registry)      # 普通工具
register_schema_tools(tool_registry)    # inspect_tables + inspect_table_schema
register_execute_sql(tool_registry)     # execute_sql
register_modify_user_data(tool_registry)# modify_user_data
register_chart_recommend(tool_registry) # recommend_chart
```

### 上下文传递 (chat.py)

`_execute_tool` 构建 context dict 并传递给 `execute_builtin`:
```python
context = {"user": user, "db": db, "request": raw_request}
result = await registry.execute_builtin(tool_name, arguments, context=context)
```

---

## 3B.7 System Prompt 增强 ✅

**修改文件**: `backend/app/api/v1/chat.py`

- 更新 DEFAULT_SYSTEM_PROMPT 描述 5 个工具能力
- 包含工作流程指引 (inspect → schema → execute → chart)
- 包含注意事项 (使用 pg_table_name、LIMIT 自动限制、写操作权限)
- MAX_TOOL_ROUNDS 从 5 提升到 10

---

## 任务清单

- [x] 实现 SQLSecurityChecker (安全检查 + LIMIT 强制 + 表名提取)
- [x] 实现 inspect_tables 工具
- [x] 实现 inspect_table_schema 工具
- [x] 实现 execute_sql 工具 (含安全检查 + 隔离执行)
- [x] 实现 modify_user_data 工具 (含所有权验证 + 行数限制)
- [x] 实现 recommend_chart 工具 (规则推荐 + ChartConfig 输出)
- [x] 扩展 ToolRegistry 支持 context-aware 工具
- [x] 工具注册到 ToolRegistry (6 个工具共计)
- [x] 更新 System Prompt + MAX_TOOL_ROUNDS=10
- [x] 修复 get_user_enabled_builtins 包含 context_tools
- [x] 端到端测试: 对话 → 工具调用 → SQL 执行 → 结果返回
- [x] 验证通过

---

## 验证标准

- [x] 对话 "我有哪些数据表?" → Agent 调用 inspect_tables → 返回 2 张表列表
- [x] 对话 "查看销售表的结构" → Agent 调用 inspect_table_schema → 返回 6 列信息 + 前 3 行示例数据
- [x] 对话 "查询销售额" → Agent 调用 execute_sql → 返回 5 行查询结果 (3ms)
- [x] Agent 自动调用 recommend_chart → 返回 ChartConfig JSON
- [x] 对话 "在表里新增一行" → Agent 调用 modify_user_data → INSERT 成功 (1 行, 12ms)
- [x] Agent 自动调用 execute_sql 验证 INSERT 结果 (6 行)
- [x] 危险 SQL (DROP TABLE) → 模型拒绝调用工具
- [x] 无 LIMIT 的 SQL 自动追加 LIMIT 1000
- [x] 多轮工具调用: 单次对话最多 5 轮 (inspect → schema → query → chart → verify)
- [x] 6 个工具全部注册并启用 (tools/builtin API 验证)
- [x] 所有容器运行中, backend healthy

---

## 新增/修改文件列表

### 新增/完善

| 文件 | 说明 |
|------|------|
| `app/core/security/sql_checker.py` | 完整重写: SQLSecurityChecker + SecurityResult + 20+ 安全模式 |
| `app/core/tools/builtin/schema_inspect.py` | inspect_tables + inspect_table_schema (context-aware) |
| `app/core/tools/builtin/data_query.py` | execute_sql (安全检查→权限校验→隔离执行→JSON 结果) |
| `app/core/tools/builtin/data_modify.py` | modify_user_data (所有权验证→schema 隔离→事务写入) |
| `app/core/tools/builtin/chart_recommend.py` | recommend_chart (6 种图表规则推荐 + ChartConfig 输出) |

### 修改

| 文件 | 变更 |
|------|------|
| `app/core/tools/registry.py` | 新增 ContextToolFn / register_context_tool / _context_tools |
| `app/core/tools/builtin/__init__.py` | 导出 5 个新注册函数 |
| `app/main.py` | 注册 5 个 NL2SQL 工具 (共 6 个内置工具) |
| `app/api/v1/chat.py` | 更新 System Prompt + MAX_TOOL_ROUNDS=10 + _execute_tool 传递 context |
| `app/api/v1/tools.py` | get_user_enabled_builtins / list_builtin_tools 包含 context_tools |

---

## 实现备注

1. **上下文感知工具架构**: 新增 `ContextToolFn(arguments, context)` 类型，context 包含 `user`, `db`, `request`；与原有 `BuiltinToolFn(arguments)` 完全向后兼容
2. **SQL 安全多层防御**: 正则拦截 → sqlparse AST → 多语句禁止 → 表名权限校验 → schema 隔离
3. **execute_sql 执行路径**: SecurityChecker → LIMIT 强制 → 表归属验证 → IsolatedSQLExecutor (search_path + timeout)
4. **recommend_chart 意图覆盖**: 用户 query_intent 中的关键词 (饼/折线/散点) 优先于自动规则推荐
5. **Agent 表现**: DeepSeek-chat 能自主决定调用链 (inspect → schema → query → chart)，单次对话最多进行 5 轮工具调用
