import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, Save, Sparkles, Loader2, ListTree, FileText } from 'lucide-react'
import type { Report, ReportSection, ReportTemplate } from '@/types'
import { useReportStore } from '@/stores/reportStore'
import { reportApi } from '@/services/api'
import { toast } from '@/components/common/Toast'
import ReportOutlineTree from './ReportOutlineTree'

interface ReportEditorProps {
  reportId?: string
  templateId?: string
  onBack: () => void
  onCreated?: (report: Report) => void
  onGenerated?: () => void
}

function findSection(sections: ReportSection[], id: string): ReportSection | null {
  for (const s of sections) {
    if (s.id === id) return s
    if (s.children) {
      const found = findSection(s.children, id)
      if (found) return found
    }
  }
  return null
}

function updateSectionInTree(sections: ReportSection[], id: string, updater: (s: ReportSection) => ReportSection): ReportSection[] {
  return sections.map((s) => {
    if (s.id === id) return updater(s)
    if (s.children) return { ...s, children: updateSectionInTree(s.children, id, updater) }
    return s
  })
}

function addChildSection(sections: ReportSection[], parentId: string | null, child: ReportSection): ReportSection[] {
  if (!parentId) return [...sections, child]
  return sections.map((s) => {
    if (s.id === parentId) return { ...s, children: [...(s.children || []), child] }
    if (s.children) return { ...s, children: addChildSection(s.children, parentId, child) }
    return s
  })
}

function deleteSectionFromTree(sections: ReportSection[], id: string): ReportSection[] {
  return sections
    .filter((s) => s.id !== id)
    .map((s) => s.children ? { ...s, children: deleteSectionFromTree(s.children, id) } : s)
}

function collectSectionIds(sections: ReportSection[]): string[] {
  const ids: string[] = []
  for (const s of sections) {
    ids.push(s.id)
    if (s.children) ids.push(...collectSectionIds(s.children))
  }
  return ids
}

function sectionsToMarkdown(sections: ReportSection[], depth = 1): string {
  return sections.map((s) => {
    const heading = '#'.repeat(depth)
    let md = `${heading} ${s.title}\n\n`
    if (s.content?.trim()) md += `${s.content.trim()}\n\n`
    if (s.children?.length) md += sectionsToMarkdown(s.children, depth + 1)
    return md
  }).join('')
}

function mapApiReport(r: Record<string, unknown>): Report {
  return {
    id: String(r.id),
    userId: String(r.user_id),
    title: String(r.title),
    reportType: ((r.report_type as string) || 'manual') as Report['reportType'],
    status: ((r.status as string) || 'draft') as Report['status'],
    content: r.content != null ? String(r.content) : undefined,
    sections: (r.sections as Report['sections']) ?? undefined,
    templateId: r.template_id != null ? String(r.template_id) : undefined,
    createdAt: r.created_at != null ? new Date(r.created_at as string).toISOString() : '',
    updatedAt: r.updated_at != null ? new Date(r.updated_at as string).toISOString() : '',
  }
}

