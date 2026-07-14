import { create } from 'zustand'
import { taskAPI } from '@/api/task'
import type {
  CreateTaskRequest,
  ListTasksRequest,
  Task,
  UpdateTaskRequest,
  TaskStatus
} from '@/types'
import { Toast } from '@douyinfe/semi-ui-19'
import { useTaskListStore } from './taskList'

// 任务增删/状态变化会影响侧边栏清单的执行中数量,静默刷新(fetchAllLists 自行吞错)
const refreshListCounts = () => {
  useTaskListStore.getState().fetchAllLists()
}

interface TaskState {
  tasks: Task[]
  total: number
  loading: boolean
  currentPage: number
  pageSize: number
  fetchTasks: (params?: ListTasksRequest) => Promise<void>
  getById: (id: string) => Promise<Task | null>
  createTask: (data: CreateTaskRequest) => Promise<Task | null>
  updateTask: (id: string, data: UpdateTaskRequest) => Promise<Task | null>
  deleteTask: (id: string) => Promise<boolean>
  updateStatus: (id: string, status: TaskStatus) => Promise<Task | null>
  searchTasks: (query: string, page?: number) => Promise<void>
  setPage: (page: number) => void
  reset: () => void
}

export const useTaskStore = create<TaskState>()((set, get) => ({
  tasks: [],
  total: 0,
  loading: false,
  currentPage: 1,
  pageSize: 20,

  fetchTasks: async (params) => {
    set({ loading: true })
    try {
      const response = await taskAPI.list({
        page: get().currentPage,
        page_size: get().pageSize,
        ...params
      })

      if (response.success) {
        set({ tasks: response.data || [], total: response.total || 0 })
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error)
      Toast.error('获取任务列表失败')
    } finally {
      set({ loading: false })
    }
  },

  createTask: async (data) => {
    set({ loading: true })
    try {
      const task = await taskAPI.create(data)
      set({ tasks: [task, ...get().tasks], total: get().total + 1 })
      refreshListCounts()
      Toast.success('任务创建成功')
      return task
    } catch (error) {
      console.error('Failed to create task:', error)
      Toast.error('创建任务失败')
      return null
    } finally {
      set({ loading: false })
    }
  },

  updateTask: async (id, data) => {
    set({ loading: true })
    try {
      const updatedTask = await taskAPI.update(id, data)
      set({ tasks: get().tasks.map(t => (t.id === id ? updatedTask : t)) })
      refreshListCounts()
      Toast.success('任务更新成功')
      return updatedTask
    } catch (error) {
      console.error('Failed to update task:', error)
      Toast.error('更新任务失败')
      return null
    } finally {
      set({ loading: false })
    }
  },

  deleteTask: async (id) => {
    set({ loading: true })
    try {
      await taskAPI.delete(id)
      set({ tasks: get().tasks.filter(t => t.id !== id), total: get().total - 1 })
      refreshListCounts()
      Toast.success('任务删除成功')
      return true
    } catch (error) {
      console.error('Failed to delete task:', error)
      Toast.error('删除任务失败')
      return false
    } finally {
      set({ loading: false })
    }
  },

  updateStatus: async (id, status) => {
    set({ loading: true })
    try {
      const updatedTask = await taskAPI.updateStatus(id, { status })
      set({ tasks: get().tasks.map(t => (t.id === id ? updatedTask : t)) })
      refreshListCounts()
      Toast.success('状态更新成功')
      return updatedTask
    } catch (error) {
      console.error('Failed to update task status:', error)
      const message = (error as any).response?.data?.message || '更新状态失败'
      Toast.error(message)
      return null
    } finally {
      set({ loading: false })
    }
  },

  getById: async (id) => {
    set({ loading: true })
    try {
      const task = await taskAPI.getById(id)
      // Update in existing list if found
      set({ tasks: get().tasks.map(t => (t.id === id ? task : t)) })
      return task
    } catch (error) {
      console.error('Failed to get task:', error)
      Toast.error('获取任务详情失败')
      return null
    } finally {
      set({ loading: false })
    }
  },

  searchTasks: async (query, page = 1) => {
    set({ loading: true })
    try {
      const response = await taskAPI.search({
        q: query,
        page,
        page_size: get().pageSize
      })

      if (response.success) {
        set({
          tasks: response.data || [],
          total: response.total || 0,
          currentPage: page
        })
      }
    } catch (error) {
      console.error('Failed to search tasks:', error)
      Toast.error('搜索任务失败')
    } finally {
      set({ loading: false })
    }
  },

  setPage: (page) => {
    set({ currentPage: page })
  },

  reset: () => {
    set({ tasks: [], total: 0, currentPage: 1, loading: false })
  }
}))
