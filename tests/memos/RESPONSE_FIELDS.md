# MemOS Cloud API — 接口字段总结

> 测试日期: 2026-02-11
> Base URL: `https://memos.memtensor.cn/api/openmem/v1`
> 认证: `Authorization: Token <API_KEY>`

---

## 1. 添加记忆 — `POST /add/message`

### Request

```json
{
  "user_id": "string",              // 必填, 用户唯一标识
  "conversation_id": "string",      // 必填, 会话 ID
  "messages": [                     // 必填, 对话消息列表
    {
      "role": "user" | "assistant",
      "content": "string"
    }
  ]
}
```

### Response

```json
{
  "code": 0,                        // 0=成功
  "data": {
    "success": true,
    "task_id": "bd271a21-...",       // 异步任务 ID
    "status": "running"             // 任务状态 (异步处理)
  },
  "message": "ok"
}
```

**关键点:**
- 添加记忆是**异步操作**，返回 `task_id` 和 `status: "running"`
- MemOS 后端会自动从对话中提取:
  - **事实记忆** (UserMemory) — 用户提到的客观事实
  - **显式偏好** (explicit_preference) — 用户明确表达的偏好
  - **隐式偏好** (implicit_preference) — 从行为推断的偏好
  - **自动标签** — 从内容中提取的关键词标签
- 处理需要几秒钟，建议添加后等待 3-5 秒再检索

---

## 2. 检索记忆 — `POST /search/memory`

### Request

```json
{
  "query": "string",                // 必填, 查询内容(自然语言)
  "user_id": "string",             // 必填, 用户标识
  "conversation_id": "string",     // 可选, 填写后优先考虑该会话相关记忆(提升权重,不强制)
  "filter": {                      // 可选, 过滤条件
    "and": [
      {"tags": {"contains": "标签名"}},
      {"create_time": {"gt": "2025-01-01"}}
    ]
  }
}
```

### Response

```json
{
  "code": 0,
  "data": {
    "memory_detail_list": [...],          // 事实记忆列表
    "preference_detail_list": [...],       // 偏好记忆列表
    "tool_memory_detail_list": [...],      // 工具记忆列表 (测试中为空)
    "skill_detail_list": [...],            // 技能记忆列表 (测试中为空)
    "preference_note": "string"            // 系统提示文本(直接注入 LLM prompt)
  },
  "message": "ok"
}
```

---

## 3. 返回字段详解

### 3.1 memory_detail_list — 事实记忆

```json
{
  "id": "843c0345-1d0d-40a3-ad9c-bd623ec79189",    // 记忆唯一 ID (UUID)
  "memory_key": "广州旅游计划",                        // 记忆标题/关键词
  "memory_value": "用户计划在2026年暑假去广州旅游...",    // 记忆内容摘要
  "memory_type": "UserMemory",                       // 记忆类型
  "create_time": 1770801661875,                      // 创建时间 (Unix ms)
  "conversation_id": "conv_test_0211_01",            // 来源会话 ID
  "status": "activated",                              // 状态: "activated"
  "confidence": 0.99,                                 // 置信度 (0-1)
  "tags": ["旅游", "广州", "住宿", "酒店"],              // 自动提取的标签
  "update_time": 1770801667488,                      // 最后更新时间 (Unix ms)
  "relativity": 0.53322834                           // 与当前查询的相关度 (0-1)
}
```

### 3.2 preference_detail_list — 偏好记忆

```json
{
  "id": "9c250c3a-2836-43db-bf9a-da0247c4d7a9",
  "preference_type": "explicit_preference" | "implicit_preference",
  "preference": "用户偏好于选择七天连锁酒店作为住宿",       // 偏好描述
  "reasoning": "用户在助理推荐的连锁酒店中明确选择了七天...", // 推理依据
  "create_time": 1770801659041,
  "conversation_id": "conv_test_0211_01",
  "status": "activated",
  "update_time": 1770801662519,
  "relativity": 0.02790284
}
```

### 3.3 preference_note — 系统提示

固定文本，直接注入 LLM 的 system prompt 中:

```
# 注意：
事实记忆是事实的摘要，而偏好记忆是用户偏好的摘要。
你的回复不得违反用户的任何偏好，无论是显式偏好还是隐式偏好，并简要解释你为什么这样回答以避免冲突。
```

---

## 4. 删除记忆 — `POST /delete/memory`

### Request

```json
{
  "memory_ids": ["843c0345-..."]    // 必填, 要删除的记忆 ID 数组
}
```

### Response

```json
{
  "code": 0,
  "data": {
    "success": true
  },
  "message": "ok"
}
```

