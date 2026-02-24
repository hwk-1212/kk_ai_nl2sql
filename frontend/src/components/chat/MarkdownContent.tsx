import { memo, useCallback, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeHighlight from 'rehype-highlight'
import rehypeKatex from 'rehype-katex'
import { Copy, Check } from 'lucide-react'
import ChartRenderer from '@/components/chart/ChartRenderer'
import type { ChartConfig } from '@/types'

const CHART_TYPES = new Set(['bar', 'line', 'area', 'pie', 'scatter', 'table'])

function _tryParseChartConfig(code: string): ChartConfig | null {
  try {
    const raw = JSON.parse(code)
    if (!raw || typeof raw !== 'object') return null
    const chartType = raw.type || raw.chartType
    if (!CHART_TYPES.has(chartType)) return null
    if (!Array.isArray(raw.data) || raw.data.length === 0) return null
    // Build a minimal ChartConfig
    const config: ChartConfig = { chartType, data: raw.data }
    if (raw.title) config.title = String(raw.title)
    const xField = raw.xField || raw.nameField
    if (xField) config.xAxis = { field: String(xField) }
    const yFields: string[] = raw.yFields || (raw.valueField ? [String(raw.valueField)] : [])
    if (yFields.length > 0) {
      config.yAxis = { field: yFields[0] }
      config.series = yFields.map((f, i) => ({
        field: f,
        color: ['#4F46E5','#06B6D4','#10B981','#F59E0B','#EF4444'][i % 5],
      }))
    }
    if (raw.series && Array.isArray(raw.series)) {
      config.series = (raw.series as Record<string, unknown>[]).map((s) => ({
        field: (s.dataKey ?? s.field) as string,
        label: (s.name ?? s.label) as string | undefined,
        color: s.color as string | undefined,
      }))
    }
    if (raw.image_url) config.imageUrl = String(raw.image_url)
    return config
  } catch {
    return null
  }
}

function InlineChart({ config }: { config: ChartConfig }) {
  const imageUrl = config.imageUrl
  if (imageUrl) {
    return (
      <div className="my-4 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
        {config.title && <p className="text-xs font-semibold text-slate-500 mb-2">{config.title}</p>}
        <img src={imageUrl} alt={config.title || '图表'} className="w-full rounded-xl" />
      </div>
    )
  }
  return (
    <div className="my-4 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
      <ChartRenderer config={config} height={260} />
    </div>
  )
}

function CodeBlock({ className, children, ...props }: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false)
  const match = /language-(\w+)/.exec(className || '')
  const lang = match ? match[1] : ''
  const code = String(children).replace(/\n$/, '')

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [code])

  // json code block with valid chart config → render inline chart
  if (lang === 'json') {
    const chartConfig = _tryParseChartConfig(code)
    if (chartConfig) return <InlineChart config={chartConfig} />
  }

  if (!match) {
    return (
      <code className="px-1.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-sm font-mono text-primary-dark" {...props}>
        {children}
      </code>
    )
  }

  return (
    <div className="relative group my-4 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
      <div className="flex items-center justify-between px-4 py-2 bg-white/60 dark:bg-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
        <span>{lang}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          {copied ? <Check size={12} className="text-primary" /> : <Copy size={12} />}
          {copied ? '已复制' : '复制'}
        </button>
      </div>
      <pre className="!m-0 !rounded-none overflow-x-auto text-sm">
        <code className={className} {...props}>
          {children}
        </code>
      </pre>
    </div>
  )
}

function MarkdownLink({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary-dark hover:text-primary hover:underline" {...props}>
      {children}
    </a>
  )
}

interface MarkdownContentProps {
  content: string
}

/**
 * 预处理 LaTeX 公式分隔符 — remark-math 只认 $ 和 $$
 * 将 \[...\] → $$...$$ 和 \(...\) → $...$
 */
function preprocessLatex(raw: string): string {
  // \[...\] → $$...$$  (block math)
  let s = raw.replace(/\\\[(.+?)\\\]/gs, (_m, inner) => `$$${inner}$$`)
  // \(...\) → $...$  (inline math)
  s = s.replace(/\\\((.+?)\\\)/gs, (_m, inner) => `$${inner}$`)
  return s
}

export default memo(function MarkdownContent({ content }: MarkdownContentProps) {
  const processed = preprocessLatex(content)

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none
      prose-headings:text-slate-800 dark:prose-headings:text-white prose-headings:font-bold
      prose-p:text-slate-600 dark:prose-p:text-slate-300 prose-p:leading-relaxed
      prose-li:text-slate-600 dark:prose-li:text-slate-300
      prose-strong:text-slate-800 dark:prose-strong:text-white
      prose-blockquote:border-primary prose-blockquote:bg-primary-50 prose-blockquote:rounded-xl prose-blockquote:py-1 prose-blockquote:px-2
      prose-table:text-sm
      prose-th:bg-slate-50 dark:prose-th:bg-slate-800 prose-th:text-[10px] prose-th:font-black prose-th:uppercase prose-th:tracking-wider prose-th:text-slate-400
      prose-td:border-slate-100 dark:prose-td:border-slate-700
      prose-th:border-slate-100 dark:prose-th:border-slate-700
      prose-th:px-4 prose-th:py-2.5 prose-td:px-4 prose-td:py-2.5
    ">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeHighlight, rehypeKatex]}
        components={{
          code: CodeBlock as any,
          a: MarkdownLink as any,
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  )
})
