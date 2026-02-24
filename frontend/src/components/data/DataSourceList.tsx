import { useEffect, useState } from 'react'
import {
  FileSpreadsheet, FileText, Database, Search, Trash2,
  ChevronRight, Table2, Loader2, AlertCircle, CheckCircle2, Clock,
} from 'lucide-react'
import { useDataStore } from '@/stores/dataStore'
import type { DataSource, DataTable } from '@/types'

const statusConfig: Record<DataSource['status'], { color: string; icon: typeof Loader2; label: string }> = {
  uploading: { color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400', icon: Loader2, label: '上传中' },
  processing: { color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400', icon: Clock, label: '处理中' },
  ready: { color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400', icon: CheckCircle2, label: '就绪' },
  failed: { color: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400', icon: AlertCircle, label: '失败' },
}

function getSourceIcon(type: DataSource['sourceType']) {
  switch (type) {
    case 'excel': return <FileSpreadsheet size={20} className="text-emerald-500" />
    case 'csv': return <FileText size={20} className="text-blue-500" />
    case 'sqlite': return <Database size={20} className="text-purple-500" />
  }
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function DataSourceList() {
  const {
    dataSources, tables, selectedSourceId, selectedTableId,
    selectSource, selectTable, deleteDataSource, loadDataSources,
  } = useDataStore()

  const [search, setSearch] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  useEffect(() => {
    if (dataSources.length === 0) loadDataSources()
  }, [dataSources.length, loadDataSources])

  const filtered = dataSources.filter((ds) =>
    ds.name.toLowerCase().includes(search.toLowerCase()) ||
    ds.originalFilename.toLowerCase().includes(search.toLowerCase()),
  )

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (deleteConfirm === id) {
      await deleteDataSource(id)
      setDeleteConfirm(null)
    } else {
      setDeleteConfirm(id)
      setTimeout(() => setDeleteConfirm(null), 3000)
    }
  }

  const sourceTables = (sourceId: string): DataTable[] =>
    selectedSourceId === sourceId ? tables : []

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="搜索数据源..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-600 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1.5">
        {filtered.map((ds) => {
          const isSelected = selectedSourceId === ds.id
          const cfg = statusConfig[ds.status]
          const StatusIcon = cfg.icon

          return (
            <div key={ds.id}>
              <button
                onClick={() => selectSource(isSelected ? null : ds.id)}
                className={`w-full text-left px-3 py-3 rounded-2xl transition-all group ${
                  isSelected
                    ? 'bg-primary-100 dark:bg-primary/10 ring-1 ring-primary/30'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-700/40'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">{getSourceIcon(ds.sourceType)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800 dark:text-white truncate">{ds.name}</span>
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[10px] font-medium shrink-0 ${cfg.color}`}>
                        <StatusIcon size={10} className={ds.status === 'uploading' || ds.status === 'processing' ? 'animate-spin' : ''} />
                        {cfg.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                      <span>{ds.tableCount} 张表</span>
                      <span>·</span>
                      <span>{formatSize(ds.fileSize)}</span>
                      <span>·</span>
                      <span>{formatDate(ds.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => handleDelete(ds.id, e)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        deleteConfirm === ds.id
                          ? 'bg-red-100 text-red-500 dark:bg-red-900/30'
                          : 'opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                      }`}
                      title={deleteConfirm === ds.id ? '再次点击确认删除' : '删除'}
                    >
                      <Trash2 size={14} />
                    </button>
                    <ChevronRight
                      size={16}
                      className={`text-slate-300 transition-transform ${isSelected ? 'rotate-90' : ''}`}
                    />
                  </div>
                </div>
              </button>

              {isSelected && sourceTables(ds.id).length > 0 && (
                <div className="ml-8 mt-1 space-y-0.5">
                  {sourceTables(ds.id).map((tbl) => (
                    <button
                      key={tbl.id}
                      onClick={() => selectTable(tbl.id)}
                      className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all ${
                        selectedTableId === tbl.id
                          ? 'bg-primary-50 dark:bg-primary/5 text-primary font-semibold'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/30'
                      }`}
                    >
                      <Table2 size={14} className="shrink-0" />
                      <span className="truncate">{tbl.displayName}</span>
                      <span className="ml-auto text-xs text-slate-400 shrink-0">{tbl.rowCount} 行</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-slate-400">
            {search ? '未找到匹配的数据源' : '暂无数据源'}
          </div>
        )}
      </div>
    </div>
  )
}
