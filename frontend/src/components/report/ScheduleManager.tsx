import { useState } from 'react'
import { Plus, Play, Trash2, Clock } from 'lucide-react'
import type { ReportSchedule } from '@/types'
import Modal from '@/components/common/Modal'
import { useReportStore } from '@/stores/reportStore'

const CRON_PRESETS = [
  { label: '每天 9:00', cron: '0 9 * * *', desc: '每天 9:00' },
  { label: '每周一 9:00', cron: '0 9 * * 1', desc: '每周一 9:00' },
  { label: '每月1号 9:00', cron: '0 9 1 * *', desc: '每月1号 9:00' },
  { label: '自定义', cron: '', desc: '' },
]

function formatDate(iso?: string) {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function ScheduleManager() {
  const { schedules, templates, addSchedule, updateSchedule, deleteSchedule } = useReportStore()
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState(0)
  const [customCron, setCustomCron] = useState('')
  const [templateId, setTemplateId] = useState('')

  const openNew = () => {
    setSelectedPreset(0)
    setCustomCron('')
    setTemplateId(templates[0]?.id ?? '')
    setModalOpen(true)
  }

  const handleSave = () => {
    const preset = CRON_PRESETS[selectedPreset]
    const cron = preset.cron || customCron.trim()
    if (!cron || !templateId) return
    const tpl = templates.find((t) => t.id === templateId)
    addSchedule({
      id: `sch-${Date.now()}`,
      userId: 'u1',
      templateId,
      templateName: tpl?.name,
      cronExpression: cron,
      cronDescription: preset.desc || cron,
      isActive: true,
      createdAt: new Date().toISOString(),
    })
    setModalOpen(false)
  }

  const toggleActive = (s: ReportSchedule) => {
    updateSchedule(s.id, { isActive: !s.isActive })
  }

  const simulateRun = (s: ReportSchedule) => {
    updateSchedule(s.id, { lastRunAt: new Date().toISOString() })
  }

  const inputCls =
    'w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 dark:text-white'

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 rounded-2xl btn-gradient text-white text-sm font-semibold shadow-lg shadow-primary/20 active:scale-[0.98]">
          <Plus size={16} />
          新建定时任务
        </button>
      </div>

      <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-700">
              <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400">模板</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400">调度规则</th>
              <th className="text-center px-4 py-3 font-medium text-slate-500 dark:text-slate-400">状态</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400">上次运行</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400">下次运行</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500 dark:text-slate-400">操作</th>
            </tr>
          </thead>
          <tbody>
            {schedules.map((s) => (
              <tr key={s.id} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                <td className="px-4 py-3 font-medium text-slate-800 dark:text-white">{s.templateName ?? s.templateId}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-slate-400 shrink-0" />
                    <span className="text-slate-600 dark:text-slate-300">{s.cronDescription ?? s.cronExpression}</span>
                    <code className="text-xs text-slate-400 font-mono">{s.cronExpression}</code>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => toggleActive(s)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
                      s.isActive ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-600'
                    }`}
                  >
                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition-transform mt-0.5 ${
                      s.isActive ? 'translate-x-[22px]' : 'translate-x-0.5'
                    }`} />
                  </button>
                </td>
                <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">{formatDate(s.lastRunAt)}</td>
                <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">{formatDate(s.nextRunAt)}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => simulateRun(s)} className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-slate-400 hover:text-blue-500 transition-colors" title="立即运行">
                    <Play size={14} />
                  </button>
                  <button onClick={() => deleteSchedule(s.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 ml-1 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {schedules.length === 0 && (
          <p className="text-center text-slate-400 py-10 text-sm">暂无定时任务</p>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="新建定时任务">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">报告模板</label>
            <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className={inputCls}>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">调度频率</label>
            <div className="grid grid-cols-2 gap-2">
              {CRON_PRESETS.map((p, i) => (
                <button
                  key={p.label}
                  onClick={() => setSelectedPreset(i)}
                  className={`px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
                    selectedPreset === i
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {selectedPreset === CRON_PRESETS.length - 1 && (
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Cron 表达式</label>
              <input value={customCron} onChange={(e) => setCustomCron(e.target.value)} placeholder="0 9 * * *" className={`${inputCls} font-mono`} />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">取消</button>
            <button onClick={handleSave} className="px-5 py-2.5 rounded-xl btn-gradient text-white text-sm font-semibold shadow-lg shadow-primary/20 active:scale-[0.98]">保存</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
