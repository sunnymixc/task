import { defineStore } from 'pinia'
import { ref } from 'vue'

const STORAGE_KEY = 'sidebar-collapsed'

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

  return {
    sidebarCollapsed,
    setSidebarCollapsed,
    toggleSidebar
  }
})
