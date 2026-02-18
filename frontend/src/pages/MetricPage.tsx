import { BarChart3, Plus, Tags } from 'lucide-react'

export default function MetricPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-20">
      <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center mb-6 shadow-lg shadow-violet-500/20">
        <BarChart3 size={32} className="text-white" />
      </div>
      <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">指标管理</h1>
      <p className="text-slate-500 dark:text-slate-400 text-center max-w-md mb-8">
        定义业务指标、数据维度和业务术语，构建语义层。NL2SQL 引擎将利用这些定义提升查询准确率。
      </p>
      <div className="flex gap-4">
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-sm text-slate-400">
          <Plus size={16} />
          指标定义
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-sm text-slate-400">
          <Tags size={16} />
          业务术语
        </div>
      </div>
      <p className="text-xs text-slate-400 mt-8">即将在 Phase 2c / 3d 中实现</p>
    </div>
  )
}
