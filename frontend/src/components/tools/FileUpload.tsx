import { useState, useRef, useCallback } from 'react'
import { Upload, X, File, Image } from 'lucide-react'
import type { FileAttachment } from '@/types'

interface FileUploadProps {
  files: FileAttachment[]
  onAdd: (files: File[]) => void
  onRemove: (id: string) => void
}

export default function FileUpload({ files, onAdd, onRemove }: FileUploadProps) {
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const dropped = Array.from(e.dataTransfer.files)
      if (dropped.length) onAdd(dropped)
    },
    [onAdd]
  )

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files ? Array.from(e.target.files) : []
    if (selected.length) onAdd(selected)
    e.target.value = ''
  }

  const getIcon = (type: string) =>
    type.startsWith('image/') ? <Image size={14} /> : <File size={14} />

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <div>
      {/* drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg px-4 py-6 text-center cursor-pointer transition ${
          dragOver
            ? 'border-dark-accent bg-dark-accent/5'
            : 'border-light-border dark:border-dark-border hover:border-dark-accent/50'
        }`}
      >
        <Upload size={24} className="mx-auto mb-2 text-light-muted dark:text-dark-muted" />
        <p className="text-sm text-light-muted dark:text-dark-muted">
          拖拽文件到这里，或 <span className="text-dark-accent">点击选择</span>
        </p>
        <p className="text-xs text-light-muted/60 dark:text-dark-muted/60 mt-1">
          支持 PDF、TXT、DOCX、图片等格式
        </p>
        <input ref={inputRef} type="file" multiple hidden onChange={handleSelect} />
      </div>

      {/* file list */}
      {files.length > 0 && (
        <div className="mt-2 space-y-1">
          {files.map((f) => (
            <div
              key={f.id}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-light-hover dark:bg-dark-hover"
            >
              {getIcon(f.type)}
              <span className="flex-1 truncate text-sm text-light-text dark:text-dark-text">
                {f.name}
              </span>
              <span className="text-xs text-light-muted dark:text-dark-muted shrink-0">
                {formatSize(f.size)}
              </span>
              {f.progress !== undefined && f.progress < 100 && (
                <div className="w-16 h-1 bg-light-border dark:bg-dark-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-dark-accent rounded-full transition-all"
                    style={{ width: `${f.progress}%` }}
                  />
                </div>
              )}
              <button
                onClick={() => onRemove(f.id)}
                className="p-0.5 rounded hover:bg-red-500/20 hover:text-red-400 text-light-muted dark:text-dark-muted"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
