import { useEffect, useState, useCallback } from 'react'
import { Shield, Search, Plus, X } from 'lucide-react'
import { adminApi } from '@/services/api'

interface AdminUser {
  id: string
  email: string
  nickname: string
  role: string
  tenant_id: string | null
  tenant_name: string | null
  is_active: boolean
  created_at: string
}

interface Tenant {
  id: string
  name: string
}

const roleBadge: Record<string, string> = {
  super_admin: 'bg-red-500/10 text-red-400',
  tenant_admin: 'bg-purple-500/10 text-purple-400',
  user: 'bg-blue-500/10 text-blue-400',
}

const roleLabel: Record<string, string> = {
  super_admin: '超级管理员',
  tenant_admin: '租户管理员',
  user: '普通用户',
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [creating, setCreating] = useState(false)

  // form
  const [formEmail, setFormEmail] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formNickname, setFormNickname] = useState('')
  const [formRole, setFormRole] = useState('user')
  const [formTenant, setFormTenant] = useState('')

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const resp = await adminApi.listUsers({ search, page, page_size: 20 })
      setUsers(resp.items as unknown as AdminUser[])
      setTotal(resp.total)
    } catch { /* */ }
    setLoading(false)
  }, [search, page])

  useEffect(() => { loadUsers() }, [loadUsers])

  useEffect(() => {
    adminApi.listTenants().then((t) => setTenants(t as unknown as Tenant[])).catch(() => {})
  }, [])

  const handleCreate = async () => {
    if (!formEmail || !formPassword) return
    setCreating(true)
    try {
      await adminApi.createUser({
        email: formEmail,
        password: formPassword,
        nickname: formNickname || 'User',
        role: formRole,
        tenant_id: formTenant || undefined,
      })
      setShowCreate(false)
      setFormEmail(''); setFormPassword(''); setFormNickname(''); setFormRole('user'); setFormTenant('')
      loadUsers()
    } catch (e: any) {
      alert(e.message)
    }
    setCreating(false)
  }

  const toggleActive = async (u: AdminUser) => {
    await adminApi.updateUser(u.id, { is_active: !u.is_active })
    loadUsers()
  }

  const changeRole = async (u: AdminUser, newRole: string) => {
    await adminApi.updateUser(u.id, { role: newRole })
    loadUsers()
  }

  const totalPages = Math.ceil(total / 20)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <Shield size={20} />
          用户管理
          <span className="text-sm font-normal text-slate-400 ml-2">共 {total} 人</span>
        </h1>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              placeholder="搜索用户..."
              className="pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl btn-gradient text-white text-sm font-medium"
          >
            <Plus size={14} />
            创建用户
          </button>
        </div>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 dark:text-white">创建用户</h3>
              <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <input value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="邮箱 *" className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm" />
              <input value={formPassword} onChange={(e) => setFormPassword(e.target.value)} placeholder="密码 *" type="password" className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm" />
              <input value={formNickname} onChange={(e) => setFormNickname(e.target.value)} placeholder="昵称" className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm" />
              <select value={formRole} onChange={(e) => setFormRole(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm">
                <option value="user">普通用户</option>
                <option value="tenant_admin">租户管理员</option>
                <option value="super_admin">超级管理员</option>
              </select>
              <select value={formTenant} onChange={(e) => setFormTenant(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm">
                <option value="">-- 选择租户 --</option>
                {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <button onClick={handleCreate} disabled={creating} className="w-full py-2 rounded-xl btn-gradient text-white font-medium text-sm disabled:opacity-50">
                {creating ? '创建中...' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-3xl border border-slate-100 dark:border-slate-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-400">用户</th>
              <th className="text-left px-4 py-3 font-medium text-slate-400">角色</th>
              <th className="text-left px-4 py-3 font-medium text-slate-400">租户</th>
              <th className="text-left px-4 py-3 font-medium text-slate-400">状态</th>
              <th className="text-left px-4 py-3 font-medium text-slate-400">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">加载中...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">无用户</td></tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800 dark:text-white">{u.nickname}</div>
                    <div className="text-xs text-slate-400">{u.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      onChange={(e) => changeRole(u, e.target.value)}
                      className={`text-xs px-2 py-1 rounded-full font-medium border-0 cursor-pointer ${roleBadge[u.role] || 'bg-gray-100 text-gray-500'}`}
                    >
                      <option value="user">{roleLabel.user}</option>
                      <option value="tenant_admin">{roleLabel.tenant_admin}</option>
                      <option value="super_admin">{roleLabel.super_admin}</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{u.tenant_name || '-'}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleActive(u)} className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${u.is_active ? 'bg-green-400' : 'bg-gray-400'}`} />
                      <span className="text-slate-600 dark:text-slate-300">{u.is_active ? '正常' : '禁用'}</span>
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => { if (confirm('确认禁用此用户?')) adminApi.deleteUser(u.id).then(loadUsers) }}
                      className="text-xs text-red-400 hover:text-red-500"
                    >
                      禁用
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              onClick={() => setPage(i + 1)}
              className={`w-8 h-8 rounded-lg text-sm ${page === i + 1 ? 'btn-gradient text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
