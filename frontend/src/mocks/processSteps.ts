import type { ProcessStep } from '@/types'

const base = Date.now() - 2100

export const mockProcessSteps: ProcessStep[] = [
  {
    id: 'ps-1',
    type: 'reasoning',
    title: '分析用户查询意图',
    status: 'success',
    startTime: base,
    endTime: base + 500,
    data: { summary: '用户希望按品类查看销售总额排行' },
  },
  {
    id: 'ps-2',
    type: 'tool_call',
    title: '检查表结构',
    status: 'success',
    startTime: base + 500,
    endTime: base + 700,
    data: { tool: 'schema_inspect', table: 'sales_2024' },
  },
  {
    id: 'ps-3',
    type: 'sql_generated',
    title: '生成 SQL 查询',
    status: 'success',
    startTime: base + 700,
    endTime: base + 1500,
    data: {
      sql: 'SELECT category, SUM(amount) as total FROM sales_2024 GROUP BY category ORDER BY total DESC',
    },
  },
  {
    id: 'ps-4',
    type: 'sql_result',
    title: '执行查询',
    status: 'success',
    startTime: base + 1500,
    endTime: base + 1800,
    data: {
      rowCount: 8,
      executionMs: 45,
      preview: [
        { category: '电子产品', total: 125000 },
        { category: '服装', total: 98000 },
        { category: '食品', total: 76000 },
      ],
    },
  },
  {
    id: 'ps-5',
    type: 'chart_config',
    title: '推荐图表',
    status: 'success',
    startTime: base + 1800,
    endTime: base + 1900,
    data: { chartType: 'bar', recommended: true },
  },
  {
    id: 'ps-6',
    type: 'rag_source',
    title: '知识库检索',
    status: 'success',
    startTime: base + 1900,
    endTime: base + 2050,
    data: {
      sources: [{ title: '销售分析报告', score: 0.92 }],
    },
  },
]
