import request from '@/utils/request'
import type {
  CreateTaskListRequest,
  ListTaskListsRequest,
  TaskList,
  TaskListsResponse,
  UpdateTaskListRequest
} from '@/types'

export const taskListAPI = {
  // List task lists with pagination
  list: (params?: ListTaskListsRequest): Promise<TaskListsResponse> => {
    return request({
      url: '/v1/task-lists',
      method: 'GET',
      params
    })
  },

  // Get task list by ID
  getById: (id: string): Promise<TaskList> => {
    return request({
      url: `/v1/task-lists/${id}`,
      method: 'GET'
    })
  },

  // Create task list
  create: (data: CreateTaskListRequest): Promise<TaskList> => {
    return request({
      url: '/v1/task-lists',
      method: 'POST',
      data
    })
  },

  // Update task list
  update: (id: string, data: UpdateTaskListRequest): Promise<TaskList> => {
    return request({
      url: `/v1/task-lists/${id}`,
      method: 'PUT',
      data
    })
  },

  // Delete task list
  delete: (id: string): Promise<void> => {
    return request({
      url: `/v1/task-lists/${id}`,
      method: 'DELETE'
    })
  }
}
