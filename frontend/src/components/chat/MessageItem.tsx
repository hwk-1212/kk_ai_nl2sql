import { memo, useState } from 'react'
import { Copy, Check, RefreshCw, User, Sparkles, ThumbsUp } from 'lucide-react'
import type { Message, ChartConfig } from '@/types'
import MarkdownContent from './MarkdownContent'
import ThinkingBlock from '@/components/deepseek/ThinkingBlock'
import StreamingIndicator from '@/components/deepseek/StreamingIndicator'
import ToolCallBlock from '@/components/tools/ToolCallBlock'
import MemoryIndicator from '@/components/tools/MemoryIndicator'
import RAGSourceIndicator from '@/components/tools/RAGSourceIndicator'
import ChartRenderer from '@/components/chart/ChartRenderer'
import ChartTypeSelector from '@/components/chart/ChartTypeSelector'
import { modelOptions } from '@/mocks/models'

interface MessageItemProps {
  message: Message
  isStreamingContent?: string
  isStreamingReasoning?: string
  onRegenerate?: (id: string) => void
}

const AVAILABLE_CHART_TYPES = ['bar', 'line', 'pie', 'area', 'scatter', 'table']

export default memo(function MessageItem({
  message,
  isStreamingContent,
  isStreamingReasoning,
  onRegenerate,
}: MessageItemProps) {
  const [copied, setCopied] = useState(false)
  const [chartType, setChartType] = useState<string | null>(null)
  const isUser = message.role === 'user'
  const isStreaming = !!isStreamingContent || (!!isStreamingReasoning && !isStreamingContent)

  const displayContent = isStreamingContent || message.content
  const displayReasoning = isStreamingReasoning || message.reasoning

  const handleCopy = () => {
    navigator.clipboard.writeText(displayContent || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const modelInfo = message.model ? modelOptions.find((m) => m.id === message.model) : null

  return (
    <div className="flex gap-5 animate-fade-in">
      {/* avatar */}
      <div className={`shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm ${
        isUser
          ? 'bg-user-bubble'
          : 'btn-gradient shadow-lg shadow-primary/20'
      }`}>
        {isUser
          ? <User size={18} className="text-azure" />
          : <Sparkles size={18} className="text-white" />
        }
      </div>

      {/* content */}
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm text-slate-800 dark:text-white">
            {isUser ? '你' : 'KK Intelligence'}
          </span>
          {!isUser && modelInfo && (
            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-[9px] font-bold text-slate-500 dark:text-slate-400 rounded-lg uppercase tracking-wider">
              {modelInfo.label}
            </span>
          )}
          {isStreaming && !isUser && (
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              处理中
            </span>
          )}
        </div>

        {/* memories */}
        {message.memories && message.memories.length > 0 && (
          <MemoryIndicator memories={message.memories} />
        )}

        {/* RAG sources */}
        {message.ragSources && message.ragSources.length > 0 && (
          <RAGSourceIndicator sources={message.ragSources} />
        )}

        {/* thinking */}
        {displayReasoning && (
          <ThinkingBlock
            reasoning={displayReasoning}
            isStreaming={isStreaming && !isStreamingContent}
          />
        )}

        {/* tool calls */}
        {message.toolCalls?.map((tc) => (
          <ToolCallBlock key={tc.id} toolCall={tc} />
        ))}

        {/* main content */}
        {isUser ? (
          <div className="bg-user-bubble dark:bg-slate-700 px-6 py-4 rounded-3xl rounded-tl-none text-slate-700 dark:text-slate-200 leading-relaxed shadow-sm">
            {displayContent}
          </div>
        ) : displayContent ? (
          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-3xl p-6 shadow-soft text-slate-700 dark:text-slate-200 leading-relaxed">
            <MarkdownContent content={displayContent} />
            {isStreaming && <StreamingIndicator />}
          </div>
        ) : isStreaming && displayReasoning ? (
          <div className="text-sm text-slate-400 italic">正在组织回答...</div>
        ) : null}

        {/* chart */}
        {!isUser && message.chartConfig && (
          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-3xl p-5 shadow-soft space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {message.chartConfig.title || '数据图表'}
              </h4>
              <ChartTypeSelector
                currentType={chartType || message.chartConfig.chartType}
                availableTypes={AVAILABLE_CHART_TYPES}
                onChange={setChartType}
              />
            </div>
            <ChartRenderer
              config={{ ...message.chartConfig, chartType: (chartType || message.chartConfig.chartType) as ChartConfig['chartType'] }}
              height={280}
            />
          </div>
        )}

        {/* actions bar */}
        {!isUser && !isStreaming && displayContent && (
          <div className="flex items-center gap-1 pt-1">
            <button
              onClick={handleCopy}
              className="p-2 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-colors text-slate-300 dark:text-slate-500 hover:text-primary"
              title={copied ? '已复制' : '复制'}
            >
              {copied ? <Check size={16} className="text-primary" /> : <Copy size={16} />}
            </button>
            <button className="p-2 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-colors text-slate-300 dark:text-slate-500 hover:text-primary" title="有帮助">
              <ThumbsUp size={16} />
            </button>
            {onRegenerate && (
              <button
                onClick={() => onRegenerate(message.id)}
                className="p-2 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-colors text-slate-300 dark:text-slate-500 hover:text-primary"
                title="重新生成"
              >
                <RefreshCw size={16} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
})
