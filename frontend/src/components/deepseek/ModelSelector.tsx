import { useChatStore } from '@/stores/chatStore'
import { Brain, Zap, MessageSquare } from 'lucide-react'
import type { ModelId } from '@/types'

export default function ModelSelector() {
  const { selectedModel, setSelectedModel, thinkingEnabled, setThinkingEnabled } = useChatStore()

  const models: { id: ModelId; icon: typeof Brain; label: string }[] = [
    { id: 'deepseek-chat', icon: Zap, label: 'DeepSeek' },
    { id: 'qwen-plus', icon: MessageSquare, label: '千问' },
  ]

  return (
    <div className="flex items-center gap-3">
      {/* 模型选择 */}
      <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl">
        {models.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setSelectedModel(id)}
            className={`px-5 py-2 text-xs font-bold rounded-xl flex items-center gap-2 transition-all ${
              selectedModel === id
                ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            {selectedModel === id && <Icon size={14} />}
            {label}
          </button>
        ))}
      </div>

      {/* 思考模式开关 */}
      <button
        onClick={() => setThinkingEnabled(!thinkingEnabled)}
        className={`px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-2 transition-all ${
          thinkingEnabled
            ? 'bg-primary/10 text-primary border border-primary/30'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800'
        }`}
      >
        <Brain size={14} />
        深度思考
      </button>
    </div>
  )
}
