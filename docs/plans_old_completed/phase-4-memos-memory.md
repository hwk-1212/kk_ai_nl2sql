# Phase 4: MemOS Cloud 记忆系统

## 状态: ✅ 已完成 (2026-02-11)

## 目标

集成 MemOS Cloud 记忆服务，实现**对话记忆的自动提取、跨会话召回、偏好分析**，增强 LLM 对话的个性化和上下文连贯性。

> MemOS Cloud API: `https://memos.memtensor.cn/api/openmem/v1`
> 认证: `Authorization: Token <API_KEY>`

---

## 4.1 MemOS API 独立测试 ✅ 已完成

### 测试结果 (2026-02-11)

| 测试项 | 状态 | 耗时 | 备注 |
|---|---|---|---|
| 添加记忆 (add/message) | ✅ | ~460ms | 异步，返回 task_id |
| 检索记忆 (search/memory) | ✅ | ~800ms | 返回事实+偏好+note |
| 对话中使用记忆 | ✅ | ~1s | 跨会话召回正常 |
| 用户画像查询 | ✅ | ~1.4s | 通过 search/memory 实现 |
| 过滤器 (create_time/tags) | ✅ | ~960ms | AND 条件正常 |
| 删除记忆 (delete/memory) | ✅ | ~1s | 同步操作 |

### 关键发现

1. **自动记忆提取**: MemOS 接收对话消息后，自动提取事实记忆 + 显式/隐式偏好 + 标签（无需我们用 LLM 做提取）
2. **异步处理**: add/message 返回 `task_id`，后台 3-5 秒完成提取
3. **语义检索**: search/memory 按自然语言 query 搜索，返回带 `relativity` 评分的结果
4. **跨会话召回**: conversation_id 仅提升权重，不限制召回范围
5. **偏好推理**: 自动区分 explicit_preference（用户直接说）和 implicit_preference（行为推断）
6. **preference_note**: 固定约束文本，直接注入 system prompt

> 详细字段文档: `tests/memos/RESPONSE_FIELDS.md`

---

## 4.2 MemOS Client 封装

```python
# app/core/memory/memos_client.py
class MemosClient:
    """MemOS Cloud REST API 异步封装"""

    def __init__(self, api_key: str, base_url: str):
        self.base_url = base_url
        self.headers = {
            "Authorization": f"Token {api_key}",
            "Content-Type": "application/json",
        }
        self.client = httpx.AsyncClient(timeout=10.0)

    async def add_memory(
        self,
        user_id: str,
        conversation_id: str,
        messages: list[dict],  # [{"role": "user", "content": "..."}]
    ) -> dict:
        """
        添加记忆 — 异步操作
        POST /add/message
        返回: {"task_id": "...", "status": "running"}
        """
        ...

    async def search_memory(
        self,
        user_id: str,
        query: str,
        conversation_id: str | None = None,
        filter: dict | None = None,
    ) -> MemorySearchResult:
        """
        检索记忆
        POST /search/memory
        返回: memory_detail_list + preference_detail_list + preference_note
        """
        ...

    async def delete_memory(self, memory_ids: list[str]) -> bool:
        """
        删除记忆
        POST /delete/memory
        """
        ...
```

### MemorySearchResult 类型

```python
class MemoryItem(BaseModel):
    id: str
    memory_key: str             # 记忆标题
    memory_value: str           # 记忆内容摘要
    memory_type: str            # "UserMemory"
    confidence: float           # 0-1 置信度
    tags: list[str]             # 自动提取的标签
    relativity: float           # 0-1 与查询的相关度
    conversation_id: str
    create_time: int            # Unix ms

class PreferenceItem(BaseModel):
    id: str
    preference_type: str        # "explicit_preference" | "implicit_preference"
    preference: str             # 偏好描述
    reasoning: str              # 推理依据
    relativity: float
    conversation_id: str
    create_time: int

class MemorySearchResult(BaseModel):
    memories: list[MemoryItem]
    preferences: list[PreferenceItem]
    preference_note: str        # 系统约束提示 (直接注入 prompt)
```

---

## 4.3 记忆管理器

