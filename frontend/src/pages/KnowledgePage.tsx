import { useEffect, useState, useRef, useCallback } from 'react'
import {
  BookOpen, Plus, Trash2, Upload, FileText, Loader2, CheckCircle,
  AlertCircle, ArrowLeft, RefreshCw, Database, Eye, List, RotateCcw, X,
  ChevronDown, ChevronRight,
} from 'lucide-react'
import { useKnowledgeStore } from '@/stores/knowledgeStore'
import type { KnowledgeBase, KBDocument } from '@/types'
import EmptyState from '@/components/common/EmptyState'
import Modal from '@/components/common/Modal'
import DocumentPreviewDrawer from '@/components/knowledge/DocumentPreviewDrawer'

const FILE_TYPE_ICONS: Record<string, string> = {
  pdf: '📄', docx: '📝', txt: '📃', md: '📑', csv: '📊',
}

const STATUS_CONFIG: Record<string, { color: string; label: string; icon: typeof CheckCircle }> = {
  uploading: { color: 'text-blue-500', label: '上传中', icon: Loader2 },
  processing: { color: 'text-amber-500', label: '处理中', icon: Loader2 },
  ready: { color: 'text-primary', label: '就绪', icon: CheckCircle },
  failed: { color: 'text-red-500', label: '失败', icon: AlertCircle },
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

// ======================== Create KB Modal ========================
function CreateKBModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createKB = useKnowledgeStore((s) => s.createKnowledgeBase)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  const handleCreate = async () => {
    if (!name.trim()) return
    setLoading(true)
    try {
      await createKB(name.trim(), description.trim() || undefined)
      setName('')
      setDescription('')
      onClose()
    } catch (err) {
      console.error('Failed to create KB:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="创建知识库" maxWidth="max-w-md">
      <div className="space-y-4">
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">名称 *</label>
          <input
            value={name} onChange={(e) => setName(e.target.value)}
            placeholder="例如: 产品文档"
            className="w-full px-4 py-3 rounded-2xl border border-slate-100 dark:border-slate-700 bg-bg-main dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">描述</label>
          <textarea
            value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="知识库用途描述..." rows={3}
            className="w-full px-4 py-3 rounded-2xl border border-slate-100 dark:border-slate-700 bg-bg-main dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
          />
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={handleCreate} disabled={loading || !name.trim()}
            className="flex-1 btn-gradient text-white py-3 rounded-2xl font-semibold text-sm shadow-lg shadow-primary/20 disabled:opacity-50 transition-all active:scale-[0.98] flex items-center justify-center gap-2">
            {loading && <Loader2 size={16} className="animate-spin" />} 创建
          </button>
          <button onClick={onClose}
            className="flex-1 py-3 rounded-2xl font-semibold text-sm bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-all">
            取消
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ======================== Chunk Viewer Modal ========================
interface ChunkData {
  id: string; content: string; chunk_index: number; page: number | null; total_chunks: number | null
}

function ChunkViewerModal({ open, onClose, docName, kbId, docId }: {
  open: boolean; onClose: () => void; docName: string; kbId: string; docId: string
}) {
  const loadChunks = useKnowledgeStore((s) => s.loadChunks)
  const [chunks, setChunks] = useState<ChunkData[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    loadChunks(kbId, docId)
      .then((data) => {
        // 按 page → chunk_index 排序
        const sorted = [...data].sort((a, b) => {
          const pa = a.page ?? 0, pb = b.page ?? 0
          if (pa !== pb) return pa - pb
          return a.chunk_index - b.chunk_index
        })
        setChunks(sorted)
      })
      .catch((err) => console.error('Failed to load chunks:', err))
      .finally(() => setLoading(false))
  }, [open, kbId, docId, loadChunks])

  return (
    <Modal open={open} onClose={onClose} title={`文档切片 — ${docName}`} maxWidth="max-w-3xl">
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-primary" /></div>
      ) : chunks.length === 0 ? (
        <p className="text-center text-sm text-slate-400 py-8">暂无切片数据</p>
      ) : (
        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          <p className="text-xs text-slate-400 mb-3">共 {chunks.length} 个切片</p>
          {chunks.map((chunk) => {
            const isExpanded = expandedIdx === chunk.chunk_index
            return (
              <div key={chunk.id} className="border border-slate-100 dark:border-slate-700 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setExpandedIdx(isExpanded ? null : chunk.chunk_index)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                >
                  {isExpanded ? <ChevronDown size={14} className="text-slate-400 shrink-0" /> : <ChevronRight size={14} className="text-slate-400 shrink-0" />}
                  <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-lg shrink-0">
                    #{chunk.chunk_index + 1}
                  </span>
                  {chunk.page && (
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-lg shrink-0">
                      第{chunk.page}页
                    </span>
                  )}
                  <span className="text-xs text-slate-600 dark:text-slate-300 truncate flex-1">
                    {chunk.content.slice(0, 80)}...
                  </span>
                  <span className="text-[10px] text-slate-400 shrink-0">{chunk.content.length}字</span>
                </button>
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-slate-100 dark:border-slate-700">
                    <pre className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed font-sans bg-slate-50 dark:bg-slate-900 rounded-xl p-4 max-h-64 overflow-y-auto">
                      {chunk.content}
                    </pre>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Modal>
  )
}

// ======================== KB Card ========================
function KBCard({ kb, onSelect, onDelete }: { kb: KnowledgeBase; onSelect: () => void; onDelete: () => void }) {
  return (
    <div onClick={onSelect}
      className="rounded-3xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 cursor-pointer transition-all hover:shadow-glass hover:border-primary/30 group">
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 rounded-2xl bg-primary-50 dark:bg-primary/10 flex items-center justify-center">
          <Database size={24} className="text-primary" />
        </div>
        <button onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100">
          <Trash2 size={16} />
        </button>
      </div>
      <h3 className="font-bold text-slate-800 dark:text-white text-lg mb-1">{kb.name}</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 line-clamp-2">{kb.description || '暂无描述'}</p>
      <div className="flex items-center gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1"><FileText size={12} /> {kb.doc_count} 文档</span>
        <span>{kb.embedding_model} · {kb.embedding_dim}d</span>
      </div>
    </div>
  )
}

// ======================== Document Row ========================
function DocumentRow({ doc, kbId }: { doc: KBDocument; kbId: string }) {
  const { deleteDocument, retryDocument } = useKnowledgeStore()
  const [showChunks, setShowChunks] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const status = STATUS_CONFIG[doc.status] || STATUS_CONFIG.failed
  const StatusIcon = status.icon

  const handleRetry = async () => {
    setRetrying(true)
    try { await retryDocument(kbId, doc.id) } catch (err) { console.error(err) }
    finally { setRetrying(false) }
  }

  return (
    <>
      <div className="flex items-center gap-4 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-200 dark:hover:border-slate-600 transition-all group">
        <div className="text-2xl w-10 text-center">{FILE_TYPE_ICONS[doc.file_type] || '📄'}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{doc.filename}</p>
          <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
            <span>{formatSize(doc.file_size)}</span>
            {doc.chunk_count > 0 && <span>{doc.chunk_count} chunks</span>}
            <span className={`flex items-center gap-1 ${status.color}`}>
              <StatusIcon size={10} className={doc.status === 'processing' || doc.status === 'uploading' ? 'animate-spin' : ''} />
              {status.label}
            </span>
          </div>
          {doc.error_message && <p className="text-xs text-red-500 mt-1 truncate">{doc.error_message}</p>}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Retry — only for failed */}
          {doc.status === 'failed' && (
            <button onClick={handleRetry} disabled={retrying}
              className="p-2 rounded-xl text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-all"
              title="重新处理">
              {retrying ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
            </button>
          )}

          {/* Preview original — drawer */}
          <button onClick={() => setShowPreview(true)}
            className="p-2 rounded-xl text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-all opacity-0 group-hover:opacity-100"
            title="查看原件">
            <Eye size={16} />
          </button>

          {/* View chunks — only for ready */}
          {doc.status === 'ready' && doc.chunk_count > 0 && (
            <button onClick={() => setShowChunks(true)}
              className="p-2 rounded-xl text-slate-400 hover:text-primary hover:bg-primary/10 transition-all opacity-0 group-hover:opacity-100"
              title="查看切片">
              <List size={16} />
            </button>
          )}

          {/* Delete */}
          <button
            onClick={() => {
              if (window.confirm(`确定删除文档「${doc.filename}」？`)) deleteDocument(kbId, doc.id)
            }}
            className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
            title="删除">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Document preview drawer */}
      <DocumentPreviewDrawer
        open={showPreview}
        onClose={() => setShowPreview(false)}
        kbId={kbId}
        docId={doc.id}
        docName={doc.filename}
        docType={doc.file_type}
      />

      {/* Chunk viewer modal */}
      <ChunkViewerModal
        open={showChunks}
        onClose={() => setShowChunks(false)}
        docName={doc.filename}
        kbId={kbId}
        docId={doc.id}
      />
    </>
  )
}

// ======================== KB Detail View ========================
function KBDetailView({ kbId, onBack }: { kbId: string; onBack: () => void }) {
  const {
    knowledgeBases, currentDocuments, uploading,
    loadDocuments, uploadDocument, refreshDocuments,
  } = useKnowledgeStore()
  const kb = knowledgeBases.find((k) => k.id === kbId)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [polling, setPolling] = useState(false)

  useEffect(() => { loadDocuments(kbId) }, [kbId, loadDocuments])

  useEffect(() => {
    const hasProcessing = currentDocuments.some((d) => d.status === 'processing' || d.status === 'uploading')
    if (!hasProcessing) { setPolling(false); return }
    setPolling(true)
    const timer = setInterval(() => refreshDocuments(kbId), 3000)
    return () => clearInterval(timer)
  }, [currentDocuments, kbId, refreshDocuments])

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    for (let i = 0; i < files.length; i++) {
      try { await uploadDocument(kbId, files[i]) } catch (err) { console.error('Upload failed:', err) }
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [kbId, uploadDocument])

  if (!kb) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 transition-all">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">{kb.name}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {kb.description || '暂无描述'} · {kb.doc_count} 文档 · {kb.embedding_model}
          </p>
        </div>
        <div className="flex gap-2">
          {polling && (
            <span className="flex items-center gap-1 text-xs text-amber-500 bg-amber-50 dark:bg-amber-500/10 px-3 py-2 rounded-xl">
              <Loader2 size={12} className="animate-spin" /> 处理中...
            </span>
          )}
          <button onClick={() => refreshDocuments(kbId)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 transition-all">
            <RefreshCw size={18} />
          </button>
          <input ref={fileInputRef} type="file" multiple accept=".pdf,.docx,.xlsx,.txt,.md,.csv" onChange={handleUpload} className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
            className="btn-gradient text-white px-5 py-2.5 rounded-2xl font-semibold text-sm shadow-lg shadow-primary/20 disabled:opacity-50 transition-all active:scale-[0.98] flex items-center gap-2">
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} 上传文档
          </button>
        </div>
      </div>

      {currentDocuments.length === 0 ? (
        <EmptyState icon={FileText} title="暂无文档"
          description="上传 PDF、Word、TXT、Markdown 或 CSV 文件，系统将自动分块、向量化并存储"
          action={{ label: '上传文档', onClick: () => fileInputRef.current?.click() }} />
      ) : (
        <div className="space-y-3">
          {currentDocuments.map((doc) => (
            <DocumentRow key={doc.id} doc={doc} kbId={kbId} />
          ))}
        </div>
      )}
    </div>
  )
}

// ======================== Main Page ========================
export default function KnowledgePage() {
  const { knowledgeBases, currentKBId, loading, loadKnowledgeBases, selectKnowledgeBase, deleteKnowledgeBase } = useKnowledgeStore()
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => { loadKnowledgeBases() }, [loadKnowledgeBases])

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 md:px-8 py-8 space-y-8">
        {!currentKBId && (
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
                <BookOpen size={28} className="text-primary" /> 知识库
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">上传文档，让 AI 基于你的私有知识回答问题</p>
            </div>
            <button onClick={() => setShowCreate(true)}
              className="btn-gradient text-white px-6 py-3 rounded-2xl font-semibold text-sm shadow-lg shadow-primary/20 transition-all active:scale-[0.98] flex items-center gap-2">
              <Plus size={18} /> 新建知识库
            </button>
          </div>
        )}

        {currentKBId ? (
          <KBDetailView kbId={currentKBId} onBack={() => selectKnowledgeBase(null)} />
        ) : loading ? (
          <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-primary" /></div>
        ) : knowledgeBases.length === 0 ? (
          <EmptyState icon={BookOpen} title="还没有知识库"
            description="创建一个知识库，上传你的文档，让 AI 理解你的专属数据"
            action={{ label: '创建第一个知识库', onClick: () => setShowCreate(true) }} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {knowledgeBases.map((kb) => (
              <KBCard key={kb.id} kb={kb} onSelect={() => selectKnowledgeBase(kb.id)}
                onDelete={() => { if (window.confirm(`确定删除知识库「${kb.name}」？`)) deleteKnowledgeBase(kb.id) }} />
            ))}
          </div>
        )}

        <CreateKBModal open={showCreate} onClose={() => setShowCreate(false)} />
      </div>
    </div>
  )
}
