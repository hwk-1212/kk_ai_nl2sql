import { Eye, Pencil, Trash2, FileText } from 'lucide-react'
import type { Report } from '@/types'
import EmptyState from '@/components/common/EmptyState'

interface ReportListProps {
  reports: Report[]
  onView: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onAdd: () => void
}

const statusConfig: Record<Report['status'], { label: string; cls: string; pulse?: boolean }> = {
  draft: { label: '草稿', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
  generating: { label: '生成中', cls: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400', pulse: true },
  ready: { label: '已完成', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  failed: { label: '失败', cls: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
}

const typeLabels: Record<Report['reportType'], string> = {
  manual: '手动',
  scheduled: '定时',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function sectionCount(report: Report): number {
  if (!report.sections) return 0
  function count(secs: typeof report.sections): number {
    if (!secs) return 0
    return secs.reduce((n, s) => n + 1 + count(s.children), 0)
  }
  return count(report.sections)
}

export default function ReportList({ reports, onView, onEdit, onDelete, onAdd }: ReportListProps) {
  if (reports.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="暂无报告"
        description="创建一份新的分析报告"
        action={{ label: '新建报告', onClick: onAdd }}
      />
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {reports.map((r) => {
        const st = statusConfig[r.status]
        const secCnt = sectionCount(r)
        return (
          <div
            key={r.id}
            className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur p-5 shadow-soft hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-3">
              <h4 className="font-bold text-slate-800 dark:text-white line-clamp-2 leading-snug">{r.title}</h4>
            </div>

            <div className="flex items-center gap-2 mb-3">
              <span className="px-2 py-0.5 text-xs font-medium rounded-lg bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                {typeLabels[r.reportType]}
              </span>
              <span className={`px-2 py-0.5 text-xs font-medium rounded-lg ${st.cls} ${st.pulse ? 'animate-pulse' : ''}`}>
                {st.label}
              </span>
              {secCnt > 0 && (
                <span className="px-2 py-0.5 text-xs font-medium rounded-lg bg-slate-50 text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                  {secCnt} 章节
                </span>
              )}
            </div>

            <p className="text-xs text-slate-400 mb-4">{formatDate(r.updatedAt)}</p>

            <div className="flex justify-end gap-1.5 pt-2 border-t border-slate-50 dark:border-slate-700/50">
              {r.status === 'ready' && (
                <button
                  onClick={() => onView(r.id)}
                  className="p-2 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                  title="查看报告"
                >
                  <Eye size={15} />
                </button>
              )}
              <button
                onClick={() => onEdit(r.id)}
                className="p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                title="编辑"
              >
                <Pencil size={15} />
              </button>
              <button
                onClick={() => onDelete(r.id)}
                className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-colors"
                title="删除"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
