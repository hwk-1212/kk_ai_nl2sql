import { useState } from 'react'
import { ChevronDown, ChevronRight, CheckCircle } from 'lucide-react'

interface ThinkingBlockProps {
  reasoning: string
  isStreaming?: boolean
  thinkingTime?: number
}

export default function ThinkingBlock({ reasoning, isStreaming }: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(true)

  if (!reasoning) return null

  // split reasoning into steps
  const steps = reasoning
    .split('\n')
    .filter((line) => line.trim())
    .reduce<string[]>((acc, line) => {
      if (line.match(/^\d+\./) || line.match(/^-\s/) || line.match(/^[•·]\s/) || acc.length === 0) {
        acc.push(line)
      } else {
        acc[acc.length - 1] += '\n' + line
      }
      return acc
    }, [])

  return (
    <div className="border border-slate-100 dark:border-slate-700 rounded-3xl bg-white dark:bg-slate-800 shadow-soft overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50/50 dark:hover:bg-slate-700/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-primary text-2xl">🧠</span>
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
            推理过程
          </span>
          {isStreaming && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-primary uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              推理中
            </span>
          )}
        </div>
        {expanded ? <ChevronDown size={16} className="text-slate-300" /> : <ChevronRight size={16} className="text-slate-300" />}
      </button>

      {expanded && (
        <div className="px-6 pb-6 pt-2">
          <div className="space-y-4 text-sm leading-relaxed">
            {steps.map((step, i) => (
              <div key={i} className="relative pl-8 thought-step-line">
                {isStreaming && i === steps.length - 1 ? (
                  <span className="absolute left-0 top-0.5 w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                ) : (
                  <CheckCircle size={20} className="absolute left-0 top-0.5 text-primary" />
                )}
                <div className={`${isStreaming && i === steps.length - 1 ? 'text-slate-800 dark:text-white font-medium' : 'text-slate-500 dark:text-slate-400'}`}>
                  {step}
                  {isStreaming && i === steps.length - 1 && (
                    <span className="inline-block w-0.5 h-4 bg-primary ml-0.5 animate-cursor-blink" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
