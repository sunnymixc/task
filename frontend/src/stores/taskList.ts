import { create } from 'zustand'
import { taskListAPI } from '@/api/taskList'
import type {
  CreateTaskListRequest,
  ListTaskListsRequest,
  TaskList,
  UpdateTaskListRequest
} from '@/types'
import { Toast } from '@douyinfe/semi-ui-19'

// 与后端排序保持一致:默认清单最先,其余按序号升序,同序号按创建时间先后
const sortTaskLists = (items: TaskList[]): TaskList[] =>
  [...items].sort((a, b) => {
    if (a.is_default !== b.is_default) return a.is_default ? -1 : 1
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
    return a.created_at.localeCompare(b.created_at)
  })

interface TaskListState {
  lists: TaskList[]
  allLists: TaskList[]
  total: number
  loading: boolean
  currentPage: number
  pageSize: number
  fetchLists: (params?: ListTaskListsRequest) => Promise<void>
  fetchAllLists: () => Promise<TaskList[]>
  createList: (data: CreateTaskListRequest) => Promise<TaskList | null>
  updateList: (id: string, data: UpdateTaskListRequest) => Promise<TaskList | null>
  deleteList: (id: string) => Promise<boolean>
  setPage: (page: number) => void
  reset: () => void
}

export const useTaskListStore = create<TaskListState>()((set, get) => ({
  lists: [],
  allLists: [],
  total: 0,
  loading: false,
  currentPage: 1,
  pageSize: 20,

  // Fetch task lists (paginated, for the manage page)
  fetchLists: async (params) => {
    set({ loading: true })
    try {
      const response = await taskListAPI.list({
        page: get().currentPage,
        page_size: get().pageSize,
        ...params
      })

      if (response.success) {
        set({ lists: response.data || [], total: response.total || 0 })
      }
    } catch (error) {
      console.error('Failed to fetch task lists:', error)
      Toast.error('获取任务清单失败')
    } finally {
      set({ loading: false })
    }
  },

  // Fetch all task lists (for selectors/filters/sidebar)
  fetchAllLists: async () => {
    try {
      const response = await taskListAPI.list({ page: 1, page_size: 100 })
      if (response.success) {
        set({ allLists: response.data || [] })
      }
      return get().allLists
    } catch (error) {
      console.error('Failed to fetch task lists:', error)
      return []
    }
  },

  createList: async (data) => {
    set({ loading: true })
    try {
      const list = await taskListAPI.create(data)
      set({
        lists: sortTaskLists([...get().lists, list]),
        allLists: sortTaskLists([...get().allLists, list]),
        total: get().total + 1
      })
      Toast.success('任务清单创建成功')
      return list
    } catch (error) {
      console.error('Failed to create task list:', error)
      Toast.error('创建任务清单失败')
      return null
    } finally {
      set({ loading: false })
    }
  },

  updateList: async (id, data) => {
    set({ loading: true })
    try {
      const updated = await taskListAPI.update(id, data)
      const lists = get().lists.map(l => (l.id === id ? updated : l))
      // update 接口不返回 executing_count,保留原有统计值
      const allLists = get().allLists.map(l =>
        l.id === id ? { ...updated, executing_count: l.executing_count } : l
      )
      set({ lists: sortTaskLists(lists), allLists: sortTaskLists(allLists) })
      Toast.success('任务清单更新成功')
      return updated
    } catch (error) {
      console.error('Failed to update task list:', error)
      Toast.error('更新任务清单失败')
      return null
    } finally {
      set({ loading: false })
    }
  },

  deleteList: async (id) => {
    set({ loading: true })
    try {
      await taskListAPI.delete(id)
      set({
        lists: get().lists.filter(l => l.id !== id),
        allLists: get().allLists.filter(l => l.id !== id),
        total: get().total - 1
      })
      Toast.success('任务清单删除成功')
      return true
    } catch (error) {
      console.error('Failed to delete task list:', error)
      const message = (error as any).response?.data?.message || '删除任务清单失败'
      Toast.error(message)
      return false
    } finally {
      set({ loading: false })
    }
  },

  setPage: (page) => {
    set({ currentPage: page })
  },

  reset: () => {
    set({ lists: [], allLists: [], total: 0, currentPage: 1, loading: false })
  }
}))
