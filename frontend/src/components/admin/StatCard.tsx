import { LucideIcon } from 'lucide-react'

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: string | number
  trend?: string
  color?: string
}

export default function StatCard({ icon: Icon, label, value, trend, color = 'text-primary' }: StatCardProps) {
  return (
    <div className="rounded-3xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{label}</p>
          <p className="text-3xl font-bold text-slate-800 dark:text-white">{value}</p>
          {trend && (
            <p className="text-xs text-primary font-bold mt-1 flex items-center gap-1">
              📈 {trend}
            </p>
          )}
        </div>
        <div className={`w-10 h-10 rounded-2xl bg-primary-50 dark:bg-primary/10 flex items-center justify-center ${color}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  )
}