export default function ReportEditor({ reportId, templateId, onBack, onCreated, onGenerated }: ReportEditorProps) {
  const { reports, templates, addReport, updateReport } = useReportStore()
  const report = reportId ? reports.find((r) => r.id === reportId) : undefined
  const template = templateId ? templates.find((t) => t.id === templateId) : undefined

  const [title, setTitle] = useState('')
  const [sections, setSections] = useState<ReportSection[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [currentReportId, setCurrentReportId] = useState<string | undefined>(reportId)

  useEffect(() => {
    if (report) {
      setTitle(report.title)
      if (report.sections && report.sections.length > 0) {
        setSections(JSON.parse(JSON.stringify(report.sections)))
      } else if (report.content) {
        setSections([{ id: `sec-${Date.now()}`, title: '内容', content: report.content, children: [] }])
      } else {
        setSections([{ id: `sec-${Date.now()}`, title: '概述', content: '', children: [] }])
      }
      const allIds = report.sections ? collectSectionIds(report.sections) : []
      setSelectedId(allIds[0] ?? null)
      setCurrentReportId(report.id)
    } else if (template?.outline) {
      setTitle('')
      const outline = JSON.parse(JSON.stringify(template.outline)) as ReportSection[]
      setSections(outline)
      setSelectedId(collectSectionIds(outline)[0] ?? null)
      setCurrentReportId(undefined)
    } else {
      setTitle('')
      setSections([{ id: `sec-${Date.now()}`, title: '概述', content: '', children: [] }])
      setSelectedId(null)
      setCurrentReportId(undefined)
    }
  }, [report?.id, template?.id])

  const selectedSection = selectedId ? findSection(sections, selectedId) : null

  const handleSectionContentChange = (content: string) => {
    if (!selectedId) return
    setSections((prev) => updateSectionInTree(prev, selectedId, (s) => ({ ...s, content })))
  }

  const handleAdd = (parentId: string | null) => {
    const newSec: ReportSection = { id: `sec-${Date.now()}`, title: '新章节', content: '', children: [] }
    setSections((prev) => addChildSection(prev, parentId, newSec))
    setSelectedId(newSec.id)
  }

  const handleDelete = (id: string) => {
    setSections((prev) => {
      const result = deleteSectionFromTree(prev, id)
      if (selectedId === id) {
        const allIds = collectSectionIds(result)
        setSelectedId(allIds[0] ?? null)
      }
      return result
    })
  }

  const handleRename = (id: string, newTitle: string) => {
    setSections((prev) => updateSectionInTree(prev, id, (s) => ({ ...s, title: newTitle })))
  }

  const handleAIGenerate = useCallback(async () => {
    if (!currentReportId && !title.trim()) {
      toast('info', '请先填写报告标题')
      return
    }
    let id = currentReportId
    if (!id) {
      setSaving(true)
      try {
        const created = await reportApi.createReport({
          title: title.trim(),
          template_id: templateId ?? undefined,
          data_config: {},
        })
        const mapped = mapApiReport(created)
        addReport(mapped)
        onCreated?.(mapped)
        id = mapped.id
        setCurrentReportId(id)
      } catch (e) {
        console.error('Create report failed', e)
        toast('error', e instanceof Error ? e.message : '创建报告失败')
        setSaving(false)
        return
      }
      setSaving(false)
    }
    setGenerating(true)
    try {
      await reportApi.generateReport(id, { data_config: {} })
      const poll = async () => {
        const res = await reportApi.getReport(id!)
        const status = res.status as string
        const mapped = mapApiReport(res)
        updateReport(id!, { status: mapped.status, content: mapped.content, sections: mapped.sections, updatedAt: mapped.updatedAt })
        if (status === 'ready') {
          setGenerating(false)
          onGenerated?.()
          return
        }
        if (status === 'failed') {
          setGenerating(false)
          const errMsg = (res as { error_message?: string }).error_message
          toast('error', errMsg || '报告生成失败')
          return
        }
        setTimeout(poll, 2000)
      }
      setTimeout(poll, 2000)
    } catch (e) {
      console.error('Generate report failed', e)
      toast('error', e instanceof Error ? e.message : '触发生成失败')
      setGenerating(false)
    }
  }, [currentReportId, title, templateId, addReport, updateReport, onCreated, onGenerated])

  const handleSave = async () => {
    if (!title.trim()) return
    setSaving(true)
    try {
      const content = sectionsToMarkdown(sections)
      if (report) {
        await reportApi.updateReport(report.id, { title: title.trim(), content })
        updateReport(report.id, { title: title.trim(), content, updatedAt: new Date().toISOString() })
      } else {
        const created = await reportApi.createReport({
          title: title.trim(),
          template_id: templateId ?? undefined,
          data_config: {},
        })
        const mapped = mapApiReport(created)
        addReport(mapped)
        onCreated?.(mapped)
        setCurrentReportId(mapped.id)
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      console.error('Save report failed', e)
    }
    setSaving(false)
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
          <ArrowLeft size={18} />
        </button>

        <div className="flex-1 min-w-0">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="报告标题..."
            className="w-full text-lg font-bold bg-transparent border-none outline-none text-slate-800 dark:text-white placeholder-slate-300 dark:placeholder-slate-600"
          />
        </div>

        <button
          onClick={handleAIGenerate}
          disabled={generating || saving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-900/50 disabled:opacity-50 transition-colors"
        >
          {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          AI 生成报告
        </button>

        <button
          onClick={handleSave}
          disabled={!title.trim() || saving}
          className="flex items-center gap-1.5 px-5 py-2 rounded-xl btn-gradient text-white text-sm font-semibold shadow-lg shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saved ? '已保存' : '保存'}
        </button>
      </div>

      {/* Body: outline tree + content editor */}
      <div className="flex-1 flex min-h-0">
        {/* Left: outline */}
        <div className="w-64 shrink-0 border-r border-slate-100 dark:border-slate-700/50 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm overflow-y-auto">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-50 dark:border-slate-700/30">
            <ListTree size={14} className="text-slate-400" />
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">目录结构</span>
          </div>
          <div className="p-2">
            <ReportOutlineTree
              sections={sections}
              selectedId={selectedId}
              onSelect={setSelectedId}
              editable
              onAdd={handleAdd}
              onDelete={handleDelete}
              onRename={handleRename}
            />
          </div>
        </div>

        {/* Right: section editor */}
        <div className="flex-1 min-w-0 overflow-y-auto bg-white/40 dark:bg-slate-800/40">
          {selectedSection ? (
            <div className="max-w-3xl mx-auto p-6">
              <div className="flex items-center gap-2 mb-4">
                <FileText size={16} className="text-primary" />
                <h3 className="text-base font-bold text-slate-800 dark:text-white">{selectedSection.title}</h3>
              </div>
              <textarea
                value={selectedSection.content}
                onChange={(e) => handleSectionContentChange(e.target.value)}
                placeholder={`在此编写「${selectedSection.title}」章节的内容...\n\n支持 Markdown 语法：\n# 标题\n**加粗** *斜体*\n- 列表\n| 表格 | 列 |\n> 引用`}
                className="w-full min-h-[400px] px-5 py-4 rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900/50 text-sm font-mono leading-relaxed text-slate-700 dark:text-slate-200 placeholder-slate-300 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
              />
              <p className="mt-2 text-xs text-slate-400">支持 Markdown 语法 · 双击左侧目录项可重命名</p>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400 dark:text-slate-500 text-sm">
              从左侧选择一个章节开始编辑
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
