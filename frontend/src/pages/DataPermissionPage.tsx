import { useState, useEffect, useCallback } from 'react'
import { Plus, ShieldCheck, Trash2, Search, X } from 'lucide-react'
import type { DataRole, RoleTablePermission, RoleColumnPermission, RoleRowFilter } from '@/types'
import EmptyState from '@/components/common/EmptyState'
import Modal from '@/components/common/Modal'
import { dataPermissionApi, dataApi, adminApi } from '@/services/api'

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

function permissionToReadWrite(permission: string): { canRead: boolean; canWrite: boolean } {
  if (permission === 'admin' || permission === 'write') return { canRead: true, canWrite: true }
  if (permission === 'read') return { canRead: true, canWrite: false }
  return { canRead: false, canWrite: false }
}

function readWriteToPermission(canRead: boolean, canWrite: boolean): 'read' | 'write' | 'admin' {
  if (!canRead) return 'read'
  if (canWrite) return 'write'
  return 'read'
}

export default function DataPermissionPage() {
  const [roles, setRoles] = useState<DataRole[]>([])
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null)
  const [detailTab, setDetailTab] = useState<DetailTab>('tables')
  const [roleModalOpen, setRoleModalOpen] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')
  const [newRoleDesc, setNewRoleDesc] = useState('')

  const [tablePerms, setTablePerms] = useState<Record<string, RoleTablePermission[]>>({})
  const [colPerms, setColPerms] = useState<Record<string, Record<string, RoleColumnPermission[]>>>({})
  const [rowFilters, setRowFilters] = useState<Record<string, RoleRowFilter[]>>({})
  const [assignedUserIds, setAssignedUserIds] = useState<Record<string, string[]>>({})

  const [allTables, setAllTables] = useState<{ id: string; display_name: string }[]>([])
  const [allUsers, setAllUsers] = useState<{ id: string; name: string; email: string }[]>([])
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
  const [newFilterExpr, setNewFilterExpr] = useState('')
  const [newFilterDesc, setNewFilterDesc] = useState('')
  const [userSearch, setUserSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [addTableModalOpen, setAddTableModalOpen] = useState(false)
  const [addUserModalOpen, setAddUserModalOpen] = useState(false)

  const selectedRole = roles.find((r) => r.id === selectedRoleId)

  const loadRoles = useCallback(async () => {
    setLoading(true)
    try {
      const list = await dataPermissionApi.listRoles()
      setRoles(
        list.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description ?? undefined,
          userCount: assignedUserIds[r.id]?.length ?? 0,
          createdAt: '',
        }))
      )
    } catch (e) {
      console.error('Failed to load roles', e)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadRoleDetail = useCallback(
    async (roleId: string) => {
      setDetailLoading(true)
      try {
        const detail = await dataPermissionApi.getRole(roleId)
        const tp: RoleTablePermission[] = detail.table_permissions.map((t) => {
          const { canRead, canWrite } = permissionToReadWrite(t.permission)
          return { tableId: t.table_id, tableName: t.table_name, canRead, canWrite }
        })
        const cp: Record<string, RoleColumnPermission[]> = {}
        for (const c of detail.column_permissions) {
          if (!cp[c.table_id]) cp[c.table_id] = []
          const visible = c.visibility === 'visible' || c.visibility === 'masked'
          const maskType = (c.masking_rule as RoleColumnPermission['maskType']) ?? 'none'
          cp[c.table_id].push({ columnName: c.column_name, visible, maskType: maskType === 'none' ? undefined : maskType })
        }
        const rf: RoleRowFilter[] = detail.row_filters.map((r) => ({
          id: r.id,
          filterExpression: r.filter_expression,
          description: r.description ?? undefined,
          tableId: r.table_id,
        }))
        setTablePerms((prev) => ({ ...prev, [roleId]: tp }))
        setColPerms((prev) => ({ ...prev, [roleId]: cp }))
        setRowFilters((prev) => ({ ...prev, [roleId]: rf }))
        setAssignedUserIds((prev) => ({ ...prev, [roleId]: detail.assigned_user_ids }))
        setRoles((prev) =>
          prev.map((r) => (r.id === roleId ? { ...r, userCount: detail.assigned_user_ids.length } : r))
        )
      } catch (e) {
        console.error('Failed to load role detail', e)
      } finally {
        setDetailLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    loadRoles()
  }, [loadRoles])

  useEffect(() => {
    if (selectedRoleId) loadRoleDetail(selectedRoleId)
  }, [selectedRoleId, loadRoleDetail])

  useEffect(() => {
    dataApi.getTables(0, 500).then((res) => {
      setAllTables(res.items.map((t) => ({ id: t.id, display_name: t.display_name || t.name })))
    })
  }, [])

  useEffect(() => {
    adminApi.listUsers({ page_size: 500 }).then((res) => {
      const items = (res.items || []) as { id: string; nickname?: string; email?: string }[]
      setAllUsers(
        items.map((u) => ({
          id: u.id,
          name: (u.nickname as string) || (u.email as string) || u.id,
          email: (u.email as string) || '',
        }))
      )
    })
  }, [])

  const addRole = async () => {
    if (!newRoleName.trim()) return
    try {
      const created = await dataPermissionApi.createRole({
        name: newRoleName.trim(),
        description: newRoleDesc.trim() || undefined,
      })
      setRoleModalOpen(false)
      setNewRoleName('')
      setNewRoleDesc('')
      await loadRoles()
      setSelectedRoleId(created.id)
      loadRoleDetail(created.id)
    } catch (e) {
      console.error('Create role failed', e)
    }
  }

  const deleteRole = async (roleId: string) => {
    if (!confirm('确定删除该角色？')) return
    try {
      await dataPermissionApi.deleteRole(roleId)
      if (selectedRoleId === roleId) setSelectedRoleId(null)
      await loadRoles()
    } catch (e) {
      console.error('Delete role failed', e)
    }
  }

  const toggleTablePerm = async (roleId: string, tableId: string, field: 'canRead' | 'canWrite') => {
    const arr = tablePerms[roleId] ?? []
    const t = arr.find((x) => x.tableId === tableId)
    if (!t) return
    const next = { ...t, [field]: !t[field] }
    const permission = readWriteToPermission(next.canRead, next.canWrite)
    try {
      await dataPermissionApi.setTablePermission(roleId, tableId, permission)
      setTablePerms((prev) => ({
        ...prev,
        [roleId]: arr.map((x) => (x.tableId === tableId ? next : x)),
      }))
    } catch (e) {
      console.error('Set table permission failed', e)
    }
  }

  const addTableToRole = async (roleId: string, tableId: string, permission: 'read' | 'write') => {
    try {
      await dataPermissionApi.setTablePermission(roleId, tableId, permission)
      const table = allTables.find((x) => x.id === tableId)
      const perm: RoleTablePermission = {
        tableId,
        tableName: table?.display_name ?? tableId,
        canRead: true,
        canWrite: permission === 'write',
      }
      setTablePerms((prev) => ({
        ...prev,
        [roleId]: [...(prev[roleId] ?? []), perm],
      }))
      setAddTableModalOpen(false)
    } catch (e) {
      console.error('Add table permission failed', e)
    }
  }

  const removeTableFromRole = async (roleId: string, tableId: string) => {
    try {
      await dataPermissionApi.deleteTablePermission(roleId, tableId)
      setTablePerms((prev) => ({
        ...prev,
        [roleId]: (prev[roleId] ?? []).filter((x) => x.tableId !== tableId),
      }))
    } catch (e) {
      console.error('Remove table permission failed', e)
    }
  }

  const toggleColVisible = async (roleId: string, tableId: string, colName: string) => {
    const roleObj = colPerms[roleId] ?? {}
    const arr = roleObj[tableId] ?? []
    const c = arr.find((x) => x.columnName === colName)
    if (!c) return
    const visible = !c.visible
    const visibility = visible ? 'visible' : 'hidden'
    try {
      await dataPermissionApi.setColumnPermission(roleId, tableId, colName, visibility)
      setColPerms((prev) => ({
        ...prev,
        [roleId]: {
          ...prev[roleId],
          [tableId]: arr.map((x) => (x.columnName === colName ? { ...x, visible } : x)),
        },
      }))
    } catch (e) {
      console.error('Set column visibility failed', e)
    }
  }

  const setColMask = async (
    roleId: string,
    tableId: string,
    colName: string,
    mask: RoleColumnPermission['maskType']
  ) => {
    const roleObj = colPerms[roleId] ?? {}
    const arr = roleObj[tableId] ?? []
    const visibility = mask && mask !== 'none' ? 'masked' : 'visible'
    try {
      await dataPermissionApi.setColumnPermission(roleId, tableId, colName, visibility, mask ?? undefined)
      setColPerms((prev) => ({
        ...prev,
        [roleId]: {
          ...prev[roleId],
          [tableId]: arr.map((x) => (x.columnName === colName ? { ...x, maskType: mask } : x)),
        },
      }))
    } catch (e) {
      console.error('Set column mask failed', e)
    }
  }

  const addRowFilter = async (roleId: string) => {
    if (!selectedTableId || !newFilterExpr.trim()) return
    try {
      await dataPermissionApi.setRowFilter(roleId, selectedTableId, newFilterExpr.trim(), newFilterDesc.trim() || undefined)
      const newFilter: RoleRowFilter = {
        id: `rf-${Date.now()}`,
        tableId: selectedTableId,
        filterExpression: newFilterExpr.trim(),
        description: newFilterDesc.trim() || undefined,
      }
      setRowFilters((prev) => ({
        ...prev,
        [roleId]: [...(prev[roleId] ?? []), newFilter],
      }))
      setNewFilterExpr('')
      setNewFilterDesc('')
    } catch (e) {
      console.error('Add row filter failed', e)
    }
  }

  const deleteRowFilter = async (roleId: string, filterId: string) => {
    const list = rowFilters[roleId] ?? []
    const f = list.find((x) => x.id === filterId)
    const tableId = f?.tableId
    if (!tableId) return
    try {
      await dataPermissionApi.deleteRowFilter(roleId, tableId)
      setRowFilters((prev) => ({
        ...prev,
        [roleId]: (prev[roleId] ?? []).filter((x) => x.id !== filterId),
      }))
    } catch (e) {
      console.error('Delete row filter failed', e)
    }
  }

  const assignUser = async (roleId: string, userId: string) => {
    try {
      await dataPermissionApi.assignUser(roleId, userId)
      setAssignedUserIds((prev) => {
        const next = { ...prev, [roleId]: [...(prev[roleId] ?? []), userId] }
        setRoles((r) =>
          r.map((x) =>
            x.id === roleId ? { ...x, userCount: next[roleId].length } : x
          )
        )
        return next
      })
      setAddUserModalOpen(false)
    } catch (e) {
      console.error('Assign user failed', e)
    }
  }

  const removeUser = async (roleId: string, userId: string) => {
    try {
      await dataPermissionApi.unassignUser(roleId, userId)
      setAssignedUserIds((prev) => {
        const nextIds = (prev[roleId] ?? []).filter((id) => id !== userId)
        const next = { ...prev, [roleId]: nextIds }
        setRoles((r) =>
          r.map((x) => (x.id === roleId ? { ...x, userCount: nextIds.length } : x))
        )
        return next
      })
    } catch (e) {
      console.error('Unassign user failed', e)
    }
  }

  const roleTables = selectedRoleId ? tablePerms[selectedRoleId] ?? [] : []
  const roleColPerms = selectedRoleId ? colPerms[selectedRoleId] ?? {} : {}
  const roleRowFilters = selectedRoleId ? rowFilters[selectedRoleId] ?? [] : []
  const roleUserIds = selectedRoleId ? assignedUserIds[selectedRoleId] ?? [] : []
  const roleUsers = roleUserIds
    .map((id) => allUsers.find((u) => u.id === id))
    .filter(Boolean) as { id: string; name: string; email: string }[]

  const inputCls =
    'w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 dark:text-white'

  return (
    <div className="h-full flex flex-col overflow-hidden">
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

      <div className="flex-1 flex overflow-hidden">
        <div className="w-80 shrink-0 border-r border-slate-100 dark:border-slate-700/50 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <p className="text-sm text-slate-500">加载中...</p>
          ) : (
            roles.map((r) => (
              <div key={r.id} className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setSelectedRoleId(r.id)
                    setDetailTab('tables')
                    setSelectedTableId(null)
                  }}
                  className={`flex-1 text-left rounded-2xl p-4 transition-all ${
                    selectedRoleId === r.id
                      ? 'bg-primary/10 border border-primary/30 dark:bg-primary/20'
                      : 'bg-white/80 dark:bg-slate-800/80 backdrop-blur border border-slate-100 dark:border-slate-700 hover:border-slate-200 dark:hover:border-slate-600'
                  }`}
                >
                  <h4 className="font-bold text-sm text-slate-800 dark:text-white">{r.name}</h4>
                  {r.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{r.description}</p>
                  )}
                  <p className="text-xs text-slate-400 mt-2">{r.userCount} 位用户</p>
                </button>
                <button
                  onClick={() => deleteRole(r.id)}
                  className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500"
                  title="删除角色"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {!selectedRole ? (
            <EmptyState
              icon={ShieldCheck}
              title="请选择角色"
              description="从左侧列表选择一个角色查看权限配置"
            />
          ) : detailLoading ? (
            <p className="text-sm text-slate-500">加载详情中...</p>
          ) : (
            <>
              <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4">{selectedRole.name}</h2>

              <div className="flex gap-1 mb-4">
                {DETAIL_TABS.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => {
                      setDetailTab(t.key)
                      setSelectedTableId(null)
                    }}
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

              {detailTab === 'tables' && (
                <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur overflow-hidden">
                  <div className="flex justify-end p-2">
                    <button
                      onClick={() => setAddTableModalOpen(true)}
                      className="text-sm text-primary hover:underline"
                    >
                      + 添加表权限
                    </button>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-700">
                        <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400">数据表</th>
                        <th className="text-center px-4 py-3 font-medium text-slate-500 dark:text-slate-400">读取</th>
                        <th className="text-center px-4 py-3 font-medium text-slate-500 dark:text-slate-400">写入</th>
                        <th className="text-center px-4 py-3 font-medium text-slate-500 dark:text-slate-400">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roleTables.map((t) => (
                        <tr key={t.tableId} className="border-b border-slate-50 dark:border-slate-700/50">
                          <td className="px-4 py-3 text-slate-800 dark:text-white font-medium">{t.tableName}</td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() =>
                                toggleTablePerm(selectedRole.id, t.tableId, 'canRead')
                              }
                              className={`w-5 h-5 rounded-md border-2 transition-colors ${
                                t.canRead ? 'bg-primary border-primary' : 'border-slate-300 dark:border-slate-600'
                              }`}
                            >
                              {t.canRead && (
                                <svg
                                  className="w-full h-full text-white"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              )}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() =>
                                toggleTablePerm(selectedRole.id, t.tableId, 'canWrite')
                              }
                              className={`w-5 h-5 rounded-md border-2 transition-colors ${
                                t.canWrite ? 'bg-primary border-primary' : 'border-slate-300 dark:border-slate-600'
                              }`}
                            >
                              {t.canWrite && (
                                <svg
                                  className="w-full h-full text-white"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              )}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => removeTableFromRole(selectedRole.id, t.tableId)}
                              className="text-xs text-red-500 hover:underline"
                            >
                              移除
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {roleTables.length === 0 && (
                    <p className="text-center text-slate-400 py-10 text-sm">暂无表权限配置，可点击「添加表权限」</p>
                  )}
                </div>
              )}

              {detailTab === 'columns' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                      选择数据表
                    </label>
                    <select
                      value={selectedTableId ?? ''}
                      onChange={(e) => setSelectedTableId(e.target.value || null)}
                      className={inputCls}
                    >
                      <option value="">请选择...</option>
                      {roleTables.map((t) => (
                        <option key={t.tableId} value={t.tableId}>
                          {t.tableName}
                        </option>
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
                              <td className="px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">
                                {c.columnName}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <button
                                  onClick={() =>
                                    toggleColVisible(selectedRole.id, selectedTableId!, c.columnName)
                                  }
                                  className={`w-5 h-5 rounded-md border-2 transition-colors ${
                                    c.visible ? 'bg-primary border-primary' : 'border-slate-300 dark:border-slate-600'
                                  }`}
                                >
                                  {c.visible && (
                                    <svg
                                      className="w-full h-full text-white"
                                      viewBox="0 0 20 20"
                                      fill="currentColor"
                                    >
                                      <path
                                        fillRule="evenodd"
                                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                        clipRule="evenodd"
                                      />
                                    </svg>
                                  )}
                                </button>
                              </td>
                              <td className="px-4 py-3">
                                <select
                                  value={c.maskType ?? 'none'}
                                  onChange={(e) =>
                                    setColMask(
                                      selectedRole.id,
                                      selectedTableId!,
                                      c.columnName,
                                      e.target.value as RoleColumnPermission['maskType']
                                    )
                                  }
                                  className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs focus:outline-none dark:text-white"
                                >
                                  {MASK_OPTIONS.map((o) => (
                                    <option key={o.value} value={o.value}>
                                      {o.label}
                                    </option>
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

              {detailTab === 'rows' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                      选择数据表
                    </label>
                    <select
                      value={selectedTableId ?? ''}
                      onChange={(e) => setSelectedTableId(e.target.value || null)}
                      className={inputCls}
                    >
                      <option value="">请选择...</option>
                      {roleTables.map((t) => (
                        <option key={t.tableId} value={t.tableId}>
                          {t.tableName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur overflow-hidden">
                    {roleRowFilters.length > 0 ? (
                      <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
                        {roleRowFilters.map((f) => (
                          <div key={f.id} className="flex items-center justify-between px-4 py-3">
                            <div>
                              <code className="text-xs font-mono text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 px-2 py-1 rounded-lg">
                                {f.filterExpression}
                              </code>
                              {f.description && (
                                <p className="text-xs text-slate-500 mt-1">{f.description}</p>
                              )}
                            </div>
                            <button
                              onClick={() => deleteRowFilter(selectedRole.id, f.id)}
                              className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500"
                            >
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
                    <input
                      value={newFilterExpr}
                      onChange={(e) => setNewFilterExpr(e.target.value)}
                      placeholder="过滤表达式，如 region = '华东'"
                      className={`${inputCls} font-mono flex-1`}
                    />
                    <input
                      value={newFilterDesc}
                      onChange={(e) => setNewFilterDesc(e.target.value)}
                      placeholder="描述（可选）"
                      className={`${inputCls} flex-1`}
                    />
                    <button
                      onClick={() => addRowFilter(selectedRole.id)}
                      disabled={!selectedTableId || !newFilterExpr.trim()}
                      className="px-4 py-2.5 rounded-xl btn-gradient text-white text-sm font-semibold shrink-0 active:scale-[0.98] disabled:opacity-50"
                    >
                      添加
                    </button>
                  </div>
                </div>
              )}

              {detailTab === 'users' && (
                <div className="space-y-4">
                  <div className="flex justify-end">
                    <button
                      onClick={() => setAddUserModalOpen(true)}
                      className="text-sm text-primary hover:underline"
                    >
                      + 分配用户
                    </button>
                  </div>
                  <div className="relative">
                    <Search
                      size={16}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />
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
                          .filter(
                            (u) =>
                              !userSearch ||
                              u.name.includes(userSearch) ||
                              u.email.includes(userSearch)
                          )
                          .map((u) => (
                            <div key={u.id} className="flex items-center justify-between px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                                  {u.name[0]}
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-slate-800 dark:text-white">
                                    {u.name}
                                  </p>
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

      <Modal open={roleModalOpen} onClose={() => setRoleModalOpen(false)} title="新建角色">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              角色名称
            </label>
            <input
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              placeholder="销售分析师"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">描述</label>
            <textarea
              value={newRoleDesc}
              onChange={(e) => setNewRoleDesc(e.target.value)}
              rows={2}
              placeholder="角色权限描述..."
              className={`${inputCls} resize-none`}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setRoleModalOpen(false)}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              取消
            </button>
            <button
              onClick={addRole}
              className="px-5 py-2.5 rounded-xl btn-gradient text-white text-sm font-semibold shadow-lg shadow-primary/20 active:scale-[0.98]"
            >
              保存
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={addTableModalOpen} onClose={() => setAddTableModalOpen(false)} title="添加表权限">
        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            选择数据表并设置权限（读取 / 写入）
          </p>
          {allTables
            .filter((t) => !roleTables.some((rt) => rt.tableId === t.id))
            .length === 0 ? (
            <p className="text-slate-500 text-sm">当前角色已拥有所有表的权限</p>
          ) : (
            <ul className="max-h-60 overflow-y-auto space-y-2">
              {allTables
                .filter((t) => !roleTables.some((rt) => rt.tableId === t.id))
                .map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-4 py-2 border-b border-slate-100 dark:border-slate-700">
                    <span className="text-sm font-medium text-slate-800 dark:text-white">
                      {t.display_name}
                    </span>
                    <span className="flex gap-2">
                      <button
                        onClick={() => selectedRole && addTableToRole(selectedRole.id, t.id, 'read')}
                        className="px-3 py-1 rounded-lg text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                      >
                        只读
                      </button>
                      <button
                        onClick={() => selectedRole && addTableToRole(selectedRole.id, t.id, 'write')}
                        className="px-3 py-1 rounded-lg text-xs btn-gradient text-white"
                      >
                        读写
                      </button>
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </Modal>

      <Modal open={addUserModalOpen} onClose={() => setAddUserModalOpen(false)} title="分配用户">
        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-400">选择用户加入该角色</p>
          {allUsers.filter((u) => !roleUserIds.includes(u.id)).length === 0 ? (
            <p className="text-slate-500 text-sm">暂无可分配用户</p>
          ) : (
            <ul className="max-h-60 overflow-y-auto space-y-2">
              {allUsers
                .filter((u) => !roleUserIds.includes(u.id))
                .map((u) => (
                  <li
                    key={u.id}
                    className="flex items-center justify-between gap-4 py-2 border-b border-slate-100 dark:border-slate-700"
                  >
                    <span className="text-sm text-slate-800 dark:text-white">
                      {u.name} <span className="text-slate-400">({u.email})</span>
                    </span>
                    <button
                      onClick={() => selectedRole && assignUser(selectedRole.id, u.id)}
                      className="px-3 py-1 rounded-lg text-xs btn-gradient text-white"
                    >
                      分配
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </Modal>
    </div>
  )
}
