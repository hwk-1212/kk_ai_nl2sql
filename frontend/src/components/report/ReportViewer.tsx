import { useState, useRef, useCallback, useMemo } from 'react'
import { ArrowLeft, Download, FileText, FileType, FileCode, Pencil } from 'lucide-react'
import type { Report, ReportSection } from '@/types'
import MarkdownContent from '@/components/chat/MarkdownContent'
import ReportOutlineTree from './ReportOutlineTree'

interface ReportViewerProps {
  report: Report
  onBack: () => void
  onEdit: (id: string) => void
}

function sectionsToMarkdown(sections: ReportSection[], depth: number = 1): string {
  return sections.map((s) => {
    const heading = '#'.repeat(depth)
    let md = `${heading} ${s.title}\n\n`
    if (s.content.trim()) md += `${s.content}\n\n`
    if (s.children && s.children.length > 0) {
      md += sectionsToMarkdown(s.children, depth + 1)
    }
    return md
  }).join('')
}

function sectionsToHTML(title: string, sections: ReportSection[], depth: number = 1): string {
  let html = sections.map((s) => {
    const tag = `h${Math.min(depth, 6)}`
    let h = `<${tag}>${escapeHtml(s.title)}</${tag}>\n`
    if (s.content.trim()) {
      const paragraphs = s.content.split('\n\n')
      for (const p of paragraphs) {
        if (p.startsWith('|')) {
          h += markdownTableToHTML(p)
        } else if (p.startsWith('- ') || p.startsWith('* ')) {
          h += '<ul>' + p.split('\n').map((line) => `<li>${escapeHtml(line.replace(/^[-*]\s+/, ''))}</li>`).join('\n') + '</ul>\n'
        } else if (/^\d+\.\s/.test(p)) {
          h += '<ol>' + p.split('\n').map((line) => `<li>${escapeHtml(line.replace(/^\d+\.\s+/, ''))}</li>`).join('\n') + '</ol>\n'
        } else if (p.startsWith('>')) {
          h += `<blockquote>${escapeHtml(p.replace(/^>\s?/gm, ''))}</blockquote>\n`
        } else {
          h += `<p>${boldAndItalic(escapeHtml(p))}</p>\n`
        }
      }
    }
    if (s.children && s.children.length > 0) {
      h += sectionsToHTML(title, s.children, depth + 1)
    }
    return h
  }).join('\n')
  return html
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function boldAndItalic(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
}

function markdownTableToHTML(md: string): string {
  const lines = md.split('\n').filter((l) => l.trim())
  if (lines.length < 2) return `<p>${escapeHtml(md)}</p>`
  const headers = lines[0].split('|').map((c) => c.trim()).filter(Boolean)
  const rows = lines.slice(2).map((line) => line.split('|').map((c) => c.trim()).filter(Boolean))
  let html = '<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;margin:8px 0">'
  html += '<thead><tr>' + headers.map((h) => `<th style="background:#f5f5f5;text-align:left;padding:8px">${escapeHtml(h)}</th>`).join('') + '</tr></thead>'
  html += '<tbody>' + rows.map((row) => '<tr>' + row.map((c) => `<td style="padding:8px">${boldAndItalic(escapeHtml(c))}</td>`).join('') + '</tr>').join('') + '</tbody>'
  html += '</table>'
  return html
}

function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function ReportViewer({ report, onBack, onEdit }: ReportViewerProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const sections = report.sections ?? []

  const fullMarkdown = useMemo(() => {
    if (sections.length === 0) return report.content ?? ''
    return `# ${report.title}\n\n` + sectionsToMarkdown(sections)
  }, [report, sections])

  const scrollToSection = useCallback((id: string) => {
    setSelectedId(id)
    const el = document.getElementById(`report-section-${id}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const exportMarkdown = () => {
    downloadFile(`${report.title}.md`, fullMarkdown, 'text/markdown;charset=utf-8')
  }

  const exportWord = () => {
    const bodyHtml = sectionsToHTML(report.title, sections)
    const doc = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(report.title)}</title><style>body{font-family:"Microsoft YaHei","PingFang SC",sans-serif;max-width:800px;margin:0 auto;padding:40px;color:#333;line-height:1.8}h1{font-size:24px;border-bottom:2px solid #34d399;padding-bottom:8px}h2{font-size:20px;color:#1e40af;margin-top:24px}h3{font-size:16px;color:#374151}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px}th{background:#f3f4f6}blockquote{border-left:3px solid #34d399;margin:12px 0;padding:8px 16px;background:#f0fdf4}</style></head><body><h1>${escapeHtml(report.title)}</h1>${bodyHtml}</body></html>`
    downloadFile(`${report.title}.doc`, doc, 'application/msword;charset=utf-8')
  }

  const exportPDF = () => {
    const bodyHtml = sectionsToHTML(report.title, sections)
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(report.title)}</title><style>@media print{@page{margin:20mm}body{font-family:"Microsoft YaHei","PingFang SC",sans-serif;color:#333;line-height:1.8;max-width:100%}h1{font-size:22px;border-bottom:2px solid #34d399;padding-bottom:8px}h2{font-size:18px;color:#1e40af;margin-top:20px;page-break-after:avoid}h3{font-size:15px;color:#374151;page-break-after:avoid}table{width:100%;border-collapse:collapse;page-break-inside:avoid}th,td{border:1px solid #ddd;padding:6px 8px;font-size:13px}th{background:#f3f4f6}blockquote{border-left:3px solid #34d399;margin:12px 0;padding:8px 16px;background:#f0fdf4}}body{font-family:"Microsoft YaHei","PingFang SC",sans-serif;max-width:800px;margin:0 auto;padding:40px;color:#333;line-height:1.8}h1{font-size:24px;border-bottom:2px solid #34d399;padding-bottom:8px}h2{font-size:20px;color:#1e40af;margin-top:24px}h3{font-size:16px;color:#374151}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px}th{background:#f3f4f6}blockquote{border-left:3px solid #34d399;margin:12px 0;padding:8px 16px;background:#f0fdf4}</style></head><body><h1>${escapeHtml(report.title)}</h1>${bodyHtml}</body></html>`)
    printWindow.document.close()
    setTimeout(() => { printWindow.print() }, 500)
  }

  function renderSections(secs: ReportSection[], depth: number): React.ReactNode {
    return secs.map((s) => (
      <div key={s.id} id={`report-section-${s.id}`} className="mb-6">
        {depth === 1 && <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-3 pb-2 border-b border-slate-100 dark:border-slate-700/50">{s.title}</h2>}
        {depth === 2 && <h3 className="text-base font-bold text-slate-700 dark:text-slate-200 mb-2">{s.title}</h3>}
        {depth >= 3 && <h4 className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-2">{s.title}</h4>}
        {s.content.trim() && (
          <div className="pl-0">
            <MarkdownContent content={s.content} />
          </div>
        )}
        {s.children && s.children.length > 0 && (
          <div className="mt-4">
            {renderSections(s.children, depth + 1)}
          </div>
        )}
      </div>
    ))
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
          <ArrowLeft size={18} />
        </button>

        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white truncate">{report.title}</h2>
          <p className="text-xs text-slate-400">
            {new Date(report.updatedAt).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {report.status === 'ready' && (
          <button
            onClick={() => onEdit(report.id)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <Pencil size={14} />
            编辑
          </button>
        )}

        <div className="flex items-center gap-1 border-l border-slate-200 dark:border-slate-700 pl-3 ml-1">
          <button
            onClick={exportPDF}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/20 dark:text-rose-400 dark:hover:bg-rose-900/30 transition-colors"
            title="导出 PDF"
          >
            <Download size={13} />
            PDF
          </button>
          <button
            onClick={exportWord}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30 transition-colors"
            title="导出 Word"
          >
            <FileType size={13} />
            Word
          </button>
          <button
            onClick={exportMarkdown}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 transition-colors"
            title="导出 Markdown"
          >
            <FileCode size={13} />
            MD
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex min-h-0">
        {/* Left: TOC */}
        {sections.length > 0 && (
          <div className="w-64 shrink-0 border-r border-slate-100 dark:border-slate-700/50 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm overflow-y-auto">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-50 dark:border-slate-700/30">
              <FileText size={14} className="text-slate-400" />
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">目录</span>
            </div>
            <div className="p-2">
              <ReportOutlineTree
                sections={sections}
                selectedId={selectedId}
                onSelect={scrollToSection}
              />
            </div>
          </div>
        )}

        {/* Right: rendered report */}
        <div ref={contentRef} className="flex-1 min-w-0 overflow-y-auto bg-white/40 dark:bg-slate-800/40">
          <div className="max-w-3xl mx-auto p-8">
            {sections.length > 0 ? (
              <>
                <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-1">{report.title}</h1>
                <p className="text-sm text-slate-400 mb-8">
                  {report.reportType === 'scheduled' ? '定时生成' : '手动创建'} · 更新于 {new Date(report.updatedAt).toLocaleDateString('zh-CN')}
                </p>
                {renderSections(sections, 1)}
              </>
            ) : report.content ? (
              <MarkdownContent content={report.content} />
            ) : (
              <div className="text-center text-slate-400 py-20">此报告暂无内容</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
