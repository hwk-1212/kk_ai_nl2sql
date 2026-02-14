import { useState } from 'react'
import { Globe, Database, FolderOpen, ToggleLeft, ToggleRight, RefreshCw, Trash2, Pencil, Loader2 } from 'lucide-react'
import { useMCPStore } from '@/stores/mcpStore'
import Modal from '@/components/common/Modal'
import type { MCPServer, MCPTransport } from '@/types'

const statusConfig = {
  online: { color: 'text-primary', bg: 'bg-primary/10', label: 'CONNECTED' },
  offline: { color: 'text-slate-400', bg: 'bg-slate-100', label: 'INACTIVE' },
  error: { color: 'text-red-500', bg: 'bg-red-50', label: 'ERROR' },
}

const iconMap: Record<string, typeof Globe> = {
  'Web Search': Globe,
  'File System': FolderOpen,
  'Database Query': Database,
}

// ===== 编辑弹窗 (提取到外部避免重渲染) =====
function EditModal({
  open,
  server,
  onClose,
  onSave,
}: {
  open: boolean
  server: MCPServer | null
  onClose: () => void
  onSave: (id: string, data: { name?: string; transport_type?: string; config?: string; env?: Record<string, string> }) => Promise<void>
}) {
  const [mode, setMode] = useState<'json' | 'fields'>('json')
  const [jsonText, setJsonText] = useState('')
  const [name, setName] = useState('')
  const [transport, setTransport] = useState<MCPTransport>('stdio')
  const [config, setConfig] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // 打开时填充当前值
  const initForm = () => {
    if (!server) return
    setName(server.name)
    setTransport(server.transport)
    setConfig(server.config)
    setError('')
    // 构建标准 JSON
    const obj: Record<string, unknown> = {}
    if (server.transport === 'stdio') {
      obj.command = server.config
      if (server.env && Object.keys(server.env).length) obj.env = server.env
    } else {
      obj.url = server.config
    }
    setJsonText(JSON.stringify({ mcpServers: { [server.name]: obj } }, null, 2))
  }

  // 每次 open + server 变化时重置
  if (open && server && name !== server.name && config !== server.config) {
    initForm()
  }

  const handleSave = async () => {
    if (!server) return
    setSaving(true)
    setError('')
    try {
      if (mode === 'json') {
        // 解析 JSON 提取配置
        const parsed = JSON.parse(jsonText)
        const servers = parsed.mcpServers || parsed.mcp_servers || parsed.servers || parsed
        const entries = Object.entries(servers).filter(([, v]) => typeof v === 'object') as [string, Record<string, any>][]
        if (entries.length === 0) throw new Error('未找到有效配置')
        const [newName, cfg] = entries[0]
        const newEnv = cfg.env && Object.keys(cfg.env).length ? cfg.env : undefined
        if (cfg.url) {
          await onSave(server.id, { name: newName, transport_type: 'http', config: cfg.url, env: newEnv })
        } else if (cfg.command) {
          const parts = [cfg.command, ...(cfg.args || [])].join(' ')
          await onSave(server.id, { name: newName, transport_type: 'stdio', config: parts, env: newEnv })
        } else {
          throw new Error('配置中缺少 command 或 url')
        }
      } else {
        await onSave(server.id, { name, transport_type: transport, config })
      }
      onClose()
    } catch (err: any) {
      setError(err?.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  if (!open || !server) return null

  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-lg">
      <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">编辑 MCP 配置</h3>

      {/* Tab */}
      <div className="flex gap-1 mb-4 bg-slate-50 dark:bg-slate-900 p-1 rounded-xl">
        <button
          type="button"
          onClick={() => setMode('json')}
          className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
            mode === 'json' ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-500'
          }`}
        >
          JSON 配置
        </button>
        <button
          type="button"
          onClick={() => setMode('fields')}
          className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
            mode === 'fields' ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-500'
          }`}
        >
          字段编辑
        </button>
      </div>

      {mode === 'json' ? (
        <textarea
          value={jsonText}
          onChange={(e) => { setJsonText(e.target.value); setError('') }}
          rows={10}
          className="w-full px-4 py-3 rounded-2xl border border-slate-100 dark:border-slate-700 bg-bg-main dark:bg-slate-900 text-sm font-mono text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
          spellCheck={false}
        />
      ) : (
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">名称</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-100 dark:border-slate-700 bg-bg-main dark:bg-slate-900 text-sm"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">传输类型</label>
            <div className="flex bg-slate-50 dark:bg-slate-900 p-1 rounded-xl">
              {(['stdio', 'sse', 'http'] as MCPTransport[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTransport(t)}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                    transport === t ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-500'
                  }`}
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
              {transport === 'stdio' ? '命令' : 'URL'}
            </label>
            <input
              value={config}
              onChange={(e) => setConfig(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-100 dark:border-slate-700 bg-bg-main dark:bg-slate-900 text-sm font-mono"
            />
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}

      <div className="flex gap-3 mt-5">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 btn-gradient text-white py-2.5 rounded-xl font-semibold text-sm shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          {saving ? '保存中...' : '保存'}
        </button>
        <button
          onClick={onClose}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
        >
          取消
        </button>
      </div>
    </Modal>
  )
}

// ===== 删除确认弹窗 =====
function DeleteConfirm({
  open,
  serverName,
  onClose,
  onConfirm,
}: {
  open: boolean
  serverName: string
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-sm">
      <div className="text-center py-2">
        <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
          <Trash2 size={28} className="text-red-500" />
        </div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">删除 MCP Server</h3>
        <p className="text-sm text-slate-500 mb-5">
          确定删除 <strong>{serverName}</strong>？此操作不可撤销。
        </p>
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-xl font-semibold text-sm transition-colors"
          >
            确认删除
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
          >
            取消
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default function MCPServerList() {
  const { servers, selectedServerId, setSelectedServerId, toggleServer, refreshServer, removeServer, updateServer } = useMCPStore()
  const [editServer, setEditServer] = useState<MCPServer | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<MCPServer | null>(null)

  const handleSave = async (id: string, data: Parameters<typeof updateServer>[1]) => {
    await updateServer(id, data)
  }

  const handleDelete = async () => {
    if (deleteTarget) {
      await removeServer(deleteTarget.id)
      setDeleteTarget(null)
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {servers.map((srv: MCPServer) => {
          const status = statusConfig[srv.status]
          const Icon = iconMap[srv.name] || Globe
          return (
            <div
              key={srv.id}
              onClick={() => setSelectedServerId(srv.id === selectedServerId ? null : srv.id)}
              className={`rounded-3xl border bg-white dark:bg-slate-800 p-6 cursor-pointer transition-all hover:shadow-glass ${
                selectedServerId === srv.id
                  ? 'border-primary shadow-glass'
                  : 'border-slate-100 dark:border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-primary-50 dark:bg-primary/10 flex items-center justify-center">
                  <Icon size={24} className="text-primary" />
                </div>
                <div className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${srv.status === 'online' ? 'bg-primary' : srv.status === 'error' ? 'bg-red-500' : 'bg-slate-300'}`} />
                  <span className={`text-[9px] font-black uppercase tracking-wider ${status.color}`}>
                    {status.label}
                  </span>
                </div>
              </div>

              <h3 className="font-bold text-slate-800 dark:text-white text-lg mb-1">{srv.name}</h3>
              <p className="text-xs text-slate-400 font-mono truncate mb-1">{srv.config}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                {srv.transport.toUpperCase()} · {srv.tools.length} 个工具可用
              </p>

              <div className="flex items-center justify-between pt-4 border-t border-slate-50 dark:border-slate-700">
                <button
                  onClick={(e) => { e.stopPropagation(); toggleServer(srv.id) }}
                  className={`flex items-center gap-1.5 ${srv.enabled ? 'text-primary' : 'text-slate-400'}`}
                >
                  {srv.enabled ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); refreshServer(srv.id) }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/5 transition-colors"
                    title="刷新工具"
                  >
                    <RefreshCw size={14} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditServer(srv) }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/5 transition-colors"
                    title="编辑配置"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(srv) }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                    title="删除"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <EditModal
        open={!!editServer}
        server={editServer}
        onClose={() => setEditServer(null)}
        onSave={handleSave}
      />
      <DeleteConfirm
        open={!!deleteTarget}
        serverName={deleteTarget?.name || ''}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </>
  )
}
