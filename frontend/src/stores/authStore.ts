import { create } from 'zustand'
import type { User } from '@/types'
import { authApi, setTokens, clearTokens, getToken } from '@/services/api'

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  loading: boolean

  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, nickname: string) => Promise<void>
  logout: () => void
  fetchMe: () => Promise<void>
  init: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: getToken(),
  isAuthenticated: !!getToken(),
  loading: false,

  login: async (email: string, password: string) => {
    set({ loading: true })
    try {
      const res = await authApi.login(email, password)
      setTokens(res.access_token, res.refresh_token)
      set({ token: res.access_token, isAuthenticated: true })
      await get().fetchMe()
    } finally {
      set({ loading: false })
    }
  },

  register: async (email: string, password: string, nickname: string) => {
    set({ loading: true })
    try {
      const res = await authApi.register(email, password, nickname)
      setTokens(res.access_token, res.refresh_token)
      set({ token: res.access_token, isAuthenticated: true })
      await get().fetchMe()
    } finally {
      set({ loading: false })
    }
  },

  logout: () => {
    authApi.logout()
    clearTokens()
    set({ user: null, token: null, isAuthenticated: false })
  },

  fetchMe: async () => {
    try {
      const me = await authApi.me()
      set({
        user: {
          id: me.id,
          email: me.email,
          name: me.nickname,
          role: me.role as 'user' | 'tenant_admin' | 'super_admin',
          tenantId: (me as any).tenant_id || '',
        },
      })
    } catch {
      // token invalid — clear
      clearTokens()
      set({ user: null, token: null, isAuthenticated: false })
    }
  },

  init: async () => {
    const token = getToken()
    if (token) {
      set({ isAuthenticated: true, token })
      await get().fetchMe()
    }
  },
}))
