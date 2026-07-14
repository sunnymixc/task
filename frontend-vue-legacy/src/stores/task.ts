import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { taskAPI } from '@/api/task'
import type {
  CreateTaskRequest,
  ListTasksRequest,
  Task,
  UpdateTaskRequest,
  TaskStatus
} from '@/types'
import { MessagePlugin } from 'tdesign-vue-next'
import { useTaskListStore } from './taskList'

export const useTaskStore = defineStore('task', () => {
  const tasks = ref<Task[]>([])
  const total = ref(0)
  const loading = ref(false)
  const currentPage = ref(1)
  const pageSize = ref(20)

  // 任务增删/状态变化会影响侧边栏清单的执行中数量,静默刷新(fetchAllLists 自行吞错)
  const refreshListCounts = () => {
    useTaskListStore().fetchAllLists()
  }

  // Computed
  const hasMore = computed(() => tasks.value.length < total.value)

  // Fetch tasks
  const fetchTasks = async (params?: ListTasksRequest): Promise<void> => {
    loading.value = true
    try {
      const response = await taskAPI.list({
        page: currentPage.value,
        page_size: pageSize.value,
        ...params
      })

      if (response.success) {
        tasks.value = response.data || []
        total.value = response.total || 0
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error)
      MessagePlugin.error('获取任务列表失败')
    } finally {
      loading.value = false
    }
  }

  // Create task
  const createTask = async (data: CreateTaskRequest): Promise<Task | null> => {
    loading.value = true
    try {
      const task = await taskAPI.create(data)
      tasks.value.unshift(task)
      total.value += 1
      refreshListCounts()
      MessagePlugin.success('任务创建成功')
      return task
    } catch (error) {
      console.error('Failed to create task:', error)
      MessagePlugin.error('创建任务失败')
      return null
    } finally {
      loading.value = false
    }
  }

  // Update task
  const updateTask = async (id: string, data: UpdateTaskRequest): Promise<Task | null> => {
    loading.value = true
    try {
      const updatedTask = await taskAPI.update(id, data)
      const index = tasks.value.findIndex(t => t.id === id)
      if (index !== -1) {
        tasks.value[index] = updatedTask
      }
      refreshListCounts()
      MessagePlugin.success('任务更新成功')
      return updatedTask
    } catch (error) {
      console.error('Failed to update task:', error)
      MessagePlugin.error('更新任务失败')
      return null
    } finally {
      loading.value = false
    }
  }

  // Delete task
  const deleteTask = async (id: string): Promise<boolean> => {
    loading.value = true
    try {
      await taskAPI.delete(id)
      tasks.value = tasks.value.filter(t => t.id !== id)
      total.value -= 1
      refreshListCounts()
      MessagePlugin.success('任务删除成功')
      return true
    } catch (error) {
      console.error('Failed to delete task:', error)
      MessagePlugin.error('删除任务失败')
      return false
    } finally {
      loading.value = false
    }
  }

  // Update task status
  const updateStatus = async (id: string, status: TaskStatus): Promise<Task | null> => {
    loading.value = true
    try {
      const updatedTask = await taskAPI.updateStatus(id, { status })
      const index = tasks.value.findIndex(t => t.id === id)
      if (index !== -1) {
        tasks.value[index] = updatedTask
      }
      refreshListCounts()
      MessagePlugin.success('状态更新成功')
      return updatedTask
    } catch (error) {
      console.error('Failed to update task status:', error)
      const message = (error as any).response?.data?.message || '更新状态失败'
      MessagePlugin.error(message)
      return null
    } finally {
      loading.value = false
    }
  }

  // Get task by ID
  const getById = async (id: string): Promise<Task | null> => {
    loading.value = true
    try {
      const task = await taskAPI.getById(id)
      // Update in existing list if found
      const index = tasks.value.findIndex(t => t.id === id)
      if (index !== -1) {
        tasks.value[index] = task
      }
      return task
    } catch (error) {
      console.error('Failed to get task:', error)
      MessagePlugin.error('获取任务详情失败')
      return null
    } finally {
      loading.value = false
    }
  }

  // Search tasks
  const searchTasks = async (query: string, page = 1): Promise<void> => {
    loading.value = true
    try {
      const response = await taskAPI.search({
        q: query,
        page,
        page_size: pageSize.value
      })

      if (response.success) {
        tasks.value = response.data || []
        total.value = response.total || 0
        currentPage.value = page
      }
    } catch (error) {
      console.error('Failed to search tasks:', error)
      MessagePlugin.error('搜索任务失败')
    } finally {
      loading.value = false
    }
  }

  // Set page
  const setPage = (page: number) => {
    currentPage.value = page
  }

  // Reset state
  const reset = () => {
    tasks.value = []
    total.value = 0
    currentPage.value = 1
    loading.value = false
  }

  return {
    tasks,
    total,
    loading,
    currentPage,
    pageSize,
    hasMore,
    fetchTasks,
    getById,
    createTask,
    updateTask,
    deleteTask,
    updateStatus,
    searchTasks,
    setPage,
    reset
  }
})
