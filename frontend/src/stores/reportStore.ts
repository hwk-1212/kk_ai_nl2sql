import { create } from 'zustand'
import type { Report, ReportTemplate, ReportSchedule } from '@/types'
import { reportApi } from '@/services/api'

type ReportTab = 'reports' | 'templates' | 'schedules'

function mapReport(r: Record<string, unknown>): Report {
  return {
    id: String(r.id),
    userId: String(r.user_id),
    title: String(r.title),
    reportType: (r.report_type as 'manual' | 'scheduled') || 'manual',
    status: (r.status as Report['status']) || 'draft',
    content: r.content != null ? String(r.content) : undefined,
    sections: Array.isArray(r.sections) ? (r.sections as Report['sections']) : (r.sections as Report['sections'] | undefined),
    templateId: r.template_id != null ? String(r.template_id) : undefined,
    createdAt: r.created_at != null ? new Date(r.created_at as string).toISOString() : '',
    updatedAt: r.updated_at != null ? new Date(r.updated_at as string).toISOString() : '',
  }
}

function mapTemplate(t: Record<string, unknown>): ReportTemplate {
  return {
    id: String(t.id),
    name: String(t.name),
    description: t.description != null ? String(t.description) : undefined,
    category: t.category != null ? String(t.category) : undefined,
    outline: t.outline as ReportTemplate['outline'] | undefined,
    isSystem: Boolean(t.is_system),
    createdAt: t.created_at != null ? new Date(t.created_at as string).toISOString() : '',
  }
}

function mapSchedule(s: Record<string, unknown>, templateName?: string): ReportSchedule {
  return {
    id: String(s.id),
    userId: String(s.user_id),
    templateId: s.template_id != null ? String(s.template_id) : '',
    templateName: templateName ?? (s.template_id != null ? String(s.template_id) : undefined),
    cronExpression: String(s.cron_expression),
    cronDescription: s.cron_description != null ? String(s.cron_description) : String(s.cron_expression),
    isActive: Boolean(s.is_active),
    lastRunAt: s.last_run_at != null ? new Date(s.last_run_at as string).toISOString() : undefined,
    nextRunAt: s.next_run_at != null ? new Date(s.next_run_at as string).toISOString() : undefined,
    createdAt: s.created_at != null ? new Date(s.created_at as string).toISOString() : '',
  }
}

interface ReportState {
  reports: Report[]
  templates: ReportTemplate[]
  schedules: ReportSchedule[]
  selectedReportId: string | null
  activeTab: ReportTab
  isLoading: boolean

  setActiveTab: (tab: ReportTab) => void
  setSelectedReportId: (id: string | null) => void
  loadAll: () => Promise<void>

  addReport: (r: Report) => void
  updateReport: (id: string, patch: Partial<Report>) => void
  deleteReport: (id: string) => Promise<void>

  addSchedule: (s: ReportSchedule) => void
  updateSchedule: (id: string, patch: Partial<ReportSchedule>) => void
  deleteSchedule: (id: string) => Promise<void>
}

export const useReportStore = create<ReportState>((set, get) => ({
  reports: [],
  templates: [],
  schedules: [],
  selectedReportId: null,
  activeTab: 'reports',
  isLoading: false,

  setActiveTab: (tab) => set({ activeTab: tab }),
  setSelectedReportId: (id) => set({ selectedReportId: id }),

  loadAll: async () => {
    set({ isLoading: true })
    try {
      const [reportsRes, templatesRes, schedulesRes] = await Promise.all([
        reportApi.listReports({ page_size: 100 }),
        reportApi.listTemplates(),
        reportApi.listSchedules(),
      ])
      const items = (reportsRes.items || []) as Record<string, unknown>[]
      const templates = ((templatesRes || []) as Record<string, unknown>[]).map(mapTemplate)
      const schedulesRaw = (schedulesRes || []) as Record<string, unknown>[]
      const schedules = schedulesRaw.map((s) => {
        const tid = s.template_id != null ? String(s.template_id) : ''
        const tpl = templates.find((t) => t.id === tid)
        return mapSchedule(s, tpl?.name)
      })
      set({
        reports: items.map(mapReport),
        templates,
        schedules,
        isLoading: false,
      })
    } catch (e) {
      console.error('Report loadAll failed', e)
      set({ isLoading: false })
    }
  },

  addReport: (r) => set((s) => ({ reports: [r, ...s.reports] })),
  updateReport: (id, patch) =>
    set((s) => ({
      reports: s.reports.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    })),
  deleteReport: async (id) => {
    await reportApi.deleteReport(id)
    set((s) => ({ reports: s.reports.filter((r) => r.id !== id) }))
  },

  addSchedule: (s) => set((st) => ({ schedules: [s, ...st.schedules] })),
  updateSchedule: (id, patch) =>
    set((st) => ({
      schedules: st.schedules.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    })),
  deleteSchedule: async (id) => {
    await reportApi.deleteSchedule(id)
    set((st) => ({ schedules: st.schedules.filter((s) => s.id !== id) }))
  },
}))
