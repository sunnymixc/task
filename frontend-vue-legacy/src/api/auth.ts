import request from '@/utils/request'
import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  User
} from '@/types'

export const authAPI = {
  // User login
  login: (data: LoginRequest): Promise<LoginResponse> => {
    return request({
      url: '/v1/auth/login',
      method: 'POST',
      data
    })
  },

  // User registration
  register: (data: RegisterRequest): Promise<LoginResponse> => {
    return request({
      url: '/v1/auth/register',
      method: 'POST',
      data
    })
  },

  // Get current user info
  getUserInfo: (): Promise<{ success: boolean; data?: User }> => {
    return request({
      url: '/v1/auth/me',
      method: 'GET'
    })
  },

  // Refresh token
  refreshToken: (refreshToken: string): Promise<LoginResponse> => {
    return request({
      url: '/v1/auth/refresh',
      method: 'POST',
      data: { refresh_token: refreshToken }
    })
  }
}
