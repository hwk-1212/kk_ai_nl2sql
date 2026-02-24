import { useState, useEffect } from 'react'
import type { Metric } from '@/types'
import Modal from '@/components/common/Modal'

interface MetricFormProps {
  open: boolean
  onClose: () => void
  metric?: Metric
  onSave: (data: Omit<Metric, 'id' | 'userId' | 'createdAt' | 'updatedAt'> & { id?: string }) => void | Promise<void>
}

const AGGREGATIONS = ['SUM', 'AVG', 'COUNT', 'MAX', 'MIN'] as const
const STATUSES: Metric['status'][] = ['active', 'draft', 'deprecated']
const STATUS_LABELS: Record<Metric['status'], string> = { active: '启用', draft: '草稿', deprecated: '已废弃' }

export default function MetricForm({ open, onClose, metric, onSave }: MetricFormProps) {
  const [name, setName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [description, setDescription] = useState('')
  const [formula, setFormula] = useState('')
  const [aggregation, setAggregation] = useState('')
  const [unit, setUnit] = useState('')
  const [tagsStr, setTagsStr] = useState('')
  const [status, setStatus] = useState<Metric['status']>('draft')
  const [sourceTable, setSourceTable] = useState('')

  useEffect(() => {
    if (metric) {
      setName(metric.name)
      setDisplayName(metric.displayName)
      setDescription(metric.description ?? '')
      setFormula(metric.formula)
      setAggregation(metric.aggregation ?? '')
      setUnit(metric.unit ?? '')
      setTagsStr(metric.tags.join(', '))
      setStatus(metric.status)
      setSourceTable(metric.dataTableName ?? '')
    } else {
      setName('')
      setDisplayName('')
      setDescription('')
      setFormula('')
      setAggregation('')
      setUnit('')
      setTagsStr('')
      setStatus('draft')
      setSourceTable('')
    }
  }, [metric, open])

  const handleSubmit = async () => {
    if (!name.trim() || !displayName.trim() || !formula.trim()) return
    await onSave({
      id: metric?.id,
      name: name.trim(),
      displayName: displayName.trim(),
      description: description.trim() || undefined,
      formula: formula.trim(),
      dataTableName: sourceTable.trim() || name.trim(),
      aggregation: aggregation || undefined,
      unit: unit.trim() || undefined,
      tags: tagsStr
        .split(/[,，]/)
        .map((t) => t.trim())
        .filter(Boolean),
      status,
    })
    onClose()
  }

  const inputCls =
    'w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 dark:text-white'

  return (
    <Modal open={open} onClose={onClose} title={metric ? '编辑指标' : '新建指标'} maxWidth="max-w-lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">指标名称</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="total_sales" className={`${inputCls} font-mono`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">显示名称</label>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="销售总额" className={inputCls} />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">描述</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="指标的业务含义..."
            className={`${inputCls} resize-none`}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">计算公式</label>
          <input
            value={formula}
            onChange={(e) => setFormula(e.target.value)}
            placeholder="SUM(order_items.price * order_items.quantity)"
            className={`${inputCls} font-mono bg-slate-900 dark:bg-slate-900 text-emerald-400 dark:text-emerald-400 border-slate-700`}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">来源表（SQL 中用到的表名）</label>
          <input
            value={sourceTable}
            onChange={(e) => setSourceTable(e.target.value)}
            placeholder="如 orders 或 order_items"
            className={`${inputCls} font-mono`}
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">聚合方式</label>
            <select value={aggregation} onChange={(e) => setAggregation(e.target.value)} className={inputCls}>
              <option value="">无</option>
              {AGGREGATIONS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">单位</label>
            <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="元" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">状态</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as Metric['status'])} className={inputCls}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">标签（逗号分隔）</label>
          <input value={tagsStr} onChange={(e) => setTagsStr(e.target.value)} placeholder="核心, 销售" className={inputCls} />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            取消
          </button>
          <button onClick={handleSubmit} className="px-5 py-2.5 rounded-xl btn-gradient text-white text-sm font-semibold shadow-lg shadow-primary/20 transition-all active:scale-[0.98]">
            保存
          </button>
        </div>
      </div>
    </Modal>
  )
}
