import { useState, useMemo } from 'react'
import { Table2, Columns3, ChevronLeft, ChevronRight, Database } from 'lucide-react'
import { useDataStore } from '@/stores/dataStore'
import EmptyState from '@/components/common/EmptyState'
import type { ColumnInfo } from '@/types'

type Tab = 'schema' | 'preview'

const typeColors: Record<string, string> = {
  varchar: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  int4: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  float8: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  date: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  bool: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  timestamp: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
}

function TypeBadge({ type }: { type: string }) {
  const color = typeColors[type] ?? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
  return (
    <span className={`inline-block px-2 py-0.5 rounded-lg text-[11px] font-medium ${color}`}>
      {type}
    </span>
  )
}

function SchemaTab({ columns }: { columns: ColumnInfo[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 dark:border-slate-700">
            <th className="text-left py-2.5 px-3 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">列名</th>
            <th className="text-left py-2.5 px-3 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">类型</th>
            <th className="text-center py-2.5 px-3 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">可空</th>
            <th className="text-left py-2.5 px-3 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">备注</th>
          </tr>
        </thead>
        <tbody>
          {columns.map((col) => (
            <tr key={col.name} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50/50 dark:hover:bg-slate-700/20 transition-colors">
              <td className="py-2.5 px-3 font-mono text-slate-800 dark:text-slate-200">{col.name}</td>
              <td className="py-2.5 px-3"><TypeBadge type={col.type} /></td>
              <td className="py-2.5 px-3 text-center">
                <span className={`text-xs ${col.nullable ? 'text-amber-500' : 'text-slate-300 dark:text-slate-600'}`}>
                  {col.nullable ? 'YES' : 'NO'}
                </span>
              </td>
              <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">{col.comment ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DataPreviewTab({ tableId }: { tableId: string }) {
  const { tableData, loadTableData, isLoading } = useDataStore()
  const page = tableData[tableId]
  const [currentPage, setCurrentPage] = useState(0)

  const columns = useMemo(() => {
    if (!page?.data?.length) return []
    return Object.keys(page.data[0])
  }, [page])

  const goTo = (p: number) => {
    setCurrentPage(p)
    loadTableData(tableId, p)
  }

  if (!page) return <div className="py-12 text-center text-sm text-slate-400">加载中...</div>

  const totalPages = Math.ceil(page.totalCount / 50)

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-700">
              {columns.map((col) => (
                <th key={col} className="text-left py-2.5 px-3 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {page.data.map((row, i) => (
              <tr key={i} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50/50 dark:hover:bg-slate-700/20 transition-colors">
                {columns.map((col) => (
                  <td key={col} className="py-2 px-3 text-slate-700 dark:text-slate-300 whitespace-nowrap max-w-[200px] truncate">
                    {row[col] === null ? <span className="text-slate-300 dark:text-slate-600 italic">NULL</span> : String(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4 px-1">
        <span className="text-xs text-slate-400">
          共 {page.totalCount.toLocaleString()} 行 · 第 {currentPage + 1} / {totalPages} 页
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => goTo(currentPage - 1)}
            disabled={currentPage === 0 || isLoading}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-500 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => goTo(currentPage + 1)}
            disabled={!page.hasMore || isLoading}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-500 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function TableDetail() {
  const { selectedTableId, tables } = useDataStore()
  const [activeTab, setActiveTab] = useState<Tab>('schema')

  const table = tables.find((t) => t.id === selectedTableId)

  if (!table) {
    return (
      <div className="flex items-center justify-center h-full">
        <EmptyState
          icon={Database}
          title="选择一张数据表"
          description="从左侧列表中选择数据源并点击表名查看详情"
        />
      </div>
    )
  }

  const tabs: { key: Tab; label: string; icon: typeof Table2 }[] = [
    { key: 'schema', label: 'Schema', icon: Columns3 },
    { key: 'preview', label: '数据预览', icon: Table2 },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700">
        <h2 className="text-lg font-bold text-slate-800 dark:text-white">{table.displayName}</h2>
        <p className="text-sm text-slate-400 mt-0.5">
          {table.description ?? '暂无描述'}
        </p>
        <div className="flex items-center gap-4 mt-3 text-xs text-slate-500 dark:text-slate-400">
          <span>{table.rowCount.toLocaleString()} 行</span>
          <span>·</span>
          <span>{table.columnSchema.length} 列</span>
          <span>·</span>
          <span className="font-mono text-slate-400">{table.pgSchema}.{table.pgTableName}</span>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 px-6 pt-3 border-b border-slate-100 dark:border-slate-700">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-xl transition-colors -mb-px border-b-2 ${
              activeTab === key
                ? 'border-primary text-primary bg-primary-50 dark:bg-primary/5'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'schema' && <SchemaTab columns={table.columnSchema} />}
        {activeTab === 'preview' && <DataPreviewTab tableId={table.id} />}
      </div>
    </div>
  )
}
