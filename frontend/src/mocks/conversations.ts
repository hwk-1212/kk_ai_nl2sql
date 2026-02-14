import type { Conversation } from '@/types'

export const mockConversations: Conversation[] = [
  {
    id: 'conv-001',
    title: 'FastAPI 项目架构设计',
    model: 'deepseek-chat',
    createdAt: '2026-02-10T10:00:00Z',
    updatedAt: '2026-02-10T10:05:00Z',
    messages: [
      {
        id: 'msg-001',
        role: 'user',
        content: '帮我设计一个 FastAPI 项目的目录结构，要求支持多模块、数据库迁移和测试',
        createdAt: '2026-02-10T10:00:00Z',
      },
      {
        id: 'msg-002',
        role: 'assistant',
        content: `好的，这是一个推荐的 FastAPI 项目结构：

\`\`\`
backend/
├── app/
│   ├── __init__.py
│   ├── main.py           # FastAPI 入口
│   ├── config.py          # 配置管理
│   ├── api/
│   │   └── v1/
│   │       ├── auth.py
│   │       └── chat.py
│   ├── models/            # SQLAlchemy 模型
│   ├── schemas/           # Pydantic 模型
│   ├── services/          # 业务逻辑
│   └── db/
│       └── session.py
├── alembic/               # 数据库迁移
├── tests/
└── requirements.txt
\`\`\`

**关键设计原则**：

1. **分层架构** — API → Service → Repository
2. **依赖注入** — 使用 FastAPI 的 \`Depends\` 
3. **异步优先** — 全链路 async/await`,
        model: 'deepseek-chat',
        createdAt: '2026-02-10T10:00:30Z',
      },
    ],
  },
  {
    id: 'conv-002',
    title: '量子计算入门解释',
    model: 'deepseek-chat',
    createdAt: '2026-02-09T15:00:00Z',
    updatedAt: '2026-02-09T15:03:00Z',
    messages: [
      {
        id: 'msg-003',
        role: 'user',
        content: '用通俗的方式解释量子计算的基本原理',
        createdAt: '2026-02-09T15:00:00Z',
      },
      {
        id: 'msg-004',
        role: 'assistant',
        content: `量子计算利用**量子叠加**和**量子纠缠**来进行计算。

## 核心概念

| 经典计算 | 量子计算 |
|---------|---------|
| 比特 (0 或 1) | 量子比特 (同时 0 和 1) |
| 串行处理 | 并行处理 |
| 确定性 | 概率性 |

### 量子叠加

> 想象你抛一枚硬币，在落地之前它**同时是正面和反面**。

量子比特 (qubit) 就是这样 — 它可以同时处于 $|0\\rangle$ 和 $|1\\rangle$ 的叠加态：

$$|\\psi\\rangle = \\alpha|0\\rangle + \\beta|1\\rangle$$

其中 $|\\alpha|^2 + |\\beta|^2 = 1$。`,
        reasoning: `用户要求通俗解释量子计算，需要:
1. 避免过于学术的表述
2. 使用类比帮助理解
3. 关键数学公式可以保留但要简化
4. 按照 叠加 → 纠缠 → 优势 的逻辑展开
5. 加入表格对比更直观

先从经典和量子的对比入手，这样最容易建立认知框架...`,
        model: 'deepseek-chat',
        createdAt: '2026-02-09T15:01:00Z',
      },
    ],
  },
  {
    id: 'conv-003',
    title: 'Python 性能优化技巧',
    model: 'deepseek-chat',
    createdAt: '2026-02-08T09:00:00Z',
    updatedAt: '2026-02-08T09:02:00Z',
    messages: [],
  },
  {
    id: 'conv-004',
    title: 'Docker Compose 网络配置',
    model: 'deepseek-chat',
    createdAt: '2026-02-07T14:00:00Z',
    updatedAt: '2026-02-07T14:05:00Z',
    messages: [],
  },
  {
    id: 'conv-005',
    title: 'React Hooks 最佳实践',
    model: 'deepseek-chat',
    createdAt: '2026-02-06T11:00:00Z',
    updatedAt: '2026-02-06T11:10:00Z',
    messages: [],
  },
]
