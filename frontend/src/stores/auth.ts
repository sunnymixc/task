import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { authAPI } from '@/api/auth'
import type { LoginRequest, RegisterRequest, User } from '@/types'
import { MessagePlugin } from 'tdesign-vue-next'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const token = ref<string>('')
  const refreshToken = ref<string>('')
  const loading = ref(false)
  const isRefreshing = ref(false)

  // Computed
  const isLoggedIn = computed(() => !!token.value)
  const userName = computed(() => user.value?.username || '')
  const userEmail = computed(() => user.value?.email || '')

  // 解析 JWT 的 exp 声明，判断当前 token 是否已过期
  // 无 token 或解析失败时返回 false（不误判为过期，交由服务端 401 处理）
  const isTokenExpired = (): boolean => {
    if (!token.value) {
      return false
    }
    try {
      const seg = token.value.split('.')[1]
      const payload = JSON.parse(atob(seg.replace(/-/g, '+').replace(/_/g, '/')))
      if (!payload.exp) {
        return false
      }
      return payload.exp * 1000 <= Date.now()
    } catch (e) {
      console.error('Failed to parse token exp', e)
      return false
    }
  }

  // Initialize from localStorage
  const init = () => {
    const storedToken = localStorage.getItem('task_token')
    const storedRefreshToken = localStorage.getItem('task_refresh_token')
    const storedUser = localStorage.getItem('task_user')
    if (storedToken) {
      token.value = storedToken
    }
    if (storedRefreshToken) {
      refreshToken.value = storedRefreshToken
    }
    if (storedUser) {
      try {
        user.value = JSON.parse(storedUser)
      } catch (e) {
        console.error('Failed to parse stored user', e)
      }
    }
  }

  // Login
  const login = async (credentials: LoginRequest): Promise<boolean> => {
    loading.value = true
    try {
      const response = await authAPI.login(credentials)
      if (response.success && response.user && response.token) {
        user.value = response.user
        token.value = response.token
        refreshToken.value = response.refresh_token || ''
        localStorage.setItem('task_token', response.token)
        localStorage.setItem('task_user', JSON.stringify(response.user))
        if (response.refresh_token) {
          localStorage.setItem('task_refresh_token', response.refresh_token)
        }
        MessagePlugin.success('登录成功')
        return true
      }
      return false
    } catch (error) {
      console.error('Login failed:', error)
      return false
    } finally {
      loading.value = false
    }
  }

  // Register
  const register = async (data: RegisterRequest): Promise<boolean> => {
    loading.value = true
    try {
      const response = await authAPI.register(data)
      if (response.success && response.user && response.token) {
        user.value = response.user
        token.value = response.token
        refreshToken.value = response.refresh_token || ''
        localStorage.setItem('task_token', response.token)
        localStorage.setItem('task_user', JSON.stringify(response.user))
        if (response.refresh_token) {
          localStorage.setItem('task_refresh_token', response.refresh_token)
        }
        MessagePlugin.success('注册成功')
        return true
      }
      return false
    } catch (error) {
      console.error('Register failed:', error)
      return false
    } finally {
      loading.value = false
    }
  }

  // Logout
  const logout = () => {
    user.value = null
    token.value = ''
    refreshToken.value = ''
    localStorage.removeItem('task_token')
    localStorage.removeItem('task_refresh_token')
    localStorage.removeItem('task_user')
    MessagePlugin.success('已退出登录')
  }

  // Refresh access token
  const refreshAccessToken = async (): Promise<boolean> => {
    if (!refreshToken.value || isRefreshing.value) {
      return false
    }

    isRefreshing.value = true
    try {
      const response = await authAPI.refreshToken(refreshToken.value)
      if (response.success && response.token) {
        token.value = response.token
        refreshToken.value = response.refresh_token || refreshToken.value
        localStorage.setItem('task_token', response.token)
        if (response.refresh_token) {
          localStorage.setItem('task_refresh_token', response.refresh_token)
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
      isRefreshing.value = false
    }
  }

  // Fetch user info
  const fetchUserInfo = async (): Promise<void> => {
    try {
      const response = await authAPI.getUserInfo()
      if (response.success && response.data) {
        user.value = response.data
        localStorage.setItem('task_user', JSON.stringify(response.data))
      }
    } catch (error) {
      console.error('Failed to fetch user info:', error)
    }
  }

  return {
    user,
    token,
    refreshToken,
    loading,
    isLoggedIn,
    userName,
    userEmail,
    isTokenExpired,
    init,
    login,
    register,
    logout,
    fetchUserInfo,
    refreshAccessToken
  }
})
