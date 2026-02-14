import { useEffect, useState } from 'react'
import { Coins, TrendingUp } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts'
import StatCard from '@/components/admin/StatCard'
import { adminApi } from '@/services/api'

interface BillingSummary {
  total_requests: number
  total_input_tokens: number
  total_output_tokens: number
  total_tokens: number
  total_cost: number
  daily: { date: string; tokens: number; requests: number; cost: number }[]
  by_model: { model: string; tokens: number; requests: number; cost: number }[]
  top_users: { user_id: string; name: string; tokens: number; cost: number }[]
  quota: { quota: number; used: number; unlimited: boolean } | null
  model_pricing: Record<string, { input: number; output: number }>
}

const COLORS = ['#4FD1C5', '#805AD5', '#F6AD55', '#FC8181', '#63B3ED']

export default function BillingPage() {
  const [data, setData] = useState<BillingSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'week' | 'month'>('month')

  useEffect(() => {
    setLoading(true)
    adminApi.billingSummary(period)
      .then((d) => setData(d as unknown as BillingSummary))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [period])

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">加载中...</div>
  if (!data) return <div className="text-slate-400">无数据</div>

  const fmt = (t: number) => t >= 1_000_000 ? `${(t / 1_000_000).toFixed(1)}M` : t >= 1_000 ? `${(t / 1_000).toFixed(0)}K` : String(t)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <Coins size={20} />
          用量计费
        </h1>
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-700 rounded-xl p-1">
          {(['week', 'month'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${period === p ? 'bg-white dark:bg-slate-600 shadow text-primary' : 'text-slate-500'}`}
            >
              {p === 'week' ? '本周' : '本月'}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={TrendingUp} label="请求数" value={data.total_requests.toLocaleString()} />
        <StatCard icon={Coins} label="Token 用量" value={fmt(data.total_tokens)} color="text-amber-500" />
        <StatCard icon={Coins} label="费用" value={`¥${data.total_cost.toFixed(2)}`} color="text-green-500" />
      </div>

      {/* Quota bar */}
      {data.quota && !data.quota.unlimited && (
        <div className="rounded-3xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-slate-500">月度 Token 额度</span>
            <span className="font-bold text-slate-800 dark:text-white">{fmt(data.quota.used)} / {fmt(data.quota.quota)}</span>
          </div>
          <div className="w-full h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-emerald-400 rounded-full transition-all"
              style={{ width: `${Math.min((data.quota.used / data.quota.quota) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Daily trend */}
        <div className="rounded-3xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-3">日用量趋势</h3>
          {data.daily.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={fmt} />
                <Tooltip formatter={((v: unknown) => [fmt(Number(v) || 0), 'Token']) as any} />
                <Bar dataKey="tokens" fill="#4FD1C5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="h-48 flex items-center justify-center text-slate-400 text-sm">暂无数据</div>}
        </div>

        {/* Model distribution */}
        <div className="rounded-3xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-3">模型分布</h3>
          {data.by_model.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={data.by_model} dataKey="tokens" nameKey="model" cx="50%" cy="50%" outerRadius={80} label={({ name }) => name}>
                  {data.by_model.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={((v: unknown) => fmt(Number(v) || 0)) as any} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="h-48 flex items-center justify-center text-slate-400 text-sm">暂无数据</div>}
        </div>
      </div>

      {/* Top Users */}
      {data.top_users.length > 0 && (
        <div className="rounded-3xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-3">Top 用户</h3>
          <div className="space-y-2">
            {data.top_users.map((u, i) => (
              <div key={u.user_id} className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">{i + 1}</span>
                <span className="flex-1 text-sm text-slate-700 dark:text-slate-200 truncate">{u.name}</span>
                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{fmt(u.tokens)}</span>
                <span className="text-xs text-slate-400">¥{u.cost.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Model Pricing */}
      <div className="rounded-3xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-3">模型单价 (¥/1K tokens)</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(data.model_pricing).map(([model, pricing]) => (
            <div key={model} className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3">
              <div className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate">{model}</div>
              <div className="text-xs text-slate-400 mt-1">输入 ¥{pricing.input} / 输出 ¥{pricing.output}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
