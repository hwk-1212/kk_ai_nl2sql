# Qwen Embedding & Rerank API — 接口字段总结

> 测试日期: 2026-02-11
> API Key: 千问 (DashScope)
> 所有接口均通过 `Authorization: Bearer <API_KEY>` 认证

---

## 1. 文本向量化 — text-embedding-v4

### 接入方式

使用 OpenAI 兼容接口 (`openai` SDK):

```python
from openai import OpenAI
client = OpenAI(
    api_key="sk-xxx",
    base_url="https://dashscope.aliyuncs.com/compatible-mode/v1"
)

resp = client.embeddings.create(
    model="text-embedding-v4",
    input="文本内容",          # str 或 list[str]
    dimensions=1024,          # 可选: 64/128/256/512/768/1024(默认)/1536/2048
)
```

### Response 结构

```json
{
  "id": "7ba2771a-b71f-9854-8f95-4cc6fb95f205",
  "object": "list",
  "model": "text-embedding-v4",
  "data": [
    {
      "object": "embedding",
      "index": 0,                          // 输入文本的序号 (批量时 0,1,2...)
      "embedding": [0.0225, -0.087, ...]   // float[] 向量
    }
  ],
  "usage": {
    "prompt_tokens": 6,        // 输入 token 数
    "total_tokens": 6           // 总 token 数 (embedding 无 completion)
  }
}
```

### 字段说明

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 请求唯一 ID (UUID) |
| `object` | string | 固定 `"list"` |
| `model` | string | `"text-embedding-v4"` |
| `data[].object` | string | 固定 `"embedding"` |
| `data[].index` | int | 输入文本序号 |
| `data[].embedding` | float[] | 向量，长度 = dimensions 参数 |
| `usage.prompt_tokens` | int | 输入 token 数 |
| `usage.total_tokens` | int | 总 token 数 |

### 维度测试结果

| 请求维度 | 实际维度 | 匹配 |
|---|---|---|
| 256 | 256 | ✅ |
| 512 | 512 | ✅ |
| 1024 | 1024 | ✅ (默认) |
| 2048 | 2048 | ✅ |

### 批量支持

- `input` 可传 `list[str]`，返回多个 `data[]` 元素
- 每个元素 `index` 对应输入顺序
- `usage.prompt_tokens` 为所有输入的 token 之和

---

## 2. 多模态向量 — qwen3-vl-embedding

### 接入方式

**注意:** 使用 DashScope 原生 REST API（非 OpenAI 兼容模式）。

```
POST https://dashscope.aliyuncs.com/api/v1/services/embeddings/multimodal-embedding/multimodal-embedding
Authorization: Bearer <API_KEY>
Content-Type: application/json
```

### Request

```json
{
  "model": "qwen3-vl-embedding",
  "input": {
    "contents": [
      {
        "text": "描述文本",                     // 可选
        "image": "https://xxx/image.png",      // 可选, URL 或 Base64
        "video": "https://xxx/video.mp4"       // 可选, 仅 URL
      }
    ]
  },
  "parameters": {
    "dimension": 1024,           // 可选, 默认 1024
    "output_type": "dense",      // 可选, 默认 "dense"
    "fps": 0.5                   // 可选, 视频帧率
  }
}
```

**限制:**
- contents 总元素数 ≤ 20
- 图片数量 ≤ 10, 视频数量 ≤ 1
- 图片格式: JPEG, PNG, WEBP, BMP, TIFF, ICO, DIB, ICNS, SGI
- 视频格式: MP4, AVI, MOV

### Response 结构

```json
{
  "output": {
    "embeddings": [
      {
        "embedding": [-0.00063, 0.00471, ...],  // float[] 向量
        "index": 0,
        "type": "vl"                             // "vl" = vision-language 融合
      }
    ]
  },
  "usage": {
    "image_tokens": 64,        // 图片消耗的 token
    "input_tokens": 30,         // 文本消耗的 token
    "total_tokens": 94          // 总 token (含视频时会很大)
  },
  "request_id": "5e94de6b-..."
}
```

### 字段说明

| 字段 | 类型 | 说明 |
|---|---|---|
| `output.embeddings[].embedding` | float[] | 融合向量 |
| `output.embeddings[].index` | int | 内容序号 |
| `output.embeddings[].type` | string | `"vl"` (vision-language) |
| `usage.image_tokens` | int | 图片/视频消耗 token |
| `usage.input_tokens` | int | 文本消耗 token |
| `usage.total_tokens` | int | 总 token |
| `request_id` | string | 请求追踪 ID |

### 使用场景

| 输入组合 | 用途 |
|---|---|
| text only | 纯文本向量化 |
| text + image | 图文融合检索 |
| text + image + video | 多模态融合检索 |
| image only | 以图搜图 |

### Token 消耗对比

| 输入 | image_tokens | input_tokens | total_tokens |
|---|---|---|---|
| text + image (256x256) | 64 | 30 | 94 |
| text + image + video (短视频) | 3904 | 322 | 4226 |

