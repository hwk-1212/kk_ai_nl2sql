# DeepSeek API 返回字段完整记录

> 基于 DeepSeek-Chat (v3.2) 实际测试结果，API Key 测试时间: 2026-02-11
> 模型版本: deepseek-chat / deepseek-reasoner (思考模式下自动切换)

---

## 1. 非流式响应 (chat.completion)

### 1.1 顶层结构

```json
{
  "id": "10a6ef37-f654-4f80-b2bb-2ff75c8b1253",    // UUID 格式
  "object": "chat.completion",                        // 固定值
  "created": 1770798399,                              // Unix timestamp
  "model": "deepseek-chat",                           // 普通模式: "deepseek-chat", 思考模式: "deepseek-reasoner"
  "system_fingerprint": "fp_eaab8d114b_prod0820_fp8_kvcache",
  "service_tier": null,
  "choices": [...],
  "usage": {...}
}
```

### 1.2 choices[0].message — 普通模式

```json
{
  "role": "assistant",
  "content": "回答内容",
  "refusal": null,
  "annotations": null,
  "audio": null,
  "function_call": null,          // 已废弃，用 tool_calls
  "tool_calls": null              // 无工具调用时为 null
}
```

### 1.3 choices[0].message — 思考模式 (thinking enabled)

```json
{
  "role": "assistant",
  "content": "最终回答内容",
  "reasoning_content": "思考过程内容（思维链）",   // ★ 关键字段，仅思考模式存在
  "refusal": null,
  "annotations": null,
  "audio": null,
  "function_call": null,
  "tool_calls": null
}
```

### 1.4 choices[0].message — Tool Call 模式

```json
{
  "role": "assistant",
  "content": "我来帮您查询...",     // 可能有文本内容，也可能为空字符串
  "tool_calls": [
    {
      "id": "call_00_Uzeq9r2a58anyxNz91WBM14t",    // 工具调用 ID，用于关联 tool 角色回复
      "type": "function",                            // 固定 "function"
      "function": {
        "name": "get_weather",                       // 函数名
        "arguments": "{\"location\": \"杭州\", \"unit\": \"celsius\"}"  // JSON 字符串
      },
      "index": 0                                     // 工具调用索引
    }
  ],
  "reasoning_content": "思考过程..."   // 思考模式 + tool call 时也存在
}
```

### 1.5 finish_reason 取值

| 值 | 含义 |
|---|---|
| `"stop"` | 正常结束 |
| `"tool_calls"` | 模型请求调用工具 |
| `"length"` | 达到 max_tokens 限制 |

### 1.6 usage 结构

```json
{
  "prompt_tokens": 17,
  "completion_tokens": 24,
  "total_tokens": 41,
  "completion_tokens_details": {              // 普通模式为 null
    "accepted_prediction_tokens": null,
    "audio_tokens": null,
    "reasoning_tokens": 303,                  // ★ 思考模式才有值，推理消耗的 token 数
    "rejected_prediction_tokens": null
  },
  "prompt_tokens_details": {
    "audio_tokens": null,
    "cached_tokens": 0                        // 命中上下文缓存的 token 数
  },
  "prompt_cache_hit_tokens": 0,              // DeepSeek 硬盘缓存命中
  "prompt_cache_miss_tokens": 17             // DeepSeek 硬盘缓存未命中
}
```

---

## 2. 流式响应 (chat.completion.chunk)

### 2.1 Chunk 顶层结构

```json
{
  "id": "f1d6331e-87a8-4ed1-97bb-c61123bdb497",
  "object": "chat.completion.chunk",           // 固定值
  "created": 1770798431,
  "model": "deepseek-chat",                    // 思考模式下为 "deepseek-reasoner"
  "system_fingerprint": "fp_...",
  "service_tier": null,
  "choices": [...],
  "usage": null                                // 最后一个 chunk 才有完整 usage
}
```

### 2.2 chunk.choices[0] — 普通模式

