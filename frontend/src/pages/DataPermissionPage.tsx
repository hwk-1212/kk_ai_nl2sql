import { useState } from 'react'
import { Plus, ShieldCheck, Trash2, Search, X } from 'lucide-react'
import type { DataRole, RoleTablePermission, RoleColumnPermission, RoleRowFilter } from '@/types'
import EmptyState from '@/components/common/EmptyState'
import Modal from '@/components/common/Modal'
import { MOCK_DATA_ROLES } from '@/mocks/reports'

const MOCK_TABLE_PERMISSIONS: Record<string, RoleTablePermission[]> = {
  'role-1': [
    { tableId: 'dt-1', tableName: '订单明细表', canRead: true, canWrite: false },
    { tableId: 'dt-2', tableName: '订单表', canRead: true, canWrite: false },
    { tableId: 'dt-5', tableName: '商品表', canRead: true, canWrite: false },
  ],
  'role-2': [
    { tableId: 'dt-3', tableName: '财务汇总表', canRead: true, canWrite: false },
  ],
  'role-3': [
    { tableId: 'dt-1', tableName: '订单明细表', canRead: true, canWrite: true },
    { tableId: 'dt-2', tableName: '订单表', canRead: true, canWrite: true },
    { tableId: 'dt-3', tableName: '财务汇总表', canRead: true, canWrite: true },
    { tableId: 'dt-5', tableName: '商品表', canRead: true, canWrite: true },
    { tableId: 'dt-6', tableName: '客户表', canRead: true, canWrite: true },
  ],
}

const MOCK_COLUMN_PERMISSIONS: Record<string, Record<string, RoleColumnPermission[]>> = {
  'role-2': {
    'dt-3': [
      { columnName: 'revenue', visible: true, maskType: 'none' },
      { columnName: 'cost', visible: false },
      { columnName: 'profit', visible: true, maskType: 'full_mask' },
      { columnName: 'contact_phone', visible: true, maskType: 'phone' },
    ],
  },
}

const MOCK_ROW_FILTERS: Record<string, RoleRowFilter[]> = {
  'role-1': [
    { id: 'rf-1', filterExpression: "region = '华东'", description: '仅可查看华东地区数据' },
    { id: 'rf-2', filterExpression: "order_date >= '2026-01-01'", description: '仅查看2026年数据' },
  ],
}

const MOCK_USERS: Record<string, { id: string; name: string; email: string }[]> = {
  'role-1': [
    { id: 'u2', name: '张明', email: 'zhangming@example.com' },
    { id: 'u3', name: '李华', email: 'lihua@example.com' },
    { id: 'u4', name: '王芳', email: 'wangfang@example.com' },
  ],
  'role-2': [
    { id: 'u5', name: '赵磊', email: 'zhaolei@example.com' },
    { id: 'u6', name: '陈静', email: 'chenjing@example.com' },
  ],
  'role-3': [
    { id: 'u7', name: '周伟', email: 'zhouwei@example.com' },
  ],
}

const MASK_OPTIONS: { value: NonNullable<RoleColumnPermission['maskType']>; label: string }[] = [
  { value: 'none', label: '无' },
  { value: 'phone', label: '手机号' },
  { value: 'email', label: '邮箱' },
  { value: 'id_card', label: '身份证' },
  { value: 'full_mask', label: '完全脱敏' },
  { value: 'last4', label: '仅显示后4位' },
]

type DetailTab = 'tables' | 'columns' | 'rows' | 'users'

const DETAIL_TABS: { key: DetailTab; label: string }[] = [
  { key: 'tables', label: '表级权限' },
  { key: 'columns', label: '列级权限' },
  { key: 'rows', label: '行过滤' },
  { key: 'users', label: '用户分配' },
]