> 视频 token 消耗远大于图片，注意成本控制。

---

## 3. 文本重排序 — qwen3-rerank

### 接入方式

使用 OpenAI 兼容 API:

```
POST https://dashscope.aliyuncs.com/compatible-api/v1/reranks
Authorization: Bearer <API_KEY>
Content-Type: application/json
```

### Request

```json
{
  "model": "qwen3-rerank",
  "query": "查询文本",
  "documents": [
    "候选文本1",
    "候选文本2",
    "候选文本3"
  ],
  "top_n": 2,                    // 可选, 返回 top N 结果
  "instruct": "Given a..."       // 可选, 任务指令
}
```

### Response 结构

```json
{
  "id": "a7fd290d-a52e-9fc4-bf1b-154af45efcf3",
  "object": "list",
  "model": "qwen3-rerank",
  "results": [
    {
      "index": 0,                            // 原始 documents 中的下标
      "relevance_score": 0.9272574008348661  // 相关性分数 (0-1)
    },
    {
      "index": 2,
      "relevance_score": 0.7576691095659295
    }
  ],
  "usage": {
    "total_tokens": 105
  }
}
```

### 字段说明

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 请求 ID |
| `object` | string | 固定 `"list"` |
| `model` | string | `"qwen3-rerank"` |
| `results[].index` | int | 对应原始 `documents[]` 下标 |
| `results[].relevance_score` | float | 相关性分数 (0-1, 降序排列) |
| `usage.total_tokens` | int | 总 token 数 |

### 关键行为

- 结果已按 `relevance_score` **降序排列**
- `top_n` 控制返回数量（不传则返回全部）
- `instruct` 可选，给模型更精确的排序指令
- **gte-rerank-v2 不支持** OpenAI 兼容模式，需用 DashScope 原生 API

---

## 4. 模型选择建议 (Phase 5 RAG 用)

| 场景 | 推荐模型 | 维度 | 说明 |
|---|---|---|---|
| 文档 chunk 向量化 | `text-embedding-v4` | 1024 | 默认维度，性价比最优 |
| 查询向量化 | `text-embedding-v4` | 1024 | 与文档同维度 |
| 检索后重排序 | `qwen3-rerank` | - | top_n=10~20 |
| 图文混合检索 (未来) | `qwen3-vl-embedding` | 1024 | 多模态场景 |

### RAG Pipeline 推荐流程

```
用户 Query
    │
    ├──① text-embedding-v4(query) → 查询向量
    │
    ├──② Milvus 向量检索 → top_k=20 候选 chunks
    │
    ├──③ qwen3-rerank(query, chunks) → top_n=5 精排
    │
    └──④ 注入 LLM prompt → 生成回答
```

### Milvus 集合建议

```python
# Phase 5 创建 Milvus collection
fields = [
    FieldSchema("id", DataType.VARCHAR, max_length=64, is_primary=True),
    FieldSchema("content", DataType.VARCHAR, max_length=8192),
    FieldSchema("embedding", DataType.FLOAT_VECTOR, dim=1024),  # text-embedding-v4 默认
    FieldSchema("metadata", DataType.JSON),                      # 来源、页码等
]
index_params = {
    "metric_type": "COSINE",  # 或 "IP" (Inner Product)
    "index_type": "HNSW",
    "params": {"M": 16, "efConstruction": 256},
}
```

---

## 5. 测试结果汇总

| 测试项 | 模型 | 状态 | 备注 |
|---|---|---|---|
| 单文本向量化 | text-embedding-v4 | ✅ | 1024维, 6 tokens |
| 批量文本向量化 | text-embedding-v4 | ✅ | 3条, 15 tokens |
| 维度切换 (256/512/1024/2048) | text-embedding-v4 | ✅ | 全部匹配 |
| 文本+图片融合向量 | qwen3-vl-embedding | ✅ | 94 tokens |
| 文本+图片+视频融合向量 | qwen3-vl-embedding | ✅ | 4226 tokens |
| 基础 rerank | qwen3-rerank | ✅ | 排序正确 |
| 带 instruct rerank | qwen3-rerank | ✅ | 排序正确 |
| gte-rerank-v2 | gte-rerank-v2 | ❌ | 不支持 OpenAI 兼容模式 |

---

## 6. API 差异: OpenAI 兼容 vs DashScope 原生

| 能力 | OpenAI 兼容 | DashScope 原生 |
|---|---|---|
| text-embedding-v4 | ✅ `embeddings.create()` | ✅ |
| qwen3-vl-embedding | ❌ | ✅ (原生 REST) |
| qwen3-rerank | ✅ `/compatible-api/v1/reranks` | ✅ |
| gte-rerank-v2 | ❌ | ✅ |

> 后端实现中，text embedding 和 rerank 用 OpenAI SDK，多模态 embedding 需用 httpx 直接调 DashScope REST API。
