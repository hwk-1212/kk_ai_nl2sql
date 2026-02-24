import { create } from 'zustand'
import type { Conversation, Message, ModelId, MemoryFragment, RAGSource, ToolCall, ProcessStep, ChartConfig } from '@/types'
import { conversationsApi, streamChat, type ConvResponse, type ConvDetail, type MemoryRecallPayload } from '@/services/api'

interface ChatState {
  conversations: Conversation[]
  currentId: string | null
  selectedModel: ModelId
  isStreaming: boolean
  streamingContent: string
  streamingReasoning: string
  thinkingEnabled: boolean
  loaded: boolean
  selectedKBIds: string[]
  processSteps: ProcessStep[]
  showProcessPanel: boolean

  setCurrentId: (id: string | null) => void
  setSelectedModel: (m: ModelId) => void
  setThinkingEnabled: (v: boolean) => void
  setSelectedKBIds: (ids: string[]) => void
  toggleKBId: (id: string) => void
  loadConversations: () => Promise<void>
  loadConversation: (id: string) => Promise<void>
  createConversation: () => Promise<string>
  deleteConversation: (id: string) => Promise<void>
  renameConversation: (id: string, title: string) => Promise<void>
  sendMessage: (content: string) => Promise<void>
  stopStreaming: () => void
  regenerate: (messageId: string) => void
  addProcessStep: (step: ProcessStep) => void
  updateProcessStep: (id: string, updates: Partial<ProcessStep>) => void
  clearProcessSteps: () => void
  toggleProcessPanel: () => void
}

let abortController: AbortController | null = null

function convResponseToConversation(c: ConvResponse): Conversation {
  return {
    id: c.id,
    title: c.title,
    model: c.model as ModelId,
    messages: [],
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  }
}

