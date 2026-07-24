import { create } from 'zustand'
import { Toast } from '@douyinfe/semi-ui-19'
import { workbenchAPI } from '@/api/workbench'
import { useUiStore } from './ui'
import type { Task } from '@/types'

// 任务工作台:按用户落库的任务钉选清单。
// 持有独立的 Task 副本(来自 GET /workbench),与任务列表分页解耦;
// 与 task store 的同步由 task.ts 的变更钩子单向调用本 store(不得反向 import task.ts,防循环依赖)。

interface WorkbenchState {
  tasks: Task[]
  loading: boolean
  // 已折叠面板的任务 id;服务端落库(task_workbench.collapsed),fetch 时初始化。
  // 独立于 Task 对象维护:applyTaskUpdate 整体替换 Task 副本,内嵌状态会被冲掉
  collapsedIds: Set<string>
  // 加入(或重复加入)任务后由 TaskWorkbench 消费的滚动目标
  scrollTargetId: string | null
  fetchWorkbench: () => Promise<void>
  addTask: (task: Task) => Promise<void>
  removeTask: (taskId: string) => Promise<void>
  // 设置面板折叠状态:乐观更新本地 + 后台持久化(失败仅记日志,下次 fetch 自然纠偏)
  setCollapsed: (taskId: string, collapsed: boolean) => void
  toggleCollapsed: (taskId: string) => void
  // 任务在他处被更新时回写工作台副本(不在工作台则无操作)
  applyTaskUpdate: (task: Task) => void
  // 任务在他处被删除时同步移除(仅本地,后端软删后列表接口自然过滤)
  removeIfPresent: (taskId: string) => void
  clearScrollTarget: () => void
  reset: () => void
}

// 从折叠集合中删除 id;不存在时原样返回(避免无谓的引用变化触发重渲染)
const setWithout = (ids: Set<string>, taskId: string): Set<string> => {
  if (!ids.has(taskId)) return ids
  const next = new Set(ids)
  next.delete(taskId)
  return next
}

export const useWorkbenchStore = create<WorkbenchState>()((set, get) => ({
  tasks: [],
  loading: false,
  collapsedIds: new Set(),
  scrollTargetId: null,

  fetchWorkbench: async () => {
    set({ loading: true })
    try {
      const response = await workbenchAPI.list()
      if (response.success) {
        const items = response.data || []
        set({
          tasks: items,
          collapsedIds: new Set(items.filter((t) => t.collapsed).map((t) => t.id))
        })
      }
    } catch (error) {
      console.error('Failed to fetch workbench:', error)
    } finally {
      set({ loading: false })
    }
  },

  addTask: async (task) => {
    const expand = () => useUiStore.getState().setRightSidebarCollapsed(false)
    // 已在工作台:仅展开并滚动定位,不重复请求
    if (get().tasks.some((t) => t.id === task.id)) {
      expand()
      set({ scrollTargetId: task.id })
      Toast.info('任务已在工作台')
      return
    }
    try {
      const response = await workbenchAPI.add(task.id)
      // 优先用服务端返回的副本(关联预加载最新),失败退回行数据
      const added = response.data ?? task
      // 新加入的行折叠状态恒为 false,防御性清理本地集合
      set({
        tasks: [...get().tasks, added],
        collapsedIds: setWithout(get().collapsedIds, added.id),
        scrollTargetId: added.id
      })
      expand()
      Toast.success('已加入工作台')
    } catch (error) {
      console.error('Failed to add task to workbench:', error)
      Toast.error('加入工作台失败')
    }
  },

  removeTask: async (taskId) => {
    try {
      await workbenchAPI.remove(taskId)
      // 折叠状态随服务端行硬删消失,本地同步清理
      set({
        tasks: get().tasks.filter((t) => t.id !== taskId),
        collapsedIds: setWithout(get().collapsedIds, taskId)
      })
      Toast.success('已移出工作台')
    } catch (error) {
      console.error('Failed to remove task from workbench:', error)
      Toast.error('移出工作台失败')
    }
  },

  setCollapsed: (taskId, collapsed) => {
    const ids = get().collapsedIds
    if (ids.has(taskId) === collapsed) return
    const next = new Set(ids)
    if (collapsed) next.add(taskId)
    else next.delete(taskId)
    set({ collapsedIds: next })
    // fire-and-forget:视图偏好,失败不回滚不打断
    workbenchAPI.setCollapsed(taskId, collapsed).catch((error) => {
      console.error('Failed to persist collapsed state:', error)
    })
  },

  toggleCollapsed: (taskId) => {
    get().setCollapsed(taskId, !get().collapsedIds.has(taskId))
  },

  applyTaskUpdate: (task) => {
    if (get().tasks.some((t) => t.id === task.id)) {
      set({ tasks: get().tasks.map((t) => (t.id === task.id ? task : t)) })
    }
  },

  removeIfPresent: (taskId) => {
    if (get().tasks.some((t) => t.id === taskId)) {
      set({
        tasks: get().tasks.filter((t) => t.id !== taskId),
        collapsedIds: setWithout(get().collapsedIds, taskId)
      })
    }
  },

  clearScrollTarget: () => {
    set({ scrollTargetId: null })
  },

  reset: () => {
    set({ tasks: [], loading: false, collapsedIds: new Set(), scrollTargetId: null })
  }
}))
