import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { useMetricStore } from '@/stores/metricStore'
import type { Metric, Dimension, BusinessTerm } from '@/types'
import MetricList from '@/components/metric/MetricList'
import MetricForm from '@/components/metric/MetricForm'
import Modal from '@/components/common/Modal'

const TABS = [
  { key: 'metrics' as const, label: '指标' },
  { key: 'dimensions' as const, label: '维度' },
  { key: 'terms' as const, label: '业务术语' },
]

const DIM_TYPES: Record<Dimension['dimType'], string> = {
  categorical: '分类',
  temporal: '时间',
  numeric: '数值',
}

export default function MetricPage() {
  const store = useMetricStore()
  const [formOpen, setFormOpen] = useState(false)
  const [editMetric, setEditMetric] = useState<Metric | undefined>()

  const [dimModalOpen, setDimModalOpen] = useState(false)
  const [editDim, setEditDim] = useState<Dimension | undefined>()
  const [dimForm, setDimForm] = useState({ name: '', displayName: '', sourceColumn: '', dataTableName: '', dimType: 'categorical' as Dimension['dimType'] })

  const [termModalOpen, setTermModalOpen] = useState(false)
  const [editTerm, setEditTerm] = useState<BusinessTerm | undefined>()
  const [termForm, setTermForm] = useState({ term: '', canonicalName: '', description: '', sqlExpression: '', synonyms: '' })

  useEffect(() => {
    store.loadAll()
  }, [])

  const handleMetricSave = (data: Omit<Metric, 'id' | 'userId' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
    const now = new Date().toISOString()
    if (data.id) {
      store.updateMetric(data.id, { ...data, updatedAt: now })
    } else {
      store.addMetric({
        ...data,
        id: `met-${Date.now()}`,
        userId: 'u1',
        tags: data.tags ?? [],
        createdAt: now,
        updatedAt: now,
      } as Metric)
    }
  }

  const openDimEdit = (d: Dimension) => {
    setEditDim(d)
    setDimForm({ name: d.name, displayName: d.displayName, sourceColumn: d.sourceColumn, dataTableName: d.dataTableName ?? '', dimType: d.dimType })
    setDimModalOpen(true)
  }

  const saveDim = () => {
    if (!dimForm.name.trim() || !dimForm.displayName.trim()) return
    const now = new Date().toISOString()
    if (editDim) {
      store.updateDimension(editDim.id, { ...dimForm, dataTableName: dimForm.dataTableName || undefined })
    } else {
      store.addDimension({
        id: `dim-${Date.now()}`,
        userId: 'u1',
        ...dimForm,
        dataTableName: dimForm.dataTableName || undefined,
        createdAt: now,
      } as Dimension)
    }
    setDimModalOpen(false)
    setEditDim(undefined)
  }

  const openTermEdit = (t: BusinessTerm) => {
    setEditTerm(t)
    setTermForm({ term: t.term, canonicalName: t.canonicalName, description: t.description ?? '', sqlExpression: t.sqlExpression ?? '', synonyms: t.synonyms ?? '' })
    setTermModalOpen(true)
  }

  const saveTerm = () => {
    if (!termForm.term.trim() || !termForm.canonicalName.trim()) return
    const now = new Date().toISOString()
    if (editTerm) {
      store.updateTerm(editTerm.id, { ...termForm, description: termForm.description || undefined, sqlExpression: termForm.sqlExpression || undefined, synonyms: termForm.synonyms || undefined })
    } else {
      store.addTerm({
        id: `term-${Date.now()}`,
        userId: 'u1',
        ...termForm,
        description: termForm.description || undefined,
        sqlExpression: termForm.sqlExpression || undefined,
        synonyms: termForm.synonyms || undefined,
        createdAt: now,
      } as BusinessTerm)
    }
    setTermModalOpen(false)
    setEditTerm(undefined)
  }

  const inputCls =
    'w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 dark:text-white'

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-700/50">
        <h1 className="text-xl font-bold text-slate-800 dark:text-white">指标管理</h1>
        <button
          onClick={() => {
            if (store.activeTab === 'metrics') { setEditMetric(undefined); setFormOpen(true) }
            else if (store.activeTab === 'dimensions') { setEditDim(undefined); setDimForm({ name: '', displayName: '', sourceColumn: '', dataTableName: '', dimType: 'categorical' }); setDimModalOpen(true) }
            else { setEditTerm(undefined); setTermForm({ term: '', canonicalName: '', description: '', sqlExpression: '', synonyms: '' }); setTermModalOpen(true) }
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl btn-gradient text-white text-sm font-semibold shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
        >
          <Plus size={16} />
          {store.activeTab === 'metrics' ? '新建指标' : store.activeTab === 'dimensions' ? '新建维度' : '新建术语'}
        </button>
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
        {store.activeTab === 'metrics' && (
          <>
            <MetricList
              metrics={store.metrics}
              searchQuery={store.searchQuery}
              onSearchChange={store.setSearchQuery}
              onEdit={(m) => { setEditMetric(m); setFormOpen(true) }}
              onDelete={store.deleteMetric}
              onAdd={() => { setEditMetric(undefined); setFormOpen(true) }}
            />
            <MetricForm
              open={formOpen}
              onClose={() => setFormOpen(false)}
              metric={editMetric}
              onSave={handleMetricSave}
            />
          </>
        )}

        {store.activeTab === 'dimensions' && (
          <>
            <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-700">
                    <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400">名称</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400">显示名称</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400">来源列</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400">数据表</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400">类型</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-500 dark:text-slate-400">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {store.dimensions.map((d) => (
                    <tr key={d.id} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                      <td className="px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">{d.name}</td>
                      <td className="px-4 py-3 text-slate-800 dark:text-white font-medium">{d.displayName}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{d.sourceColumn}</td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{d.dataTableName ?? '-'}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                          {DIM_TYPES[d.dimType]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => openDimEdit(d)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => store.deleteDimension(d.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 ml-1">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {store.dimensions.length === 0 && (
                <p className="text-center text-slate-400 py-10 text-sm">暂无维度</p>
              )}
            </div>
            <Modal open={dimModalOpen} onClose={() => { setDimModalOpen(false); setEditDim(undefined) }} title={editDim ? '编辑维度' : '新建维度'}>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">维度名称</label>
                  <input value={dimForm.name} onChange={(e) => setDimForm({ ...dimForm, name: e.target.value })} className={`${inputCls} font-mono`} placeholder="product_category" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">显示名称</label>
                  <input value={dimForm.displayName} onChange={(e) => setDimForm({ ...dimForm, displayName: e.target.value })} className={inputCls} placeholder="产品类目" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">来源列</label>
                  <input value={dimForm.sourceColumn} onChange={(e) => setDimForm({ ...dimForm, sourceColumn: e.target.value })} className={`${inputCls} font-mono`} placeholder="products.category" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">数据表名</label>
                  <input value={dimForm.dataTableName} onChange={(e) => setDimForm({ ...dimForm, dataTableName: e.target.value })} className={inputCls} placeholder="商品表" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">维度类型</label>
                  <select value={dimForm.dimType} onChange={(e) => setDimForm({ ...dimForm, dimType: e.target.value as Dimension['dimType'] })} className={inputCls}>
                    <option value="categorical">分类</option>
                    <option value="temporal">时间</option>
                    <option value="numeric">数值</option>
                  </select>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button onClick={() => { setDimModalOpen(false); setEditDim(undefined) }} className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">取消</button>
                  <button onClick={saveDim} className="px-5 py-2.5 rounded-xl btn-gradient text-white text-sm font-semibold shadow-lg shadow-primary/20 active:scale-[0.98]">保存</button>
                </div>
              </div>
            </Modal>
          </>
        )}

        {store.activeTab === 'terms' && (
          <>
            <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-700">
                    <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400">术语</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400">标准名称</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400">描述</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400">SQL 表达式</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-500 dark:text-slate-400">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {store.businessTerms.map((t) => (
                    <tr key={t.id} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                      <td className="px-4 py-3 font-bold text-slate-800 dark:text-white">{t.term}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{t.canonicalName}</td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 max-w-[200px] truncate">{t.description ?? '-'}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500 max-w-[200px] truncate">{t.sqlExpression ?? '-'}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => openTermEdit(t)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => store.deleteTerm(t.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 ml-1">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {store.businessTerms.length === 0 && (
                <p className="text-center text-slate-400 py-10 text-sm">暂无业务术语</p>
              )}
            </div>
            <Modal open={termModalOpen} onClose={() => { setTermModalOpen(false); setEditTerm(undefined) }} title={editTerm ? '编辑业务术语' : '新建业务术语'}>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">术语</label>
                  <input value={termForm.term} onChange={(e) => setTermForm({ ...termForm, term: e.target.value })} className={inputCls} placeholder="GMV" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">标准名称</label>
                  <input value={termForm.canonicalName} onChange={(e) => setTermForm({ ...termForm, canonicalName: e.target.value })} className={inputCls} placeholder="销售总额" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">描述</label>
                  <textarea value={termForm.description} onChange={(e) => setTermForm({ ...termForm, description: e.target.value })} rows={2} className={`${inputCls} resize-none`} placeholder="业务含义说明..." />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">SQL 表达式</label>
                  <input value={termForm.sqlExpression} onChange={(e) => setTermForm({ ...termForm, sqlExpression: e.target.value })} className={`${inputCls} font-mono`} placeholder="SUM(order_items.price)" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">同义词（逗号分隔）</label>
                  <input value={termForm.synonyms} onChange={(e) => setTermForm({ ...termForm, synonyms: e.target.value })} className={inputCls} placeholder="总销售额, 交易额" />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button onClick={() => { setTermModalOpen(false); setEditTerm(undefined) }} className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">取消</button>
                  <button onClick={saveTerm} className="px-5 py-2.5 rounded-xl btn-gradient text-white text-sm font-semibold shadow-lg shadow-primary/20 active:scale-[0.98]">保存</button>
                </div>
              </div>
            </Modal>
          </>
        )}
      </div>
    </div>
  )
}