```json
{
  "index": 0,
  "delta": {
    "role": "assistant",        // 仅第一个 chunk 有值
    "content": "Python是...",   // 逐 token 输出
    "function_call": null,
    "refusal": null,
    "tool_calls": null
  },
  "finish_reason": null,        // 最后一个 chunk 为 "stop"
  "logprobs": null
}
```

### 2.3 chunk.choices[0].delta — 思考模式 ★★★

思考模式流式输出分 **两个阶段**：

**阶段1: Reasoning（思考过程）**
```json
{
  "delta": {
    "role": "assistant",              // 仅第一个 chunk
    "content": null,                  // 思考阶段 content 为 null
    "reasoning_content": "让我想想...", // ★ 思考内容逐 token 输出
    "function_call": null,
    "refusal": null,
    "tool_calls": null
  },
  "finish_reason": null
}
```

**阶段2: Content（最终回答）—— 切换标志: reasoning_content 变为 null，content 开始有值**
```json
{
  "delta": {
    "role": null,
    "content": "答案是...",            // ★ 最终回答逐 token 输出
    "reasoning_content": null,         // 切换后变为 null
    "function_call": null,
    "refusal": null,
    "tool_calls": null
  },
  "finish_reason": null
}
```

**前端判断逻辑:**
```typescript
// 伪代码
if (delta.reasoning_content) {
  // 追加到思考过程区域
  reasoning += delta.reasoning_content
} else if (delta.content) {
  // 追加到回答区域
  content += delta.content
}
```

### 2.4 chunk.choices[0].delta — 流式 Tool Call

```json
{
  "delta": {
    "tool_calls": [
      {
        "index": 0,
        "id": "call_00_...",          // 仅首次出现
        "function": {
          "name": "get_weather",       // 仅首次出现
          "arguments": "{\"loc"        // 分片追加
        }
      }
    ]
  }
}
```

**前端收集逻辑:**
```typescript
const toolCalls: Record<number, { id: string; name: string; arguments: string }> = {}
for (const tc of delta.tool_calls) {
  if (!toolCalls[tc.index]) toolCalls[tc.index] = { id: '', name: '', arguments: '' }
  if (tc.id) toolCalls[tc.index].id = tc.id
  if (tc.function?.name) toolCalls[tc.index].name = tc.function.name
  if (tc.function?.arguments) toolCalls[tc.index].arguments += tc.function.arguments
}
```

### 2.5 最后一个 Chunk（包含 usage）

```json
{
  "choices": [{
    "delta": { "content": "", "role": null },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 38,
    "total_tokens": 48,
    "prompt_cache_hit_tokens": 0,
    "prompt_cache_miss_tokens": 10
  }
}
```

---

## 3. Tool Call 多轮对话协议

### 3.1 完整流程

```
[用户消息] → [模型返回 tool_calls, finish_reason="tool_calls"]
          → [将 assistant message 原样追加到 messages]
          → [追加 tool 角色消息（每个 tool_call 一条）]
          → [再次请求模型]
          → [模型返回最终回答, finish_reason="stop"]
```

### 3.2 tool 角色消息格式

```json
{
  "role": "tool",
  "tool_call_id": "call_00_Uzeq9r2a58anyxNz91WBM14t",   // 必须与 tool_calls[i].id 对应
  "content": "{\"temperature\": 24, \"condition\": \"晴天\"}"  // 工具执行结果（字符串）
}
```

### 3.3 并行 Tool Call

模型可一次返回多个 tool_calls（如同时查北京和上海天气），需全部执行后一起返回：

```python
messages.append(assistant_message)  # 包含 tool_calls 的 assistant 消息
for tc in assistant_message.tool_calls:
    result = execute_tool(tc.function.name, tc.function.arguments)
    messages.append({
        "role": "tool",
        "tool_call_id": tc.id,
        "content": json.dumps(result)
    })
```

---

## 4. 请求参数汇总 (前端→后端需传递)

