import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { TaskStatus } from '@/types'

// localStorage key 遵循 auth.ts 的 task_ 前缀约定
const STORAGE_KEY = 'task_status_filters'

export const DEFAULT_STATUS_FILTER: TaskStatus[] = ['draft', 'pending', 'running']
const VALID_STATUSES: TaskStatus[] = ['draft', 'pending', 'running', 'completed']

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

// 已删除清单的残留条目不做清理（体积极小、无副作用）
export const useTaskFilterStore = defineStore('taskFilter', () => {
  const statusFilters = ref<StatusFilterMap>(load())

  const persist = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(statusFilters.value))
  }

  // 无缓存条目 → 默认值；空数组是合法缓存，原样返回
  const getStatusFilter = (scopeKey: string): TaskStatus[] => {
    const cached = statusFilters.value[scopeKey]
    return cached !== undefined ? [...cached] : [...DEFAULT_STATUS_FILTER]
  }

  const setStatusFilter = (scopeKey: string, statuses: TaskStatus[]) => {
    statusFilters.value[scopeKey] = [...statuses]
    persist()
  }

  const resetStatusFilter = (scopeKey: string): TaskStatus[] => {
    setStatusFilter(scopeKey, DEFAULT_STATUS_FILTER)
    return [...DEFAULT_STATUS_FILTER]
  }

  return { statusFilters, getStatusFilter, setStatusFilter, resetStatusFilter }
})
