import { useState } from 'react'
import { Brain, ChevronDown, ChevronRight } from 'lucide-react'
import type { MemoryFragment } from '@/types'

interface MemoryIndicatorProps {
  memories: MemoryFragment[]
}

export default function MemoryIndicator({ memories }: MemoryIndicatorProps) {
  const [expanded, setExpanded] = useState(false)

  if (!memories.length) return null

  return (
    <div className="mb-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition"
      >
        <Brain size={12} />
        <span>已载入 {memories.length} 条记忆</span>
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>

      {expanded && (
        <div className="mt-1 space-y-1">
          {memories.map((m) => (
            <div
              key={m.id}
              className="px-3 py-2 rounded-lg bg-purple-500/5 border border-purple-500/10 text-xs text-light-muted dark:text-dark-muted"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-purple-400">相关度 {(m.relevance * 100).toFixed(0)}%</span>
                <span className="text-light-muted/60 dark:text-dark-muted/60">· {m.source}</span>
              </div>
              <div>{m.content}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
