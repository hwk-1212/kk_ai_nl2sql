import { create } from 'zustand'
import type { MCPServer, MCPTransport, MCPTool } from '@/types'
import { mcpApi, type MCPServerResponse } from '@/services/api'

interface MCPState {
  servers: MCPServer[]
  selectedServerId: string | null
  loading: boolean

  loadServers: () => Promise<void>
  setSelectedServerId: (id: string | null) => void
  toggleServer: (id: string) => Promise<void>
  removeServer: (id: string) => Promise<void>
  addServer: (name: string, transport: MCPTransport, config: string) => Promise<void>
  updateServer: (id: string, data: { name?: string; transport_type?: string; config?: string; env?: Record<string, string> }) => Promise<void>
  importServers: (configJson: string) => Promise<number>
  loadServerTools: (id: string) => Promise<void>
  refreshServer: (id: string) => Promise<void>
}

function toServer(r: MCPServerResponse): MCPServer {
  return {
    id: r.id,
    name: r.name,
    transport: r.transport_type as MCPTransport,
    config: r.config,
    env: (r as any).env || undefined,
    status: r.enabled ? 'online' : 'offline',
    tools: (r.tools_cache || []).map((t: any) => ({
      name: t.name || '',
      description: t.description || '',
      inputSchema: t.input_schema || t.inputSchema || {},
    })),
    enabled: r.enabled,
  }
}

export const useMCPStore = create<MCPState>((set, get) => ({
  servers: [],
  selectedServerId: null,
  loading: false,

  loadServers: async () => {
    set({ loading: true })
    try {
      const list = await mcpApi.listServers()
      set({ servers: list.map(toServer), loading: false })
    } catch (err) {
      console.error('Failed to load MCP servers:', err)
      set({ loading: false })
    }
  },

  setSelectedServerId: (selectedServerId) => set({ selectedServerId }),

  toggleServer: async (id) => {
    try {
      const resp = await mcpApi.toggleServer(id)
      const updated = toServer(resp)
      set((s) => ({
        servers: s.servers.map((srv) => (srv.id === id ? updated : srv)),
      }))
    } catch (err) {
      console.error('Failed to toggle server:', err)
    }
  },

  removeServer: async (id) => {
    try {
      await mcpApi.deleteServer(id)
      set((s) => ({
        servers: s.servers.filter((srv) => srv.id !== id),
        selectedServerId: s.selectedServerId === id ? null : s.selectedServerId,
      }))
    } catch (err) {
      console.error('Failed to remove server:', err)
    }
  },

  addServer: async (name, transport, config) => {
    try {
      const resp = await mcpApi.createServer({
        name,
        transport_type: transport,
        config,
      })
      const srv = toServer(resp)
      set((s) => ({ servers: [...s.servers, srv] }))
    } catch (err) {
      console.error('Failed to add server:', err)
      throw err
    }
  },

  updateServer: async (id, data) => {
    try {
      const resp = await mcpApi.updateServer(id, data)
      const updated = toServer(resp)
      set((s) => ({
        servers: s.servers.map((srv) => (srv.id === id ? updated : srv)),
      }))
    } catch (err) {
      console.error('Failed to update server:', err)
      throw err
    }
  },

  importServers: async (configJson) => {
    try {
      const list = await mcpApi.importServers(configJson)
      const newServers = list.map(toServer)
      set((s) => ({ servers: [...s.servers, ...newServers] }))
      return newServers.length
    } catch (err) {
      console.error('Failed to import servers:', err)
      throw err
    }
  },

  loadServerTools: async (id) => {
    try {
      const tools = await mcpApi.listServerTools(id)
      set((s) => ({
        servers: s.servers.map((srv) =>
          srv.id === id
            ? {
                ...srv,
                tools: tools.map((t: any) => ({
                  name: t.name || '',
                  description: t.description || '',
                  inputSchema: t.input_schema || t.inputSchema || {},
                })),
              }
            : srv
        ),
      }))
    } catch (err) {
      console.error('Failed to load tools:', err)
    }
  },

  refreshServer: async (id) => {
    try {
      await mcpApi.refreshServer(id)
      // 等待 2 秒后重新加载, 给后台时间发现工具
      setTimeout(() => get().loadServers(), 2000)
    } catch (err) {
      console.error('Failed to refresh server:', err)
    }
  },
}))