**注意:** 只能删除 `memory_detail_list` 中的事实记忆 (by `id`)，偏好记忆 (preference) 是否可单独删除待确认。

---

## 5. 过滤器语法

### filter 结构

```json
{
  "and": [                          // 逻辑 AND
    {"tags": {"contains": "标签名"}},  // 标签包含
    {"create_time": {"gt": "2025-01-01"}}  // 创建时间大于
  ]
}
```

### 支持的过滤条件

| 字段 | 操作符 | 示例 |
|---|---|---|
| `tags` | `contains` | `{"tags": {"contains": "旅游"}}` |
| `create_time` | `gt`, `lt`, `gte`, `lte` | `{"create_time": {"gt": "2025-01-01"}}` |

---

## 6. 相关度排序规则

- `relativity` 字段: 0~1，越高越相关
- 事实记忆 `relativity` 通常高于偏好记忆
- `conversation_id` 参数可以提升对应会话记忆的权重（非强制命中）
- 结果已按 `relativity` 降序排列

---

## 7. 后端集成建议

### 7.1 对话流程中的记忆使用

```
用户发送消息
   │
   ├──① POST /search/memory (query=用户消息, user_id=当前用户)
   │     返回: memory_detail_list + preference_detail_list + preference_note
   │
   ├──② 构建增强 prompt:
   │     system_prompt += preference_note
   │     system_prompt += "相关记忆: " + memory_detail_list (按 relativity 过滤)
   │     system_prompt += "用户偏好: " + preference_detail_list
   │
   ├──③ 调用 LLM (带记忆增强的 prompt)
   │
   └──④ POST /add/message (异步存储本轮对话到记忆)
         messages = [user_msg, assistant_msg]
```

### 7.2 记忆 → System Prompt 注入格式建议

```python
def build_memory_prompt(search_result: dict) -> str:
    """将 MemOS 搜索结果转为 system prompt 片段"""
    parts = []
    
    # 事实记忆
    memories = search_result["data"]["memory_detail_list"]
    if memories:
        parts.append("## 用户相关记忆")
        for m in memories:
            if m["relativity"] > 0.3:  # 过滤低相关度
                parts.append(f"- {m['memory_key']}: {m['memory_value']}")
    
    # 偏好
    prefs = search_result["data"]["preference_detail_list"]
    if prefs:
        parts.append("## 用户偏好")
        for p in prefs:
            parts.append(f"- [{p['preference_type']}] {p['preference']}")
    
    # preference_note (MemOS 自带的约束提示)
    note = search_result["data"].get("preference_note", "")
    if note:
        parts.append(note)
    
    return "\n".join(parts)
```

### 7.3 关键设计决策

| 决策 | 建议 |
|---|---|
| user_id 映射 | 后端 User.id (UUID) 直接作为 MemOS user_id |
| conversation_id 映射 | 后端 Conversation.id (UUID) 作为 MemOS conversation_id |
| 记忆写入时机 | LLM 回复完成后异步写入 (不阻塞 SSE 流) |
| 记忆召回时机 | 用户发送消息后、调用 LLM 前 |
| relativity 阈值 | 建议 ≥ 0.3 的记忆才注入 prompt，避免噪音 |
| 偏好记忆使用 | preference_note + 偏好列表一起注入 system prompt |
| 错误处理 | MemOS 不可用时降级为无记忆模式 (不阻塞对话) |

---

## 8. API 全局信息

### 认证 Header

```
Authorization: Token <API_KEY>
Content-Type: application/json
```

### 响应通用结构

```json
{
  "code": 0,          // 0=成功, 非0=错误
  "data": {...},       // 业务数据
  "message": "ok"      // 状态描述
}
```

### Response Headers (参考)

| Header | 示例 | 说明 |
|---|---|---|
| `traceid` | `340647d3e408e3eb...` | 请求追踪 ID |
| `req-cost-time` | `459` | 请求耗时 (ms) |
| `xenv` | `prod` | 环境标识 |

---

## 9. 测试结果汇总

| 测试项 | 状态 | 耗时 | 备注 |
|---|---|---|---|
| 添加记忆 (add/message) | ✅ | ~460ms | 异步，返回 task_id |
| 检索记忆 (search/memory) | ✅ | ~800ms | 返回事实+偏好+note |
| 对话中使用记忆 | ✅ | ~1s | 跨会话召回正常 |
| 用户画像查询 | ✅ | ~1.4s | 通过 search/memory 实现 |
| 过滤器 (create_time) | ✅ | ~960ms | AND 条件正常 |
| 删除记忆 (delete/memory) | ✅ | ~1s | 同步操作 |
