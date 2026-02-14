import { useEffect, useState } from 'react'
import { Building, Plus, X, Settings } from 'lucide-react'
import { adminApi } from '@/services/api'

interface TenantItem {
  id: string
  name: string
  config: {
    allowed_models?: string[]
    token_quota?: number
    storage_quota_mb?: number
    max_users?: number
  }
  is_active: boolean
  user_count: number
  created_at: string
  updated_at: string
}

// 提取到组件外部，避免每次 render 重建导致 input 失焦
function TenantModal({
  title,
  formName, setFormName,
  formQuota, setFormQuota,
  formMaxUsers, setFormMaxUsers,
  saving,
  onClose,
  onSave,
}: {
  title: string
  formName: string; setFormName: (v: string) => void
  formQuota: number; setFormQuota: (v: number) => void
  formMaxUsers: number; setFormMaxUsers: (v: number) => void
  saving: boolean
  onClose: () => void
  onSave: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-800 dark:text-white">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1">租户名称</label>
            <input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="租户名称" className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-white" />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">月度 Token 额度 (0=无限制)</label>
            <input type="number" value={formQuota} onChange={(e) => setFormQuota(Number(e.target.value))} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-white" />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">最大用户数</label>
            <input type="number" value={formMaxUsers} onChange={(e) => setFormMaxUsers(Number(e.target.value))} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-white" />
          </div>
          <button onClick={onSave} disabled={saving} className="w-full py-2 rounded-xl btn-gradient text-white font-medium text-sm disabled:opacity-50">
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function TenantManagementPage() {
  const [tenants, setTenants] = useState<TenantItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editTenant, setEditTenant] = useState<TenantItem | null>(null)
  const [formName, setFormName] = useState('')
  const [formQuota, setFormQuota] = useState(0)
  const [formMaxUsers, setFormMaxUsers] = useState(100)
  const [saving, setSaving] = useState(false)

  const loadTenants = async () => {
    setLoading(true)
    try {
      const resp = await adminApi.listTenants()
      setTenants(resp as unknown as TenantItem[])
    } catch { /* */ }
    setLoading(false)
  }

  useEffect(() => { loadTenants() }, [])

  const handleCreate = async () => {
    if (!formName.trim()) return
    setSaving(true)
    try {
      await adminApi.createTenant({
        name: formName,
        config: { token_quota: formQuota, max_users: formMaxUsers, allowed_models: ['deepseek-chat', 'deepseek-reasoner', 'qwen-plus'] },
      })
      setShowCreate(false)
      setFormName(''); setFormQuota(0); setFormMaxUsers(100)
      loadTenants()
    } catch (e: any) { alert(e.message) }
    setSaving(false)
  }

  const handleUpdate = async () => {
    if (!editTenant) return
    setSaving(true)
    try {
      await adminApi.updateTenant(editTenant.id, {
        name: formName,
        config: { ...editTenant.config, token_quota: formQuota, max_users: formMaxUsers },
      })
      setEditTenant(null)
      loadTenants()
    } catch (e: any) { alert(e.message) }
    setSaving(false)
  }

  const openEdit = (t: TenantItem) => {
    setEditTenant(t)
    setFormName(t.name)
    setFormQuota(t.config.token_quota || 0)
    setFormMaxUsers(t.config.max_users || 100)
  }

  const formatQuota = (q: number) => q <= 0 ? '无限制' : q >= 1_000_000 ? `${(q / 1_000_000).toFixed(1)}M` : `${(q / 1_000).toFixed(0)}K`

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <Building size={20} />
          租户管理
        </h1>
        <button
          onClick={() => { setShowCreate(true); setFormName(''); setFormQuota(0); setFormMaxUsers(100) }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl btn-gradient text-white text-sm font-medium"
        >
          <Plus size={14} />
          新建租户
        </button>
      </div>

      {showCreate && (
        <TenantModal
          title="新建租户"
          formName={formName} setFormName={setFormName}
          formQuota={formQuota} setFormQuota={setFormQuota}
          formMaxUsers={formMaxUsers} setFormMaxUsers={setFormMaxUsers}
          saving={saving}
          onClose={() => setShowCreate(false)}
          onSave={handleCreate}
        />
      )}
      {editTenant && (
        <TenantModal
          title="编辑租户"
          formName={formName} setFormName={setFormName}
          formQuota={formQuota} setFormQuota={setFormQuota}
          formMaxUsers={formMaxUsers} setFormMaxUsers={setFormMaxUsers}
          saving={saving}
          onClose={() => setEditTenant(null)}
          onSave={handleUpdate}
        />
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32 text-slate-400">加载中...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tenants.map((t) => (
            <div key={t.id} className="rounded-3xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 hover:border-primary/50 transition">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-400">
                    <Building size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800 dark:text-white">{t.name}</h3>
                    <p className="text-xs text-slate-400">
                      {t.is_active ? '活跃' : '已禁用'} · 创建于 {t.created_at?.split('T')[0]}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400">
                    <Settings size={14} />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <span className="text-slate-400 text-xs block">用户数</span>
                  <span className="font-bold text-slate-800 dark:text-white">{t.user_count}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-xs block">Token 额度</span>
                  <span className="font-bold text-slate-800 dark:text-white">{formatQuota(t.config.token_quota || 0)}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-xs block">最大用户</span>
                  <span className="font-bold text-slate-800 dark:text-white">{t.config.max_users || '∞'}</span>
                </div>
              </div>
              {!t.is_active && (
                <div className="mt-2 text-xs text-red-400 font-medium">已禁用</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
