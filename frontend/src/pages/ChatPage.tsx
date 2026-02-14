import { useEffect } from 'react'
import MessageList from '@/components/chat/MessageList'
import ChatInput from '@/components/chat/ChatInput'
import { useChatStore } from '@/stores/chatStore'

export default function ChatPage() {
  const { loaded, loadConversations } = useChatStore()

  useEffect(() => {
    if (!loaded) {
      loadConversations()
    }
  }, [loaded, loadConversations])

  return (
    <div className="flex flex-col h-full">
      <MessageList />
      <ChatInput />
    </div>
  )
}
