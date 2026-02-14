import { create } from 'zustand'
import { toolsApi } from '@/services/api'

export interface ToolItem {
  id: string
  name: string
  description: string
  tool_type: string      // "builtin" | "http"
  parameters: Record<string, unknown>
  http_url?: string
  http_method?: string
  http_headers?: Record<string, string>
  http_body_template?: string
  enabled: boolean
  source: string         // "builtin" | "custom"
  created_at?: string
}

interface ToolState {
  tools: ToolItem[]
  loading: boolean
  loadTools: () => Promise<void>
  createTool: (data: Partial<ToolItem>) => Promise<void>
  updateTool: (id: string, data: Partial<ToolItem>) => Promise<void>
  deleteTool: (id: string) => Promise<void>
  toggleTool: (id: string) => Promise<void>
  testTool: (id: string) => Promise<{ success: boolean; result?: string; error?: string }>
  toggleBuiltin: (name: string) => Promise<void>
}

export const useToolStore = create<ToolState>((set, get) => ({
  tools: [],
  loading: false,

  loadTools: async () => {
    set({ loading: true })
    try {
      const list = await toolsApi.list()
      set({ tools: list as unknown as ToolItem[], loading: false })
    } catch (err) {
      console.error('Failed to load tools:', err)
      set({ loading: false })
    }
  },

  createTool: async (data) => {
    const resp = await toolsApi.create(data)
    set((s) => ({ tools: [...s.tools, resp as unknown as ToolItem] }))
  },

  updateTool: async (id, data) => {
    const resp = await toolsApi.update(id, data)
    set((s) => ({
      tools: s.tools.map((t) => (t.id === id ? (resp as unknown as ToolItem) : t)),
    }))
  },

  deleteTool: async (id) => {
    await toolsApi.delete(id)
    set((s) => ({ tools: s.tools.filter((t) => t.id !== id) }))
  },

  toggleTool: async (id) => {
    const resp = await toolsApi.toggle(id)
    set((s) => ({
      tools: s.tools.map((t) => (t.id === id ? (resp as unknown as ToolItem) : t)),
    }))
  },

  testTool: async (id) => {
    return await toolsApi.test(id)
  },

  toggleBuiltin: async (name) => {
    const resp = await toolsApi.toggleBuiltin(name)
    const updated = resp as unknown as ToolItem
    set((s) => ({
      tools: s.tools.map((t) =>
        t.id === `builtin:${name}` ? { ...t, enabled: updated.enabled } : t
      ),
    }))
  },
}))
