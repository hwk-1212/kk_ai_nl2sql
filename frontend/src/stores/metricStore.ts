import { create } from 'zustand'
import type { Metric, Dimension, BusinessTerm } from '@/types'
import { MOCK_METRICS, MOCK_DIMENSIONS, MOCK_TERMS } from '@/mocks/metrics'

type MetricTab = 'metrics' | 'dimensions' | 'terms'

interface MetricState {
  metrics: Metric[]
  dimensions: Dimension[]
  businessTerms: BusinessTerm[]
  selectedMetricId: string | null
  activeTab: MetricTab
  isLoading: boolean
  searchQuery: string

  setActiveTab: (tab: MetricTab) => void
  setSearchQuery: (q: string) => void
  setSelectedMetricId: (id: string | null) => void
  loadAll: () => void

  addMetric: (m: Metric) => void
  updateMetric: (id: string, patch: Partial<Metric>) => void
  deleteMetric: (id: string) => void

  addDimension: (d: Dimension) => void
  updateDimension: (id: string, patch: Partial<Dimension>) => void
  deleteDimension: (id: string) => void

  addTerm: (t: BusinessTerm) => void
  updateTerm: (id: string, patch: Partial<BusinessTerm>) => void
  deleteTerm: (id: string) => void
}

export const useMetricStore = create<MetricState>((set) => ({
  metrics: [],
  dimensions: [],
  businessTerms: [],
  selectedMetricId: null,
  activeTab: 'metrics',
  isLoading: false,
  searchQuery: '',

  setActiveTab: (tab) => set({ activeTab: tab }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setSelectedMetricId: (id) => set({ selectedMetricId: id }),

  loadAll: () => {
    set({ isLoading: true })
    setTimeout(() => {
      set({
        metrics: [...MOCK_METRICS],
        dimensions: [...MOCK_DIMENSIONS],
        businessTerms: [...MOCK_TERMS],
        isLoading: false,
      })
    }, 300)
  },

  addMetric: (m) => set((s) => ({ metrics: [...s.metrics, m] })),
  updateMetric: (id, patch) =>
    set((s) => ({
      metrics: s.metrics.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    })),
  deleteMetric: (id) =>
    set((s) => ({ metrics: s.metrics.filter((m) => m.id !== id) })),

  addDimension: (d) => set((s) => ({ dimensions: [...s.dimensions, d] })),
  updateDimension: (id, patch) =>
    set((s) => ({
      dimensions: s.dimensions.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    })),
  deleteDimension: (id) =>
    set((s) => ({ dimensions: s.dimensions.filter((d) => d.id !== id) })),

  addTerm: (t) => set((s) => ({ businessTerms: [...s.businessTerms, t] })),
  updateTerm: (id, patch) =>
    set((s) => ({
      businessTerms: s.businessTerms.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    })),
  deleteTerm: (id) =>
    set((s) => ({ businessTerms: s.businessTerms.filter((t) => t.id !== id) })),
}))
