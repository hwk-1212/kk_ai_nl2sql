import type { ModelOption } from '@/types'

export const modelOptions: ModelOption[] = [
  {
    id: 'deepseek-chat',
    name: 'DeepSeek V3.2',
    label: 'DeepSeek',
    description: 'DeepSeek v3.2 混合推理模型，支持普通对话和深度推理',
    supportsThinking: true,
  },
  {
    id: 'qwen-plus',
    name: '千问 Plus',
    label: '千问',
    description: '阿里千问 Plus 模型，支持普通对话和深度推理',
    supportsThinking: true,
  },
]
