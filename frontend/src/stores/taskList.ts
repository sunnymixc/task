import { defineStore } from 'pinia'
import { ref } from 'vue'
import { taskListAPI } from '@/api/taskList'
import type {
  CreateTaskListRequest,
  ListTaskListsRequest,
  TaskList,
  UpdateTaskListRequest
} from '@/types'
import { MessagePlugin } from 'tdesign-vue-next'

// 与后端排序保持一致:默认清单最先,其余按序号升序,同序号按创建时间先后
const sortTaskLists = (items: TaskList[]): TaskList[] =>
  items.sort((a, b) => {
    if (a.is_default !== b.is_default) return a.is_default ? -1 : 1
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
    return a.created_at.localeCompare(b.created_at)
  })

export const useTaskListStore = defineStore('taskList', () => {
  const lists = ref<TaskList[]>([])
  const allLists = ref<TaskList[]>([])
  const total = ref(0)
  const loading = ref(false)
  const currentPage = ref(1)
  const pageSize = ref(20)

  // Fetch task lists (paginated, for the manage page)
  const fetchLists = async (params?: ListTaskListsRequest): Promise<void> => {
    loading.value = true
    try {
      const response = await taskListAPI.list({
        page: currentPage.value,
        page_size: pageSize.value,
        ...params
      })

      if (response.success) {
        lists.value = response.data || []
        total.value = response.total || 0
      }
    } catch (error) {
      console.error('Failed to fetch task lists:', error)
      MessagePlugin.error('获取任务清单失败')
    } finally {
      loading.value = false
    }
  }

  // Fetch all task lists (for selectors/filters/sidebar)
  const fetchAllLists = async (): Promise<TaskList[]> => {
    try {
      const response = await taskListAPI.list({ page: 1, page_size: 100 })
      if (response.success) {
        allLists.value = response.data || []
      }
      return allLists.value
    } catch (error) {
      console.error('Failed to fetch task lists:', error)
      return []
    }
  }

  // Create task list
  const createList = async (data: CreateTaskListRequest): Promise<TaskList | null> => {
    loading.value = true
    try {
      const list = await taskListAPI.create(data)
      lists.value.push(list)
      allLists.value.push(list)
      sortTaskLists(lists.value)
      sortTaskLists(allLists.value)
      total.value += 1
      MessagePlugin.success('任务清单创建成功')
      return list
    } catch (error) {
      console.error('Failed to create task list:', error)
      MessagePlugin.error('创建任务清单失败')
      return null
    } finally {
      loading.value = false
    }
  }

  // Update task list
  const updateList = async (id: string, data: UpdateTaskListRequest): Promise<TaskList | null> => {
    loading.value = true
    try {
      const updated = await taskListAPI.update(id, data)
      const index = lists.value.findIndex(l => l.id === id)
      if (index !== -1) {
        lists.value[index] = updated
      }
      const allIndex = allLists.value.findIndex(l => l.id === id)
      if (allIndex !== -1) {
        allLists.value[allIndex] = updated
      }
      sortTaskLists(lists.value)
      sortTaskLists(allLists.value)
      MessagePlugin.success('任务清单更新成功')
      return updated
    } catch (error) {
      console.error('Failed to update task list:', error)
      MessagePlugin.error('更新任务清单失败')
      return null
    } finally {
      loading.value = false
    }
  }

  // Delete task list
  const deleteList = async (id: string): Promise<boolean> => {
    loading.value = true
    try {
      await taskListAPI.delete(id)
      lists.value = lists.value.filter(l => l.id !== id)
      allLists.value = allLists.value.filter(l => l.id !== id)
      total.value -= 1
      MessagePlugin.success('任务清单删除成功')
      return true
    } catch (error) {
      console.error('Failed to delete task list:', error)
      const message = (error as any).response?.data?.message || '删除任务清单失败'
      MessagePlugin.error(message)
      return false
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
    lists.value = []
    allLists.value = []
    total.value = 0
    currentPage.value = 1
    loading.value = false
  }

  return {
    lists,
    allLists,
    total,
    loading,
    currentPage,
    pageSize,
    fetchLists,
    fetchAllLists,
    createList,
    updateList,
    deleteList,
    setPage,
    reset
  }
})
