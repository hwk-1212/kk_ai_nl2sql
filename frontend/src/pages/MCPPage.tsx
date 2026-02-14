import { useEffect } from 'react'
import { useMCPStore } from '@/stores/mcpStore'
import MCPServerList from '@/components/mcp/MCPServerList'
import MCPRegisterForm from '@/components/mcp/MCPRegisterForm'
import MCPToolBrowser from '@/components/mcp/MCPToolBrowser'

export default function MCPPage() {
  const selectedServerId = useMCPStore((s) => s.selectedServerId)
  const loadServers = useMCPStore((s) => s.loadServers)

  useEffect(() => {
    loadServers()
  }, [loadServers])

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 md:px-8 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">MCP Toolkits</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage external connectors for your AI assistant
          </p>
        </div>

        {selectedServerId ? (
          <MCPToolBrowser />
        ) : (
          <>
            <MCPRegisterForm />
            <div>
              <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4">
                已注册 Toolkits
              </h2>
              <MCPServerList />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
