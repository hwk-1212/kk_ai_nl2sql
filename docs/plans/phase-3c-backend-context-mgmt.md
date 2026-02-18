# Phase 3-C: 后端 — 上下文管理

## 目标

实现 Token 计算器、上下文管理器、上下文摘要压缩器。当对话上下文 token 数达到模型上限的 60% 时，自动将旧消息压缩为摘要，保留最近对话原文。

---

## 前置条件

- Phase 3-B NL2SQL 工具集已完成 (工具调用结果也参与上下文)
- 现有 chat.py 中的 `_build_messages` 逻辑可用

---

## 3C.1 Token 计算器

**文件**: `backend/app/core/context/token_counter.py`

```python
class TokenCounter:
    """Token 计数器 — 支持多模型"""

    MODEL_ENCODING = {
        "deepseek-chat": "cl100k_base",   # OpenAI 兼容编码
        "deepseek-reasoner": "cl100k_base",
        "qwen-plus": "cl100k_base",
    }

    def __init__(self):
        self._encoders = {}  # 延迟加载编码器

    def count(self, text: str, model: str = "deepseek-chat") -> int:
        """计算文本的 token 数"""
        encoder = self._get_encoder(model)
        return len(encoder.encode(text))

    def count_messages(self, messages: list[dict], model: str) -> int:
        """
        计算消息列表的总 token 数
        每条消息额外 +4 tokens (role + 分隔符开销)
        """
        total = 0
        for msg in messages:
            total += 4  # message overhead
            total += self.count(msg.get("content", ""), model)
            if msg.get("role"):
                total += 1
        total += 2  # final assistant prompt overhead
        return total
```

> **技术决策**: 使用 `tiktoken` 的 `cl100k_base` 编码，对 DeepSeek/Qwen 为近似值（误差 ±5%），但性能优秀且无需额外依赖。

---

## 3C.2 上下文摘要器

**文件**: `backend/app/core/context/summarizer.py`

```python
class ContextSummarizer:
    """对话历史摘要压缩器 — 使用 LLM 生成摘要"""

    SUMMARIZE_PROMPT = """请将以下对话历史压缩为一段简洁的摘要。
保留关键信息：用户意图、重要数据发现、查询结果要点、用户偏好。
不要遗漏任何重要的数据分析结论或业务发现。

对话历史:
{conversation_text}

请用第三人称描述，输出简洁的摘要:"""

    async def summarize(
        self, messages: list[dict], llm_router, model: str
    ) -> str:
        """
        将多条消息压缩为一条摘要文本
        使用当前模型的非流式调用生成摘要
        """
```

---

## 3C.3 上下文管理器

**文件**: `backend/app/core/context/manager.py`

```python
class ContextManager:
    """上下文管理器 — 自动控制对话窗口大小"""

    MAX_TOKENS = {
        "deepseek-chat": 64000,
        "deepseek-reasoner": 64000,
        "qwen-plus": 128000,
    }
    COMPRESS_THRESHOLD = 0.6      # 60% 触发压缩
    KEEP_RECENT_ROUNDS = 6        # 压缩后保留最近 6 轮
    MIN_MESSAGES_TO_COMPRESS = 10  # 至少 10 条消息才触发压缩

    def __init__(self, token_counter: TokenCounter, summarizer: ContextSummarizer):
        self.counter = token_counter
        self.summarizer = summarizer

    async def build_messages(
        self,
        system_prompt: str,
        history_messages: list[dict],
        user_input: str,
        model: str,
        llm_router = None,
        tool_definitions: list[dict] | None = None,
    ) -> tuple[list[dict], bool]:
        """
        构建最终发送给 LLM 的消息列表

        返回: (messages, was_compressed)

        流程:
        1. 组装完整消息列表: system + history + user_input
        2. 计算总 token 数
        3. 若超过阈值 → 压缩旧消息
        4. 确保 tool_definitions 的 token 开销也计入
        """
        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(history_messages)
        messages.append({"role": "user", "content": user_input})

        total_tokens = self.counter.count_messages(messages, model)
        max_tokens = self.MAX_TOKENS.get(model, 64000)

        # 工具定义也占用 token
        if tool_definitions:
            tool_tokens = self.counter.count(str(tool_definitions), model)
            total_tokens += tool_tokens

        was_compressed = False
        if (total_tokens > max_tokens * self.COMPRESS_THRESHOLD
                and len(history_messages) >= self.MIN_MESSAGES_TO_COMPRESS):
            messages = await self._compress(
                system_prompt, history_messages, user_input, model, llm_router
            )
            was_compressed = True

        return messages, was_compressed

    async def _compress(
        self, system_prompt, history, user_input, model, llm_router
    ) -> list[dict]:
        """
        压缩策略:
        1. 保留 system prompt
        2. 将旧消息 (除最近 N 轮) 通过 LLM 压缩为一条摘要
        3. 保留最近 KEEP_RECENT_ROUNDS 轮对话原文
        4. 拼接: system + 摘要消息 + 最近 N 轮 + 当前 user_input
        """
        keep_count = self.KEEP_RECENT_ROUNDS * 2  # 每轮 = user + assistant
        old_messages = history[:-keep_count] if len(history) > keep_count else []
        recent_messages = history[-keep_count:] if len(history) > keep_count else history

        if old_messages:
            summary = await self.summarizer.summarize(old_messages, llm_router, model)
            summary_msg = {
                "role": "system",
                "content": f"[上下文摘要] 以下是之前对话的摘要:\n{summary}"
            }
            return [
                {"role": "system", "content": system_prompt},
                summary_msg,
                *recent_messages,
                {"role": "user", "content": user_input},
            ]
        else:
            return [
                {"role": "system", "content": system_prompt},
                *recent_messages,
                {"role": "user", "content": user_input},
            ]
```

