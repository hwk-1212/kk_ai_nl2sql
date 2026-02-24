# Phase 3-D: 后端 — 语义层 / 指标模块

> **状态**: ✅ 已完成

## 目标

实现业务指标、维度、术语映射的完整 CRUD 和语义检索能力。指标名称+描述写入 Milvus 向量库，Agent 通过 `lookup_metrics` 工具进行语义检索，找到最相关的指标定义以生成精确 SQL。

---

## 前置条件

- Phase 3-A 数据管理模块已完成 (DataTable 可关联)
- 现有 Milvus + Embedding 服务可用 (Phase 5 老 RAG)

---

## 3D.1 ORM 模型完善

### Metric 模型

**文件**: `backend/app/models/metric.py`

```python
class Metric(Base):
    __tablename__ = "metrics"
    id: UUID
    user_id: UUID                   # FK users.id
    tenant_id: UUID?                # FK tenants.id
    name: str                       # "销售额"
    english_name: str               # "sales_amount"
    description: str                # 口径说明
    formula: str                    # "SUM(orders.amount)"
    data_table_id: UUID?            # FK data_tables.id
    source_table: str               # 可手动指定表名
    dimensions: JSON                # ["date", "region", "category"]
    filters: JSON                   # ["status = 'completed'"]
    time_granularity: JSON          # ["day", "week", "month"]
    category: str                   # 指标分类
    status: str                     # "active" | "draft" | "deprecated"
    version: str
    created_at / updated_at
```

### Dimension 模型

**文件**: `backend/app/models/dimension.py`

```python
class Dimension(Base):
    __tablename__ = "dimensions"
    id: UUID
    user_id: UUID
    tenant_id: UUID?
    name: str                       # "地区"
    english_name: str               # "region"
    description: str
    data_table_id: UUID?            # FK data_tables.id
    source_column: str              # 对应的列名
    hierarchy: JSON?                # 层级关系 ["国家", "省", "市"]
    created_at / updated_at
```

### BusinessTerm 模型

**文件**: `backend/app/models/business_term.py`

```python
class BusinessTerm(Base):
    __tablename__ = "business_terms"
    id: UUID
    user_id: UUID
    tenant_id: UUID?
    term: str                       # "营收"
    canonical_name: str             # "sales_amount" (指向 metric.english_name)
    term_type: str                  # "metric" | "dimension" | "filter"
    created_at
```

---

## 3D.2 语义层检索服务

**文件**: `backend/app/core/semantic/layer.py`

```python
class SemanticLayer:
    """语义层 — 指标向量化 + 语义检索"""

    COLLECTION_NAME = "kk_metrics"
    EMBEDDING_DIM = 1024  # text-embedding-v4

    async def index_metric(self, metric: Metric):
        """
        将指标写入 Milvus:
        - 文本: "{name} {english_name} {description} {formula}"
        - 向量: text-embedding-v4 编码
        - 元数据: metric_id, user_id, tenant_id, category
        """

    async def index_term(self, term: BusinessTerm, metric: Metric):
        """
        将业务术语写入 Milvus:
        - 文本: "{term.term} → {metric.name} {metric.description}"
        """

    async def search(
        self, query: str, user_id: str, tenant_id: str | None,
        top_k: int = 5
    ) -> list[MetricSearchResult]:
        """
        语义检索:
        1. query → embedding
        2. Milvus ANN search (过滤 user_id/tenant_id)
        3. 返回 top-k 指标 (含 formula, dimensions, filters)
        """

    async def remove_metric(self, metric_id: str):
        """从 Milvus 中删除指标向量"""

    async def rebuild_index(self, user_id: str, db: AsyncSession):
        """重建用户的所有指标索引"""
```

### MetricSearchResult

```python
class MetricSearchResult(BaseModel):
    metric_id: str
    name: str
    english_name: str
    formula: str
    description: str
    dimensions: list[str]
    filters: list[str]
    source_table: str
    score: float  # 语义相似度
```

---

## 3D.3 Agent 工具: lookup_metrics

**文件**: `backend/app/core/tools/builtin/metric_lookup.py`

```python
TOOL_DEFINITION = {
    "name": "lookup_metrics",
    "description": "根据用户查询语义检索匹配的业务指标。返回指标名称、计算公式、维度和过滤条件，帮助生成精确的SQL。",
    "parameters": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "搜索查询，如'销售额'、'用户增长率'、'订单转化'"
            }
        },
        "required": ["query"]
    }
}

async def execute(arguments: dict, user: User, db: AsyncSession) -> str:
    """
    1. 调用 SemanticLayer.search(query, user_id, tenant_id)
    2. 格式化匹配结果
    3. 返回: 指标列表 (name, formula, dimensions, filters, source_table)
    """
```

---

## 3D.4 指标管理 API

