import type { MCPServer } from '@/types'

export const mockMCPServers: MCPServer[] = [
  {
    id: 'mcp-001',
    name: 'Web Search',
    transport: 'stdio',
    config: 'npx @anthropic/mcp-web-search',
    status: 'online',
    enabled: true,
    tools: [
      {
        name: 'web_search',
        description: '搜索互联网获取最新信息',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: '搜索关键词' },
            num_results: { type: 'number', description: '返回结果数量', default: 5 },
          },
          required: ['query'],
        },
      },
    ],
  },
  {
    id: 'mcp-002',
    name: 'File System',
    transport: 'stdio',
    config: 'npx @anthropic/mcp-filesystem /workspace',
    status: 'online',
    enabled: true,
    tools: [
      {
        name: 'read_file',
        description: '读取文件内容',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: '文件路径' },
          },
          required: ['path'],
        },
      },
      {
        name: 'write_file',
        description: '写入文件内容',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: '文件路径' },
            content: { type: 'string', description: '文件内容' },
          },
          required: ['path', 'content'],
        },
      },
      {
        name: 'list_directory',
        description: '列出目录内容',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: '目录路径' },
          },
          required: ['path'],
        },
      },
    ],
  },
  {
    id: 'mcp-003',
    name: 'Database Query',
    transport: 'http',
    config: 'http://localhost:3100/mcp',
    status: 'offline',
    enabled: false,
    tools: [
      {
        name: 'query_sql',
        description: '执行 SQL 查询',
        inputSchema: {
          type: 'object',
          properties: {
            sql: { type: 'string', description: 'SQL 语句' },
            database: { type: 'string', description: '数据库名称' },
          },
          required: ['sql'],
        },
      },
    ],
  },
]
