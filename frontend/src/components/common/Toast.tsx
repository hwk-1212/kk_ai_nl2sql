import { useState, useEffect, useCallback } from 'react'
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  type: ToastType
  message: string
}

let addToastFn: ((type: ToastType, message: string) => void) | null = null

export function toast(type: ToastType, message: string) {
  addToastFn?.(type, message)
}

const icons = { success: CheckCircle, error: AlertCircle, info: Info }
const colors = {
  success: 'bg-white dark:bg-slate-800 border-primary/30 text-primary',
  error: 'bg-white dark:bg-slate-800 border-red-300 text-red-500',
  info: 'bg-white dark:bg-slate-800 border-azure/30 text-azure',
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, type, message }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000)
  }, [])

  useEffect(() => {
    addToastFn = addToast
    return () => { addToastFn = null }
  }, [addToast])

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => {
        const Icon = icons[t.type]
        return (
          <div
            key={t.id}
            className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl border shadow-glass animate-in slide-in-from-right ${colors[t.type]}`}
          >
            <Icon size={18} />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{t.message}</span>
            <button
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              className="ml-2 text-slate-300 hover:text-slate-500"
            >
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