```python
# app/core/memory/manager.py
class MemoryManager:
    """编排记忆的存储和召回"""

    def __init__(self, memos_client: MemosClient):
        self.client = memos_client

    async def recall(
        self,
        user_id: str,
        query: str,
        conversation_id: str | None = None,
        relativity_threshold: float = 0.3,
    ) -> MemorySearchResult:
        """
        记忆召回 — 用户发送消息后、调用 LLM 前执行
        1. 调用 search/memory
        2. 按 relativity >= threshold 过滤低相关记忆
        3. 返回结构化结果
        """
        result = await self.client.search_memory(
            user_id=user_id,
            query=query,
            conversation_id=conversation_id,
        )
        # 过滤低相关度
        result.memories = [m for m in result.memories if m.relativity >= relativity_threshold]
        return result

    async def save(
        self,
        user_id: str,
        conversation_id: str,
        messages: list[dict],
    ) -> str | None:
        """
        记忆存储 — LLM 回复完成后异步执行
        调用 add/message, MemOS 自动提取事实 + 偏好 + 标签
        返回 task_id
        """
        result = await self.client.add_memory(
            user_id=user_id,
            conversation_id=conversation_id,
            messages=messages,
        )
        return result.get("task_id")

    def build_memory_prompt(self, search_result: MemorySearchResult) -> str:
        """将召回结果格式化为可注入 system prompt 的文本"""
        parts = []

        if search_result.memories:
            parts.append("## 用户相关记忆")
            for m in search_result.memories:
                parts.append(f"- {m.memory_key}: {m.memory_value}")

        if search_result.preferences:
            parts.append("## 用户偏好")
            for p in search_result.preferences:
                label = "显式" if p.preference_type == "explicit_preference" else "隐式"
                parts.append(f"- [{label}] {p.preference}")

        if search_result.preference_note:
            parts.append(search_result.preference_note)

        return "\n".join(parts)
```

> **注意:** 不再需要 LLM 做记忆提取 — MemOS Cloud 内置 AI 自动完成事实提取 + 偏好推理 + 标签生成。

---

## 4.4 集成到对话流

修改 `app/api/v1/chat.py` 的对话主流程:

```python
async def chat_stream(request: ChatRequest, user: User, ...):
    # 1. [新增] 记忆召回 (用户消息 → MemOS 搜索)
    memory_result = await memory_manager.recall(
        user_id=str(user.id),
        query=request.messages[-1].content,
        conversation_id=request.conversation_id,
    )

    # 2. 构建增强 system prompt
    base_prompt = "You are KK GPT AIBot..."
    memory_prompt = memory_manager.build_memory_prompt(memory_result)
    system_msg = {"role": "system", "content": f"{base_prompt}\n\n{memory_prompt}"}

    # 3. SSE 事件: 通知前端使用了哪些记忆
    yield sse_event("memory_recall", {
        "memories": [m.dict() for m in memory_result.memories],
        "preferences_count": len(memory_result.preferences),
    })

    # 4. 加载历史 + LLM 流式调用 + SSE 输出 (existing)
    ...

    # 5. [新增] 流结束后，异步保存本轮对话到记忆
    background_tasks.add_task(
        memory_manager.save,
        user_id=str(user.id),
        conversation_id=conversation_id,
        messages=[
            {"role": "user", "content": user_message},
            {"role": "assistant", "content": assistant_response},
        ],
    )
```

### SSE 新增事件

```
data: {"type":"memory_recall","data":{"memories":[{"memory_key":"广州旅游计划","memory_value":"用户计划暑假去广州...","relativity":0.53}],"preferences_count":2}}
```

---

## 4.5 配置

```python
# app/config.py 新增
MEMOS_API_KEY: str = ""               # MemOS Cloud API Key
MEMOS_BASE_URL: str = "https://memos.memtensor.cn/api/openmem/v1"
MEMORY_RECALL_ENABLED: bool = True     # 记忆召回开关
MEMORY_SAVE_ENABLED: bool = True       # 记忆保存开关
MEMORY_RELATIVITY_THRESHOLD: float = 0.3  # 相关度阈值
```

---

## 4.6 user_id 映射策略

| 系统 | ID | 说明 |
|---|---|---|
| 后端 User | `user.id` (UUID) | PG 数据库主键 |
| MemOS user_id | `str(user.id)` | 直接用 UUID 字符串 |
| MemOS conversation_id | `str(conversation.id)` | 直接用 UUID 字符串 |

> 无需额外映射表，直接复用后端 UUID。

---

## 4.7 前端展示

### MemoryIndicator 组件

- 位于消息气泡上方/旁边
- 显示本次回复使用了几条记忆
- 点击展开显示具体记忆内容和偏好
- `memory_recall` SSE 事件触发渲染

### 记忆管理页面 (可选)

- 查看当前用户的所有记忆
- 手动删除不需要的记忆
- 需要后端提供 `GET /api/v1/memories` 代理接口

---

## 4.8 错误处理与降级

