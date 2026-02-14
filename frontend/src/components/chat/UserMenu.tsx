import { useState, useRef, useEffect } from 'react'
import { Settings, LogOut, Moon, Sun, Shield } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import { useNavigate } from 'react-router-dom'

export default function UserMenu() {
  const { user, logout } = useAuthStore()
  const { theme, toggleTheme } = useUIStore()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div ref={menuRef} className="relative p-5">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-3 bg-white/40 dark:bg-slate-800/40 rounded-2xl border border-white/60 dark:border-slate-700/50 hover:bg-white/60 dark:hover:bg-slate-700/60 cursor-pointer transition-all"
      >
        <div className="w-10 h-10 rounded-full btn-gradient flex items-center justify-center text-white font-bold shadow-sm">
          {user?.name?.[0]?.toUpperCase() || 'U'}
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-bold text-slate-800 dark:text-white truncate">
            {user?.name || 'User'}
          </p>
          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">
            {user?.role === 'super_admin' ? 'System Admin' : user?.role === 'tenant_admin' ? 'Admin' : 'Pro Plan'}
          </p>
        </div>
      </button>

      {open && (
        <div className="absolute bottom-full left-5 right-5 mb-2 rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-glass py-2 animate-slide-up">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            {theme === 'dark' ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} className="text-slate-400" />}
            {theme === 'dark' ? '浅色模式' : '深色模式'}
          </button>
          {user?.role !== 'user' && (
            <button
              onClick={() => { navigate('/admin'); setOpen(false) }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <Shield size={16} className="text-primary" />
              管理后台
            </button>
          )}
          <button
            onClick={() => setOpen(false)}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <Settings size={16} className="text-slate-400" />
            设置
          </button>
          <div className="my-1 border-t border-slate-100 dark:border-slate-700" />
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
          >
            <LogOut size={16} />
            退出登录
          </button>
        </div>
      )}
    </div>
  )
}