| 参数 | 类型 | 说明 |
|---|---|---|
| `model` | string | `"deepseek-chat"` 统一入口 |
| `messages` | array | 消息历史 |
| `stream` | boolean | 是否流式输出 |
| `extra_body.thinking.type` | string | `"enabled"` 开启思考模式 |
| `response_format.type` | string | `"json_object"` 强制 JSON 输出 |
| `tools` | array | 工具定义列表 |
| `temperature` | float | 温度参数（思考模式不建议设置） |
| `max_tokens` | int | 最大生成 token 数 |

---

## 5. 关键差异对照表（前端需关注）

| 特性 | 普通模式 | 思考模式 |
|---|---|---|
| 返回 model 字段 | `"deepseek-chat"` | `"deepseek-reasoner"` |
| message.reasoning_content | 字段不存在 | 有值（思维链） |
| delta.reasoning_content (流式) | 字段不存在 | 先有值，切到 content 后为 null |
| usage.reasoning_tokens | null | 有值（推理 token 数） |
| 可同时使用 tool_calls | ✅ | ✅ (V3.2 支持) |
| 可使用 json_object | ✅ | ❌ (不建议) |

---

## 6. 后端 SSE 推送给前端的建议格式

```typescript
// 后端统一推送的 SSE event 格式
interface SSEEvent {
  type: 'reasoning' | 'content' | 'tool_call' | 'tool_result' | 'usage' | 'done' | 'error'
  data: {
    reasoning?: string      // type=reasoning 时，增量思考内容
    content?: string        // type=content 时，增量回答内容
    tool_call?: {           // type=tool_call 时
      id: string
      name: string
      arguments: string
    }
    tool_result?: {         // type=tool_result 时
      tool_call_id: string
      content: string
    }
    usage?: {               // type=usage 时
      prompt_tokens: number
      completion_tokens: number
      reasoning_tokens?: number
      total_tokens: number
      cache_hit_tokens?: number   // DeepSeek 特有
    }
    error?: string          // type=error 时
    model?: string          // 实际使用的模型名
    finish_reason?: string  // done 时携带
  }
}
```

---

## 7. 千问 (Qwen-Plus) API 字段记录

> 基于 qwen-plus 实际测试结果，API Key 测试时间: 2026-02-11
> Base URL: https://dashscope.aliyuncs.com/compatible-mode/v1

### 7.1 与 DeepSeek 完全兼容的部分

千问使用 OpenAI 兼容接口，以下结构与 DeepSeek **完全一致**：

- 顶层结构: `id`, `object`, `created`, `model`, `choices`, `usage`
- `choices[0].message` 字段: `role`, `content`, `tool_calls`, `reasoning_content`
- `finish_reason` 取值: `"stop"`, `"tool_calls"`
- Tool Call 多轮协议: `tool_call_id` 关联方式完全相同
- 思考模式: `reasoning_content` 字段行为一致
- 流式 delta: `reasoning_content` → `content` 切换逻辑一致

### 7.2 关键差异

| 特性 | DeepSeek (deepseek-chat) | 千问 (qwen-plus) |
|---|---|---|
| **Base URL** | `https://api.deepseek.com` | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| **思考模式开启方式** | `extra_body={"thinking": {"type": "enabled"}}` | `extra_body={"enable_thinking": True}` |
| **思考模式返回 model** | 自动变为 `"deepseek-reasoner"` | 保持 `"qwen-plus"` 不变 |
| **system_fingerprint** | 有值 (如 `fp_eaab8d114b_...`) | `null` |
| **id 格式** | UUID (如 `10a6ef37-f654-...`) | `chatcmpl-` 前缀 (如 `chatcmpl-e30fc25f-...`) |
| **流式 usage 位置** | 在最后一个 chunk（含 `finish_reason: "stop"`）中 | **单独的额外 chunk**（`choices: []`，仅含 `usage`）★ |
| **流式 usage 需要** | 默认包含 | 需 `stream_options={"include_usage": True}` |
| **usage.prompt_cache_hit_tokens** | 有（硬盘缓存） | 无此字段 |
| **usage.prompt_cache_miss_tokens** | 有 | 无此字段 |
| **usage.prompt_tokens_details.cached_tokens** | 有 | 有，但始终为 0 |
| **tool_call id 长度** | 较长 (`call_00_Uzeq9r2a58anyxNz91WBM14t`) | 较短 (`call_c64a6f29e4d241048670e5`) |

