import request from '@/utils/request'
import type { SystemSettings, SystemSettingsResponse } from '@/types'

export const settingsAPI = {
  // Get system settings (any authenticated user)
  getSettings: (): Promise<SystemSettingsResponse> => {
    return request({
      url: '/v1/settings',
      method: 'GET'
    })
  },

  // Update system settings (admin only)
  updateSettings: (data: Partial<SystemSettings>): Promise<SystemSettingsResponse> => {
    return request({
      url: '/v1/settings',
      method: 'PUT',
      data
    })
  }
}
