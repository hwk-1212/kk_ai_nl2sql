import { useEffect, useState, useCallback } from 'react'
import { ScrollText, ChevronLeft, ChevronRight, Database, BarChart3 } from 'lucide-react'
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

interface DataAuditItem {
  id: string
  user_id: string
  action: string
  table_name: string | null
  sql_text: string | null
  execution_ms: number | null
  result_row_count: number | null
  status: string
  error_message: string | null
  created_at: string | null
}

type TabKind = 'system' | 'data'

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

const DATA_ACTION_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'query', label: '查询' },
  { value: 'write', label: '写入' },
  { value: 'denied', label: '拒绝' },
  { value: 'upload', label: '上传' },
  { value: 'drop_table', label: '删表' },
]

const DATA_STATUS_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'success', label: '成功' },
  { value: 'failed', label: '失败' },
  { value: 'denied', label: '拒绝' },
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
  query: 'bg-green-500/10 text-green-400',
  write: 'bg-amber-500/10 text-amber-400',
  denied: 'bg-red-500/10 text-red-400',
  drop_table: 'bg-red-500/10 text-red-400',
}

const statusColors: Record<string, string> = {
  success: 'text-green-500',
  failed: 'text-red-500',
  denied: 'text-orange-500',
}

export default function AuditLogsPage() {
  const [tab, setTab] = useState<TabKind>('system')
  const [logs, setLogs] = useState<AuditItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [action, setAction] = useState('')
  const [loading, setLoading] = useState(true)

  const [dataLogs, setDataLogs] = useState<DataAuditItem[]>([])
  const [dataTotal, setDataTotal] = useState(0)
  const [dataPage, setDataPage] = useState(1)
  const [dataAction, setDataAction] = useState('')
  const [dataStatus, setDataStatus] = useState('')
  const [dataStartDate, setDataStartDate] = useState('')
  const [dataEndDate, setDataEndDate] = useState('')
  const [dataLoading, setDataLoading] = useState(false)
  const [dataStats, setDataStats] = useState<{
    period_days: number
    total_operations: number
    avg_execution_ms: number
    failure_rate: number
    daily_trend: { date: string; count: number }[]
    top_tables: { table: string; count: number }[]
    by_status?: Record<string, number>
  } | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [detailCache, setDetailCache] = useState<Record<string, Record<string, unknown>>>({})

  const pageSize = 30
  const dataPageSize = 20

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const resp = await adminApi.listAuditLogs({ action: action || undefined, page, page_size: pageSize })
      setLogs(resp.items as unknown as AuditItem[])
      setTotal(resp.total)
    } catch { /* */ }
    setLoading(false)
  }, [action, page])

  const loadDataAudit = useCallback(async () => {
    setDataLoading(true)
    try {
      const resp = await adminApi.dataAudit.list({
        action: dataAction || undefined,
        status: dataStatus || undefined,
        start_date: dataStartDate || undefined,
        end_date: dataEndDate || undefined,
        page: dataPage,
        page_size: dataPageSize,
      })
      const items = (resp.items || []) as unknown as DataAuditItem[]
      setDataLogs(items)
      setDataTotal(resp.total)
    } catch { /* */ }
    setDataLoading(false)
  }, [dataAction, dataStatus, dataStartDate, dataEndDate, dataPage])

  const loadDataStats = useCallback(async () => {
    try {
      const s = await adminApi.dataAudit.stats(7)
      setDataStats(s as typeof dataStats)
    } catch { /* */ }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (tab === 'data') {
      loadDataAudit()
      loadDataStats()
    }
  }, [tab, loadDataAudit, loadDataStats])

  const totalPages = Math.ceil(total / pageSize)
  const dataTotalPages = Math.ceil(dataTotal / dataPageSize)

  const formatTime = (iso: string) => {
    if (!iso) return ''
    const d = new Date(iso)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  const sqlSummary = (sql: string | null) => {
    if (!sql) return '-'
    const t = sql.replace(/\s+/g, ' ').trim()
    return t.length > 80 ? t.slice(0, 80) + '…' : t
  }

  const loadDetail = async (logId: string) => {
    if (detailCache[logId]) return
    try {
      const d = await adminApi.dataAudit.getDetail(logId)
      setDetailCache((prev) => ({ ...prev, [logId]: d }))
    } catch { /* */ }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <ScrollText size={20} />
          审计日志
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => setTab('system')}
            className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${tab === 'system' ? 'bg-primary/10 text-primary' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          >
            系统审计
          </button>
          <button
            onClick={() => setTab('data')}
            className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-1.5 ${tab === 'data' ? 'bg-primary/10 text-primary' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          >
            <Database size={16} />
            数据审计
          </button>
        </div>
      </div>

      {tab === 'system' && (
        <>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <span className="text-sm text-slate-400">共 {total} 条</span>
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

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm text-slate-500">{page} / {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}

      {tab === 'data' && (
        <>
          {dataStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 p-4">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs mb-1">
                  <BarChart3 size={14} />
                  近 {dataStats.period_days} 天操作量
                </div>
                <div className="text-xl font-bold text-slate-800 dark:text-white">{dataStats.total_operations}</div>
              </div>
              <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 p-4">
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">平均耗时</div>
                <div className="text-xl font-bold text-slate-800 dark:text-white">{dataStats.avg_execution_ms ?? 0} ms</div>
              </div>
              <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 p-4">
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">失败/拒绝率</div>
                <div className={`text-xl font-bold ${(dataStats.failure_rate ?? 0) > 5 ? 'text-red-500' : 'text-slate-800 dark:text-white'}`}>
                  {dataStats.failure_rate ?? 0}%
                </div>
              </div>
              <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 p-4">
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">高频表 Top 5</div>
                <div className="text-sm font-medium text-slate-800 dark:text-white">
                  {dataStats.top_tables?.length ? dataStats.top_tables[0]?.table ?? '-' : '-'}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={dataAction}
              onChange={(e) => { setDataAction(e.target.value); setDataPage(1) }}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {DATA_ACTION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select
              value={dataStatus}
              onChange={(e) => { setDataStatus(e.target.value); setDataPage(1) }}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {DATA_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <input
              type="date"
              value={dataStartDate}
              onChange={(e) => { setDataStartDate(e.target.value); setDataPage(1) }}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none dark:text-white"
            />
            <span className="text-slate-400">至</span>
            <input
              type="date"
              value={dataEndDate}
              onChange={(e) => { setDataEndDate(e.target.value); setDataPage(1) }}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none dark:text-white"
            />
            <span className="text-sm text-slate-400">共 {dataTotal} 条</span>
          </div>

          {dataLoading ? (
            <div className="flex items-center justify-center h-32 text-slate-400">加载中...</div>
          ) : dataLogs.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-slate-400">无数据审计记录</div>
          ) : (
            <div className="space-y-2">
              {dataLogs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 overflow-hidden"
                >
                  <button
                    onClick={() => {
                      setExpandedId(expandedId === log.id ? null : log.id)
                      if (expandedId !== log.id) loadDetail(log.id)
                    }}
                    className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
                  >
                    <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{log.user_id}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${actionColors[log.action] || 'bg-gray-500/10 text-gray-400'}`}>
                          {log.action}
                        </span>
                        {log.table_name && (
                          <span className="text-sm text-slate-600 dark:text-slate-300">{log.table_name}</span>
                        )}
                        <span className={`text-xs font-medium ${statusColors[log.status] || 'text-slate-500'}`}>
                          {log.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 font-mono truncate">{sqlSummary(log.sql_text)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs text-slate-400">{log.created_at ? formatTime(log.created_at) : '-'}</div>
                      {log.execution_ms != null && (
                        <div className="text-xs text-slate-500">{log.execution_ms} ms</div>
                      )}
                      {log.result_row_count != null && log.action === 'query' && (
                        <div className="text-xs text-slate-500">{log.result_row_count} 行</div>
                      )}
                    </div>
                  </button>
                  {expandedId === log.id && (
                    <div className="px-4 pb-4 pt-0 border-t border-slate-100 dark:border-slate-700">
                      {detailCache[log.id] ? (
                        <div className="space-y-2 text-sm">
                          <div>
                            <span className="text-slate-500 dark:text-slate-400">SQL：</span>
                            <pre className="mt-1 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 overflow-x-auto text-xs font-mono text-slate-700 dark:text-slate-300">
                              {(detailCache[log.id].sql_text as string) || '-'}
                            </pre>
                          </div>
                          {(detailCache[log.id].affected_rows as number) != null && (detailCache[log.id].affected_rows as number) > 0 && (
                            <p className="text-slate-500">影响行数: {String(detailCache[log.id].affected_rows)}</p>
                          )}
                          {(detailCache[log.id].error_message as string) && (
                            <p className="text-red-500">{String(detailCache[log.id].error_message)}</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-slate-400 text-xs">加载详情中...</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {dataTotalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setDataPage((p) => Math.max(1, p - 1))}
                disabled={dataPage <= 1}
                className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm text-slate-500">{dataPage} / {dataTotalPages}</span>
              <button
                onClick={() => setDataPage((p) => Math.min(dataTotalPages, p + 1))}
                disabled={dataPage >= dataTotalPages}
                className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
