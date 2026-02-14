import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { useUIStore } from '@/stores/uiStore'
import Sidebar from './Sidebar'

export default function AppLayout() {
  const { theme, setIsMobile } = useUIStore()

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const handler = (e: MediaQueryListEvent | MediaQueryList) => setIsMobile(e.matches)
    handler(mq)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [setIsMobile])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  return (
    <div className="flex h-screen overflow-hidden bg-bg-main dark:bg-bg-dark">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
