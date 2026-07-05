import request from '@/utils/request'
import type {
  CreateTaskRequest,
  ListTasksRequest,
  SearchTasksRequest,
  Task,
  TaskListResponse,
  UpdateTaskRequest,
  UpdateTaskStatusRequest
} from '@/types'

export const taskAPI = {
  // List tasks with filters
  list: (params?: ListTasksRequest): Promise<TaskListResponse> => {
    return request({
      url: '/v1/tasks',
      method: 'GET',
      params,
      // 数组参数序列化为重复同名参数(status=a&status=b),与后端 gin QueryArray 对齐
      paramsSerializer: { indexes: null }
    })
  },

  // Get task by ID
  getById: (id: string): Promise<Task> => {
    return request({
      url: `/v1/tasks/${id}`,
      method: 'GET'
    })
  },

  // Create task
  create: (data: CreateTaskRequest): Promise<Task> => {
    return request({
      url: '/v1/tasks',
      method: 'POST',
      data
    })
  },

  // Update task
  update: (id: string, data: UpdateTaskRequest): Promise<Task> => {
    return request({
      url: `/v1/tasks/${id}`,
      method: 'PUT',
      data
    })
  },

  // Delete task
  delete: (id: string): Promise<void> => {
    return request({
      url: `/v1/tasks/${id}`,
      method: 'DELETE'
    })
  },

  // Update task status
  updateStatus: (id: string, data: UpdateTaskStatusRequest): Promise<Task> => {
    return request({
      url: `/v1/tasks/${id}/status`,
      method: 'PATCH',
      data
    })
  },

  // Search tasks
  search: (params: SearchTasksRequest): Promise<TaskListResponse> => {
    return request({
      url: '/v1/tasks/search',
      method: 'GET',
      params
    })
  }
}
