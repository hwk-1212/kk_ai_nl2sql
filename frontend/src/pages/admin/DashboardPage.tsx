import { useEffect, useState } from 'react'
import { Users, MessageSquare, Building, Coins } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import StatCard from '@/components/admin/StatCard'
import { adminApi } from '@/services/api'

interface DashboardData {
  total_users: number
  total_tenants: number
  today_messages: number
  month_tokens: number
  daily_trend: { date: string; tokens: number; requests: number; cost: number }[]
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminApi.dashboard()
      .then((d) => setData(d as unknown as DashboardData))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-slate-400">加载中...</div>
  }

  const d = data!
  const formatTokens = (t: number) => {
    if (t >= 1_000_000) return `${(t / 1_000_000).toFixed(1)}M`
    if (t >= 1_000) return `${(t / 1_000).toFixed(0)}K`
    return String(t)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-800 dark:text-white">管理后台</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="总用户数" value={d.total_users} />
        <StatCard icon={MessageSquare} label="今日消息" value={d.today_messages.toLocaleString()} color="text-green-500" />
        <StatCard icon={Building} label="租户数" value={d.total_tenants} color="text-purple-500" />
        <StatCard icon={Coins} label="本月 Token" value={formatTokens(d.month_tokens)} color="text-amber-500" />
      </div>

      {/* 7日趋势图 */}
      <div className="rounded-3xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-white mb-4">7 日使用趋势</h2>
        {d.daily_trend.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={d.daily_trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => formatTokens(v)} />
              <Tooltip
                formatter={((value: unknown, name?: string) => {
                  const v = Number(value) || 0
                  return [
                    name === 'tokens' ? formatTokens(v) : name === 'cost' ? `¥${v.toFixed(2)}` : v,
                    name === 'tokens' ? 'Token' : name === 'requests' ? '请求数' : '费用',
                  ]
                }) as any}
              />
              <Bar dataKey="tokens" fill="#4FD1C5" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-48 flex items-center justify-center text-slate-400 text-sm">暂无数据</div>
        )}
      </div>
    </div>
  )
}
