import { useState } from 'react'
import { BookOpen, ChevronDown, ChevronRight } from 'lucide-react'
import type { RAGSource } from '@/types'

interface RAGSourceIndicatorProps {
  sources: RAGSource[]
}

export default function RAGSourceIndicator({ sources }: RAGSourceIndicatorProps) {
  const [expanded, setExpanded] = useState(false)

  if (!sources.length) return null

  return (
    <div className="mb-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs bg-primary/10 text-primary hover:bg-primary/20 transition"
      >
        <BookOpen size={12} />
        <span>引用 {sources.length} 个知识片段</span>
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>

      {expanded && (
        <div className="mt-1 space-y-1">
          {sources.map((s, i) => (
            <div
              key={i}
              className="px-3 py-2 rounded-lg bg-primary/5 border border-primary/10 text-xs text-light-muted dark:text-dark-muted"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-primary">相关度 {(s.score * 100).toFixed(0)}%</span>
                {s.source && (
                  <span className="text-light-muted/60 dark:text-dark-muted/60 truncate max-w-[200px]" title={s.source}>· {s.source}</span>
                )}
                {s.page && (
                  <span className="text-light-muted/60 dark:text-dark-muted/60">第{s.page}页</span>
                )}
              </div>
              <div className="line-clamp-3">{s.content}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
