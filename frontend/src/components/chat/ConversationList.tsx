import { useState } from 'react'
import { MessageSquare, Trash2, Pencil, Check, X } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useChatStore } from '@/stores/chatStore'

export default function ConversationList() {
  const { conversations, currentId, setCurrentId, deleteConversation, renameConversation } = useChatStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const navigate = useNavigate()
  const location = useLocation()

  const startRename = (id: string, title: string) => {
    setEditingId(id)
    setEditTitle(title)
  }

  const confirmRename = () => {
    if (editingId && editTitle.trim()) {
      renameConversation(editingId, editTitle.trim())
    }
    setEditingId(null)
  }

  // group by section
  const today = new Date().toDateString()
  const recentConvs = conversations.filter((c) => new Date(c.updatedAt).toDateString() === today)
  const olderConvs = conversations.filter((c) => new Date(c.updatedAt).toDateString() !== today)

  const renderSection = (label: string, items: typeof conversations) => {
    if (!items.length) return null
    return (
      <div>
        <h3 className="px-4 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">
          {label}
        </h3>
        <div className="space-y-0.5">
          {items.map((conv) => (
            <div
              key={conv.id}
              onClick={() => { setCurrentId(conv.id); if (location.pathname !== '/') navigate('/') }}
              className={`group flex items-center gap-3 rounded-2xl px-4 py-3 cursor-pointer transition-all text-sm ${
                currentId === conv.id
                  ? 'bg-white/80 dark:bg-slate-700 shadow-sm text-primary font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700/50'
              }`}
            >
              <MessageSquare size={16} className="shrink-0" />

              {editingId === conv.id ? (
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && confirmRename()}
                    className="flex-1 min-w-0 bg-transparent border-b-2 border-primary text-sm outline-none text-slate-800 dark:text-white"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button onClick={(e) => { e.stopPropagation(); confirmRename() }} className="p-0.5 hover:text-green-500">
                    <Check size={14} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setEditingId(null) }} className="p-0.5 hover:text-red-400">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <>
                  <span className="flex-1 truncate">{conv.title}</span>
                  <div className="hidden group-hover:flex items-center gap-0.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); startRename(conv.id, conv.title) }}
                      className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-600"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id) }}
                      className="p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/20 hover:text-red-500"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <nav className="flex-1 overflow-y-auto px-3 space-y-4 pb-2">
      {renderSection('今天', recentConvs)}
      {renderSection('近期对话', olderConvs)}
      {conversations.length === 0 && (
        <p className="text-center text-sm text-slate-400 py-8">暂无对话</p>
      )}
    </nav>
  )
}
