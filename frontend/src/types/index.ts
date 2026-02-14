// ========== Auth ==========
export interface User {
  id: string
  email: string
  name: string
  avatar?: string
  role: 'super_admin' | 'tenant_admin' | 'user'
  tenantId: string
}

// ========== Chat ==========
export type ModelId = 'deepseek-chat' | 'qwen-plus'

export interface ModelOption {
  id: ModelId
  name: string
  label: string
  description: string
  supportsThinking: boolean
}

export interface FileAttachment {
  id: string
  name: string
  size: number
  type: string
  url?: string
  progress?: number
}

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
  status: 'calling' | 'success' | 'error'
  result?: string
  error?: string
}

export interface MemoryFragment {
  id: string
  content: string
  relevance: number
  source: string
  createdAt: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  reasoning?: string
  toolCalls?: ToolCall[]
  files?: FileAttachment[]
  memories?: MemoryFragment[]
  ragSources?: RAGSource[]
  model?: ModelId
  createdAt: string
  isStreaming?: boolean
}

export interface Conversation {
  id: string
  title: string
  model: ModelId
  messages: Message[]
  createdAt: string
  updatedAt: string
}

// ========== MCP ==========
export type MCPTransport = 'stdio' | 'sse' | 'http'

export interface MCPTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export interface MCPServer {
  id: string
  name: string
  transport: MCPTransport
  config: string // command or url
  env?: Record<string, string>
  status: 'online' | 'offline' | 'error'
  tools: MCPTool[]
  enabled: boolean
}

// ========== RAG Source ==========
export interface RAGSource {
  content: string
  score: number
  source: string
  page?: number
}

// ========== Knowledge Base ==========
export interface KnowledgeBase {
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

export interface KBDocument {
  id: string
  kb_id: string
  filename: string
  file_type: string
  file_size: number
  status: 'uploading' | 'processing' | 'ready' | 'failed'
  chunk_count: number
  error_message?: string
  created_at: string
}

// ========== Admin ==========
export interface TenantInfo {
  id: string
  name: string
  userCount: number
  messageCount: number
  createdAt: string
}

export interface UsageRecord {
  date: string
  requests: number
  tokens: number
  cost: number
}

export interface AuditLog {
  id: string
  userId: string
  userName: string
  action: string
  target: string
  detail: string
  ip: string
  createdAt: string
}

// ========== Health ==========
export interface HealthResponse {
  status: string
  version: string
  services: Record<string, string>
  timestamp: string
}
