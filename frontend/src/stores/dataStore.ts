import { create } from 'zustand'
import type { DataSource, DataTable, TableDataPage } from '@/types'
import { MOCK_DATA_SOURCES, MOCK_DATA_TABLES, getMockTableData } from '@/mocks/dataSources'

interface DataState {
  dataSources: DataSource[]
  selectedSourceId: string | null
  selectedTableId: string | null
  tables: DataTable[]
  tableData: Record<string, TableDataPage>
  isUploading: boolean
  isLoading: boolean

  loadDataSources: () => void
  loadTables: (sourceId: string) => void
  loadTableData: (tableId: string, page: number) => void
  uploadFile: (file: File) => Promise<void>
  deleteDataSource: (id: string) => void
  deleteTable: (id: string) => void
  selectSource: (id: string | null) => void
  selectTable: (id: string | null) => void
}

export const useDataStore = create<DataState>((set, get) => ({
  dataSources: [],
  selectedSourceId: null,
  selectedTableId: null,
  tables: [],
  tableData: {},
  isUploading: false,
  isLoading: false,

  loadDataSources: () => {
    set({ isLoading: true })
    setTimeout(() => {
      set({ dataSources: [...MOCK_DATA_SOURCES], isLoading: false })
    }, 300)
  },

  loadTables: (sourceId: string) => {
    const tables = MOCK_DATA_TABLES.filter((t) => t.dataSourceId === sourceId)
    set({ tables })
  },

  loadTableData: (tableId: string, page: number) => {
    set({ isLoading: true })
    setTimeout(() => {
      const data = getMockTableData(tableId, page)
      set((s) => ({
        tableData: { ...s.tableData, [tableId]: data },
        isLoading: false,
      }))
    }, 400)
  },

  uploadFile: (file: File) => {
    set({ isUploading: true })
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const ext = file.name.split('.').pop()?.toLowerCase()
        let sourceType: DataSource['sourceType'] = 'csv'
        if (ext === 'xlsx' || ext === 'xls') sourceType = 'excel'
        else if (ext === 'sqlite') sourceType = 'sqlite'

        const newSource: DataSource = {
          id: `ds-${Date.now()}`,
          userId: 'user-001',
          name: file.name.replace(/\.[^.]+$/, ''),
          sourceType,
          originalFilename: file.name,
          fileSize: file.size,
          tableCount: 0,
          status: 'processing',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        set((s) => ({
          dataSources: [newSource, ...s.dataSources],
          isUploading: false,
        }))
        resolve()
      }, 2000)
    })
  },

  deleteDataSource: (id: string) => {
    set((s) => ({
      dataSources: s.dataSources.filter((ds) => ds.id !== id),
      tables: s.selectedSourceId === id ? [] : s.tables,
      selectedSourceId: s.selectedSourceId === id ? null : s.selectedSourceId,
      selectedTableId: s.selectedSourceId === id ? null : s.selectedTableId,
    }))
  },

  deleteTable: (id: string) => {
    set((s) => {
      const newTableData = { ...s.tableData }
      delete newTableData[id]
      return {
        tables: s.tables.filter((t) => t.id !== id),
        tableData: newTableData,
        selectedTableId: s.selectedTableId === id ? null : s.selectedTableId,
      }
    })
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
