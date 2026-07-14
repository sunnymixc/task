import { create } from 'zustand'
import type { TaskStatus } from '@/types'

// localStorage key 遵循 auth.ts 的 task_ 前缀约定
const STORAGE_KEY = 'task_status_filters'

// 默认不勾选任何状态（空 = 不传 status 参数，展示全部状态任务）
export const DEFAULT_STATUS_FILTER: TaskStatus[] = []
const VALID_STATUSES: TaskStatus[] = ['draft', 'pending', 'executing', 'completed']

// scopeKey: 清单 id，全局任务视图用 'all'
type StatusFilterMap = Record<string, TaskStatus[]>

const load = (): StatusFilterMap => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
    const map: StatusFilterMap = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (Array.isArray(value)) {
        // 丢弃未知状态值；空数组是合法缓存（用户清空过筛选）
        map[key] = value.filter((v): v is TaskStatus => VALID_STATUSES.includes(v as TaskStatus))
      }
    }
    return map
  } catch {
    return {}
  }
}

interface TaskFilterState {
  statusFilters: StatusFilterMap
  getStatusFilter: (scopeKey: string) => TaskStatus[]
  setStatusFilter: (scopeKey: string, statuses: TaskStatus[]) => void
  resetStatusFilter: (scopeKey: string) => TaskStatus[]
}

// 已删除清单的残留条目不做清理（体积极小、无副作用）
export const useTaskFilterStore = create<TaskFilterState>()((set, get) => ({
  statusFilters: load(),

  // 无缓存条目 → 默认值；空数组是合法缓存，原样返回
  getStatusFilter: (scopeKey) => {
    const cached = get().statusFilters[scopeKey]
    return cached !== undefined ? [...cached] : [...DEFAULT_STATUS_FILTER]
  },

  setStatusFilter: (scopeKey, statuses) => {
    const next = { ...get().statusFilters, [scopeKey]: [...statuses] }
    set({ statusFilters: next })
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  },

  resetStatusFilter: (scopeKey) => {
    get().setStatusFilter(scopeKey, DEFAULT_STATUS_FILTER)
    return [...DEFAULT_STATUS_FILTER]
  }
}))
