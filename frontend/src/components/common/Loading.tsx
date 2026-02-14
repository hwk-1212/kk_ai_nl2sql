import { Loader2 } from 'lucide-react'

interface LoadingProps {
  text?: string
  size?: number
  fullScreen?: boolean
}

export default function Loading({ text = '加载中...', size = 24, fullScreen }: LoadingProps) {
  const content = (
    <div className="flex flex-col items-center justify-center gap-3">
      <Loader2 size={size} className="animate-spin text-dark-accent" />
      {text && <span className="text-sm text-light-muted dark:text-dark-muted">{text}</span>}
    </div>
  )

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-light-bg dark:bg-dark-bg">
        {content}
      </div>
    )
  }

  return content
}
