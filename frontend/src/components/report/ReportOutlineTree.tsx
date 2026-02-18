import { useState } from 'react'
import { ChevronRight, ChevronDown, Plus, Trash2, GripVertical, FileText } from 'lucide-react'
import type { ReportSection } from '@/types'

interface TreeNodeProps {
  section: ReportSection
  depth: number
  selectedId: string | null
  onSelect: (id: string) => void
  editable?: boolean
  onAdd?: (parentId: string) => void
  onDelete?: (id: string) => void
  onRename?: (id: string, title: string) => void
}

function TreeNode({ section, depth, selectedId, onSelect, editable, onAdd, onDelete, onRename }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(section.title)
  const hasChildren = section.children && section.children.length > 0
  const isSelected = selectedId === section.id
  const hasContent = section.content.trim().length > 0

  const commitRename = () => {
    if (editTitle.trim() && editTitle !== section.title) {
      onRename?.(section.id, editTitle.trim())
    } else {
      setEditTitle(section.title)
    }
    setEditing(false)
  }

  return (
    <div>
      <div
        className={`group flex items-center gap-1 py-1.5 px-2 rounded-xl cursor-pointer transition-all ${
          isSelected
            ? 'bg-primary/10 text-primary dark:bg-primary/20'
            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => onSelect(section.id)}
      >
        {editable && (
          <GripVertical size={12} className="shrink-0 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 cursor-grab" />
        )}

        <button
          onClick={(e) => { e.stopPropagation(); if (hasChildren) setExpanded(!expanded) }}
          className="shrink-0 w-4 h-4 flex items-center justify-center"
        >
          {hasChildren ? (
            expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />
          ) : (
            <FileText size={11} className={hasContent ? 'text-primary' : 'text-slate-300 dark:text-slate-600'} />
          )}
        </button>

        {editing ? (
          <input
            autoFocus
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') { setEditTitle(section.title); setEditing(false) } }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 min-w-0 px-1.5 py-0.5 rounded-lg text-xs bg-white dark:bg-slate-900 border border-primary/40 outline-none"
          />
        ) : (
          <span
            className={`flex-1 min-w-0 text-xs font-medium truncate ${
              isSelected ? 'font-semibold' : ''
            } ${!hasContent && !hasChildren ? 'text-slate-400 dark:text-slate-500 italic' : ''}`}
            onDoubleClick={() => { if (editable) { setEditing(true); setEditTitle(section.title) } }}
          >
            {section.title}
          </span>
        )}

        {editable && !editing && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => { e.stopPropagation(); onAdd?.(section.id) }}
              className="p-0.5 rounded hover:bg-primary/10 text-slate-400 hover:text-primary"
              title="添加子章节"
            >
              <Plus size={12} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete?.(section.id) }}
              className="p-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500"
              title="删除"
            >
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>

      {hasChildren && expanded && (
        <div>
          {section.children!.map((child) => (
            <TreeNode
              key={child.id}
              section={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              editable={editable}
              onAdd={onAdd}
              onDelete={onDelete}
              onRename={onRename}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface ReportOutlineTreeProps {
  sections: ReportSection[]
  selectedId: string | null
  onSelect: (id: string) => void
  editable?: boolean
  onAdd?: (parentId: string | null) => void
  onDelete?: (id: string) => void
  onRename?: (id: string, title: string) => void
  className?: string
}

export default function ReportOutlineTree({
  sections,
  selectedId,
  onSelect,
  editable = false,
  onAdd,
  onDelete,
  onRename,
  className = '',
}: ReportOutlineTreeProps) {
  return (
    <div className={className}>
      <div className="space-y-0.5">
        {sections.map((section) => (
          <TreeNode
            key={section.id}
            section={section}
            depth={0}
            selectedId={selectedId}
            onSelect={onSelect}
            editable={editable}
            onAdd={(parentId) => onAdd?.(parentId)}
            onDelete={onDelete}
            onRename={onRename}
          />
        ))}
      </div>

      {editable && (
        <button
          onClick={() => onAdd?.(null)}
          className="mt-3 flex items-center gap-1.5 px-3 py-2 w-full rounded-xl text-xs font-medium text-slate-400 hover:text-primary hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors"
        >
          <Plus size={13} />
          添加章节
        </button>
      )}
    </div>
  )
}
