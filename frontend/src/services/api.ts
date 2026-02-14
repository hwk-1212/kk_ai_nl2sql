/**
 * HTTP API client — 统一封装 fetch 请求
 */
const API_BASE = '/api/v1'

function getToken(): string | null {
  return localStorage.getItem('kk-access-token')
}

function getRefreshToken(): string | null {
  return localStorage.getItem('kk-refresh-token')
}

function setTokens(access: string, refresh: string) {
  localStorage.setItem('kk-access-token', access)
  localStorage.setItem('kk-refresh-token', refresh)
}

function clearTokens() {
  localStorage.removeItem('kk-access-token')
  localStorage.removeItem('kk-refresh-token')
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  if (res.status === 401) {
    // try refresh
    const refreshed = await tryRefreshToken()
    if (refreshed) {
      headers['Authorization'] = `Bearer ${getToken()}`
      const retry = await fetch(`${API_BASE}${path}`, { ...options, headers })
      if (!retry.ok) throw new Error(`API Error: ${retry.status}`)
      if (retry.status === 204) return null as T
      return retry.json()
    }
    clearTokens()
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const detail = body.detail
    // FastAPI detail 可能是字符串或 Pydantic 校验错误数组
    const msg = typeof detail === 'string'
      ? detail
      : Array.isArray(detail)
        ? detail.map((d: any) => d.msg || JSON.stringify(d)).join('; ')
        : `API Error: ${res.status}`
    throw new Error(msg)
  }

  if (res.status === 204) return null as T
  return res.json()
}

async function tryRefreshToken(): Promise<boolean> {
  const refresh = getRefreshToken()
  if (!refresh) return false

  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
    })
    if (!res.ok) return false
    const data = await res.json()
    setTokens(data.access_token, data.refresh_token)
    return true
  } catch {
    return false
  }
}

// ====== Auth API ======
export const authApi = {
  register: (email: string, password: string, nickname: string) =>
    request<{ access_token: string; refresh_token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, nickname }),
    }),

  login: (email: string, password: string) =>
    request<{ access_token: string; refresh_token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  me: () => request<{ id: string; email: string; nickname: string; role: string; is_active: boolean }>('/auth/me'),

  logout: () => {
    const refresh = getRefreshToken()
    if (refresh) {
      request('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: refresh }),
      }).catch(() => {})
    }
    clearTokens()
  },
}

// ====== Conversations API ======
export interface ConvResponse {
  id: string
  title: string
  model: string
  created_at: string
  updated_at: string
}

export interface ConvDetail extends ConvResponse {
  messages: {
    id: string
    role: string
    content: string
    reasoning_content: string | null
    usage: Record<string, number> | null
    metadata: {
      tool_calls?: { id: string; name: string; arguments: Record<string, unknown>; status: string; result?: string; error?: string }[]
      memories?: { id: string; content: string; relevance: number; source: string }[]
      rag_sources?: { content: string; score: number; source: string; page?: number }[]
    } | null
    created_at: string
  }[]
}