```python
async def recall_with_fallback(memory_manager, user_id, query, conversation_id):
    """记忆召回，MemOS 不可用时降级为无记忆模式"""
    try:
        return await asyncio.wait_for(
            memory_manager.recall(user_id, query, conversation_id),
            timeout=3.0,  # 3秒超时
        )
    except (httpx.HTTPError, asyncio.TimeoutError) as e:
        logger.warning(f"MemOS recall failed, degrading: {e}")
        return MemorySearchResult(memories=[], preferences=[], preference_note="")
```

**核心原则:** MemOS 不可用时不阻塞对话，降级为无记忆模式。

---

## 验证标准

- [x] **4.1 独立测试**: MemOS Cloud API 6 项测试全部通过
- [x] **4.2 Client**: MemosClient 封装 + 类型定义 (`app/core/memory/memos_client.py`)
- [x] **4.3 Manager**: MemoryManager recall / save / build_memory_prompt / to_sse_payload (`app/core/memory/manager.py`)
- [x] **4.4 集成**: 对话流中记忆召回 → prompt 注入 → 异步保存 (`app/api/v1/chat.py`)
- [x] **4.5 SSE**: memory_recall 事件正常推送到前端 (含 memories + preferences)
- [x] **4.6 降级**: MemOS 超时 (3s) / 不可用 → 降级为无记忆模式，不阻塞对话
- [x] **跨会话**: A 会话中的偏好在 B 会话中被成功召回 (已验证: 成都旅游 → 旅游推荐)
- [x] **前端**: MemoryIndicator 组件 + chatStore 适配 memory_recall SSE 事件

---

## 验证结果 (2026-02-11)

| 验证项 | 状态 | 备注 |
|---|---|---|
| MemOS search/memory 调用 | ✅ | 每次对话前自动召回，200 OK |
| MemOS add/message 调用 | ✅ | 流结束后后台异步保存，返回 task_id |
| 记忆注入 system prompt | ✅ | 事实记忆 + 偏好 + preference_note 注入 |
| SSE memory_recall 事件 | ✅ | 包含 memories[] + preferences[] |
| 跨会话召回 | ✅ | 第1轮存"成都+全季"→ 第2轮"旅游推荐"召回 2 条记忆 + 2 条偏好 |
| LLM 基于记忆回答 | ✅ | 回复中体现"根据您的偏好" |
| 降级 (MemOS 不可用) | ✅ | asyncio.wait_for 3s 超时 + 异常捕获 → 空结果 |
| 前端 MemoryIndicator | ✅ | 已有组件，chatStore 适配 memory_recall 事件 |
| 10 容器全部正常 | ✅ | backend healthy，MemOS 日志确认 |

---

## 与原方案的差异

| 原方案 (自部署 Memos) | 现方案 (MemOS Cloud) |
|---|---|
| 自部署 Memos Docker 容器 | MemOS Cloud 在线 API |
| 需要 LLM 提取记忆 | MemOS 内置 AI 自动提取 |
| 手动打标签 (#type:preference) | 自动生成标签 + 偏好分类 |
| 自行实现相关性排序 | 内置 relativity 语义评分 |
| 需要去重逻辑 | MemOS 自动处理 |
| CRUD 操作较多 | 只需 3 个端点 (add/search/delete) |
| 需要 MEMORY_EXTRACTION_PROMPT | 不需要，MemOS 自动完成 |

> MemOS Cloud 大幅简化了记忆系统的实现复杂度。原方案中的 LLM 记忆提取、手动标签、去重、排序等逻辑全部由 MemOS Cloud 内置处理。

---

## 新增/修改文件列表

### 后端 (3 new + 3 modified)

```
backend/app/core/memory/
├── __init__.py              # [NEW] 模块导出
├── memos_client.py          # [NEW] MemOS Cloud 异步客户端 + 类型定义
└── manager.py               # [NEW] 记忆管理器 (recall/save/prompt/sse)

backend/app/
├── config.py                # [MOD] 新增 memos_api_key/url + memory 开关/阈值/超时
├── main.py                  # [MOD] lifespan 初始化 MemosClient + MemoryManager
└── api/v1/chat.py           # [MOD] 集成记忆召回/注入/memory_recall SSE/异步保存
```

### 前端 (2 modified)

```
frontend/src/
├── services/api.ts          # [MOD] 新增 onMemoryRecall 回调 + MemoryRecallPayload 类型
└── stores/chatStore.ts      # [MOD] 捕获 memory_recall → 附加到 assistant 消息 memories 字段
```

### 配置 (1 modified)

```
.env                         # [MOD] 新增 MEMOS_API_KEY/URL + MEMORY_* 开关
```
