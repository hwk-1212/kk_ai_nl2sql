# Phase 3-E: 后端 — RBAC 数据权限 + 脱敏

## 目标

实现细粒度的数据访问权限控制：数据角色 (DataRole) 管理、表级/列级/行级权限、字段脱敏引擎，以及与 Agent 工具集的自动集成。

---

## 前置条件

- Phase 3-A 数据管理模块已完成 (DataTable 可用)
- Phase 3-B NL2SQL 工具集已完成 (execute_sql 可用)

---

## 3E.1 权限 ORM 模型完善

**文件**: `backend/app/models/data_permission.py`

```python
class DataRole(Base):
    """数据角色 — 比系统 role 更细粒度的数据访问角色"""
    __tablename__ = "data_roles"
    id: UUID
    tenant_id: UUID                 # FK tenants.id
    name: str                       # "销售部数据分析师"
    description: str
    is_default: bool = False        # 租户默认角色
    created_at / updated_at

class DataRoleAssignment(Base):
    """用户 ←→ 数据角色关联"""
    __tablename__ = "data_role_assignments"
    id: UUID
    user_id: UUID                   # FK users.id
    data_role_id: UUID              # FK data_roles.id
    assigned_by: UUID               # 分配人
    created_at

class TablePermission(Base):
    """表级权限"""
    __tablename__ = "table_permissions"
    id: UUID
    data_role_id: UUID              # FK data_roles.id
    data_table_id: UUID             # FK data_tables.id
    permission: str                 # "read" | "write" | "admin"
    created_at

class ColumnPermission(Base):
    """列级权限 — 控制字段可见性和脱敏"""
    __tablename__ = "column_permissions"
    id: UUID
    data_role_id: UUID              # FK data_roles.id
    data_table_id: UUID             # FK data_tables.id
    column_name: str
    visibility: str                 # "visible" | "masked" | "hidden"
    masking_rule: str?              # "last4" | "first3" | "phone" | "email_mask" | "id_card" | "full_mask" | "amount"
    created_at

class RowFilter(Base):
    """行级过滤条件"""
    __tablename__ = "row_filters"
    id: UUID
    data_role_id: UUID              # FK data_roles.id
    data_table_id: UUID             # FK data_tables.id
    filter_expression: str          # SQL WHERE 子句
    description: str                # "仅查看本部门数据"
    created_at
```

---

## 3E.2 数据访问控制引擎

**文件**: `backend/app/core/security/data_access.py`

```python
class DataAccessControl:
    """数据访问控制 — SQL 执行前的权限检查和 SQL 改写"""

    async def check_table_access(
        self, user: User, table: DataTable, operation: str, db: AsyncSession
    ) -> bool:
        """
        检查用户对表的操作权限 (read/write/admin)
        逻辑:
        1. 表的所有者 (user_id) 默认有全部权限
        2. 查询用户关联的 DataRole
        3. 查询 TablePermission 是否允许该操作
        4. 无权限返回 False
        """

    async def get_visible_columns(
        self, user: User, table: DataTable, db: AsyncSession
    ) -> list[ColumnAccess]:
        """
        获取用户对表的每列可见性和脱敏规则
        返回: [{column: "phone", visibility: "masked", rule: "last4"}, ...]
        默认: 表所有者所有列可见; 其他用户按 ColumnPermission 控制
        """

    async def rewrite_sql_with_filters(
        self, user: User, sql: str, tables: list[DataTable], db: AsyncSession
    ) -> str:
        """
        将行级过滤条件注入 SQL WHERE 子句
        使用 sqlparse 解析 SQL，在每个 FROM 表引用上追加 WHERE 条件
        示例: SELECT * FROM orders → SELECT * FROM orders WHERE department = '销售部'
        """

    async def apply_column_masking(
        self, result: QueryResult, user: User, table: DataTable, db: AsyncSession
    ) -> QueryResult:
        """
        对查询结果应用列级脱敏
        遍历结果集每一行，对 visibility=masked 的列应用脱敏规则
        visibility=hidden 的列直接移除
        """
```

### ColumnAccess

```python
class ColumnAccess(BaseModel):
    column: str
    visibility: str           # "visible" | "masked" | "hidden"
    masking_rule: str | None  # 脱敏规则名
```

---

## 3E.3 脱敏规则引擎

**文件**: `backend/app/core/security/masking.py`

