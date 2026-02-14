import { useEffect, useState, useCallback } from 'react'
import { ScrollText, ChevronLeft, ChevronRight } from 'lucide-react'
import { adminApi } from '@/services/api'

interface AuditItem {
  id: string
  user_id: string | null
  user_name: string
  action: string
  resource: string
  detail: Record<string, unknown> | null
  ip: string
  created_at: string
}

const ACTION_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'login', label: '登录' },
  { value: 'register', label: '注册' },
  { value: 'chat', label: '对话' },
  { value: 'upload', label: '上传' },
  { value: 'create_user', label: '创建用户' },
  { value: 'update_user', label: '更新用户' },
  { value: 'delete_user', label: '删除用户' },
  { value: 'create_tenant', label: '创建租户' },
  { value: 'update_tenant', label: '更新租户' },
  { value: 'delete_tenant', label: '删除租户' },
  { value: 'update_quota', label: '更新配额' },
]

const actionColors: Record<string, string> = {
  login: 'bg-blue-500/10 text-blue-400',
  register: 'bg-indigo-500/10 text-indigo-400',
  chat: 'bg-green-500/10 text-green-400',
  upload: 'bg-cyan-500/10 text-cyan-400',
  create_user: 'bg-purple-500/10 text-purple-400',
  update_user: 'bg-amber-500/10 text-amber-400',
  delete_user: 'bg-red-500/10 text-red-400',
  create_tenant: 'bg-purple-500/10 text-purple-400',
  update_tenant: 'bg-amber-500/10 text-amber-400',
  delete_tenant: 'bg-red-500/10 text-red-400',
  update_quota: 'bg-emerald-500/10 text-emerald-400',
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [action, setAction] = useState('')
  const [loading, setLoading] = useState(true)

  const pageSize = 30

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const resp = await adminApi.listAuditLogs({ action: action || undefined, page, page_size: pageSize })
      setLogs(resp.items as unknown as AuditItem[])
      setTotal(resp.total)
    } catch { /* */ }
    setLoading(false)
  }, [action, page])

  useEffect(() => { load() }, [load])

  const totalPages = Math.ceil(total / pageSize)

  const formatTime = (iso: string) => {
    if (!iso) return ''
    const d = new Date(iso)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <ScrollText size={20} />
          审计日志
          <span className="text-sm font-normal text-slate-400 ml-2">共 {total} 条</span>
        </h1>
        <select
          value={action}
          onChange={(e) => { setAction(e.target.value); setPage(1) }}
          className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {ACTION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32 text-slate-400">加载中...</div>
      ) : logs.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-slate-400">无日志</div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <div
              key={log.id}
              className="flex items-start gap-3 px-4 py-3 rounded-2xl border border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
            >
              <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-slate-800 dark:text-white">{log.user_name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${actionColors[log.action] || 'bg-gray-500/10 text-gray-400'}`}>
                    {log.action}
                  </span>
                  {log.resource && (
                    <span className="text-sm text-slate-500 dark:text-slate-400 truncate max-w-[200px]">{log.resource}</span>
                  )}
                </div>
                {log.detail && (
                  <p className="text-xs text-slate-400 mt-0.5 truncate">{JSON.stringify(log.detail)}</p>
                )}
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs text-slate-400">{formatTime(log.created_at)}</div>
                <div className="text-xs text-slate-300 dark:text-slate-500">{log.ip}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm text-slate-500">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
