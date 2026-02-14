import { create } from 'zustand'

type Theme = 'dark' | 'light'
type RightPanel = 'none' | 'rag' | 'tools' | 'mcp' | 'settings'

interface UIState {
  theme: Theme
  sidebarOpen: boolean
  rightPanel: RightPanel
  isMobile: boolean

  setTheme: (t: Theme) => void
  toggleTheme: () => void
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  setRightPanel: (p: RightPanel) => void
  setIsMobile: (v: boolean) => void
}

const getInitialTheme = (): Theme => {
  if (typeof window === 'undefined') return 'dark'
  const saved = localStorage.getItem('kk-theme')
  if (saved === 'light' || saved === 'dark') return saved
  return 'dark'
}

export const useUIStore = create<UIState>((set) => ({
  theme: getInitialTheme(),
  sidebarOpen: true,
  rightPanel: 'none',
  isMobile: false,

  setTheme: (theme) => {
    localStorage.setItem('kk-theme', theme)
    set({ theme })
  },
  toggleTheme: () =>
    set((s) => {
      const next = s.theme === 'dark' ? 'light' : 'dark'
      localStorage.setItem('kk-theme', next)
      return { theme: next }
    }),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setRightPanel: (rightPanel) => set({ rightPanel }),
  setIsMobile: (isMobile) => set({ isMobile, sidebarOpen: !isMobile }),
}))