export default function DataPermissionPage() {
  const [roles, setRoles] = useState<DataRole[]>([...MOCK_DATA_ROLES])
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null)
  const [detailTab, setDetailTab] = useState<DetailTab>('tables')
  const [roleModalOpen, setRoleModalOpen] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')
  const [newRoleDesc, setNewRoleDesc] = useState('')

  const [tablePerms, setTablePerms] = useState<Record<string, RoleTablePermission[]>>({ ...MOCK_TABLE_PERMISSIONS })
  const [colPerms, setColPerms] = useState<Record<string, Record<string, RoleColumnPermission[]>>>({ ...MOCK_COLUMN_PERMISSIONS })
  const [rowFilters, setRowFilters] = useState<Record<string, RoleRowFilter[]>>({ ...MOCK_ROW_FILTERS })
  const [users, setUsers] = useState<Record<string, { id: string; name: string; email: string }[]>>({ ...MOCK_USERS })

  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
  const [newFilterExpr, setNewFilterExpr] = useState('')
  const [newFilterDesc, setNewFilterDesc] = useState('')
  const [userSearch, setUserSearch] = useState('')

  const selectedRole = roles.find((r) => r.id === selectedRoleId)

  const addRole = () => {
    if (!newRoleName.trim()) return
    const id = `role-${Date.now()}`
    setRoles((prev) => [...prev, { id, name: newRoleName.trim(), description: newRoleDesc.trim() || undefined, userCount: 0, createdAt: new Date().toISOString() }])
    setRoleModalOpen(false)
    setNewRoleName('')
    setNewRoleDesc('')
  }

  const toggleTablePerm = (roleId: string, tableId: string, field: 'canRead' | 'canWrite') => {
    setTablePerms((prev) => {
      const arr = prev[roleId] ?? []
      return { ...prev, [roleId]: arr.map((t) => (t.tableId === tableId ? { ...t, [field]: !t[field] } : t)) }
    })
  }

  const toggleColVisible = (roleId: string, tableId: string, colName: string) => {
    setColPerms((prev) => {
      const roleObj = prev[roleId] ?? {}
      const arr = roleObj[tableId] ?? []
      return { ...prev, [roleId]: { ...roleObj, [tableId]: arr.map((c) => (c.columnName === colName ? { ...c, visible: !c.visible } : c)) } }
    })
  }

  const setColMask = (roleId: string, tableId: string, colName: string, mask: RoleColumnPermission['maskType']) => {
    setColPerms((prev) => {
      const roleObj = prev[roleId] ?? {}
      const arr = roleObj[tableId] ?? []
      return { ...prev, [roleId]: { ...roleObj, [tableId]: arr.map((c) => (c.columnName === colName ? { ...c, maskType: mask } : c)) } }
    })
  }

  const addRowFilter = (roleId: string) => {
    if (!newFilterExpr.trim()) return
    setRowFilters((prev) => ({
      ...prev,
      [roleId]: [...(prev[roleId] ?? []), { id: `rf-${Date.now()}`, filterExpression: newFilterExpr.trim(), description: newFilterDesc.trim() || undefined }],
    }))
    setNewFilterExpr('')
    setNewFilterDesc('')
  }

  const deleteRowFilter = (roleId: string, filterId: string) => {
    setRowFilters((prev) => ({
      ...prev,
      [roleId]: (prev[roleId] ?? []).filter((f) => f.id !== filterId),
    }))
  }

  const removeUser = (roleId: string, userId: string) => {
    setUsers((prev) => ({
      ...prev,
      [roleId]: (prev[roleId] ?? []).filter((u) => u.id !== userId),
    }))
  }

  const inputCls =
    'w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 dark:text-white'

  const roleTables = selectedRoleId ? tablePerms[selectedRoleId] ?? [] : []
  const roleColPerms = selectedRoleId ? colPerms[selectedRoleId] ?? {} : {}
  const roleRowFilters = selectedRoleId ? rowFilters[selectedRoleId] ?? [] : []
  const roleUsers = selectedRoleId ? users[selectedRoleId] ?? [] : []

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-700/50">
        <h1 className="text-xl font-bold text-slate-800 dark:text-white">数据权限管理</h1>
        <button
          onClick={() => setRoleModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl btn-gradient text-white text-sm font-semibold shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
        >
          <Plus size={16} />
          新建角色
        </button>
      </div>

      {/* Body: left-right split */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Role list */}
        <div className="w-80 shrink-0 border-r border-slate-100 dark:border-slate-700/50 overflow-y-auto p-4 space-y-2">
          {roles.map((r) => (
            <button
              key={r.id}
              onClick={() => { setSelectedRoleId(r.id); setDetailTab('tables'); setSelectedTableId(null) }}
              className={`w-full text-left rounded-2xl p-4 transition-all ${
                selectedRoleId === r.id
                  ? 'bg-primary/10 border border-primary/30 dark:bg-primary/20'
                  : 'bg-white/80 dark:bg-slate-800/80 backdrop-blur border border-slate-100 dark:border-slate-700 hover:border-slate-200 dark:hover:border-slate-600'
              }`}
            >
              <h4 className="font-bold text-sm text-slate-800 dark:text-white">{r.name}</h4>
              {r.description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{r.description}</p>}
              <p className="text-xs text-slate-400 mt-2">{r.userCount} 位用户</p>
            </button>
          ))}
        </div>

        {/* Right: Role detail */}
        <div className="flex-1 overflow-y-auto p-6">
          {!selectedRole ? (
            <EmptyState icon={ShieldCheck} title="请选择角色" description="从左侧列表选择一个角色查看权限配置" />
          ) : (
            <>
              <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4">{selectedRole.name}</h2>

              {/* Detail tabs */}
              <div className="flex gap-1 mb-4">
                {DETAIL_TABS.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => { setDetailTab(t.key); setSelectedTableId(null) }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                      detailTab === t.key
                        ? 'bg-primary/10 text-primary dark:bg-primary/20'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Table Permissions */}
              {detailTab === 'tables' && (
                <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-700">
                        <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400">数据表</th>
                        <th className="text-center px-4 py-3 font-medium text-slate-500 dark:text-slate-400">读取</th>
                        <th className="text-center px-4 py-3 font-medium text-slate-500 dark:text-slate-400">写入</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roleTables.map((t) => (
                        <tr key={t.tableId} className="border-b border-slate-50 dark:border-slate-700/50">
                          <td className="px-4 py-3 text-slate-800 dark:text-white font-medium">{t.tableName}</td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => toggleTablePerm(selectedRole.id, t.tableId, 'canRead')}
                              className={`w-5 h-5 rounded-md border-2 transition-colors ${t.canRead ? 'bg-primary border-primary' : 'border-slate-300 dark:border-slate-600'}`}
                            >
                              {t.canRead && <svg className="w-full h-full text-white" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => toggleTablePerm(selectedRole.id, t.tableId, 'canWrite')}
                              className={`w-5 h-5 rounded-md border-2 transition-colors ${t.canWrite ? 'bg-primary border-primary' : 'border-slate-300 dark:border-slate-600'}`}
                            >
                              {t.canWrite && <svg className="w-full h-full text-white" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {roleTables.length === 0 && <p className="text-center text-slate-400 py-10 text-sm">暂无表权限配置</p>}
                </div>
              )}

              {/* Column Permissions */}
              {detailTab === 'columns' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">选择数据表</label>
                    <select
                      value={selectedTableId ?? ''}
                      onChange={(e) => setSelectedTableId(e.target.value || null)}
                      className={inputCls}
                    >
                      <option value="">请选择...</option>
                      {roleTables.map((t) => (
                        <option key={t.tableId} value={t.tableId}>{t.tableName}</option>
                      ))}
                    </select>
                  </div>

                  {selectedTableId && (roleColPerms[selectedTableId]?.length ?? 0) > 0 && (
                    <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-100 dark:border-slate-700">
                            <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400">字段</th>
                            <th className="text-center px-4 py-3 font-medium text-slate-500 dark:text-slate-400">可见</th>
                            <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400">脱敏方式</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(roleColPerms[selectedTableId] ?? []).map((c) => (
                            <tr key={c.columnName} className="border-b border-slate-50 dark:border-slate-700/50">
                              <td className="px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">{c.columnName}</td>
                              <td className="px-4 py-3 text-center">
                                <button
                                  onClick={() => toggleColVisible(selectedRole.id, selectedTableId!, c.columnName)}
                                  className={`w-5 h-5 rounded-md border-2 transition-colors ${c.visible ? 'bg-primary border-primary' : 'border-slate-300 dark:border-slate-600'}`}
                                >
                                  {c.visible && <svg className="w-full h-full text-white" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                                </button>
                              </td>
                              <td className="px-4 py-3">
                                <select
                                  value={c.maskType ?? 'none'}
                                  onChange={(e) => setColMask(selectedRole.id, selectedTableId!, c.columnName, e.target.value as RoleColumnPermission['maskType'])}
                                  className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs focus:outline-none dark:text-white"
                                >
                                  {MASK_OPTIONS.map((o) => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                  ))}
                                </select>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {selectedTableId && (roleColPerms[selectedTableId]?.length ?? 0) === 0 && (
                    <p className="text-center text-slate-400 py-10 text-sm">该表暂无列级权限配置</p>
                  )}
                </div>
              )}

              {/* Row Filters */}
              {detailTab === 'rows' && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur overflow-hidden">
                    {roleRowFilters.length > 0 ? (
                      <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
                        {roleRowFilters.map((f) => (
                          <div key={f.id} className="flex items-center justify-between px-4 py-3">
                            <div>
                              <code className="text-xs font-mono text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 px-2 py-1 rounded-lg">{f.filterExpression}</code>
                              {f.description && <p className="text-xs text-slate-500 mt-1">{f.description}</p>}
                            </div>
                            <button onClick={() => deleteRowFilter(selectedRole.id, f.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-slate-400 py-10 text-sm">暂无行过滤规则</p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <input value={newFilterExpr} onChange={(e) => setNewFilterExpr(e.target.value)} placeholder="过滤表达式，如 region = '华东'" className={`${inputCls} font-mono flex-1`} />
                    <input value={newFilterDesc} onChange={(e) => setNewFilterDesc(e.target.value)} placeholder="描述（可选）" className={`${inputCls} flex-1`} />
                    <button onClick={() => addRowFilter(selectedRole.id)} className="px-4 py-2.5 rounded-xl btn-gradient text-white text-sm font-semibold shrink-0 active:scale-[0.98]">
                      添加
                    </button>
                  </div>
                </div>
              )}

              {/* User Assignment */}
              {detailTab === 'users' && (
                <div className="space-y-4">
                  <div className="relative">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="搜索用户名或邮箱..."
                      className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-600 bg-white/80 dark:bg-slate-800/80 backdrop-blur text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 dark:text-white"
                    />
                  </div>

                  <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur overflow-hidden">
                    {roleUsers.length > 0 ? (
                      <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
                        {roleUsers
                          .filter((u) => !userSearch || u.name.includes(userSearch) || u.email.includes(userSearch))
                          .map((u) => (
                            <div key={u.id} className="flex items-center justify-between px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                                  {u.name[0]}
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-slate-800 dark:text-white">{u.name}</p>
                                  <p className="text-xs text-slate-400">{u.email}</p>
                                </div>
                              </div>
                              <button
                                onClick={() => removeUser(selectedRole.id, u.id)}
                                className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <p className="text-center text-slate-400 py-10 text-sm">暂无已分配用户</p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* New Role Modal */}
      <Modal open={roleModalOpen} onClose={() => setRoleModalOpen(false)} title="新建角色">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">角色名称</label>
            <input value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} placeholder="销售分析师" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">描述</label>
            <textarea value={newRoleDesc} onChange={(e) => setNewRoleDesc(e.target.value)} rows={2} placeholder="角色权限描述..." className={`${inputCls} resize-none`} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setRoleModalOpen(false)} className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">取消</button>
            <button onClick={addRole} className="px-5 py-2.5 rounded-xl btn-gradient text-white text-sm font-semibold shadow-lg shadow-primary/20 active:scale-[0.98]">保存</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
