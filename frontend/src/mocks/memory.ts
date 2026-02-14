import type { MemoryFragment } from '@/types'

export const mockMemories: MemoryFragment[] = [
  {
    id: 'mem-001',
    content: '用户偏好 Python 和 FastAPI 技术栈，正在开发企业级 ChatGPT 系统',
    relevance: 0.95,
    source: 'conversation',
    createdAt: '2026-02-10T10:00:00Z',
  },
  {
    id: 'mem-002',
    content: '用户使用 OrbStack 作为 Docker 运行时，macOS 环境',
    relevance: 0.88,
    source: 'conversation',
    createdAt: '2026-02-09T15:00:00Z',
  },
  {
    id: 'mem-003',
    content: '项目使用 DeepSeek 模型，支持推理和对话两种模式',
    relevance: 0.92,
    source: 'system',
    createdAt: '2026-02-08T09:00:00Z',
  },
]
