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

/** 消息块：用于交错展示 文本 | 工具调用 | 文本 | ... */
export type MessageBlock =
  | { type: 'content'; text: string }
  | { type: 'tool'; toolCall: ToolCall }

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  reasoning?: string
  toolCalls?: ToolCall[]
  /** 交错块（文本+工具），有则按此渲染；否则用 content + toolCalls */
  blocks?: MessageBlock[]
  files?: FileAttachment[]
  memories?: MemoryFragment[]
  ragSources?: RAGSource[]
  model?: ModelId
  createdAt: string
  isStreaming?: boolean
  chartConfig?: ChartConfig
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

// ========== Data Management ==========
export interface DataSource {
  id: string
  userId: string
  name: string
  sourceType: 'excel' | 'csv' | 'sqlite'
  originalFilename: string
  fileSize: number
  tableCount: number
  status: 'uploading' | 'processing' | 'ready' | 'failed'
  errorMessage?: string
  createdAt: string
  updatedAt: string
}

export interface ColumnInfo {
  name: string
  type: string
  nullable: boolean
  comment?: string
}

export interface DataTable {
  id: string
  dataSourceId: string
  userId: string
  pgSchema: string
  pgTableName: string
  displayName: string
  description?: string
  columnSchema: ColumnInfo[]
  rowCount: number
  isWritable: boolean
  createdAt: string
  updatedAt: string
}

export interface TableDataPage {
  data: Record<string, any>[]
  totalCount: number
  nextCursor: string | null
  hasMore: boolean
}

// ========== Process Panel ==========
export interface ProcessStep {
  id: string
  type: 'reasoning' | 'tool_call' | 'tool_result' | 'sql_generated' | 'sql_result' | 'chart_config' | 'rag_source' | 'context_compressed'
  title: string
  status: 'running' | 'success' | 'error'
  startTime: number
  endTime?: number
  data: any
}

// ========== Chart ==========
export interface ChartConfig {
  chartType: 'bar' | 'line' | 'pie' | 'area' | 'scatter' | 'table'
  title?: string
  xAxis?: { field: string; label?: string }
  yAxis?: { field: string; label?: string }
  series?: { field: string; label?: string; color?: string }[]
  colorMapping?: Record<string, string>
  data: Record<string, any>[]
  /** 后端渲染后上传至 MinIO 的图片地址（有则优先展示图片，否则用 Recharts 交互图） */
  imageUrl?: string
}

// ========== Metrics ==========
export interface Metric {
  id: string
  userId: string
  name: string
  displayName: string
  description?: string
  formula: string
  dataTableId?: string
  dataTableName?: string
  aggregation?: string
  unit?: string
  tags: string[]
  status: 'active' | 'draft' | 'deprecated'
  createdAt: string
  updatedAt: string
}

export interface Dimension {
  id: string
  userId: string
  name: string
  displayName: string
  description?: string
  sourceColumn: string
  dataTableId?: string
  dataTableName?: string
  dimType: 'categorical' | 'temporal' | 'numeric'
  createdAt: string
}

export interface BusinessTerm {
  id: string
  userId: string
  term: string
  canonicalName: string
  description?: string
  sqlExpression?: string
  synonyms?: string
  createdAt: string
}

// ========== Reports ==========
export interface ReportSection {
  id: string
  title: string
  content: string
  children?: ReportSection[]
}

export interface Report {
  id: string
  userId: string
  title: string
  reportType: 'manual' | 'scheduled'
  status: 'draft' | 'generating' | 'ready' | 'failed'
  content?: string
  sections?: ReportSection[]
  templateId?: string
  createdAt: string
  updatedAt: string
}

export interface ReportTemplate {
  id: string
  name: string
  description?: string
  category?: string
  outline?: ReportSection[]
  isSystem: boolean
  createdAt: string
}

export interface ReportSchedule {
  id: string
  userId: string
  templateId: string
  templateName?: string
  cronExpression: string
  cronDescription?: string
  isActive: boolean
  lastRunAt?: string
  nextRunAt?: string
  createdAt: string
}

// ========== Data Permissions ==========
export interface DataRole {
  id: string
  tenantId?: string
  name: string
  description?: string
  userCount: number
  createdAt: string
}

export interface RoleTablePermission {
  tableId: string
  tableName: string
  canRead: boolean
  canWrite: boolean
}

export interface RoleColumnPermission {
  columnName: string
  visible: boolean
  maskType?: 'none' | 'phone' | 'email' | 'id_card' | 'full_mask' | 'last4'
}

export interface RoleRowFilter {
  id: string
  filterExpression: string
  description?: string
  /** 表 ID，用于删除行过滤时调用 API */
  tableId?: string
}