function convDetailToConversation(c: ConvDetail): Conversation {
  return {
    id: c.id,
    title: c.title,
    model: c.model as ModelId,
    messages: c.messages.map((m) => {
      const meta = m.metadata
      return {
        id: m.id,
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
        reasoning: m.reasoning_content || undefined,
        toolCalls: meta?.tool_calls?.map((tc) => ({
          id: tc.id,
          name: tc.name,
          arguments: tc.arguments,
          status: (tc.status as 'calling' | 'success' | 'error') || 'success',
          result: tc.result,
          error: tc.error,
        })),
        memories: meta?.memories?.map((mem) => ({
          id: mem.id,
          content: mem.content,
          relevance: mem.relevance,
          source: mem.source,
          createdAt: m.created_at,
        })),
        ragSources: meta?.rag_sources?.map((s) => ({
          content: s.content,
          score: s.score,
          source: s.source,
          page: s.page,
        })),
        createdAt: m.created_at,
      }
    }),
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  }
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  currentId: null,
  selectedModel: 'deepseek-chat',
  isStreaming: false,
  streamingContent: '',
  streamingReasoning: '',
  thinkingEnabled: false,
  loaded: false,
  selectedKBIds: [],
  processSteps: [],
  showProcessPanel: false,

  setCurrentId: (currentId) => {
    set({ currentId })
    if (currentId) get().loadConversation(currentId)
  },

  setSelectedModel: (selectedModel) => set({ selectedModel }),
  setThinkingEnabled: (thinkingEnabled) => set({ thinkingEnabled }),
  setSelectedKBIds: (selectedKBIds) => set({ selectedKBIds }),
  toggleKBId: (id) => set((s) => ({
    selectedKBIds: s.selectedKBIds.includes(id)
      ? s.selectedKBIds.filter((k) => k !== id)
      : [...s.selectedKBIds, id],
  })),

  loadConversations: async () => {
    try {
      const list = await conversationsApi.list()
      set({
        conversations: list.map(convResponseToConversation),
        loaded: true,
      })
    } catch (err) {
      console.error('Failed to load conversations:', err)
    }
  },

  loadConversation: async (id: string) => {
    try {
      const detail = await conversationsApi.get(id)
      const fullConv = convDetailToConversation(detail)
      set((s) => ({
        conversations: s.conversations.map((c) =>
          c.id === id ? fullConv : c
        ),
      }))
    } catch (err) {
      console.error('Failed to load conversation:', err)
    }
  },

  createConversation: async () => {
    try {
      const res = await conversationsApi.create('New Chat', get().selectedModel)
      const conv = convResponseToConversation(res)
      set((s) => ({
        conversations: [conv, ...s.conversations],
        currentId: conv.id,
      }))
      return conv.id
    } catch (err) {
      // fallback: local only
      const id = 'conv-' + Date.now()
      const conv: Conversation = {
        id,
        title: 'New Chat',
        model: get().selectedModel,
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      set((s) => ({
        conversations: [conv, ...s.conversations],
        currentId: id,
      }))
      return id
    }
  },

  deleteConversation: async (id) => {
    try {
      await conversationsApi.delete(id)
    } catch { /* ignore */ }
    set((s) => {
      const filtered = s.conversations.filter((c) => c.id !== id)
      return {
        conversations: filtered,
        currentId: s.currentId === id ? (filtered[0]?.id ?? null) : s.currentId,
      }
    })
  },

  renameConversation: async (id, title) => {
    try {
      await conversationsApi.update(id, { title })
    } catch { /* ignore */ }
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === id ? { ...c, title, updatedAt: new Date().toISOString() } : c
      ),
    }))
  },

  sendMessage: async (content: string) => {
    const { currentId, selectedModel, thinkingEnabled, selectedKBIds } = get()
    let convId = currentId

    // 如果没有当前会话，创建一个
    if (!convId) {
      convId = await get().createConversation()
    }

    // 添加用户消息到本地
    const userMsg: Message = {
      id: 'msg-' + Date.now(),
      role: 'user',
      content,
      model: selectedModel,
      createdAt: new Date().toISOString(),
    }

    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === convId
          ? {
              ...c,
              messages: [...c.messages, userMsg],
              updatedAt: new Date().toISOString(),
              title: c.messages.length === 0
                ? content.slice(0, 30) + (content.length > 30 ? '...' : '')
                : c.title,
            }
          : c
      ),
    }))

    // 开始 SSE 流式请求
    abortController = new AbortController()
    set({ isStreaming: true, streamingContent: '', streamingReasoning: '' })
    get().clearProcessSteps()

    let finalConvId = convId
    let recalledMemories: MemoryFragment[] = []
    let ragSources: RAGSource[] = []
    const toolCalls: ToolCall[] = []
    let chartConfig: ChartConfig | undefined

    try {
      await streamChat(
        {
          conversation_id: convId,
          model: selectedModel,
          content,
          thinking_enabled: thinkingEnabled,
          kb_ids: selectedKBIds.length > 0 ? selectedKBIds : undefined,
        },
        {
          onMeta: (cid) => {
            finalConvId = cid
            if (cid !== convId) {
              set((s) => ({
                conversations: s.conversations.map((c) =>
                  c.id === convId ? { ...c, id: cid } : c
                ),
                currentId: cid,
              }))
            }
          },
          onMemoryRecall: (payload: MemoryRecallPayload) => {
            recalledMemories = payload.memories.map((m) => ({
              id: m.id,
              content: m.content,
              relevance: m.relevance,
              source: m.source,
              createdAt: new Date().toISOString(),
            }))
          },
          onRAGSource: (sources) => {
            ragSources = sources.map((s) => ({
              content: s.content,
              score: s.score,
              source: s.source,
            }))
            get().addProcessStep({
              id: 'rag-' + Date.now(),
              type: 'rag_source',
              title: `知识库检索: ${sources.length} 条结果`,
              status: 'success',
              startTime: Date.now(),
              endTime: Date.now(),
              data: { sources: sources.map((s) => ({ title: s.source, score: s.score })) },
            })
          },
          onToolCall: (data) => {
            toolCalls.push({
              id: data.id,
              name: data.name,
              arguments: data.arguments,
              status: 'calling',
            })
            get().addProcessStep({
              id: data.id,
              type: 'tool_call',
              title: `调用工具: ${data.name}`,
              status: 'running',
              startTime: Date.now(),
              data: { tool: data.name, ...data.arguments },
            })
          },
          onToolResult: (data) => {
            const tc = toolCalls.find((t) => t.id === data.id)
            if (tc) {
              tc.status = data.status === 'success' ? 'success' : 'error'
              tc.result = data.result || undefined
              tc.error = data.error || undefined
            }

            const endTime = Date.now()
            const stepStatus = data.status === 'success' ? 'success' as const : 'error' as const

            get().updateProcessStep(data.id, { status: stepStatus, endTime })

            const structured = (data as Record<string, unknown>).structured_data as Record<string, unknown> | undefined

            if (data.name === 'execute_sql') {
              const parsed = structured?.type === 'sql_result' ? structured : _tryParseToolJson(data.result || '')
              if (parsed) {
                const cols = parsed.columns as string[] | undefined
                const rows = parsed.rows as unknown[][] | undefined
                get().addProcessStep({
                  id: 'sql-' + Date.now(),
                  type: 'sql_result',
                  title: `查询结果: ${parsed.total_rows ?? '?'} 行`,
                  status: 'success',
                  startTime: endTime,
                  endTime,
                  data: {
                    rowCount: parsed.total_rows,
                    executionMs: parsed.execution_ms,
                    preview: _rowsToRecords(cols, rows?.slice(0, 5)),
                  },
                })
              }
            }

            if (data.name === 'recommend_chart') {
              try {
                const raw = structured?.type === 'chart_config'
                  ? structured
                  : JSON.parse(data.result || '{}')
                chartConfig = _mapChartConfig(raw as Record<string, unknown>)
                get().addProcessStep({
                  id: 'chart-' + Date.now(),
                  type: 'chart_config',
                  title: `图表推荐: ${(raw as Record<string, unknown>).type || (raw as Record<string, unknown>).chartType || 'table'}`,
                  status: 'success',
                  startTime: endTime,
                  endTime,
                  data: { chartType: (raw as Record<string, unknown>).type || (raw as Record<string, unknown>).chartType, recommended: true },
                })
              } catch { /* ignore parse error */ }
            }
          },
          onReasoning: (chunk) =>
            set((s) => ({ streamingReasoning: s.streamingReasoning + chunk })),
          onContent: (chunk) =>
            set((s) => ({ streamingContent: s.streamingContent + chunk })),
          onDone: () => {
            // handled below
          },
          onError: (err) => {
            console.error('Stream error:', err)
          },
        },
        abortController.signal,
      )
    } catch {
      // aborted or error
    }

    // 保存 assistant 消息到本地状态
    const { streamingContent, streamingReasoning } = get()
    if (streamingContent || toolCalls.length > 0) {
      const assistantMsg: Message = {
        id: 'msg-' + Date.now(),
        role: 'assistant',
        content: streamingContent || '',
        reasoning: streamingReasoning || undefined,
        memories: recalledMemories.length > 0 ? recalledMemories : undefined,
        ragSources: ragSources.length > 0 ? ragSources : undefined,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        chartConfig,
        model: selectedModel,
        createdAt: new Date().toISOString(),
      }

      set((s) => ({
        conversations: s.conversations.map((c) =>
          c.id === finalConvId
            ? { ...c, messages: [...c.messages, assistantMsg], updatedAt: new Date().toISOString() }
            : c
        ),
        isStreaming: false,
        streamingContent: '',
        streamingReasoning: '',
      }))
    } else {
      set({ isStreaming: false, streamingContent: '', streamingReasoning: '' })
    }

    abortController = null
  },

  stopStreaming: () => {
    abortController?.abort()
    const { streamingContent, streamingReasoning, currentId, selectedModel } = get()
    if (streamingContent) {
      const msg: Message = {
        id: 'msg-' + Date.now(),
        role: 'assistant',
        content: streamingContent + '\n\n*[已停止生成]*',
        reasoning: streamingReasoning || undefined,
        model: selectedModel,
        createdAt: new Date().toISOString(),
      }
      set((s) => ({
        conversations: s.conversations.map((c) =>
          c.id === currentId ? { ...c, messages: [...c.messages, msg] } : c
        ),
        isStreaming: false,
        streamingContent: '',
        streamingReasoning: '',
      }))
    } else {
      set({ isStreaming: false })
    }
    abortController = null
  },

  addProcessStep: (step) => set((s) => ({ processSteps: [...s.processSteps, step] })),

  updateProcessStep: (id, updates) => set((s) => ({
    processSteps: s.processSteps.map((ps) => ps.id === id ? { ...ps, ...updates } : ps),
  })),

  clearProcessSteps: () => set({ processSteps: [] }),

  toggleProcessPanel: () => set((s) => ({ showProcessPanel: !s.showProcessPanel })),

  regenerate: (messageId: string) => {
    const { currentId, conversations } = get()
    const conv = conversations.find((c) => c.id === currentId)
    if (!conv) return

    const idx = conv.messages.findIndex((m) => m.id === messageId)
    if (idx < 1) return

    const userMsg = conv.messages[idx - 1]
    if (userMsg.role !== 'user') return

    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === currentId
          ? { ...c, messages: c.messages.filter((_, i) => i < idx) }
          : c
      ),
    }))

    get().sendMessage(userMsg.content)
  },
}))


