import { Wrench, ArrowLeft, Pencil, Trash2, RefreshCw } from 'lucide-react'
import { useMCPStore } from '@/stores/mcpStore'

export default function MCPToolBrowser() {
  const { servers, selectedServerId, setSelectedServerId, refreshServer, removeServer } = useMCPStore()
  const server = servers.find((s) => s.id === selectedServerId)

  if (!server) return null

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setSelectedServerId(null)}
          className="flex items-center gap-1.5 text-sm text-primary font-semibold hover:text-primary-dark transition-colors"
        >
          <ArrowLeft size={16} />
          返回列表
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refreshServer(server.id)}
            className="p-2 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/5 transition-colors"
            title="刷新工具"
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={async () => { await removeServer(server.id); setSelectedServerId(null) }}
            className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
            title="删除此服务"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white">{server.name}</h2>
        <span className="text-xs font-black text-primary bg-primary/10 px-3 py-1 rounded-full">
          {server.tools.length} 个工具
        </span>
      </div>

      {/* 配置摘要 */}
      <div className="rounded-2xl bg-slate-50 dark:bg-slate-900 p-4">
        <div className="flex items-center gap-4 text-xs">
          <span className="text-slate-400">传输:</span>
          <span className="font-bold text-slate-600 dark:text-slate-300">{server.transport.toUpperCase()}</span>
          <span className="text-slate-400">配置:</span>
          <span className="font-mono text-slate-600 dark:text-slate-300 truncate flex-1">{server.config}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {server.tools.map((tool) => (
          <div
            key={tool.name}
            className="rounded-3xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 hover:shadow-glass transition-shadow"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-2xl bg-primary-50 dark:bg-primary/10 flex items-center justify-center">
                <Wrench size={18} className="text-primary" />
              </div>
              <span className="font-mono text-sm font-bold text-slate-800 dark:text-white">
                {tool.name}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              {tool.description}
            </p>
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Input Schema</span>
              <pre className="mt-2 text-xs bg-slate-50 dark:bg-slate-900 rounded-2xl p-3 overflow-x-auto text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-700">
                {JSON.stringify(tool.inputSchema, null, 2)}
              </pre>
            </div>
          </div>
        ))}

        {server.tools.length === 0 && (
          <div className="col-span-2 text-center py-12 text-slate-400">
            <p className="text-sm">暂无工具，尝试刷新</p>
          </div>
        )}
      </div>
    </div>
  )
}
