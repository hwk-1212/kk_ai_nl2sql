import { Search, Pencil, Trash2, BarChart3 } from 'lucide-react'
import type { Metric } from '@/types'
import EmptyState from '@/components/common/EmptyState'

interface MetricListProps {
  metrics: Metric[]
  searchQuery: string
  onSearchChange: (q: string) => void
  onEdit: (m: Metric) => void
  onDelete: (id: string) => void
  onAdd: () => void
}

const statusConfig: Record<Metric['status'], { label: string; cls: string }> = {
  active: { label: '启用', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  draft: { label: '草稿', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
  deprecated: { label: '已废弃', cls: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
}

const tagColors = [
  'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  'bg-pink-50 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
]

export default function MetricList({ metrics, searchQuery, onSearchChange, onEdit, onDelete, onAdd }: MetricListProps) {
  const filtered = metrics.filter(
    (m) =>
      m.displayName.includes(searchQuery) ||
      m.name.includes(searchQuery) ||
      m.tags.some((t) => t.includes(searchQuery))
  )

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="搜索指标名称、标签..."
          className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-600 bg-white/80 dark:bg-slate-800/80 backdrop-blur text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 dark:text-white"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="暂无指标"
          description="定义业务指标以提升 NL2SQL 查询准确率"
          action={{ label: '新建指标', onClick: onAdd }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((m) => {
            const st = statusConfig[m.status]
            return (
              <div
                key={m.id}
                className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur p-5 shadow-soft hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0">
                    <h4 className="font-bold text-slate-800 dark:text-white truncate">{m.displayName}</h4>
                    <p className="text-xs text-slate-400 font-mono">{m.name}</p>
                  </div>
                  <span className={`shrink-0 ml-2 px-2 py-0.5 text-xs font-medium rounded-lg ${st.cls}`}>
                    {st.label}
                  </span>
                </div>

                <div className="mb-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 px-3 py-2">
                  <code className="text-xs font-mono text-slate-600 dark:text-slate-300 break-all">{m.formula}</code>
                </div>

                {m.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {m.tags.map((tag, i) => (
                      <span key={tag} className={`px-2 py-0.5 text-xs rounded-lg font-medium ${tagColors[i % tagColors.length]}`}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {m.unit && (
                  <p className="text-xs text-slate-400 mb-3">
                    单位: <span className="text-slate-600 dark:text-slate-300">{m.unit}</span>
                    {m.aggregation && <> · 聚合: <span className="text-slate-600 dark:text-slate-300">{m.aggregation}</span></>}
                  </p>
                )}

                <div className="flex justify-end gap-1.5 pt-2 border-t border-slate-50 dark:border-slate-700/50">
                  <button
                    onClick={() => onEdit(m)}
                    className="p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => onDelete(m.id)}
                    className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
