import { useEffect, useState } from 'react'
import { Loader2, Download, FileText, Code2 } from 'lucide-react'
import Drawer from '@/components/common/Drawer'
import MarkdownContent from '@/components/chat/MarkdownContent'
import { useKnowledgeStore } from '@/stores/knowledgeStore'
import { knowledgeApi } from '@/services/api'

interface Props {
  open: boolean
  onClose: () => void
  kbId: string
  docId: string
  docName: string
  docType: string
}

type TabMode = 'original' | 'markdown'

export default function DocumentPreviewDrawer({ open, onClose, kbId, docId, docName, docType }: Props) {
  const previewDocument = useKnowledgeStore((s) => s.previewDocument)
  const [tab, setTab] = useState<TabMode>('markdown')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Original file state
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [textContent, setTextContent] = useState<string | null>(null)
  const [originalLoaded, setOriginalLoaded] = useState(false)

  // Markdown state
  const [mdContent, setMdContent] = useState<string | null>(null)
  const [mdLoaded, setMdLoaded] = useState(false)
  const [mdError, setMdError] = useState<string | null>(null)

  // Reset when closed
  useEffect(() => {
    if (!open) {
      setOriginalLoaded(false)
      setMdLoaded(false)
      setBlobUrl(null)
      setTextContent(null)
      setMdContent(null)
      setError(null)
      setMdError(null)
      setTab('markdown')
    }
  }, [open])

  // Load markdown when tab switches (or on first open)
  useEffect(() => {
    if (!open || tab !== 'markdown' || mdLoaded) return
    setLoading(true)
    setMdError(null)
    knowledgeApi.getMarkdown(kbId, docId)
      .then((data) => {
        setMdContent(data.markdown)
        setMdLoaded(true)
      })
      .catch((err) => {
        setMdError(err.message || 'Markdown not available')
        // Fallback: switch to original
        setTab('original')
      })
      .finally(() => setLoading(false))
  }, [open, tab, mdLoaded, kbId, docId])

  // Load original when tab switches
  useEffect(() => {
    if (!open || tab !== 'original' || originalLoaded) return
    let revoke: string | null = null
    setLoading(true)
    setError(null)

    previewDocument(kbId, docId)
      .then(({ blob }) => {
        const isText = ['txt', 'md', 'csv'].includes(docType)
        if (isText) {
          blob.text().then((t) => setTextContent(t))
        } else {
          const url = URL.createObjectURL(blob)
          revoke = url
          setBlobUrl(url)
        }
        setOriginalLoaded(true)
      })
      .catch((err) => setError(err.message || 'Failed to load document'))
      .finally(() => setLoading(false))

    return () => {
      if (revoke) URL.revokeObjectURL(revoke)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab, originalLoaded, kbId, docId])

  const isPdf = docType === 'pdf'
  const isDocx = docType === 'docx'

  const handleDownload = () => {
    if (!blobUrl && !textContent) return
    const a = document.createElement('a')
    if (blobUrl) {
      a.href = blobUrl
    } else if (textContent) {
      a.href = URL.createObjectURL(new Blob([textContent], { type: 'text/plain' }))
    }
    a.download = docName
    a.click()
  }

  return (
    <Drawer open={open} onClose={onClose} title={docName} width="max-w-4xl">
      <div className="flex flex-col h-full">
        {/* Tab bar + toolbar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 shrink-0">
          <div className="flex items-center gap-1 bg-slate-200 dark:bg-slate-700 rounded-xl p-0.5">
            <button
              onClick={() => setTab('markdown')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                tab === 'markdown'
                  ? 'bg-white dark:bg-slate-600 text-primary shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Code2 size={13} /> Markdown
            </button>
            <button
              onClick={() => setTab('original')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                tab === 'original'
                  ? 'bg-white dark:bg-slate-600 text-primary shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <FileText size={13} /> 原件
            </button>
          </div>
          <button onClick={handleDownload}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-primary px-3 py-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
            <Download size={14} /> 下载
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full py-20">
              <Loader2 size={32} className="animate-spin text-primary mb-3" />
              <p className="text-sm text-slate-400">正在加载...</p>
            </div>
          ) : tab === 'markdown' ? (
            /* Markdown tab */
            mdContent ? (
              <div className="h-full overflow-auto p-6">
                <div className="max-w-none">
                  <MarkdownContent content={mdContent} />
                </div>
              </div>
            ) : mdError ? (
              <div className="flex flex-col items-center justify-center h-full py-20">
                <p className="text-sm text-slate-400">{mdError}</p>
              </div>
            ) : null
          ) : (
            /* Original tab */
            error ? (
              <div className="flex flex-col items-center justify-center h-full py-20">
                <p className="text-sm text-red-500 mb-4">{error}</p>
                <button onClick={handleDownload}
                  className="btn-gradient text-white px-6 py-2.5 rounded-2xl text-sm font-semibold flex items-center gap-2">
                  <Download size={16} /> 直接下载
                </button>
              </div>
            ) : (
              <>
                {isPdf && blobUrl && (
                  <iframe src={blobUrl} className="w-full h-full border-0" title={docName} />
                )}
                {textContent !== null && (
                  <div className="h-full overflow-auto p-6">
                    <pre className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap font-mono leading-relaxed bg-slate-50 dark:bg-slate-900 rounded-2xl p-6">
                      {textContent}
                    </pre>
                  </div>
                )}
                {isDocx && blobUrl && (
                  <div className="flex flex-col items-center justify-center h-full py-12">
                    <p className="text-sm text-slate-500 mb-4">DOCX 原件请下载查看，或切换到 Markdown 模式</p>
                    <button onClick={handleDownload}
                      className="btn-gradient text-white px-6 py-2.5 rounded-2xl text-sm font-semibold flex items-center gap-2">
                      <Download size={16} /> 下载查看
                    </button>
                  </div>
                )}
              </>
            )
          )}
        </div>
      </div>
    </Drawer>
  )
}
