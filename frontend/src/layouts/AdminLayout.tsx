import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, Users, Building, Coins, ScrollText, ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const navItems = [
  { to: '/admin', icon: LayoutDashboard, label: 'Overview', end: true },
  { to: '/admin/users', icon: Users, label: 'Users' },
  { to: '/admin/tenants', icon: Building, label: 'Tenants' },
  { to: '/admin/billing', icon: Coins, label: 'Usage Metrics' },
  { to: '/admin/logs', icon: ScrollText, label: 'System Logs' },
]

export default function AdminLayout() {
  const navigate = useNavigate()

  return (
    <div className="flex-1 flex overflow-hidden">
      <nav className="w-56 shrink-0 glass-sidebar border-r border-white/40 dark:border-slate-700/50 p-4 space-y-1 overflow-y-auto">
        <div className="px-3 mb-4">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">FreshAdmin</span>
        </div>

        {navItems.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700/50'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}

        <div className="!mt-6 pt-4 border-t border-white/30 dark:border-slate-700/50">
          <button
            onClick={() => navigate('/')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700/50 transition-colors"
          >
            <ArrowLeft size={18} />
            返回聊天
          </button>
        </div>
      </nav>

      <div className="flex-1 overflow-y-auto p-8">
        <Outlet />
      </div>
    </div>
  )
}