export const conversationsApi = {
  list: (page = 1, pageSize = 50) =>
    request<ConvResponse[]>(`/conversations?page=${page}&page_size=${pageSize}`),

  create: (title = 'New Chat', model = 'deepseek-chat') =>
    request<ConvResponse>('/conversations', {
      method: 'POST',
      body: JSON.stringify({ title, model }),
    }),

  get: (id: string) => request<ConvDetail>(`/conversations/${id}`),

  update: (id: string, data: { title?: string; model?: string }) =>
    request<ConvResponse>(`/conversations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<null>(`/conversations/${id}`, { method: 'DELETE' }),
}

// ====== Chat SSE API ======
export interface MemoryRecallPayload {
  memories: {
    id: string
    content: string
    relevance: number
    source: string
  }[]
  preferences: {
    id: string
    type: string
    content: string
  }[]
}

export interface RAGSourcePayload {
  content: string
  score: number
  source: string
}

export function streamChat(
  params: {
    conversation_id?: string | null
    model: string
    content: string
    thinking_enabled: boolean
    kb_ids?: string[]
  },
  callbacks: {
    onMeta?: (conversationId: string) => void
    onMemoryRecall?: (payload: MemoryRecallPayload) => void
    onRAGSource?: (sources: RAGSourcePayload[]) => void
    onToolCall?: (data: { id: string; name: string; arguments: Record<string, unknown>; status: string }) => void
    onToolResult?: (data: { id: string; name: string; status: string; result?: string; error?: string }) => void
    onReasoning?: (chunk: string) => void
    onContent?: (chunk: string) => void
    onDone?: (data: { usage?: Record<string, number>; model?: string }) => void
    onError?: (error: string) => void
  },
  signal?: AbortSignal,
): Promise<void> {
  return new Promise(async (resolve, reject) => {
    const token = getToken()

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          conversation_id: params.conversation_id || null,
          model: params.model,
          messages: [{ role: 'user', content: params.content }],
          thinking_enabled: params.thinking_enabled,
          kb_ids: params.kb_ids || null,
        }),
        signal,
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        callbacks.onError?.(body.detail || `HTTP ${res.status}`)
        reject(new Error(body.detail || `HTTP ${res.status}`))
        return
      }

      const reader = res.body?.getReader()
      if (!reader) {
        reject(new Error('No reader'))
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const jsonStr = line.slice(6).trim()
          if (!jsonStr || jsonStr === '[DONE]') continue

          try {
            const event = JSON.parse(jsonStr)

            switch (event.type) {
              case 'meta':
                callbacks.onMeta?.(event.conversation_id)
                break
              case 'memory_recall':
                callbacks.onMemoryRecall?.(event.data as MemoryRecallPayload)
                break
              case 'rag_source':
                callbacks.onRAGSource?.(event.data as RAGSourcePayload[])
                break
              case 'tool_call':
                callbacks.onToolCall?.(event.data)
                break
              case 'tool_result':
                callbacks.onToolResult?.(event.data)
                break
              case 'reasoning':
                callbacks.onReasoning?.(event.data)
                break
              case 'content':
                callbacks.onContent?.(event.data)
                break
              case 'done':
                callbacks.onDone?.({ usage: event.usage, model: event.model })
                break
              case 'error':
                callbacks.onError?.(event.data)
                break
            }
          } catch {
            // skip malformed JSON
          }
        }
      }

      resolve()
    } catch (err: any) {
      if (err.name === 'AbortError') {
        resolve()
      } else {
        callbacks.onError?.(err.message)
        reject(err)
      }
    }
  })
}

// ====== Knowledge Base API ======
export interface KBResponse {
  id: string
  name: string
  description: string
  embedding_model: string
  embedding_dim: number
  chunk_size: number
  chunk_overlap: number
  doc_count: number
  created_at: string
  updated_at: string
}

export interface KBDocResponse {
  id: string
  kb_id: string
  filename: string
  file_type: string
  file_size: number
  status: string
  chunk_count: number
  error_message?: string
  created_at: string
}

export interface KBDetailResponse extends KBResponse {
  documents: KBDocResponse[]
}

export const knowledgeApi = {
  list: () => request<KBResponse[]>('/knowledge-bases'),

  create: (data: { name: string; description?: string; chunk_size?: number; chunk_overlap?: number }) =>
    request<KBResponse>('/knowledge-bases', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  get: (id: string) => request<KBDetailResponse>(`/knowledge-bases/${id}`),

  update: (id: string, data: { name?: string; description?: string }) =>
    request<KBResponse>(`/knowledge-bases/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: string) => request<null>(`/knowledge-bases/${id}`, { method: 'DELETE' }),

  listDocuments: (kbId: string) => request<KBDocResponse[]>(`/knowledge-bases/${kbId}/documents`),

  uploadDocument: async (kbId: string, file: File): Promise<KBDocResponse> => {
    const token = getToken()
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(`${API_BASE}/knowledge-bases/${kbId}/documents`, {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: formData,
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.detail || `Upload failed: ${res.status}`)
    }
    return res.json()
  },

  deleteDocument: (kbId: string, docId: string) =>
    request<null>(`/knowledge-bases/${kbId}/documents/${docId}`, { method: 'DELETE' }),

  retryDocument: (kbId: string, docId: string) =>
    request<KBDocResponse>(`/knowledge-bases/${kbId}/documents/${docId}/retry`, { method: 'POST' }),

  /** 流式下载文档原件，返回 Blob */
  previewDocument: async (kbId: string, docId: string): Promise<{ blob: Blob; filename: string; fileType: string }> => {
    const token = getToken()
    const res = await fetch(`${API_BASE}/knowledge-bases/${kbId}/documents/${docId}/preview`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    })
    if (!res.ok) {
      throw new Error(`Preview failed: ${res.status}`)
    }
    const blob = await res.blob()
    // 从 content-disposition 取 filename
    const cd = res.headers.get('content-disposition') || ''
    const filenameMatch = cd.match(/filename\*?=(?:UTF-8'')?(.+)/i)
    const filename = filenameMatch ? decodeURIComponent(filenameMatch[1]) : 'document'
    const fileType = blob.type
    return { blob, filename, fileType }
  },

  listChunks: (kbId: string, docId: string) =>
    request<{ id: string; content: string; chunk_index: number; page: number | null; total_chunks: number | null }[]>(
      `/knowledge-bases/${kbId}/documents/${docId}/chunks`
    ),

  getMarkdown: (kbId: string, docId: string) =>
    request<{ markdown: string; filename: string }>(`/knowledge-bases/${kbId}/documents/${docId}/markdown`),
}

