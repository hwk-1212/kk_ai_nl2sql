import { create } from 'zustand'
import type { Report, ReportTemplate, ReportSchedule } from '@/types'
import { MOCK_REPORTS, MOCK_TEMPLATES, MOCK_SCHEDULES } from '@/mocks/reports'

type ReportTab = 'reports' | 'templates' | 'schedules'

interface ReportState {
  reports: Report[]
  templates: ReportTemplate[]
  schedules: ReportSchedule[]
  selectedReportId: string | null
  activeTab: ReportTab
  isLoading: boolean

  setActiveTab: (tab: ReportTab) => void
  setSelectedReportId: (id: string | null) => void
  loadAll: () => void

  addReport: (r: Report) => void
  updateReport: (id: string, patch: Partial<Report>) => void
  deleteReport: (id: string) => void

  addSchedule: (s: ReportSchedule) => void
  updateSchedule: (id: string, patch: Partial<ReportSchedule>) => void
  deleteSchedule: (id: string) => void
}

export const useReportStore = create<ReportState>((set) => ({
  reports: [],
  templates: [],
  schedules: [],
  selectedReportId: null,
  activeTab: 'reports',
  isLoading: false,

  setActiveTab: (tab) => set({ activeTab: tab }),
  setSelectedReportId: (id) => set({ selectedReportId: id }),

  loadAll: () => {
    set({ isLoading: true })
    setTimeout(() => {
      set({
        reports: [...MOCK_REPORTS],
        templates: [...MOCK_TEMPLATES],
        schedules: [...MOCK_SCHEDULES],
        isLoading: false,
      })
    }, 300)
  },

  addReport: (r) => set((s) => ({ reports: [...s.reports, r] })),
  updateReport: (id, patch) =>
    set((s) => ({
      reports: s.reports.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    })),
  deleteReport: (id) =>
    set((s) => ({ reports: s.reports.filter((r) => r.id !== id) })),

  addSchedule: (s) => set((st) => ({ schedules: [...st.schedules, s] })),
  updateSchedule: (id, patch) =>
    set((st) => ({
      schedules: st.schedules.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    })),
  deleteSchedule: (id) =>
    set((st) => ({ schedules: st.schedules.filter((s) => s.id !== id) })),
}))
