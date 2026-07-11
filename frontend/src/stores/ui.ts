import { defineStore } from 'pinia'
import { ref } from 'vue'

const STORAGE_KEY = 'sidebar-collapsed'
const RADIUS_KEY = 'task_radius'

// 圆角档位（px 值同时写入五个 --td-radius-* 变量，全局统一）
export const RADIUS_OPTIONS = [
  { label: '直角', px: 1 },
  { label: '默认', px: 3 },
  { label: '小', px: 6 },
  { label: '中', px: 9 },
  { label: '大', px: 12 },
  { label: '超大', px: 16 }
] as const

const DEFAULT_RADIUS = 1

// 自定义圆角允许的取值范围
export const RADIUS_MIN = 0
export const RADIUS_MAX = 32

// tdesign 组件圆角全部取自这五个变量；documentElement 内联样式覆盖 theme.css 的 :root 声明
const RADIUS_VARS = [
  '--td-radius-small',
  '--td-radius-default',
  '--td-radius-medium',
  '--td-radius-large',
  '--td-radius-extraLarge'
]

const clampRadius = (px: number): number =>
  Math.min(RADIUS_MAX, Math.max(RADIUS_MIN, Math.round(px)))

const loadRadius = (): number => {
  const raw = localStorage.getItem(RADIUS_KEY)
  if (raw === null) return DEFAULT_RADIUS
  const value = Number(raw)
  if (!Number.isFinite(value) || value < RADIUS_MIN || value > RADIUS_MAX) {
    return DEFAULT_RADIUS
  }
  return Math.round(value)
}

const applyRadiusToDom = (px: number) => {
  for (const name of RADIUS_VARS) {
    document.documentElement.style.setProperty(name, `${px}px`)
  }
}

export const useUiStore = defineStore('ui', () => {
  const sidebarCollapsed = ref<boolean>(
    localStorage.getItem(STORAGE_KEY) === 'true'
  )

  const persist = () => {
    localStorage.setItem(STORAGE_KEY, String(sidebarCollapsed.value))
  }

  const setSidebarCollapsed = (value: boolean) => {
    sidebarCollapsed.value = value
    persist()
  }

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed.value)
  }

  const radius = ref<number>(loadRadius())
  applyRadiusToDom(radius.value)

  const setRadius = (px: number) => {
    const value = clampRadius(px)
    radius.value = value
    applyRadiusToDom(value)
    localStorage.setItem(RADIUS_KEY, String(value))
  }

  return {
    sidebarCollapsed,
    setSidebarCollapsed,
    toggleSidebar,
    radius,
    setRadius
  }
})
