import request from '@/utils/request'
import type { Task } from '@/types'

// 工作台任务:任务字段 + 行级折叠状态(折叠状态不进全局 Task 类型,避免被任务更新回写冲掉)
export interface WorkbenchTask extends Task {
  collapsed: boolean
}

// 工作台列表响应(无分页,一次返回全部)
export interface WorkbenchListResponse {
  success: boolean
  data: WorkbenchTask[]
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
  },

  // Set the collapsed state of a task panel (idempotent)
  setCollapsed: (taskId: string, collapsed: boolean): Promise<{ success: boolean }> => {
    return request({
      url: `/v1/workbench/${taskId}/collapsed`,
      method: 'PATCH',
      data: { collapsed }
    })
  }
}