function _tryParseToolJson(text: string): Record<string, unknown> | null {
  const jsonStart = text.indexOf('{')
  if (jsonStart < 0) return null
  try {
    return JSON.parse(text.slice(jsonStart))
  } catch {
    return null
  }
}

function _rowsToRecords(
  columns: string[] | undefined,
  rows: unknown[][] | undefined,
): Record<string, unknown>[] | undefined {
  if (!columns || !rows) return undefined
  return rows.map((row) => {
    const obj: Record<string, unknown> = {}
    columns.forEach((col, i) => { obj[col] = (row as unknown[])[i] ?? null })
    return obj
  })
}

function _mapChartConfig(raw: Record<string, unknown>): ChartConfig {
  const chartType = (raw.type || raw.chartType || 'table') as ChartConfig['chartType']
  const data = (raw.data as Record<string, unknown>[]) || []

  const config: ChartConfig = { chartType, data }
  if (raw.title) config.title = String(raw.title)

  if (raw.xField) config.xAxis = { field: String(raw.xField) }
  if (raw.xAxis && typeof raw.xAxis === 'object') config.xAxis = raw.xAxis as ChartConfig['xAxis']

  if (raw.yFields && Array.isArray(raw.yFields)) {
    config.yAxis = { field: (raw.yFields as string[])[0] }
    config.series = (raw.yFields as string[]).map((f) => ({ field: f }))
  }
  if (raw.yAxis && typeof raw.yAxis === 'object') config.yAxis = raw.yAxis as ChartConfig['yAxis']

  if (raw.series && Array.isArray(raw.series)) {
    config.series = raw.series as ChartConfig['series']
  }

  if (raw.nameField) config.xAxis = { field: String(raw.nameField) }
  if (raw.valueField) config.yAxis = { field: String(raw.valueField) }

  return config
}
