import { PanelLeftClose, PanelLeft, Plug, BookOpen, Wrench, Shield, Database, BarChart3, FileText, ShieldCheck } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { useChatStore } from '@/stores/chatStore'
import { useAuthStore } from '@/stores/authStore'
import { useNavigate, useLocation } from 'react-router-dom'
import ConversationList from '@/components/chat/ConversationList'
import UserMenu from '@/components/chat/UserMenu'

export default function Sidebar() {
  const { sidebarOpen, toggleSidebar, isMobile } = useUIStore()
  const userRole = useAuthStore((s) => s.user?.role)
  const isAdmin = userRole === 'super_admin' || userRole === 'tenant_admin'
  const navigate = useNavigate()
  const location = useLocation()

  if (!sidebarOpen) {
    return (
      <button
        onClick={toggleSidebar}
        className="fixed top-4 left-4 z-30 p-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-white/60 dark:border-slate-700 shadow-soft hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all"
      >
        <PanelLeft size={18} />
      </button>
    )
  }

  return (
    <>
      {isMobile && (
        <div className="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm" onClick={toggleSidebar} />
      )}

      <aside className={`${isMobile ? 'fixed z-40' : 'relative'} flex flex-col w-72 h-full glass-sidebar border-r border-white/40 dark:border-slate-700/50`}>
        {/* header */}
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 btn-gradient rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
              <span className="text-white text-lg font-black">K</span>
            </div>
            <span className="font-bold text-lg tracking-tight text-slate-800 dark:text-white">KK NL2SQL</span>
          </div>
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-xl hover:bg-white/50 dark:hover:bg-slate-700 text-slate-400 transition-colors"
          >
            <PanelLeftClose size={18} />
          </button>
        </div>

        {/* new session button */}
        <div className="px-5 mb-4">
          <button
            onClick={() => {
              useChatStore.getState().createConversation()
              navigate('/')
            }}
            className="w-full flex items-center justify-center gap-2 btn-gradient text-white py-3 rounded-2xl font-semibold shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
          >
            <span className="text-lg">+</span>
            新建对话
          </button>
        </div>

        {/* conversation list */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <ConversationList />
        </div>

        {/* bottom nav */}
        <div className="px-3 py-2 space-y-0.5 border-t border-white/30 dark:border-slate-700/50">
          <button
            onClick={() => navigate('/data')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm transition-colors ${
              location.pathname === '/data'
                ? 'bg-white/80 dark:bg-slate-700 shadow-sm text-primary font-semibold'
                : 'text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700/50'
            }`}
          >
            <Database size={18} />
            数据管理
          </button>
          <button
            onClick={() => navigate('/metrics')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm transition-colors ${
              location.pathname === '/metrics'
                ? 'bg-white/80 dark:bg-slate-700 shadow-sm text-primary font-semibold'
                : 'text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700/50'
            }`}
          >
            <BarChart3 size={18} />
            指标管理
          </button>
          <button
            onClick={() => navigate('/reports')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm transition-colors ${
              location.pathname === '/reports'
                ? 'bg-white/80 dark:bg-slate-700 shadow-sm text-primary font-semibold'
                : 'text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700/50'
            }`}
          >
            <FileText size={18} />
            报告中心
          </button>
          <button
            onClick={() => navigate('/tools')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm transition-colors ${
              location.pathname === '/tools'
                ? 'bg-white/80 dark:bg-slate-700 shadow-sm text-primary font-semibold'
                : 'text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700/50'
            }`}
          >
            <Wrench size={18} />
            工具
          </button>
          <button
            onClick={() => navigate('/mcp')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm transition-colors ${
              location.pathname === '/mcp'
                ? 'bg-white/80 dark:bg-slate-700 shadow-sm text-primary font-semibold'
                : 'text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700/50'
            }`}
          >
            <Plug size={18} />
            MCP
          </button>
          <button
            onClick={() => navigate('/knowledge')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm transition-colors ${
              location.pathname === '/knowledge'
                ? 'bg-white/80 dark:bg-slate-700 shadow-sm text-primary font-semibold'
                : 'text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700/50'
            }`}
          >
            <BookOpen size={18} />
            知识库
          </button>
        </div>

        {isAdmin && (
          <div className="px-3 pb-1 space-y-0.5">
            <button
              onClick={() => navigate('/data-permissions')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm transition-colors ${
                location.pathname === '/data-permissions'
                  ? 'bg-white/80 dark:bg-slate-700 shadow-sm text-primary font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700/50'
              }`}
            >
              <ShieldCheck size={18} />
              数据权限
            </button>
          </div>
        )}

        {isAdmin && (
          <div className="px-3 pb-1">
            <button
              onClick={() => navigate('/admin')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm transition-colors ${
                location.pathname.startsWith('/admin')
                  ? 'bg-white/80 dark:bg-slate-700 shadow-sm text-primary font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700/50'
              }`}
            >
              <Shield size={18} />
              管理后台
            </button>
          </div>
        )}

        <UserMenu />
      </aside>
    </>
  )
}
