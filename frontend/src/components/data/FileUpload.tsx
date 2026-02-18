import { useState, useRef, useCallback } from 'react'
import { Upload, FileSpreadsheet, FileText, Database, X, CheckCircle2, Loader2 } from 'lucide-react'
import Modal from '@/components/common/Modal'
import { useDataStore } from '@/stores/dataStore'

interface FileUploadProps {
  open: boolean
  onClose: () => void
}

interface QueuedFile {
  file: File
  id: string
  progress: number
  status: 'queued' | 'uploading' | 'done' | 'error'
}

const ACCEPT = '.xlsx,.xls,.csv,.sqlite'
const MAX_SIZE = 100 * 1024 * 1024

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase()
  if (ext === 'xlsx' || ext === 'xls') return <FileSpreadsheet size={20} className="text-emerald-500" />
  if (ext === 'csv') return <FileText size={20} className="text-blue-500" />
  if (ext === 'sqlite') return <Database size={20} className="text-purple-500" />
  return <FileText size={20} className="text-slate-400" />
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function FileUpload({ open, onClose }: FileUploadProps) {
  const [files, setFiles] = useState<QueuedFile[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const uploadFile = useDataStore((s) => s.uploadFile)

  const addFiles = useCallback((incoming: FileList | null) => {
    if (!incoming) return
    setError(null)
    const newFiles: QueuedFile[] = []
    for (let i = 0; i < incoming.length; i++) {
      const f = incoming[i]
      const ext = f.name.split('.').pop()?.toLowerCase()
      if (!['xlsx', 'xls', 'csv', 'sqlite'].includes(ext ?? '')) {
        setError(`不支持的文件类型: ${f.name}`)
        continue
      }
      if (f.size > MAX_SIZE) {
        setError(`文件过大（最大 100MB）: ${f.name}`)
        continue
      }
      newFiles.push({ file: f, id: `${Date.now()}-${i}`, progress: 0, status: 'queued' })
    }
    setFiles((prev) => [...prev, ...newFiles])
  }, [])

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }

  const handleUpload = async () => {
    const queued = files.filter((f) => f.status === 'queued')
    if (queued.length === 0) return

    for (const qf of queued) {
      setFiles((prev) => prev.map((f) => (f.id === qf.id ? { ...f, status: 'uploading', progress: 0 } : f)))

      const interval = setInterval(() => {
        setFiles((prev) =>
          prev.map((f) => (f.id === qf.id && f.progress < 90 ? { ...f, progress: f.progress + 15 } : f)),
        )
      }, 300)

      try {
        await uploadFile(qf.file)
        clearInterval(interval)
        setFiles((prev) => prev.map((f) => (f.id === qf.id ? { ...f, status: 'done', progress: 100 } : f)))
      } catch {
        clearInterval(interval)
        setFiles((prev) => prev.map((f) => (f.id === qf.id ? { ...f, status: 'error' } : f)))
      }
    }
  }

  const handleClose = () => {
    setFiles([])
    setError(null)
    onClose()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    addFiles(e.dataTransfer.files)
  }

  const isUploading = files.some((f) => f.status === 'uploading')
  const hasQueued = files.some((f) => f.status === 'queued')

  return (
    <Modal open={open} onClose={handleClose} title="上传数据文件" maxWidth="max-w-lg">
      <div
        className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-colors ${
          dragActive
            ? 'border-primary bg-primary-50 dark:bg-primary/5'
            : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => { addFiles(e.target.files); e.target.value = '' }}
        />
        <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-slate-50 dark:bg-slate-700 flex items-center justify-center">
          <Upload size={24} className="text-slate-400" />
        </div>
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
          拖拽文件到此处，或 <span className="text-primary font-semibold">点击选择</span>
        </p>
        <p className="text-xs text-slate-400 mt-1">支持 .xlsx .xls .csv .sqlite，单文件最大 100MB</p>
      </div>

      {error && (
        <div className="mt-3 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs">
          {error}
        </div>
      )}

      {files.length > 0 && (
        <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
          {files.map((qf) => (
            <div
              key={qf.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-700/50"
            >
              {getFileIcon(qf.file.name)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{qf.file.name}</p>
                <p className="text-xs text-slate-400">{formatSize(qf.file.size)}</p>
                {qf.status === 'uploading' && (
                  <div className="mt-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-600 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-primary-light transition-all duration-300"
                      style={{ width: `${qf.progress}%` }}
                    />
                  </div>
                )}
              </div>
              {qf.status === 'done' && <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />}
              {qf.status === 'uploading' && <Loader2 size={18} className="text-primary animate-spin shrink-0" />}
              {(qf.status === 'queued' || qf.status === 'error') && (
                <button onClick={(e) => { e.stopPropagation(); removeFile(qf.id) }} className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-400 shrink-0">
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 flex justify-end gap-3">
        <button
          onClick={handleClose}
          className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        >
          取消
        </button>
        <button
          onClick={handleUpload}
          disabled={!hasQueued || isUploading}
          className="px-5 py-2 rounded-xl text-sm font-semibold text-white btn-gradient shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
        >
          {isUploading ? '上传中...' : '开始上传'}
        </button>
      </div>
    </Modal>
  )
}
