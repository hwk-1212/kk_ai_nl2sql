import { Database, Upload, Table2 } from 'lucide-react'

export default function DataPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-20">
      <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mb-6 shadow-lg shadow-blue-500/20">
        <Database size={32} className="text-white" />
      </div>
      <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">数据管理</h1>
      <p className="text-slate-500 dark:text-slate-400 text-center max-w-md mb-8">
        上传 Excel / CSV / SQLite 文件，自动解析为数据表。支持表结构预览、数据预览和 Schema 管理。
      </p>
      <div className="flex gap-4">
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-sm text-slate-400">
          <Upload size={16} />
          文件上传
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-sm text-slate-400">
          <Table2 size={16} />
          表管理
        </div>
      </div>
      <p className="text-xs text-slate-400 mt-8">即将在 Phase 2a / 3a 中实现</p>
    </div>
  )
}
