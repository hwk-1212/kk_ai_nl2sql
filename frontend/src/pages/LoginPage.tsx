import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2, Sparkles } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const login = useAuthStore((s) => s.login)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) { setError('请填写邮箱和密码'); return }
    setLoading(true)
    setError('')
    try {
      await login(email, password)
      navigate('/')
    } catch (err: any) {
      setError(err?.message || '登录失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-main px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 btn-gradient rounded-2xl flex items-center justify-center mb-5 shadow-xl shadow-primary/20">
            <Sparkles size={30} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">KK GPT AIBot</h1>
          <p className="text-sm text-slate-500 mt-1">登录到你的账户</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="px-4 py-3 rounded-2xl bg-red-50 border border-red-100 text-sm text-red-500 font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="demo@kk.ai"
              className="w-full px-5 py-3.5 rounded-2xl border border-slate-200 bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary text-sm font-medium"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-5 py-3.5 rounded-2xl border border-slate-200 bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary text-sm font-medium"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 btn-gradient text-white font-semibold text-sm rounded-2xl shadow-lg shadow-primary/20 disabled:opacity-50 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            登录
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          没有账户？{' '}
          <Link to="/register" className="text-primary font-semibold hover:text-primary-dark">
            注册
          </Link>
        </p>
      </div>
    </div>
  )
}
