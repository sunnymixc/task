<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const uiStore = useUiStore()

interface MenuItem {
  title: string
  icon: string
  path: string
}

const menuItems: MenuItem[] = [
  { title: '任务列表', icon: 'view-list', path: '/tasks' }
]

const isActive = (path: string) => route.path === path || route.path.startsWith(path + '/')

const handleMenuClick = (path: string) => {
  if (route.path !== path) {
    router.push(path)
  }
}

const goHome = () => {
  router.push('/tasks')
}

const handleLogout = () => {
  authStore.logout()
  router.push('/login')
}

const avatarText = computed(() => authStore.userName?.charAt(0)?.toUpperCase() || 'U')
</script>

<template>
  <aside class="aside-box" :class="{ 'aside-box--collapsed': uiStore.sidebarCollapsed }">
    <!-- 顶部 Logo 行 -->
    <div v-if="!uiStore.sidebarCollapsed" class="logo-row">
      <div class="logo-box" @click="goHome">
        <t-icon name="task-checked" class="logo-icon" />
        <span class="logo-text">TASK</span>
      </div>
      <div class="sidebar-toggle" @click="uiStore.toggleSidebar">
        <t-icon name="chevron-left" />
      </div>
    </div>
    <t-tooltip v-else content="展开侧边栏" placement="right">
      <div class="menu-item sidebar-toggle-collapsed" @click="uiStore.toggleSidebar">
        <div class="menu-icon"><t-icon name="chevron-right" /></div>
      </div>
    </t-tooltip>

    <!-- 中部菜单区 -->
    <div class="menu-top">
      <t-tooltip
        v-for="item in menuItems"
        :key="item.path"
        :content="item.title"
        placement="right"
        :disabled="!uiStore.sidebarCollapsed"
      >
        <div
          class="menu-item"
          :class="{ 'menu-item--active': isActive(item.path) }"
          @click="handleMenuClick(item.path)"
        >
          <div class="menu-icon"><t-icon :name="item.icon" /></div>
          <span v-if="!uiStore.sidebarCollapsed" class="menu-title">{{ item.title }}</span>
        </div>
      </t-tooltip>
    </div>

    <!-- 底部用户区 -->
    <div class="menu-bottom">
      <t-dropdown placement="top-left" trigger="click">
        <div class="user-box" :class="{ 'user-box--collapsed': uiStore.sidebarCollapsed }">
          <t-avatar :image="authStore.user?.avatar || ''" size="32px">
            {{ avatarText }}
          </t-avatar>
          <span v-if="!uiStore.sidebarCollapsed" class="user-name">{{ authStore.userName }}</span>
          <t-icon v-if="!uiStore.sidebarCollapsed" name="chevron-up" class="user-caret" />
        </div>
        <template #dropdown>
          <t-dropdown-menu>
            <t-dropdown-item>
              <div class="user-email">{{ authStore.userEmail }}</div>
            </t-dropdown-item>
            <t-dropdown-item :divider="true" />
            <t-dropdown-item @click="handleLogout">
              <template #prefix-icon>
                <t-icon name="logout" />
              </template>
              退出登录
            </t-dropdown-item>
          </t-dropdown-menu>
        </template>
      </t-dropdown>
    </div>
  </aside>
</template>

<style scoped>
.aside-box {
  display: flex;
  flex-direction: column;
  width: 240px;
  min-width: 240px;
  height: 100%;
  padding: 8px 6px 8px;
  background: var(--td-bg-color-sidebar);
  border-right: 1px solid var(--td-component-stroke);
  box-sizing: border-box;
  transition: width 0.25s ease, min-width 0.25s ease;
}

.aside-box--collapsed {
  width: 60px;
  min-width: 60px;
  padding: 8px 3px 8px;
}

/* Logo 行 */
.logo-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 50px;
  flex-shrink: 0;
  padding: 0 10px 0 var(--sidebar-inset-x);
}

.logo-box {
  display: flex;
  align-items: center;
  gap: var(--sidebar-icon-gap);
  cursor: pointer;
  overflow: hidden;
}

.logo-icon {
  font-size: 22px;
  color: var(--td-brand-color);
  flex-shrink: 0;
}

.logo-text {
  font-size: 16px;
  font-weight: 600;
  color: var(--td-text-color-primary);
  white-space: nowrap;
}

.sidebar-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  cursor: pointer;
  color: var(--td-text-color-secondary);
  transition: background-color 0.2s ease;
}

.sidebar-toggle:hover {
  background: var(--td-bg-color-container-hover);
}

/* 菜单区 */
.menu-top {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
  margin-top: 4px;
}

.menu-item {
  display: flex;
  align-items: center;
  height: 38px;
  padding: 8px 10px 8px var(--sidebar-inset-x);
  margin-bottom: 2px;
  border-radius: 4px;
  cursor: pointer;
  color: var(--td-text-color-primary);
  transition: background-color 0.2s ease;
}

.aside-box--collapsed .menu-item {
  justify-content: center;
  padding: 8px 0;
}

.menu-item:hover {
  background: var(--td-bg-color-container-hover);
}

.menu-item--active {
  background: var(--td-brand-color-light);
}

.menu-item--active .menu-icon,
.menu-item--active .menu-title {
  color: var(--td-brand-color);
}

.menu-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 var(--sidebar-icon-size);
  font-size: var(--sidebar-icon-size);
  margin-right: var(--sidebar-icon-gap);
  color: var(--td-text-color-secondary);
}

.aside-box--collapsed .menu-icon {
  margin-right: 0;
}

.menu-title {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-toggle-collapsed {
  flex: 0 0 auto;
  margin-bottom: 4px;
  color: var(--td-text-color-secondary);
}

/* 用户区 */
.menu-bottom {
  flex-shrink: 0;
  padding-top: 8px;
  border-top: 1px solid var(--td-component-stroke);
}

.user-box {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 44px;
  padding: 0 8px 0 var(--sidebar-inset-x);
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.user-box:hover {
  background: var(--td-bg-color-container-hover);
}

.user-box--collapsed {
  justify-content: center;
  padding: 0;
}

.user-name {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
  color: var(--td-text-color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-caret {
  color: var(--td-text-color-placeholder);
}

.user-email {
  font-size: 12px;
  color: var(--td-text-color-secondary);
  padding: 4px 8px;
}
</style>
