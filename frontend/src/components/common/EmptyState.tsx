import { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
}

export default function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-5 w-16 h-16 rounded-3xl bg-primary-50 dark:bg-primary/10 flex items-center justify-center">
        <Icon size={28} className="text-primary" />
      </div>
      <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-5 px-6 py-3 rounded-2xl btn-gradient text-white text-sm font-semibold shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
