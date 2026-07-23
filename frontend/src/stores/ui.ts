import { create } from 'zustand'
import { settingsAPI } from '@/api/settings'
import type { SystemSettings } from '@/types'

const STORAGE_KEY = 'sidebar-collapsed'
const RIGHT_STORAGE_KEY = 'right-sidebar-collapsed'
const RADIUS_KEY = 'task_radius'
const WORKBENCH_WIDTH_KEY = 'task_workbench_width'

// 右侧工作台栏宽度(px):拖拽调整,浏览器端缓存;上限为当前窗口宽度
export const WORKBENCH_WIDTH_MIN = 360
export const WORKBENCH_WIDTH_DEFAULT = 520

const clampWorkbenchWidth = (px: number): number =>
  Math.min(window.innerWidth, Math.max(WORKBENCH_WIDTH_MIN, Math.round(px)))

const loadWorkbenchWidth = (): number => {
  const raw = localStorage.getItem(WORKBENCH_WIDTH_KEY)
  if (raw === null) return WORKBENCH_WIDTH_DEFAULT
  const value = Number(raw)
  if (!Number.isFinite(value)) return WORKBENCH_WIDTH_DEFAULT
  return clampWorkbenchWidth(value)
}

// 圆角档位（px 值同时写入四个 --semi-border-radius-* 变量，全局统一）
export const RADIUS_OPTIONS = [
  { label: '默认', px: 6 },
  { label: '直角', px: 0 },
  { label: '小', px: 4 },
  { label: '中', px: 8 },
  { label: '大', px: 12 },
  { label: '超大', px: 14 },
  { label: '圆角', px: 16 }
] as const

const DEFAULT_RADIUS = 6

// 自定义圆角允许的取值范围
export const RADIUS_MIN = 0
export const RADIUS_MAX = 32

// semi 组件圆角全部取自这些变量（full/circle 不动）；
// 写 body 内联样式：semi.min.css 与 theme.css 都把令牌声明在 body 上，
// body 级声明会遮蔽 html（documentElement）上的内联值，只有 body 内联
// 才能不依赖样式表打包顺序稳定覆盖
const RADIUS_VARS = [
  '--semi-border-radius-extra-small',
  '--semi-border-radius-small',
  '--semi-border-radius-medium',
  '--semi-border-radius-large'
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
    document.body.style.setProperty(name, `${px}px`)
  }
}

interface UiState {
  sidebarCollapsed: boolean
  rightSidebarCollapsed: boolean
  workbenchWidth: number
  radius: number
  setSidebarCollapsed: (value: boolean) => void
  toggleSidebar: () => void
  setRightSidebarCollapsed: (value: boolean) => void
  toggleRightSidebar: () => void
  setWorkbenchWidth: (px: number) => void
  setRadius: (px: number) => void
  fetchSystemSettings: () => Promise<void>
  updateSystemSettings: (patch: Partial<SystemSettings>) => Promise<boolean>
}

// localStorage 值仅作登录前/请求失败时的缓存，服务端系统设置为准
const initialRadius = loadRadius()
applyRadiusToDom(initialRadius)

export const useUiStore = create<UiState>()((set, get) => ({
  sidebarCollapsed: localStorage.getItem(STORAGE_KEY) === 'true',
  // 右侧工作台栏默认收起,加入任务时自动展开
  rightSidebarCollapsed: localStorage.getItem(RIGHT_STORAGE_KEY) !== 'false',
  workbenchWidth: loadWorkbenchWidth(),
  radius: initialRadius,

  setSidebarCollapsed: (value) => {
    set({ sidebarCollapsed: value })
    localStorage.setItem(STORAGE_KEY, String(value))
  },

  toggleSidebar: () => {
    get().setSidebarCollapsed(!get().sidebarCollapsed)
  },

  setRightSidebarCollapsed: (value) => {
    set({ rightSidebarCollapsed: value })
    localStorage.setItem(RIGHT_STORAGE_KEY, String(value))
  },

  toggleRightSidebar: () => {
    get().setRightSidebarCollapsed(!get().rightSidebarCollapsed)
  },

  setWorkbenchWidth: (px) => {
    const value = clampWorkbenchWidth(px)
    set({ workbenchWidth: value })
    localStorage.setItem(WORKBENCH_WIDTH_KEY, String(value))
  },

  setRadius: (px) => {
    const value = clampRadius(px)
    set({ radius: value })
    applyRadiusToDom(value)
    localStorage.setItem(RADIUS_KEY, String(value))
  },

  // 从服务端加载系统设置并应用；失败时静默回退本地缓存
  fetchSystemSettings: async () => {
    try {
      const response = await settingsAPI.getSettings()
      if (response.success && response.data) {
        get().setRadius(response.data.ui_radius)
      }
    } catch (e) {
      console.error('Failed to fetch system settings', e)
    }
  },

  // 保存系统设置（仅管理员，403 由请求拦截器提示），成功后应用服务端确认值
  updateSystemSettings: async (patch) => {
    try {
      const response = await settingsAPI.updateSettings(patch)
      if (response.success && response.data) {
        get().setRadius(response.data.ui_radius)
        return true
      }
      return false
    } catch (e) {
      console.error('Failed to update system settings', e)
      return false
    }
  }
}))
