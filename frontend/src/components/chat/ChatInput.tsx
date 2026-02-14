import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Square, Paperclip, X, BookOpen, Globe, Check, Database } from 'lucide-react'
import { useChatStore } from '@/stores/chatStore'
import { useKnowledgeStore } from '@/stores/knowledgeStore'
import ModelSelector from '@/components/deepseek/ModelSelector'
import type { FileAttachment } from '@/types'

export default function ChatInput() {
  const { isStreaming, sendMessage, stopStreaming, selectedKBIds, toggleKBId } = useChatStore()
  const { knowledgeBases, loadKnowledgeBases } = useKnowledgeStore()
  const [text, setText] = useState('')
  const [files, setFiles] = useState<FileAttachment[]>([])
  const [showKBPicker, setShowKBPicker] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const kbPickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadKnowledgeBases()
  }, [loadKnowledgeBases])

  useEffect(() => {
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = Math.min(el.scrollHeight, 200) + 'px'
    }
  }, [text])

  // Close KB picker on outside click
  useEffect(() => {
    if (!showKBPicker) return
    const handler = (e: MouseEvent) => {
      if (kbPickerRef.current && !kbPickerRef.current.contains(e.target as Node)) {
        setShowKBPicker(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showKBPicker])

  const handleSend = useCallback(() => {
    const trimmed = text.trim()
    if (!trimmed || isStreaming) return
    sendMessage(trimmed)
    setText('')
    setFiles([])
  }, [text, isStreaming, sendMessage])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <footer className="p-6 md:p-8">
      <div className="max-w-3xl mx-auto space-y-4">
        {/* model selector in header area */}
        <div className="flex items-center justify-center">
          <ModelSelector />
        </div>

        {/* selected KBs indicator */}
        {selectedKBIds.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedKBIds.map((kid) => {
              const kb = knowledgeBases.find((k) => k.id === kid)
              return kb ? (
                <span
                  key={kid}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-primary/10 text-xs text-primary font-semibold border border-primary/20"
                >
                  <Database size={12} />
                  {kb.name}
                  <button onClick={() => toggleKBId(kid)} className="p-0.5 hover:text-red-500">
                    <X size={12} />
                  </button>
                </span>
              ) : null
            })}
          </div>
        )}

        {/* attached files */}
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {files.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-slate-50 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-700"
              >
                <Paperclip size={12} />
                <span className="truncate max-w-[120px]">{f.name}</span>
                <button onClick={() => setFiles((prev) => prev.filter((x) => x.id !== f.id))} className="p-0.5 hover:text-red-500">
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* input box */}
        <div className="bg-white dark:bg-slate-800 rounded-4xl shadow-soft border border-slate-100 dark:border-slate-700 p-3 transition-all focus-within:ring-4 ring-primary-100 focus-within:border-primary/20">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="有什么想问的..."
            rows={1}
            className="w-full bg-transparent border-none focus:ring-0 text-slate-700 dark:text-slate-200 placeholder-slate-400 resize-none py-3 px-6 max-h-60 font-medium text-sm outline-none"
          />
          <div className="flex items-center justify-between px-3 pb-1 pt-1">
            <div className="flex items-center gap-1">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-400 rounded-xl transition-colors"
                title="上传文件"
              >
                <Paperclip size={20} />
              </button>

              {/* Knowledge Base Picker */}
              <div className="relative" ref={kbPickerRef}>
                <button
                  onClick={() => setShowKBPicker(!showKBPicker)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-colors ${
                    selectedKBIds.length > 0
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-500'
                  }`}
                  title="知识库"
                >
                  <BookOpen size={18} className="text-primary" />
                  <span className="text-xs font-bold hidden sm:inline">
                    知识库{selectedKBIds.length > 0 ? ` (${selectedKBIds.length})` : ''}
                  </span>
                </button>

                {showKBPicker && (
                  <div className="absolute bottom-full left-0 mb-2 w-64 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-xl z-50 overflow-hidden">
                    <div className="p-3 border-b border-slate-100 dark:border-slate-700">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        选择知识库
                      </p>
                    </div>
                    <div className="max-h-48 overflow-y-auto p-2">
                      {knowledgeBases.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-4">暂无知识库</p>
                      ) : (
                        knowledgeBases.map((kb) => {
                          const selected = selectedKBIds.includes(kb.id)
                          return (
                            <button
                              key={kb.id}
                              onClick={() => toggleKBId(kb.id)}
                              className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
                                selected ? 'bg-primary/10' : 'hover:bg-slate-50 dark:hover:bg-slate-700'
                              }`}
                            >
                              <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${
                                selected ? 'border-primary bg-primary' : 'border-slate-300'
                              }`}>
                                {selected && <Check size={12} className="text-white" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{kb.name}</p>
                                <p className="text-[10px] text-slate-400">{kb.doc_count} 文档</p>
                              </div>
                            </button>
                          )
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="h-5 w-[1px] bg-slate-100 dark:bg-slate-700 mx-1" />
              <button className="p-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-400 rounded-xl transition-colors" title="联网搜索">
                <Globe size={20} />
              </button>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-[10px] text-slate-300 dark:text-slate-600 font-bold tracking-widest hidden sm:block">
                SHIFT + ENTER
              </span>
              {isStreaming ? (
                <button
                  onClick={stopStreaming}
                  className="w-12 h-12 bg-red-500 text-white rounded-2xl flex items-center justify-center shadow-lg transition-all active:scale-90"
                  title="停止生成"
                >
                  <Square size={20} />
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!text.trim()}
                  className="w-12 h-12 btn-gradient text-white rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20 transition-all active:scale-90 disabled:opacity-30 disabled:shadow-none"
                  title="发送"
                >
                  <Send size={20} />
                </button>
              )}
            </div>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) {
              const newFiles: FileAttachment[] = Array.from(e.target.files).map((f) => ({
                id: 'file-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
                name: f.name,
                size: f.size,
                type: f.type,
                progress: 100,
              }))
              setFiles((prev) => [...prev, ...newFiles])
            }
            e.target.value = ''
          }}
        />
      </div>
    </footer>
  )
}
