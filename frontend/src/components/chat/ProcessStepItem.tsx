import { useState } from 'react'
import {
  Brain, Wrench, Code, CheckCircle, BarChart3, BookOpen, Archive,
  Loader2, XCircle, ChevronDown,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ProcessStep } from '@/types'

interface ProcessStepItemProps {
  step: ProcessStep
  isLast: boolean
}

const typeIcons: Record<ProcessStep['type'], LucideIcon> = {
  reasoning: Brain,
  tool_call: Wrench,
  tool_result: CheckCircle,
  sql_generated: Code,
  sql_result: CheckCircle,
  chart_config: BarChart3,
  rag_source: BookOpen,
  context_compressed: Archive,
}

export default function ProcessStepItem({ step, isLast }: ProcessStepItemProps) {
  const [expanded, setExpanded] = useState(false)
  const Icon = typeIcons[step.type] || Brain
  const elapsed = step.endTime ? step.endTime - step.startTime : null

  return (
    <div className="relative flex gap-3">
      {/* timeline connector */}
      <div className="flex flex-col items-center">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
          step.status === 'running'
            ? 'bg-amber-100 dark:bg-amber-900/30'
            : step.status === 'success'
            ? 'bg-emerald-100 dark:bg-emerald-900/30'
            : 'bg-red-100 dark:bg-red-900/30'
        }`}>
          {step.status === 'running' ? (
            <Loader2 size={14} className="text-amber-500 animate-spin" />
          ) : step.status === 'success' ? (
            <Icon size={14} className="text-emerald-500" />
          ) : (
            <XCircle size={14} className="text-red-500" />
          )}
        </div>
        {!isLast && (
          <div className="w-px flex-1 min-h-[20px] bg-slate-200 dark:bg-slate-700" />
        )}
      </div>

      {/* content */}
      <div className="flex-1 pb-4 min-w-0">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center gap-2 text-left group"
        >
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200 group-hover:text-primary transition-colors">
            {step.title}
          </span>
          {elapsed !== null && (
            <span className="text-[10px] text-slate-400 font-mono shrink-0">
              {elapsed}ms
            </span>
          )}
          <ChevronDown
            size={14}
            className={`text-slate-400 ml-auto shrink-0 transition-transform duration-200 ${
              expanded ? 'rotate-180' : ''
            }`}
          />
        </button>

        {expanded && (
          <div className="mt-2 text-xs animate-fade-in">
            <StepDetail step={step} />
          </div>
        )}
      </div>
    </div>
  )
}

function StepDetail({ step }: { step: ProcessStep }) {
  const { type, data } = step
  if (!data) return <span className="text-slate-400">无详细信息</span>

  switch (type) {
    case 'sql_generated':
      return (
        <pre className="bg-slate-900 text-emerald-300 p-3 rounded-xl text-[11px] leading-relaxed overflow-x-auto font-mono whitespace-pre-wrap">
          {data.sql}
        </pre>
      )

    case 'sql_result':
      return (
        <div className="space-y-2">
          <div className="flex gap-3 text-slate-500 dark:text-slate-400">
            <span>{data.rowCount} 行</span>
            <span>{data.executionMs}ms</span>
          </div>
          {data.preview && data.preview.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800">
                    {Object.keys(data.preview[0]).map((k) => (
                      <th key={k} className="px-3 py-1.5 text-left font-semibold text-slate-500 dark:text-slate-400">
                        {k}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.preview.slice(0, 3).map((row: Record<string, any>, i: number) => (
                    <tr key={i} className="border-t border-slate-100 dark:border-slate-700">
                      {Object.values(row).map((v, j) => (
                        <td key={j} className="px-3 py-1.5 text-slate-600 dark:text-slate-300">
                          {String(v)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )

    case 'chart_config':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 text-primary rounded-lg font-medium">
          <BarChart3 size={12} />
          {data.chartType}
          {data.recommended && <span className="text-[9px] opacity-70">推荐</span>}
        </span>
      )

    case 'tool_call':
      return (
        <div className="text-slate-500 dark:text-slate-400 space-y-0.5">
          <div>工具: <span className="font-mono text-slate-700 dark:text-slate-200">{data.tool}</span></div>
          {data.table && <div>表: <span className="font-mono text-slate-700 dark:text-slate-200">{data.table}</span></div>}
        </div>
      )

    case 'rag_source':
      return (
        <div className="space-y-1">
          {data.sources?.map((s: { title: string; score: number }, i: number) => (
            <div key={i} className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
              <BookOpen size={12} />
              <span className="text-slate-700 dark:text-slate-200">{s.title}</span>
              <span className="ml-auto font-mono text-emerald-500">{(s.score * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      )

    default:
      return (
        <pre className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl text-[11px] text-slate-600 dark:text-slate-300 overflow-x-auto whitespace-pre-wrap">
          {JSON.stringify(data, null, 2)}
        </pre>
      )
  }
}
