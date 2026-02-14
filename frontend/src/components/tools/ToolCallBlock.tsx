import { useState } from 'react'
import { Wrench, ChevronDown, ChevronRight, Loader2, CheckCircle, XCircle } from 'lucide-react'
import type { ToolCall } from '@/types'

interface ToolCallBlockProps {
  toolCall: ToolCall
}

const statusConfig = {
  calling: { icon: Loader2, color: 'text-blue-400', label: '调用中...' },
  success: { icon: CheckCircle, color: 'text-green-400', label: '调用成功' },
  error: { icon: XCircle, color: 'text-red-400', label: '调用失败' },
}

export default function ToolCallBlock({ toolCall }: ToolCallBlockProps) {
  const [expanded, setExpanded] = useState(false)
  const config = statusConfig[toolCall.status]
  const StatusIcon = config.icon

  return (
    <div className="my-2 rounded-lg border border-light-border dark:border-dark-border overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-light-hover dark:hover:bg-dark-hover transition"
      >
        <Wrench size={14} className="text-light-muted dark:text-dark-muted shrink-0" />
        <span className="font-medium text-light-text dark:text-dark-text">{toolCall.name}</span>
        <StatusIcon size={14} className={`${config.color} ${toolCall.status === 'calling' ? 'animate-spin' : ''}`} />
        <span className={`text-xs ${config.color}`}>{config.label}</span>
        <span className="ml-auto">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-2 border-t border-light-border dark:border-dark-border pt-2">
          <div>
            <span className="text-xs font-medium text-light-muted dark:text-dark-muted">参数</span>
            <pre className="mt-1 text-xs bg-light-hover dark:bg-dark-hover rounded p-2 overflow-x-auto text-light-text dark:text-dark-text">
              {JSON.stringify(toolCall.arguments, null, 2)}
            </pre>
          </div>
          {toolCall.result && (
            <div>
              <span className="text-xs font-medium text-green-400">结果</span>
              <pre className="mt-1 text-xs bg-green-500/5 rounded p-2 overflow-x-auto text-light-text dark:text-dark-text">
                {toolCall.result}
              </pre>
            </div>
          )}
          {toolCall.error && (
            <div>
              <span className="text-xs font-medium text-red-400">错误</span>
              <pre className="mt-1 text-xs bg-red-500/5 rounded p-2 overflow-x-auto text-red-400">
                {toolCall.error}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
