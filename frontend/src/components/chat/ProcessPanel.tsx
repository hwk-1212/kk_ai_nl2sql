import { X, ListChecks } from 'lucide-react'
import type { ProcessStep } from '@/types'
import ProcessStepItem from './ProcessStepItem'

interface ProcessPanelProps {
  steps: ProcessStep[]
  open: boolean
  onClose: () => void
}

export default function ProcessPanel({ steps, open, onClose }: ProcessPanelProps) {
  return (
    <>
      {/* mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* panel */}
      <div
        className={`
          fixed right-0 top-0 bottom-0 z-50 w-full sm:w-[360px]
          lg:relative lg:z-auto
          bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl
          border-l border-slate-200/60 dark:border-slate-700/60
          flex flex-col
          transition-transform duration-300 ease-in-out
          ${open ? 'translate-x-0' : 'translate-x-full lg:translate-x-full'}
          ${open ? 'lg:w-[360px]' : 'lg:w-0 lg:border-0'}
        `}
        style={{ willChange: 'transform' }}
      >
        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200/60 dark:border-slate-700/60">
          <div className="flex items-center gap-2">
            <ListChecks size={18} className="text-primary" />
            <h3 className="font-semibold text-slate-800 dark:text-white text-sm">执行过程</h3>
            {steps.length > 0 && (
              <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-lg">
                {steps.length}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X size={18} />
          </button>
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto p-5">
          {steps.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
              <ListChecks size={40} strokeWidth={1.5} className="opacity-30" />
              <span className="text-sm">暂无过程信息</span>
            </div>
          ) : (
            <div>
              {steps.map((step, i) => (
                <ProcessStepItem
                  key={step.id}
                  step={step}
                  isLast={i === steps.length - 1}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