### 7.3 千问 usage 结构

```json
// 普通模式
{
  "completion_tokens": 58,
  "prompt_tokens": 27,
  "total_tokens": 85,
  "completion_tokens_details": null,        // 普通模式为 null
  "prompt_tokens_details": {
    "audio_tokens": null,
    "cached_tokens": 0
  }
  // 注意：没有 prompt_cache_hit_tokens / prompt_cache_miss_tokens
}

// 思考模式
{
  "completion_tokens": 3382,
  "prompt_tokens": 23,
  "total_tokens": 3405,
  "completion_tokens_details": {
    "accepted_prediction_tokens": null,
    "audio_tokens": null,
    "reasoning_tokens": 2524,               // ★ 推理 token 数
    "rejected_prediction_tokens": null
  },
  "prompt_tokens_details": {
    "audio_tokens": null,
    "cached_tokens": 0
  }
}
```

### 7.4 千问流式 usage 的特殊处理

千问的流式输出中，usage 在一个**独立的 chunk** 中返回（`choices` 为空数组）：

```json
// 千问: 最后一个 chunk (usage-only)
{
  "id": "chatcmpl-...",
  "choices": [],                    // ★ 空数组！
  "model": "qwen-plus",
  "object": "chat.completion.chunk",
  "usage": {
    "completion_tokens": 64,
    "prompt_tokens": 25,
    "total_tokens": 89
  }
}
```

**后端适配逻辑:**
```python
for chunk in response:
    if chunk.choices:
        # 处理 delta (content / reasoning_content / tool_calls)
        delta = chunk.choices[0].delta
        ...
    elif chunk.usage:
        # ★ 千问: usage 在单独的 chunk 中
        # DeepSeek: usage 在最后一个有 finish_reason 的 chunk 中
        handle_usage(chunk.usage)
```

### 7.5 后端 Provider 抽象建议

```python
class LLMProviderConfig:
    """统一的 Provider 配置"""
    name: str                          # "deepseek" | "qwen"
    api_key: str
    base_url: str
    model: str                         # "deepseek-chat" | "qwen-plus"
    thinking_param: dict               # 思考模式参数差异
    stream_options: dict | None        # 千问需要 {"include_usage": True}

# DeepSeek
deepseek_config = LLMProviderConfig(
    name="deepseek",
    base_url="https://api.deepseek.com",
    model="deepseek-chat",
    thinking_param={"thinking": {"type": "enabled"}},
    stream_options=None,               # 默认包含 usage
)

# 千问
qwen_config = LLMProviderConfig(
    name="qwen",
    base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
    model="qwen-plus",
    thinking_param={"enable_thinking": True},
    stream_options={"include_usage": True},
)
```

---

## 8. 跨模型兼容性总结（前端无需关心的差异）

后端应屏蔽以下差异，前端只接收统一的 SSE 事件：

| 后端负责适配 | 前端统一接收 |
|---|---|
| 不同的 `base_url` | 统一的 `/api/v1/chat/completions` |
| 不同的思考模式参数 | 统一的 `thinking: boolean` |
| 流式 usage 位置差异 | 统一的 `type: "usage"` 事件 |
| `prompt_cache_*` 差异 | 统一的 `usage` 对象 |
| model 名称变化 (deepseek-reasoner) | 统一的 `model` 字段 |
| `stream_options` 差异 | 后端自动处理 |
