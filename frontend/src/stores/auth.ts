import { create } from 'zustand'
import { authAPI } from '@/api/auth'
import type { LoginRequest, RegisterRequest, User } from '@/types'
import { Toast } from '@douyinfe/semi-ui-19'

const TOKEN_KEY = 'task_token'
const REFRESH_TOKEN_KEY = 'task_refresh_token'
const USER_KEY = 'task_user'

const loadUser = (): User | null => {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch (e) {
    console.error('Failed to parse stored user', e)
    return null
  }
}

interface AuthState {
  user: User | null
  token: string
  refreshToken: string
  loading: boolean
  isRefreshing: boolean
  isTokenExpired: () => boolean
  login: (credentials: LoginRequest) => Promise<boolean>
  register: (data: RegisterRequest) => Promise<boolean>
  logout: () => void
  refreshAccessToken: () => Promise<boolean>
  fetchUserInfo: () => Promise<void>
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: loadUser(),
  token: localStorage.getItem(TOKEN_KEY) || '',
  refreshToken: localStorage.getItem(REFRESH_TOKEN_KEY) || '',
  loading: false,
  isRefreshing: false,

  // 解析 JWT 的 exp 声明，判断当前 token 是否已过期
  // 直接读 localStorage（请求拦截器刷新后立即生效）；无 token 或解析失败时返回 false
  // （不误判为过期，交由服务端 401 处理）
  isTokenExpired: () => {
    const token = localStorage.getItem(TOKEN_KEY) || get().token
    if (!token) {
      return false
    }
    try {
      const seg = token.split('.')[1]
      const payload = JSON.parse(atob(seg.replace(/-/g, '+').replace(/_/g, '/')))
      if (!payload.exp) {
        return false
      }
      return payload.exp * 1000 <= Date.now()
    } catch (e) {
      console.error('Failed to parse token exp', e)
      return false
    }
  },

  login: async (credentials) => {
    set({ loading: true })
    try {
      const response = await authAPI.login(credentials)
      if (response.success && response.user && response.token) {
        set({
          user: response.user,
          token: response.token,
          refreshToken: response.refresh_token || ''
        })
        localStorage.setItem(TOKEN_KEY, response.token)
        localStorage.setItem(USER_KEY, JSON.stringify(response.user))
        if (response.refresh_token) {
          localStorage.setItem(REFRESH_TOKEN_KEY, response.refresh_token)
        }
        Toast.success('登录成功')
        return true
      }
      return false
    } catch (error) {
      console.error('Login failed:', error)
      return false
    } finally {
      set({ loading: false })
    }
  },

  register: async (data) => {
    set({ loading: true })
    try {
      const response = await authAPI.register(data)
      if (response.success && response.user && response.token) {
        set({
          user: response.user,
          token: response.token,
          refreshToken: response.refresh_token || ''
        })
        localStorage.setItem(TOKEN_KEY, response.token)
        localStorage.setItem(USER_KEY, JSON.stringify(response.user))
        if (response.refresh_token) {
          localStorage.setItem(REFRESH_TOKEN_KEY, response.refresh_token)
        }
        Toast.success('注册成功')
        return true
      }
      return false
    } catch (error) {
      console.error('Register failed:', error)
      return false
    } finally {
      set({ loading: false })
    }
  },

  logout: () => {
    set({ user: null, token: '', refreshToken: '' })
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    Toast.success('已退出登录')
  },

  refreshAccessToken: async () => {
    const { refreshToken, isRefreshing, logout } = get()
    if (!refreshToken || isRefreshing) {
      return false
    }

    set({ isRefreshing: true })
    try {
      const response = await authAPI.refreshToken(refreshToken)
      if (response.success && response.token) {
        set({
          token: response.token,
          refreshToken: response.refresh_token || refreshToken
        })
        localStorage.setItem(TOKEN_KEY, response.token)
        if (response.refresh_token) {
          localStorage.setItem(REFRESH_TOKEN_KEY, response.refresh_token)
        }
        return true
      }
      // If refresh fails, logout
      logout()
      return false
    } catch (error) {
      console.error('Token refresh failed:', error)
      logout()
      return false
    } finally {
      set({ isRefreshing: false })
    }
  },

  fetchUserInfo: async () => {
    try {
      const response = await authAPI.getUserInfo()
      if (response.success && response.data) {
        set({ user: response.data })
        localStorage.setItem(USER_KEY, JSON.stringify(response.data))
      }
    } catch (error) {
      console.error('Failed to fetch user info:', error)
    }
  }
}))
