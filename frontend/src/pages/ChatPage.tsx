import { useEffect } from 'react'
import { PanelRight } from 'lucide-react'
import MessageList from '@/components/chat/MessageList'
import ChatInput from '@/components/chat/ChatInput'
import ProcessPanel from '@/components/chat/ProcessPanel'
import { useChatStore } from '@/stores/chatStore'

export default function ChatPage() {
  const { loaded, loadConversations, processSteps, showProcessPanel, toggleProcessPanel } = useChatStore()

  useEffect(() => {
    if (!loaded) {
      loadConversations()
    }
  }, [loaded, loadConversations])

  return (
    <div className="flex h-full relative">
      {/* chat area */}
      <div className="flex flex-col flex-1 min-w-0 relative">
        {/* toggle button */}
        <button
          onClick={toggleProcessPanel}
          className={`absolute top-3 right-3 z-30 p-2 rounded-xl transition-all duration-200 ${
            showProcessPanel
              ? 'bg-primary/10 text-primary'
              : 'bg-white/60 dark:bg-slate-800/60 backdrop-blur text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-700 shadow-sm'
          }`}
          title="执行过程"
        >
          <PanelRight size={18} />
        </button>

        <MessageList />
        <ChatInput />
      </div>

      {/* process panel */}
      <ProcessPanel
        steps={processSteps}
        open={showProcessPanel}
        onClose={toggleProcessPanel}
      />
    </div>
  )
}