```python
MASKING_RULES = {
    "last4":      lambda v: "****" + str(v)[-4:] if v else None,
    "first3":     lambda v: str(v)[:3] + "****" if v else None,
    "phone":      lambda v: str(v)[:3] + "****" + str(v)[-4:] if v and len(str(v)) >= 7 else "****",
    "email_mask": lambda v: v[0] + "***@" + v.split("@")[1] if v and "@" in str(v) else "***",
    "id_card":    lambda v: "**************" + str(v)[-4:] if v else None,
    "full_mask":  lambda v: "******",
    "amount":     lambda v: "***.**",
}

def apply_mask(value: any, rule: str) -> any:
    """应用脱敏规则到单个值"""
    fn = MASKING_RULES.get(rule)
    if fn and value is not None:
        return fn(value)
    return value
```

---

## 3E.4 与 Agent 工具集成

修改 execute_sql / modify_user_data 工具，在执行前自动经过 DataAccessControl 检查:

```python
# execute_sql 工具增强
async def execute_sql_tool(arguments, user, db):
    sql = arguments["sql"]
    tables = parse_tables_from_sql(sql)

    # 1. 表级权限检查
    for table in tables:
        if not await dac.check_table_access(user, table, "read", db):
            return f"权限不足: 无法访问表 {table.display_name}"

    # 2. 行级过滤注入
    sql = await dac.rewrite_sql_with_filters(user, sql, tables, db)

    # 3. 执行查询
    result = await executor.execute_read(tenant_schema, sql, user)

    # 4. 列级脱敏
    for table in tables:
        result = await dac.apply_column_masking(result, user, table, db)

    return result
```

---

## 3E.5 权限管理 API

**文件**: `backend/app/api/v1/data_permissions.py`

| 端点 | 方法 | 权限 | 功能 |
|------|------|------|------|
| `/roles` | GET | tenant_admin+ | 列出租户下数据角色 |
| `/roles` | POST | tenant_admin+ | 创建角色 |
| `/roles/{id}` | PUT | tenant_admin+ | 更新角色 |
| `/roles/{id}` | DELETE | tenant_admin+ | 删除角色 |
| `/roles/{id}/assign` | POST | tenant_admin+ | 给用户分配角色 |
| `/roles/{id}/assign/{user_id}` | DELETE | tenant_admin+ | 移除用户角色 |
| `/roles/{id}/permissions` | GET | tenant_admin+ | 查看角色权限详情 |
| `/roles/{id}/table-permissions` | PUT | tenant_admin+ | 设置表级权限 |
| `/roles/{id}/column-permissions` | PUT | tenant_admin+ | 设置列级权限 |
| `/roles/{id}/row-filters` | PUT | tenant_admin+ | 设置行级过滤 |

---

## 任务清单

- [ ] 完善权限 ORM 模型 (DataRole, DataRoleAssignment, TablePermission, ColumnPermission, RowFilter)
- [ ] 实现 DataAccessControl 引擎 (表/列/行三级检查)
- [ ] 实现脱敏规则引擎 (7 种规则)
- [ ] 集成到 execute_sql 工具 (权限检查 + 过滤注入 + 脱敏)
- [ ] 集成到 modify_user_data 工具
- [ ] 实现权限管理 API (10 个端点)
- [ ] 表所有者默认全权限逻辑
- [ ] 验证通过

---

## 验证标准

- [ ] 表所有者可正常查询自己的表
- [ ] 分配 read 权限的角色用户可查询
- [ ] 无权限用户查询被拒绝 → 返回 "权限不足"
- [ ] 行级过滤生效 (A 用户只看到自己部门数据)
- [ ] 列脱敏生效 (phone: 138****1234, email: z***@xxx.com)
- [ ] hidden 列在结果中不出现
- [ ] 角色 CRUD API 正常
- [ ] 权限配置 API 正常
- [ ] Agent 对话中权限拦截正常 (工具返回权限不足提示)
- [ ] 写操作权限控制正常

---

## 新增/修改文件列表

### 新增/完善

| 文件 | 说明 |
|------|------|
| `app/models/data_permission.py` | 完善 5 个权限 ORM 模型 |
| `app/core/security/data_access.py` | 完整实现数据访问控制引擎 |
| `app/core/security/masking.py` | 完整实现脱敏规则引擎 |
| `app/api/v1/data_permissions.py` | 完整实现权限管理 API |

### 修改

| 文件 | 变更 |
|------|------|
| `app/core/tools/builtin/data_query.py` | 集成权限检查 + 脱敏 |
| `app/core/tools/builtin/data_modify.py` | 集成权限检查 |
| `app/main.py` | 初始化 DataAccessControl + 注册路由 |
