import { create } from 'zustand'
import type { DataSource, DataTable, TableDataPage } from '@/types'
import { dataApi, type DataSourceRaw, type DataTableRaw, type TableDataRaw } from '@/services/api'

interface DataState {
  dataSources: DataSource[]
  selectedSourceId: string | null
  selectedTableId: string | null
  tables: DataTable[]
  tableData: Record<string, TableDataPage>
  isUploading: boolean
  isLoading: boolean
  uploadProgress: number

  loadDataSources: () => Promise<void>
  loadTables: (sourceId: string) => Promise<void>
  loadTableData: (tableId: string, page: number) => Promise<void>
  uploadFile: (file: File) => Promise<void>
  deleteDataSource: (id: string) => Promise<void>
  deleteTable: (id: string) => Promise<void>
  updateTable: (id: string, data: { display_name?: string; description?: string }) => Promise<void>
  selectSource: (id: string | null) => void
  selectTable: (id: string | null) => void
}

function mapSource(raw: DataSourceRaw): DataSource {
  return {
    id: raw.id,
    userId: '',
    name: raw.name,
    sourceType: raw.file_type === 'csv' ? 'csv'
      : raw.file_type === 'sqlite' ? 'sqlite'
      : 'excel',
    originalFilename: raw.file_name ?? raw.name,
    fileSize: raw.file_size ?? 0,
    tableCount: raw.table_count,
    status: raw.status as DataSource['status'],
    errorMessage: raw.error_message ?? undefined,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  }
}

function mapTable(raw: DataTableRaw): DataTable {
  return {
    id: raw.id,
    dataSourceId: raw.data_source_id,
    userId: '',
    pgSchema: raw.pg_schema,
    pgTableName: raw.pg_table_name,
    displayName: raw.display_name || raw.name,
    description: raw.description ?? undefined,
    columnSchema: (raw.columns_meta ?? []).map((c) => ({
      name: c.name,
      type: c.type,
      nullable: c.nullable,
      comment: c.comment ?? undefined,
    })),
    rowCount: raw.row_count,
    isWritable: raw.is_writable,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at ?? raw.created_at,
  }
}

function mapTableData(raw: TableDataRaw): TableDataPage {
  const records: Record<string, unknown>[] = raw.rows.map((row) => {
    const obj: Record<string, unknown> = {}
    raw.columns.forEach((col, i) => {
      obj[col] = row[i] ?? null
    })
    return obj
  })
  return {
    data: records,
    totalCount: raw.total_count,
    nextCursor: raw.has_more ? String(raw.page + 1) : null,
    hasMore: raw.has_more,
  }
}

export const useDataStore = create<DataState>((set, get) => ({
  dataSources: [],
  selectedSourceId: null,
  selectedTableId: null,
  tables: [],
  tableData: {},
  isUploading: false,
  isLoading: false,
  uploadProgress: 0,

  loadDataSources: async () => {
    set({ isLoading: true })
    try {
      const res = await dataApi.getSources()
      set({ dataSources: res.items.map(mapSource), isLoading: false })
    } catch (err) {
      console.error('Failed to load data sources:', err)
      set({ isLoading: false })
    }
  },

  loadTables: async (sourceId: string) => {
    try {
      const detail = await dataApi.getSource(sourceId)
      const tables = (detail.tables ?? []).map(mapTable)
      set({ tables })
    } catch {
      const res = await dataApi.getTables()
      const tables = res.items
        .filter((t) => t.data_source_id === sourceId)
        .map(mapTable)
      set({ tables })
    }
  },

  loadTableData: async (tableId: string, page: number) => {
    set({ isLoading: true })
    try {
      const raw = await dataApi.getTableData(tableId, page + 1)
      set((s) => ({
        tableData: { ...s.tableData, [tableId]: mapTableData(raw) },
        isLoading: false,
      }))
    } catch (err) {
      console.error('Failed to load table data:', err)
      set({ isLoading: false })
    }
  },

  uploadFile: async (file: File) => {
    set({ isUploading: true, uploadProgress: 0 })
    try {
      await dataApi.uploadFile(file, (pct) => {
        set({ uploadProgress: pct })
      })
      set({ isUploading: false, uploadProgress: 100 })
      await get().loadDataSources()
    } catch (err) {
      set({ isUploading: false, uploadProgress: 0 })
      throw err
    }
  },

  deleteDataSource: async (id: string) => {
    try {
      await dataApi.deleteSource(id)
    } catch { /* ignore 404 */ }
    set((s) => ({
      dataSources: s.dataSources.filter((ds) => ds.id !== id),
      tables: s.selectedSourceId === id ? [] : s.tables,
      selectedSourceId: s.selectedSourceId === id ? null : s.selectedSourceId,
      selectedTableId: s.selectedSourceId === id ? null : s.selectedTableId,
    }))
  },

  deleteTable: async (id: string) => {
    try {
      await dataApi.deleteTable(id)
    } catch { /* ignore 404 */ }
    set((s) => {
      const newTableData = { ...s.tableData }
      delete newTableData[id]
      return {
        tables: s.tables.filter((t) => t.id !== id),
        tableData: newTableData,
        selectedTableId: s.selectedTableId === id ? null : s.selectedTableId,
      }
    })
    await get().loadDataSources()
  },

  updateTable: async (id: string, data: { display_name?: string; description?: string }) => {
    try {
      const raw = await dataApi.updateTable(id, data)
      const updated = mapTable(raw)
      set((s) => ({
        tables: s.tables.map((t) => (t.id === id ? updated : t)),
      }))
    } catch (err) {
      console.error('Failed to update table:', err)
      throw err
    }
  },

  selectSource: (id: string | null) => {
    set({ selectedSourceId: id, selectedTableId: null })
    if (id) get().loadTables(id)
  },

  selectTable: (id: string | null) => {
    set({ selectedTableId: id })
    if (id && !get().tableData[id]) {
      get().loadTableData(id, 0)
    }
  },
}))
