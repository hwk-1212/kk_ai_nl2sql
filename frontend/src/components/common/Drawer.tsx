import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  /** 宽度 tailwind class, 默认 max-w-2xl */
  width?: string
}

export default function Drawer({ open, onClose, title, children, width = 'max-w-2xl' }: DrawerProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (open) {
      document.addEventListener('keydown', handleEsc)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-sm animate-fade-in"
      onClick={(e) => e.target === overlayRef.current && onClose()}
    >
      <div
        className={`${width} w-full h-full bg-white dark:bg-slate-800 shadow-2xl flex flex-col animate-slide-left`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700 shrink-0">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white truncate pr-4">{title}</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-400 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        {/* Body */}
        <div className="flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  )
}
