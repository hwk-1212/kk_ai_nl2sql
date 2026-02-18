import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2, Sparkles } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const register = useAuthStore((s) => s.register)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !email || !password) { setError('请填写所有字段'); return }
    if (password !== confirm) { setError('两次密码不一致'); return }
    if (password.length < 6) { setError('密码长度至少 6 位'); return }
    setLoading(true)
    setError('')
    try {
      await register(email, password, name)
      navigate('/')
    } catch (err: any) {
      setError(err?.message || '注册失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const inputClass = "w-full px-5 py-3.5 rounded-2xl border border-slate-200 bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary text-sm font-medium"

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-main px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 btn-gradient rounded-2xl flex items-center justify-center mb-5 shadow-xl shadow-primary/20">
            <Sparkles size={30} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">创建账户</h1>
          <p className="text-sm text-slate-500 mt-1">注册 KK NL2SQL AIBot</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="px-4 py-3 rounded-2xl bg-red-50 border border-red-100 text-sm text-red-500 font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">昵称</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="你的昵称" className={inputClass} />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">邮箱</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="demo@kk.ai" className={inputClass} />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">密码</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="至少 6 位" className={inputClass} />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">确认密码</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="再输入一次密码" className={inputClass} />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 btn-gradient text-white font-semibold text-sm rounded-2xl shadow-lg shadow-primary/20 disabled:opacity-50 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            注册
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          已有账户？{' '}
          <Link to="/login" className="text-primary font-semibold hover:text-primary-dark">
            登录
          </Link>
        </p>
      </div>
    </div>
  )
}
