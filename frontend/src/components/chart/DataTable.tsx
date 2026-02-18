import { useState, useMemo } from 'react'
import { ArrowUp, ArrowDown } from 'lucide-react'

interface DataTableProps {
  data: Record<string, any>[]
  className?: string
}

type SortDir = 'asc' | 'desc'

export default function DataTable({ data, className = '' }: DataTableProps) {
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const columns = useMemo(() => {
    if (data.length === 0) return []
    return Object.keys(data[0])
  }, [data])

  const sorted = useMemo(() => {
    if (!sortCol) return data
    return [...data].sort((a, b) => {
      const va = a[sortCol]
      const vb = b[sortCol]
      if (va == null && vb == null) return 0
      if (va == null) return 1
      if (vb == null) return -1
      const cmp = typeof va === 'number' && typeof vb === 'number'
        ? va - vb
        : String(va).localeCompare(String(vb), 'zh-CN')
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [data, sortCol, sortDir])

  const toggleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  if (data.length === 0) {
    return <div className="text-sm text-slate-400 text-center py-8">暂无数据</div>
  }

  return (
    <div className={`overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700 ${className}`}>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-800">
            {columns.map((col) => (
              <th
                key={col}
                onClick={() => toggleSort(col)}
                className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300 cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
              >
                <span className="inline-flex items-center gap-1">
                  {col}
                  {sortCol === col && (
                    sortDir === 'asc'
                      ? <ArrowUp size={14} className="text-primary" />
                      : <ArrowDown size={14} className="text-primary" />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr
              key={i}
              className={`border-t border-slate-100 dark:border-slate-700 transition-colors ${
                i % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/50 dark:bg-slate-800/50'
              } hover:bg-primary/5 dark:hover:bg-primary/10`}
            >
              {columns.map((col) => (
                <td
                  key={col}
                  title={String(row[col] ?? '')}
                  className="px-4 py-2.5 text-slate-700 dark:text-slate-300 max-w-[200px] truncate"
                >
                  {row[col] != null ? String(row[col]) : '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
