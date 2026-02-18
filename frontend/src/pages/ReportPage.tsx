import { FileText, Clock, Download } from 'lucide-react'

export default function ReportPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-20">
      <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center mb-6 shadow-lg shadow-amber-500/20">
        <FileText size={32} className="text-white" />
      </div>
      <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">报告中心</h1>
      <p className="text-slate-500 dark:text-slate-400 text-center max-w-md mb-8">
        基于数据分析自动生成报告，支持定时调度、模板管理和导出。
      </p>
      <div className="flex gap-4">
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-sm text-slate-400">
          <Clock size={16} />
          定时报告
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-sm text-slate-400">
          <Download size={16} />
          导出
        </div>
      </div>
      <p className="text-xs text-slate-400 mt-8">即将在 Phase 2c / 3g 中实现</p>
    </div>
  )
}