// ====== MCP API ======
export interface MCPServerResponse {
  id: string
  name: string
  transport_type: string
  config: string
  enabled: boolean
  tools_cache: Record<string, unknown>[] | null
  created_at: string
}

export const mcpApi = {
  listServers: () => request<MCPServerResponse[]>('/mcp/servers'),

  createServer: (data: { name: string; transport_type: string; config: string; env?: Record<string, string> }) =>
    request<MCPServerResponse>('/mcp/servers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  importServers: (configJson: string) =>
    request<MCPServerResponse[]>('/mcp/servers/import', {
      method: 'POST',
      body: JSON.stringify({ config_json: configJson }),
    }),

  updateServer: (id: string, data: { name?: string; transport_type?: string; config?: string; env?: Record<string, string> }) =>
    request<MCPServerResponse>(`/mcp/servers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteServer: (id: string) => request<null>(`/mcp/servers/${id}`, { method: 'DELETE' }),

  toggleServer: (id: string) => request<MCPServerResponse>(`/mcp/servers/${id}/toggle`, { method: 'PATCH' }),

  listServerTools: (id: string) => request<Record<string, unknown>[]>(`/mcp/servers/${id}/tools`),

  refreshServer: (id: string) => request<Record<string, unknown>>(`/mcp/servers/${id}/refresh`, { method: 'POST' }),

  listAllTools: () => request<Record<string, unknown>[]>('/mcp/tools'),
}

// ====== Tools API ======
export const toolsApi = {
  list: () => request<Record<string, unknown>[]>('/tools'),

  create: (data: Record<string, unknown>) =>
    request<Record<string, unknown>>('/tools', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Record<string, unknown>) =>
    request<Record<string, unknown>>(`/tools/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: string) => request<null>(`/tools/${id}`, { method: 'DELETE' }),

  toggle: (id: string) => request<Record<string, unknown>>(`/tools/${id}/toggle`, { method: 'PATCH' }),

  toggleBuiltin: (name: string) => request<Record<string, unknown>>(`/tools/builtin/${name}/toggle`, { method: 'PATCH' }),

  test: (id: string) => request<{ success: boolean; result?: string; error?: string }>(`/tools/${id}/test`, { method: 'POST' }),
}

// ====== Admin API ======
export const adminApi = {
  // Dashboard
  dashboard: () => request<Record<string, unknown>>('/admin/dashboard'),

  // Tenants
  listTenants: () => request<Record<string, unknown>[]>('/admin/tenants'),
  createTenant: (data: { name: string; config?: Record<string, unknown> }) =>
    request<Record<string, unknown>>('/admin/tenants', { method: 'POST', body: JSON.stringify(data) }),
  updateTenant: (id: string, data: Record<string, unknown>) =>
    request<Record<string, unknown>>(`/admin/tenants/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTenant: (id: string) => request<null>(`/admin/tenants/${id}`, { method: 'DELETE' }),

  // Users
  listUsers: (params?: { search?: string; page?: number; page_size?: number }) => {
    const q = new URLSearchParams()
    if (params?.search) q.set('search', params.search)
    if (params?.page) q.set('page', String(params.page))
    if (params?.page_size) q.set('page_size', String(params.page_size))
    return request<{ items: Record<string, unknown>[]; total: number; page: number; page_size: number }>(
      `/admin/users?${q.toString()}`
    )
  },
  createUser: (data: { email: string; password: string; nickname?: string; role?: string; tenant_id?: string }) =>
    request<Record<string, unknown>>('/admin/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id: string, data: Record<string, unknown>) =>
    request<Record<string, unknown>>(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteUser: (id: string) => request<null>(`/admin/users/${id}`, { method: 'DELETE' }),

  // Audit Logs
  listAuditLogs: (params?: { action?: string; page?: number; page_size?: number }) => {
    const q = new URLSearchParams()
    if (params?.action) q.set('action', params.action)
    if (params?.page) q.set('page', String(params.page))
    if (params?.page_size) q.set('page_size', String(params.page_size))
    return request<{ items: Record<string, unknown>[]; total: number; page: number; page_size: number }>(
      `/admin/audit-logs?${q.toString()}`
    )
  },

  // Billing
  billingSummary: (period: 'week' | 'month' = 'month') =>
    request<Record<string, unknown>>(`/admin/billing/summary?period=${period}`),
  billingDetails: (params?: { model?: string; page?: number }) => {
    const q = new URLSearchParams()
    if (params?.model) q.set('model', params.model)
    if (params?.page) q.set('page', String(params.page))
    return request<{ items: Record<string, unknown>[]; total: number }>(
      `/admin/billing/details?${q.toString()}`
    )
  },
}

// ====== Models API ======
export const modelsApi = {
  list: () =>
    request<{
      models: {
        id: string
        name: string
        provider: string
        supports_thinking: boolean
        description: string
      }[]
    }>('/models'),
}

export { setTokens, clearTokens, getToken }
