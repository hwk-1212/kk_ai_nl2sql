import { useRef, useEffect } from 'react'
import { Sparkles } from 'lucide-react'
import { useChatStore } from '@/stores/chatStore'
import MessageItem from './MessageItem'

export default function MessageList() {
  const { conversations, currentId, isStreaming, streamingContent, streamingReasoning, streamingBlocks, regenerate } = useChatStore()
  const scrollRef = useRef<HTMLDivElement>(null)

  const conversation = conversations.find((c) => c.id === currentId)
  const messages = conversation?.messages ?? []

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages.length, streamingContent, streamingReasoning, streamingBlocks])

  // welcome screen
  if (!conversation || (messages.length === 0 && !isStreaming)) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-lg px-4">
          <div className="w-20 h-20 mx-auto mb-6 btn-gradient rounded-3xl flex items-center justify-center shadow-xl shadow-primary/20">
            <Sparkles size={36} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-3">
            你好，有什么可以帮你的？
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            我是 KK NL2SQL，支持深度推理和快速对话。
            <br />
            试试问我技术问题、代码调试或任何感兴趣的话题。
          </p>
        </div>
      </div>
    )
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto p-8 space-y-10">
        {messages.map((msg) => (
          <MessageItem
            key={msg.id}
            message={msg}
            onRegenerate={msg.role === 'assistant' ? regenerate : undefined}
          />
        ))}

        {isStreaming && (
          <MessageItem
            message={{
              id: 'streaming',
              role: 'assistant',
              content: '',
              createdAt: new Date().toISOString(),
            }}
            isStreamingContent={streamingContent}
            isStreamingReasoning={streamingReasoning}
            streamingBlocks={streamingBlocks}
          />
        )}
      </div>
    </div>
  )
}
