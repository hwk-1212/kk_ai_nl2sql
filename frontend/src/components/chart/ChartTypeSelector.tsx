import { BarChart3, TrendingUp, PieChart, AreaChart, Circle, Table2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface ChartTypeSelectorProps {
  currentType: string
  availableTypes: string[]
  onChange: (type: string) => void
}

const typeConfig: Record<string, { icon: LucideIcon; label: string }> = {
  bar: { icon: BarChart3, label: '柱状图' },
  line: { icon: TrendingUp, label: '折线图' },
  pie: { icon: PieChart, label: '饼图' },
  area: { icon: AreaChart, label: '面积图' },
  scatter: { icon: Circle, label: '散点图' },
  table: { icon: Table2, label: '表格' },
}

export default function ChartTypeSelector({ currentType, availableTypes, onChange }: ChartTypeSelectorProps) {
  return (
    <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
      {availableTypes.map((t) => {
        const cfg = typeConfig[t]
        if (!cfg) return null
        const Icon = cfg.icon
        const active = t === currentType
        return (
          <button
            key={t}
            onClick={() => onChange(t)}
            title={cfg.label}
            className={`p-2 rounded-lg transition-all duration-200 ${
              active
                ? 'btn-gradient text-white shadow-md shadow-primary/20'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-white dark:hover:bg-slate-700'
            }`}
          >
            <Icon size={16} />
          </button>
        )
      })}
    </div>
  )
}
