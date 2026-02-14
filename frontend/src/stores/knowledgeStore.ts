import { create } from 'zustand'
import type { KnowledgeBase, KBDocument } from '@/types'
import { knowledgeApi, type KBResponse, type KBDocResponse } from '@/services/api'

interface KnowledgeState {
  knowledgeBases: KnowledgeBase[]
  currentKBId: string | null
  currentDocuments: KBDocument[]
  loading: boolean
  uploading: boolean

  loadKnowledgeBases: () => Promise<void>
  createKnowledgeBase: (name: string, description?: string) => Promise<KnowledgeBase>
  deleteKnowledgeBase: (id: string) => Promise<void>
  selectKnowledgeBase: (id: string | null) => void
  loadDocuments: (kbId: string) => Promise<void>
  uploadDocument: (kbId: string, file: File) => Promise<void>
  deleteDocument: (kbId: string, docId: string) => Promise<void>
  refreshDocuments: (kbId: string) => Promise<void>
  retryDocument: (kbId: string, docId: string) => Promise<void>
  previewDocument: (kbId: string, docId: string) => Promise<{ blob: Blob; filename: string; fileType: string }>
  loadChunks: (kbId: string, docId: string) => Promise<{ id: string; content: string; chunk_index: number; page: number | null; total_chunks: number | null }[]>
}

function toKB(r: KBResponse): KnowledgeBase {
  return { ...r }
}

function toDoc(r: KBDocResponse): KBDocument {
  return {
    id: r.id,
    kb_id: r.kb_id,
    filename: r.filename,
    file_type: r.file_type,
    file_size: r.file_size,
    status: r.status as KBDocument['status'],
    chunk_count: r.chunk_count,
    error_message: r.error_message,
    created_at: r.created_at,
  }
}

export const useKnowledgeStore = create<KnowledgeState>((set, get) => ({
  knowledgeBases: [],
  currentKBId: null,
  currentDocuments: [],
  loading: false,
  uploading: false,

  loadKnowledgeBases: async () => {
    set({ loading: true })
    try {
      const list = await knowledgeApi.list()
      set({ knowledgeBases: list.map(toKB), loading: false })
    } catch (err) {
      console.error('Failed to load knowledge bases:', err)
      set({ loading: false })
    }
  },

  createKnowledgeBase: async (name: string, description?: string) => {
    const resp = await knowledgeApi.create({ name, description })
    const kb = toKB(resp)
    set((s) => ({ knowledgeBases: [kb, ...s.knowledgeBases] }))
    return kb
  },

  deleteKnowledgeBase: async (id: string) => {
    await knowledgeApi.delete(id)
    set((s) => ({
      knowledgeBases: s.knowledgeBases.filter((k) => k.id !== id),
      currentKBId: s.currentKBId === id ? null : s.currentKBId,
      currentDocuments: s.currentKBId === id ? [] : s.currentDocuments,
    }))
  },

  selectKnowledgeBase: (id: string | null) => {
    set({ currentKBId: id, currentDocuments: [] })
    if (id) get().loadDocuments(id)
  },

  loadDocuments: async (kbId: string) => {
    try {
      const docs = await knowledgeApi.listDocuments(kbId)
      set({ currentDocuments: docs.map(toDoc) })
    } catch (err) {
      console.error('Failed to load documents:', err)
    }
  },

  uploadDocument: async (kbId: string, file: File) => {
    set({ uploading: true })
    try {
      await knowledgeApi.uploadDocument(kbId, file)
      // reload docs to get latest status
      await get().loadDocuments(kbId)
      // reload KBs to update doc_count
      await get().loadKnowledgeBases()
    } finally {
      set({ uploading: false })
    }
  },

  deleteDocument: async (kbId: string, docId: string) => {
    await knowledgeApi.deleteDocument(kbId, docId)
    set((s) => ({
      currentDocuments: s.currentDocuments.filter((d) => d.id !== docId),
    }))
    // reload KBs to update doc_count
    await get().loadKnowledgeBases()
  },

  refreshDocuments: async (kbId: string) => {
    await get().loadDocuments(kbId)
  },

  retryDocument: async (kbId: string, docId: string) => {
    await knowledgeApi.retryDocument(kbId, docId)
    await get().loadDocuments(kbId)
  },

  previewDocument: async (kbId: string, docId: string) => {
    return await knowledgeApi.previewDocument(kbId, docId)
  },

  loadChunks: async (kbId: string, docId: string) => {
    return await knowledgeApi.listChunks(kbId, docId)
  },
}))
