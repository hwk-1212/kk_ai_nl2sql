import { create } from 'zustand'
import type { Metric, Dimension, BusinessTerm } from '@/types'
import { metricApi, type MetricRaw, type DimensionRaw, type BusinessTermRaw } from '@/services/api'

type MetricTab = 'metrics' | 'dimensions' | 'terms'

function mapMetric(r: MetricRaw): Metric {
  const tags = r.tags
    ? (Array.isArray(r.tags) ? r.tags : Object.keys(r.tags))
    : []
  return {
    id: r.id,
    userId: '',
    name: r.english_name || r.name,
    displayName: r.display_name || r.name,
    description: r.description ?? undefined,
    formula: r.formula,
    dataTableId: r.data_table_id ?? undefined,
    dataTableName: r.source_table,
    aggregation: r.aggregation ?? undefined,
    unit: r.unit ?? undefined,
    tags,
    status: r.status as Metric['status'],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

function mapDimension(r: DimensionRaw): Dimension {
  return {
    id: r.id,
    userId: '',
    name: r.english_name || r.name,
    displayName: r.display_name || r.name,
    description: r.description ?? undefined,
    sourceColumn: r.source_column,
    dataTableId: r.data_table_id ?? undefined,
    dataTableName: undefined,
    dimType: (r.dim_type as Dimension['dimType']) || 'categorical',
    createdAt: r.created_at,
  }
}

function mapTerm(r: BusinessTermRaw): BusinessTerm {
  return {
    id: r.id,
    userId: '',
    term: r.term,
    canonicalName: r.canonical_name,
    description: r.description ?? undefined,
    sqlExpression: r.sql_expression ?? undefined,
    synonyms: r.synonyms ?? undefined,
    createdAt: r.created_at,
  }
}

/** 前端 Metric 转为 API 创建/更新 payload */
function toMetricPayload(m: Partial<Metric>): Record<string, unknown> {
  return {
    name: m.displayName || m.name || '',
    english_name: m.name || '',
    display_name: m.displayName || null,
    description: m.description || null,
    formula: m.formula || '',
    data_table_id: m.dataTableId || null,
    source_table: m.dataTableName || m.name || '',
    aggregation: m.aggregation || null,
    unit: m.unit || null,
    tags: m.tags?.length ? Object.fromEntries(m.tags.map((t, i) => [String(i), t])) : null,
    status: m.status || 'active',
  }
}

/** 前端 Dimension 转为 API payload */
function toDimensionPayload(d: Partial<Dimension>): Record<string, unknown> {
  return {
    name: d.displayName || d.name || '',
    english_name: d.name || '',
    display_name: d.displayName || null,
    description: d.description || null,
    source_column: d.sourceColumn || '',
    data_table_id: d.dataTableId || null,
    dim_type: d.dimType || 'categorical',
  }
}

/** 前端 BusinessTerm 转为 API payload */
function toTermPayload(t: Partial<BusinessTerm>): Record<string, unknown> {
  return {
    term: t.term || '',
    canonical_name: t.canonicalName || '',
    term_type: 'metric',
    description: t.description || null,
    sql_expression: t.sqlExpression || null,
    synonyms: t.synonyms || null,
  }
}

interface MetricState {
  metrics: Metric[]
  dimensions: Dimension[]
  businessTerms: BusinessTerm[]
  selectedMetricId: string | null
  activeTab: MetricTab
  isLoading: boolean
  searchQuery: string
  error: string | null

  setActiveTab: (tab: MetricTab) => void
  setSearchQuery: (q: string) => void
  setSelectedMetricId: (id: string | null) => void
  loadAll: () => Promise<void>

  createMetric: (data: Omit<Metric, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<Metric>
  addMetric: (m: Metric) => void
  updateMetric: (id: string, patch: Partial<Metric>) => Promise<void>
  deleteMetric: (id: string) => Promise<void>

  createDimension: (data: Omit<Dimension, 'id' | 'userId' | 'createdAt'>) => Promise<Dimension>
  addDimension: (d: Dimension) => void
  updateDimension: (id: string, patch: Partial<Dimension>) => Promise<void>
  deleteDimension: (id: string) => Promise<void>

  createTerm: (data: Omit<BusinessTerm, 'id' | 'userId' | 'createdAt'>) => Promise<BusinessTerm>
  addTerm: (t: BusinessTerm) => void
  updateTerm: (id: string, patch: Partial<BusinessTerm>) => Promise<void>
  deleteTerm: (id: string) => Promise<void>
}

export const useMetricStore = create<MetricState>((set, get) => ({
  metrics: [],
  dimensions: [],
  businessTerms: [],
  selectedMetricId: null,
  activeTab: 'metrics',
  isLoading: false,
  searchQuery: '',
  error: null,

  setActiveTab: (tab) => set({ activeTab: tab }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setSelectedMetricId: (id) => set({ selectedMetricId: id }),
  loadAll: async () => {
    set({ isLoading: true, error: null })
    try {
      const [metrics, dimensions, terms] = await Promise.all([
        metricApi.getMetrics({ limit: 500 }),
        metricApi.getDimensions({ limit: 500 }),
        metricApi.getTerms({ limit: 500 }),
      ])
      set({
        metrics: metrics.map(mapMetric),
        dimensions: dimensions.map(mapDimension),
        businessTerms: terms.map(mapTerm),
        isLoading: false,
      })
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : '加载失败',
        isLoading: false,
      })
    }
  },

  createMetric: async (data) => {
    const payload = toMetricPayload(data) as Parameters<typeof metricApi.createMetric>[0]
    if (!payload.source_table) payload.source_table = (data.name || data.displayName || 'unknown') as string
    const res = await metricApi.createMetric(payload)
    const mapped = mapMetric(res)
    set((s) => ({ metrics: [mapped, ...s.metrics] }))
    return mapped
  },
  addMetric: (m) => set((s) => ({ metrics: [...s.metrics, m] })),
  updateMetric: async (id, patch) => {
    const payload = toMetricPayload(patch) as Parameters<typeof metricApi.updateMetric>[1]
    const res = await metricApi.updateMetric(id, payload)
    const mapped = mapMetric(res)
    set((s) => ({ metrics: s.metrics.map((m) => (m.id === id ? mapped : m)) }))
    return
  },
  deleteMetric: async (id) => {
    await metricApi.deleteMetric(id)
    set((s) => ({ metrics: s.metrics.filter((m) => m.id !== id) }))
  },

  createDimension: async (data) => {
    const payload = toDimensionPayload(data) as Parameters<typeof metricApi.createDimension>[0]
    const res = await metricApi.createDimension(payload)
    const mapped = mapDimension(res)
    set((s) => ({ dimensions: [mapped, ...s.dimensions] }))
    return mapped
  },
  addDimension: (d) => set((s) => ({ dimensions: [...s.dimensions, d] })),
  updateDimension: async (id, patch) => {
    const payload = toDimensionPayload(patch) as Parameters<typeof metricApi.updateDimension>[1]
    const res = await metricApi.updateDimension(id, payload)
    const mapped = mapDimension(res)
    set((s) => ({ dimensions: s.dimensions.map((d) => (d.id === id ? mapped : d)) }))
  },
  deleteDimension: async (id) => {
    await metricApi.deleteDimension(id)
    set((s) => ({ dimensions: s.dimensions.filter((d) => d.id !== id) }))
  },

  createTerm: async (data) => {
    const payload = toTermPayload(data) as Parameters<typeof metricApi.createTerm>[0]
    const res = await metricApi.createTerm(payload)
    const mapped = mapTerm(res)
    set((s) => ({ businessTerms: [mapped, ...s.businessTerms] }))
    return mapped
  },
  addTerm: (t) => set((s) => ({ businessTerms: [...s.businessTerms, t] })),
  updateTerm: async (id, patch) => {
    const payload = toTermPayload(patch) as Parameters<typeof metricApi.updateTerm>[1]
    const res = await metricApi.updateTerm(id, payload)
    const mapped = mapTerm(res)
    set((s) => ({ businessTerms: s.businessTerms.map((t) => (t.id === id ? mapped : t)) }))
  },
  deleteTerm: async (id) => {
    await metricApi.deleteTerm(id)
    set((s) => ({ businessTerms: s.businessTerms.filter((t) => t.id !== id) }))
  },
}))

export { mapMetric, mapDimension, mapTerm }
