import request from '@/utils/request'
import type { Task } from '@/types'

// 工作台列表响应(无分页,一次返回全部)
export interface WorkbenchListResponse {
  success: boolean
  data: Task[]
  total: number
}

export const workbenchAPI = {
  // List all tasks in the current user's workbench (in add order)
  list: (): Promise<WorkbenchListResponse> => {
    return request({
      url: '/v1/workbench',
      method: 'GET'
    })
  },

  // Add a task to the workbench (idempotent); returns the preloaded task
  add: (taskId: string): Promise<{ success: boolean; data?: Task }> => {
    return request({
      url: '/v1/workbench',
      method: 'POST',
      data: { task_id: taskId }
    })
  },

  // Remove a task from the workbench (idempotent)
  remove: (taskId: string): Promise<{ success: boolean }> => {
    return request({
      url: `/v1/workbench/${taskId}`,
      method: 'DELETE'
    })
  }
}
