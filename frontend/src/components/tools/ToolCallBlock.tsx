import { useState } from 'react'
import { Wrench, Loader2, CheckCircle, XCircle, ChevronRight } from 'lucide-react'
import type { ToolCall } from '@/types'

interface ToolCallBlockProps {
  toolCall: ToolCall
}

const statusConfig = {
  calling: { icon: Loader2, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20', label: '调用中...' },
  success: { icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20', label: '调用成功' },
  error: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20', label: '调用失败' },
}

function _briefResult(tc: ToolCall): string | null {
  if (tc.status === 'calling') return null
  if (tc.error) return tc.error.length > 120 ? tc.error.slice(0, 120) + '…' : tc.error
  if (!tc.result) return null
  const s = tc.result.trim()
  if (s.length <= 200) return s
  return s.slice(0, 200) + '…'
}

function _formatArgs(tc: ToolCall): string {
  try {
    if (typeof tc.arguments === 'string') {
      return JSON.stringify(JSON.parse(tc.arguments), null, 2)
    }
    return JSON.stringify(tc.arguments, null, 2)
  } catch {
    return String(tc.arguments || '')
  }
}

export default function ToolCallBlock({ toolCall }: ToolCallBlockProps) {
  const [expanded, setExpanded] = useState(false)
  const config = statusConfig[toolCall.status]
  const StatusIcon = config.icon
  const brief = _briefResult(toolCall)

  return (
    <div className="my-2 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-800/60 shadow-sm">
      {/* header — always visible */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors text-left"
      >
        <Wrench size={14} className="text-slate-400 shrink-0" />
        <span className="font-semibold text-sm text-slate-700 dark:text-slate-200">{toolCall.name}</span>
        <StatusIcon
          size={14}
          className={`shrink-0 ${config.color} ${toolCall.status === 'calling' ? 'animate-spin' : ''}`}
        />
        <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
        <span className="flex-1" />
        <ChevronRight
          size={14}
          className={`text-slate-400 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
        />
      </button>

      {/* expanded detail */}
      {expanded && (
        <div className="border-t border-slate-100 dark:border-slate-700 px-4 py-3 space-y-3 text-xs">
          {/* params */}
          {toolCall.arguments && (
            <div>
              <p className="font-bold text-slate-500 dark:text-slate-400 mb-1">参数</p>
              <pre className="bg-slate-50 dark:bg-slate-900/40 rounded-lg px-3 py-2 overflow-x-auto text-slate-600 dark:text-slate-300 whitespace-pre-wrap break-all leading-relaxed">
                {_formatArgs(toolCall)}
              </pre>
            </div>
          )}
          {/* result */}
          {brief && (
            <div>
              <p className={`font-bold mb-1 ${toolCall.error ? 'text-red-500' : 'text-emerald-500'}`}>
                {toolCall.error ? '错误' : '结果'}
              </p>
              <pre className="bg-slate-50 dark:bg-slate-900/40 rounded-lg px-3 py-2 overflow-x-auto text-slate-600 dark:text-slate-300 whitespace-pre-wrap break-all leading-relaxed max-h-48 overflow-y-auto">
                {brief}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
