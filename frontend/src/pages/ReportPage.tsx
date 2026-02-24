import { useEffect, useState } from 'react'
import { Plus, FileText, Layout } from 'lucide-react'
import { useReportStore } from '@/stores/reportStore'
import ReportList from '@/components/report/ReportList'
import ReportEditor from '@/components/report/ReportEditor'
import ReportViewer from '@/components/report/ReportViewer'
import ScheduleManager from '@/components/report/ScheduleManager'
import Modal from '@/components/common/Modal'

type ViewMode = 'list' | 'edit' | 'view'

const TABS = [
  { key: 'reports' as const, label: '我的报告' },
  { key: 'templates' as const, label: '模板库' },
  { key: 'schedules' as const, label: '定时任务' },
]

export default function ReportPage() {
  const store = useReportStore()
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [activeReportId, setActiveReportId] = useState<string | undefined>()
  const [templateId, setTemplateId] = useState<string | undefined>()
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false)

  useEffect(() => {
    store.loadAll()
  }, [])

  const handleNew = () => {
    setTemplatePickerOpen(true)
  }

  const handleCreateFromTemplate = (tplId?: string) => {
    setTemplatePickerOpen(false)
    setActiveReportId(undefined)
    setTemplateId(tplId)
    setViewMode('edit')
  }

  const handleView = (id: string) => {
    setActiveReportId(id)
    setViewMode('view')
  }

  const handleEdit = (id: string) => {
    setActiveReportId(id)
    setTemplateId(undefined)
    setViewMode('edit')
  }

  const handleBack = () => {
    setViewMode('list')
    setActiveReportId(undefined)
    setTemplateId(undefined)
  }

  const viewReport = activeReportId ? store.reports.find((r) => r.id === activeReportId) : undefined

  if (viewMode === 'edit') {
    return (
      <ReportEditor
        reportId={activeReportId}
        templateId={templateId}
        onBack={handleBack}
        onCreated={(r) => setActiveReportId(r.id)}
        onGenerated={() => setViewMode('view')}
      />
    )
  }

  if (viewMode === 'view' && viewReport) {
    return <ReportViewer report={viewReport} onBack={handleBack} onEdit={handleEdit} />
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-700/50">
        <h1 className="text-xl font-bold text-slate-800 dark:text-white">报告中心</h1>
        {store.activeTab === 'reports' && (
          <button
            onClick={handleNew}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl btn-gradient text-white text-sm font-semibold shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
          >
            <Plus size={16} />
            新建报告
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 px-6 pt-4 pb-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => store.setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              store.activeTab === tab.key
                ? 'bg-primary/10 text-primary dark:bg-primary/20'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {store.activeTab === 'reports' && (
          <ReportList
            reports={store.reports}
            onView={handleView}
            onEdit={handleEdit}
            onDelete={store.deleteReport}
            onAdd={handleNew}
          />
        )}

        {store.activeTab === 'templates' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {store.templates.map((t) => (
              <div
                key={t.id}
                className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur p-5 shadow-soft hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center shrink-0">
                    <FileText size={18} className="text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    {t.isSystem && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                        系统
                      </span>
                    )}
                    {t.outline && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                        {t.outline.length} 章节
                      </span>
                    )}
                  </div>
                </div>
                <h4 className="font-bold text-slate-800 dark:text-white mt-3 mb-1">{t.name}</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{t.description}</p>
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-50 dark:border-slate-700/50">
                  {t.category && (
                    <span className="px-2 py-0.5 text-xs rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                      {t.category}
                    </span>
                  )}
                  <button
                    onClick={() => handleCreateFromTemplate(t.id)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium text-primary hover:bg-primary/10 dark:hover:bg-primary/20 transition-colors"
                  >
                    <Layout size={12} />
                    使用模板
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {store.activeTab === 'schedules' && <ScheduleManager />}
      </div>

      {/* Template picker modal */}
      <Modal open={templatePickerOpen} onClose={() => setTemplatePickerOpen(false)} title="选择模板" maxWidth="max-w-lg">
        <div className="space-y-3">
          <button
            onClick={() => handleCreateFromTemplate()}
            className="w-full text-left rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 p-4 hover:border-primary hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors"
          >
            <h4 className="font-bold text-sm text-slate-800 dark:text-white">空白报告</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">从零开始，自由编排目录和内容</p>
          </button>
          {store.templates.map((t) => (
            <button
              key={t.id}
              onClick={() => handleCreateFromTemplate(t.id)}
              className="w-full text-left rounded-2xl border border-slate-200 dark:border-slate-700 p-4 hover:border-primary hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors"
            >
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-slate-800 dark:text-white">{t.name}</h4>
                {(t.outline?.length ?? 0) > 0 && (
                  <span className="px-2 py-0.5 text-xs rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                    {t.outline!.length} 章节
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t.description}</p>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  )
}
