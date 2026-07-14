import axios, { type AxiosInstance, type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { MessagePlugin } from 'tdesign-vue-next'

// Create axios instance
const request: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Track pending requests for token refresh
let isRefreshing = false
let failedQueue: Array<{
  resolve: (value?: any) => void
  reject: (reason?: any) => void
}> = []

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })
  failedQueue = []
}

// Request interceptor - add JWT token
request.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('task_token')
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error: AxiosError) => {
    return Promise.reject(error)
  }
)

// Response interceptor - handle errors and token refresh
request.interceptors.response.use(
  (response) => {
    return response.data
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    const status = error.response?.status
    const message = (error.response?.data as any)?.message || '请求失败'

    // Handle 401 - try to refresh token
    if (status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Wait for the refresh to complete
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then(() => {
          return request(originalRequest)
        }).catch(err => {
          return Promise.reject(err)
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const refreshToken = localStorage.getItem('task_refresh_token')
        if (!refreshToken) {
          throw new Error('No refresh token available')
        }

        // Call refresh token endpoint directly
        const response = await axios.post('/api/v1/auth/refresh', {
          refresh_token: refreshToken
        })

        if (response.data.success && response.data.token) {
          const newToken = response.data.token
          localStorage.setItem('task_token', newToken)
          if (response.data.refresh_token) {
            localStorage.setItem('task_refresh_token', response.data.refresh_token)
          }

          processQueue(null, newToken)

          // Update authorization header and retry
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`
          }
          return request(originalRequest)
        } else {
          throw new Error('Token refresh failed')
        }
      } catch (refreshError) {
        processQueue(refreshError, null)
        // Clear auth state and redirect to login
        localStorage.removeItem('task_token')
        localStorage.removeItem('task_refresh_token')
        localStorage.removeItem('task_user')
        MessagePlugin.error('登录已过期，请重新登录')
        window.location.href = '/login'
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    // Handle other errors
    switch (status) {
      case 403:
        MessagePlugin.error('没有权限访问')
        break
      case 404:
        MessagePlugin.error('请求的资源不存在')
        break
      case 500:
        MessagePlugin.error('服务器错误，请稍后重试')
        break
      default:
        if (message && status !== 401) {
          MessagePlugin.error(message)
        }
    }

    return Promise.reject(error)
  }
)

export default request