---

## 3C.4 集成到对话流

**修改文件**: `backend/app/api/v1/chat.py`

替换现有的 `_build_messages` 函数:

```python
# 现有: 手动拼接最近 20 条消息
# 改为: 通过 ContextManager 自动管理

context_manager = app.state.context_manager
messages, was_compressed = await context_manager.build_messages(
    system_prompt=system_prompt,
    history_messages=history,
    user_input=user_message,
    model=model_id,
    llm_router=llm_router,
    tool_definitions=openai_tools,
)

if was_compressed:
    # SSE 通知前端上下文已压缩
    yield sse_event("context_compressed", {
        "original_tokens": original_count,
        "compressed_tokens": compressed_count,
    })
```

---

## 3C.5 初始化

**修改文件**: `backend/app/main.py`

```python
from app.core.context.token_counter import TokenCounter
from app.core.context.summarizer import ContextSummarizer
from app.core.context.manager import ContextManager

token_counter = TokenCounter()
summarizer = ContextSummarizer()
context_manager = ContextManager(token_counter, summarizer)
app.state.context_manager = context_manager
```

---

## 任务清单

- [ ] 实现 TokenCounter (tiktoken 编码 + 消息列表计数)
- [ ] 实现 ContextSummarizer (LLM 驱动摘要)
- [ ] 实现 ContextManager (阈值检测 + 压缩策略)
- [ ] 集成到 chat.py 对话流
- [ ] 初始化到 main.py
- [ ] SSE context_compressed 事件
- [ ] 单元测试: token 计数准确性
- [ ] 集成测试: 长对话自动压缩
- [ ] 验证通过

---

## 验证标准

- [ ] TokenCounter 计数结果与 tiktoken 直接调用一致
- [ ] 10 轮以下短对话: 不触发压缩
- [ ] 20+ 轮长对话: 自动触发压缩，最近 6 轮保留原文
- [ ] 压缩后的消息列表 token 数 < 60% 阈值
- [ ] 摘要内容包含关键信息 (数据发现、查询结论)
- [ ] SSE 推送 context_compressed 事件
- [ ] 压缩后对话仍然连贯 (LLM 能基于摘要继续回答)
- [ ] 工具定义 token 开销被正确计入
- [ ] 性能: 单次 token 计算 < 10ms

---

## 新增/修改文件列表

### 新增/完善

| 文件 | 说明 |
|------|------|
| `app/core/context/token_counter.py` | 完整实现 Token 计算器 |
| `app/core/context/summarizer.py` | 完整实现上下文摘要器 |
| `app/core/context/manager.py` | 完整实现上下文管理器 |

### 修改

| 文件 | 变更 |
|------|------|
| `app/api/v1/chat.py` | 替换 _build_messages → ContextManager |
| `app/main.py` | 初始化 ContextManager |
