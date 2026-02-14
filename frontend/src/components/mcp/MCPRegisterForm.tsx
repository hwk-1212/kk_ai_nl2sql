import { useState } from 'react'
import { Loader2, CheckCircle, Zap, Shield, ClipboardPaste, Settings2 } from 'lucide-react'
import { useMCPStore } from '@/stores/mcpStore'
import Modal from '@/components/common/Modal'
import type { MCPTransport } from '@/types'

type Mode = 'paste' | 'manual'

const PLACEHOLDER_JSON = `{
  "mcpServers": {
    "server-name": {
      "command": "npx -y mcp-remote https://...",
      "env": {}
    }
  }
}`

export default function MCPRegisterForm() {
  const addServer = useMCPStore((s) => s.addServer)
  const importServers = useMCPStore((s) => s.importServers)

  const [mode, setMode] = useState<Mode>('paste')

  // paste mode
  const [jsonText, setJsonText] = useState('')
  const [parseError, setParseError] = useState('')

  // manual mode
  const [name, setName] = useState('')
  const [transport, setTransport] = useState<MCPTransport>('stdio')
  const [config, setConfig] = useState('')

  const [loading, setLoading] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [successInfo, setSuccessInfo] = useState({ count: 0, names: '' })

  const handlePasteSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!jsonText.trim()) return
    setParseError('')
    setLoading(true)
    try {
      const count = await importServers(jsonText.trim())
      // 尝试提取名称
      let names = ''
      try {
        const parsed = JSON.parse(jsonText.trim())
        const servers = parsed.mcpServers || parsed.mcp_servers || parsed.servers || parsed
        names = Object.keys(servers).filter(k => typeof servers[k] === 'object').join(', ')
      } catch { /* ignore */ }
      setSuccessInfo({ count, names })
      setJsonText('')
      setShowSuccess(true)
    } catch (err: any) {
      setParseError(err?.message || '导入失败')
    } finally {
      setLoading(false)
    }
  }

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !config.trim()) return
    setLoading(true)
    try {
      await addServer(name.trim(), transport, config.trim())
      setSuccessInfo({ count: 1, names: name.trim() })
      setName('')
      setConfig('')
      setShowSuccess(true)
    } catch (err) {
      console.error('Failed to add server:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="rounded-3xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
        {/* Tab 切换 */}
        <div className="flex border-b border-slate-100 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setMode('paste')}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-semibold transition-all ${
              mode === 'paste'
                ? 'text-primary border-b-2 border-primary bg-primary/5'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <ClipboardPaste size={14} />
            粘贴配置
          </button>
          <button
            type="button"
            onClick={() => setMode('manual')}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-semibold transition-all ${
              mode === 'manual'
                ? 'text-primary border-b-2 border-primary bg-primary/5'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Settings2 size={14} />
            手动填写
          </button>
        </div>

        <div className="p-6">
          {mode === 'paste' ? (
            /* ======================== 粘贴 JSON 模式 ======================== */
            <form onSubmit={handlePasteSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  MCP 配置 JSON
                </label>
                <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">
                  直接粘贴来自 Claude Desktop / Cursor / 官方文档的标准 JSON 配置，支持 <code className="text-primary">command</code> 和 <code className="text-primary">url</code> 两种方式
                </p>
                <textarea
                  value={jsonText}
                  onChange={(e) => { setJsonText(e.target.value); setParseError('') }}
                  placeholder={PLACEHOLDER_JSON}
                  rows={8}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-100 dark:border-slate-700 bg-bg-main dark:bg-slate-900 text-sm font-mono text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                  spellCheck={false}
                />
                {parseError && (
                  <p className="text-xs text-red-500 mt-2">{parseError}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || !jsonText.trim()}
                className="btn-gradient text-white px-8 py-3 rounded-2xl font-semibold text-sm shadow-lg shadow-primary/20 disabled:opacity-50 transition-all active:scale-[0.98] flex items-center gap-2"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <ClipboardPaste size={16} />}
                {loading ? '导入中...' : '导入配置'}
              </button>
            </form>
          ) : (
            /* ======================== 手动填写模式 ======================== */
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">名称</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="例如: Web Search"
                    className="w-full px-4 py-3 rounded-2xl border border-slate-100 dark:border-slate-700 bg-bg-main dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">传输类型</label>
                  <div className="flex bg-slate-50 dark:bg-slate-900 p-1.5 rounded-2xl">
                    {(['stdio', 'sse', 'http'] as MCPTransport[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTransport(t)}
                        className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                          transport === t
                            ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {t.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    {transport === 'stdio' ? '命令' : 'URL'}
                  </label>
                  <input
                    value={config}
                    onChange={(e) => setConfig(e.target.value)}
                    placeholder={transport === 'stdio' ? 'npx @anthropic/mcp-xxx' : 'http://localhost:3100/mcp'}
                    className="w-full px-4 py-3 rounded-2xl border border-slate-100 dark:border-slate-700 bg-bg-main dark:bg-slate-900 text-sm font-mono text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !name.trim() || !config.trim()}
                className="btn-gradient text-white px-8 py-3 rounded-2xl font-semibold text-sm shadow-lg shadow-primary/20 disabled:opacity-50 transition-all active:scale-[0.98] flex items-center gap-2"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <span>+</span>}
                {loading ? '连接中...' : 'Install New Toolkit'}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* success modal */}
      <Modal open={showSuccess} onClose={() => setShowSuccess(false)} maxWidth="max-w-sm">
        <div className="text-center py-4">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
            <CheckCircle size={36} className="text-primary" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
            {successInfo.count > 1 ? `${successInfo.count} 个服务导入成功！` : '连接成功！'}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
            工具已集成，可在所有 AI 对话中使用
          </p>

          {successInfo.names && (
            <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-4 flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-primary font-bold text-lg">🔧</span>
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{successInfo.names}</p>
                <p className="text-xs text-slate-400">工具发现中，稍后自动更新</p>
              </div>
              <span className="text-[9px] font-black text-primary bg-primary/10 px-2 py-1 rounded-full shrink-0">Online</span>
            </div>
          )}

          <div className="flex items-center justify-center gap-6 text-xs text-slate-500 mb-5">
            <span className="flex items-center gap-1"><Zap size={12} className="text-primary" /> 实时同步</span>
            <span className="flex items-center gap-1"><Shield size={12} className="text-primary" /> TLS 加密</span>
          </div>

          <button
            onClick={() => setShowSuccess(false)}
            className="w-full btn-gradient text-white py-3 rounded-2xl font-semibold text-sm shadow-lg shadow-primary/20 active:scale-[0.98] transition-all"
          >
            完成
          </button>
        </div>
      </Modal>
    </>
  )
}
