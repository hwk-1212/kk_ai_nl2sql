import { ShieldCheck, Users, Lock } from 'lucide-react'

export default function DataPermissionPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-20">
      <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/20">
        <ShieldCheck size={32} className="text-white" />
      </div>
      <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">数据权限</h1>
      <p className="text-slate-500 dark:text-slate-400 text-center max-w-md mb-8">
        配置行级、列级数据访问控制，管理数据角色和字段脱敏规则。
      </p>
      <div className="flex gap-4">
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-sm text-slate-400">
          <Users size={16} />
          角色管理
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-sm text-slate-400">
          <Lock size={16} />
          脱敏规则
        </div>
      </div>
      <p className="text-xs text-slate-400 mt-8">即将在 Phase 3e 中实现</p>
    </div>
  )
}