**文件**: `backend/app/api/v1/metrics.py`

### Metric CRUD

| 端点 | 方法 | 功能 |
|------|------|------|
| `/metrics` | GET | 列出指标 (分页, 分类筛选) |
| `/metrics` | POST | 创建指标 (同步写入 Milvus) |
| `/metrics/{id}` | GET | 指标详情 |
| `/metrics/{id}` | PUT | 更新指标 (更新 Milvus) |
| `/metrics/{id}` | DELETE | 删除指标 (删除 Milvus) |
| `/metrics/search` | GET | 搜索指标 (语义检索, 供 Agent) |

### Dimension CRUD

| 端点 | 方法 | 功能 |
|------|------|------|
| `/dimensions` | GET | 列出维度 |
| `/dimensions` | POST | 创建维度 |
| `/dimensions/{id}` | PUT | 更新维度 |
| `/dimensions/{id}` | DELETE | 删除维度 |

### BusinessTerm CRUD

| 端点 | 方法 | 功能 |
|------|------|------|
| `/terms` | GET | 列出术语 |
| `/terms` | POST | 创建术语 (同步写入 Milvus) |
| `/terms/{id}` | PUT | 更新术语 |
| `/terms/{id}` | DELETE | 删除术语 |

---

## 3D.5 Milvus Collection 初始化

在 `main.py` lifespan 中创建 metrics collection (如果不存在):

```python
collection_name = "kk_metrics"
# 字段: id (varchar PK), embedding (FLOAT_VECTOR 1024), text (varchar),
#        metric_id (varchar), user_id (varchar), tenant_id (varchar), category (varchar)
# 索引: HNSW + COSINE
```

---

## 3D.6 Pydantic Schemas

**文件**: `backend/app/schemas/metric.py`

- `MetricCreate`, `MetricUpdate`, `MetricResponse`
- `DimensionCreate`, `DimensionUpdate`, `DimensionResponse`
- `BusinessTermCreate`, `BusinessTermUpdate`, `BusinessTermResponse`
- `MetricSearchResponse`

---

## 任务清单

- [x] 完善 Metric / Dimension / BusinessTerm ORM 模型
- [x] 实现 SemanticLayer (向量化 + 语义检索)
- [x] 创建 kk_metrics Milvus Collection
- [x] 实现 lookup_metrics Agent 工具
- [x] 注册 lookup_metrics 到 ToolRegistry
- [x] 实现指标管理 API (Metric/Dimension/Term CRUD + search)
- [x] 实现 Pydantic schemas
- [x] 创建/更新/删除指标时同步 Milvus
- [x] 验证通过

---

## 验证标准

- [x] 创建指标 → Milvus 中存在对应向量
- [x] 语义搜索 "营收" → 返回包含 "销售额" 的指标
- [x] 同义词映射: "营收" → "sales_amount" 正确关联
- [x] Agent 对话 "本月销售额是多少" → lookup_metrics → 返回销售额指标公式 → execute_sql
- [x] 指标 CRUD API 全部可用
- [x] 维度/术语 CRUD API 全部可用
- [x] 删除指标 → Milvus 向量同步删除
- [x] 租户隔离: A 租户搜索不到 B 租户指标

---

## 新增/修改文件列表

### 新增/完善

| 文件 | 说明 |
|------|------|
| `app/models/metric.py` | 完善 Metric ORM |
| `app/models/dimension.py` | 完善 Dimension ORM |
| `app/models/business_term.py` | 完善 BusinessTerm ORM |
| `app/core/semantic/layer.py` | 完整实现语义层检索服务 |
| `app/core/tools/builtin/metric_lookup.py` | 完整实现 lookup_metrics 工具 |
| `app/schemas/metric.py` | 完善 Pydantic schemas |
| `app/api/v1/metrics.py` | 完整实现指标管理 API |

### 修改

| 文件 | 变更 |
|------|------|
| `app/main.py` | 初始化 SemanticLayer + 创建 Milvus collection + 注册工具 |
| `app/api/v1/chat.py` | System Prompt 增加 lookup_metrics 说明 |

---

## 代码审查修复 (2026-02-24)

| # | 严重度 | 文件 | 问题 | 修复 |
|---|--------|------|------|------|
| 1 | 🔴严重 | `metrics.py` | `GET /search`、`GET /dimensions`、`GET /terms` 定义在 `GET /{metric_id}` 之后，被路径参数截获返回 422 | 将 `/search`、CRUD 子资源路由移到 `/{metric_id}` 之前注册 |
| 2 | 🟡功能 | `layer.py` | Metric 和 BusinessTerm 在 Milvus 中均存储 `metric_id`，搜索返回重复指标 | 增加 `seen_metric_ids` 集合去重，每个指标只返回最高分结果 |
