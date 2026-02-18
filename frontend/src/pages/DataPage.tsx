import { useState, useEffect } from 'react'
import { Database, Upload } from 'lucide-react'
import { useDataStore } from '@/stores/dataStore'
import DataSourceList from '@/components/data/DataSourceList'
import TableDetail from '@/components/data/TableDetail'
import FileUpload from '@/components/data/FileUpload'
import EmptyState from '@/components/common/EmptyState'

export default function DataPage() {
  const [uploadOpen, setUploadOpen] = useState(false)
  const { dataSources, loadDataSources } = useDataStore()

  useEffect(() => {
    loadDataSources()
  }, [loadDataSources])

  const hasData = dataSources.length > 0

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Database size={18} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white">数据管理</h1>
        </div>
        <button
          onClick={() => setUploadOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold text-white btn-gradient shadow-lg shadow-primary/20 transition-all active:scale-[0.98] hover:shadow-xl hover:shadow-primary/30"
        >
          <Upload size={16} />
          上传数据
        </button>
      </div>

      {/* Content */}
      {hasData ? (
        <div className="flex flex-1 min-h-0 flex-col md:flex-row">
          {/* Left: Data source list */}
          <div className="w-full md:w-80 shrink-0 border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm overflow-hidden">
            <DataSourceList />
          </div>
          {/* Right: Table detail */}
          <div className="flex-1 min-w-0 bg-white/40 dark:bg-slate-800/40 backdrop-blur-sm overflow-hidden">
            <TableDetail />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            icon={Database}
            title="还没有数据"
            description="上传 Excel、CSV 或 SQLite 文件，系统将自动解析为数据表"
            action={{ label: '上传数据', onClick: () => setUploadOpen(true) }}
          />
        </div>
      )}

      {/* Upload modal */}
      <FileUpload open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </div>
  )
}
