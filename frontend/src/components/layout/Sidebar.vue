<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { useTaskListStore } from '@/stores/taskList'
import SystemSettingsDialog from '@/components/settings/SystemSettingsDialog.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const uiStore = useUiStore()
const taskListStore = useTaskListStore()

interface MenuItem {
  title: string
  icon: string
  path: string
}

const menuItems: MenuItem[] = [
  { title: '任务列表', icon: 'view-list', path: '/tasks' },
  { title: '任务清单', icon: 'bulletpoint', path: '/task-lists' }
]

// 任务清单子菜单(每个清单一项)
const taskListChildren = computed(() =>
  taskListStore.allLists.map((list, index) => ({
    seq: index + 1, // 纯展示序号,按侧边栏显示顺序编号
    title: list.title,
    path: `/task-lists/${list.id}/tasks`,
    isDefault: list.is_default,
    executingCount: list.executing_count || 0
  }))
)

const isActive = (item: MenuItem) =>
  route.path === item.path || route.path.startsWith(item.path + '/')

onMounted(() => {
  taskListStore.fetchAllLists()
})

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

const showSettingsDialog = ref(false)

const avatarText = computed(() => authStore.userName?.charAt(0)?.toUpperCase() || 'U')

// 用户信息弹框与侧边栏菜单同宽(折叠时保持默认自适应宽度)
const userDropdownPopupProps = {
  overlayClassName: 'sidebar-user-dropdown',
  overlayInnerStyle: (trigger: HTMLElement): Record<string, string> =>
    uiStore.sidebarCollapsed ? {} : { width: `${trigger.offsetWidth}px` }
}
</script>

<template>
  <aside class="aside-box" :class="{ 'aside-box--collapsed': uiStore.sidebarCollapsed }">
    <!-- 顶部 Logo 行 -->
    <div v-if="!uiStore.sidebarCollapsed" class="logo-row">
      <div class="logo-box" @click="goHome">
        <t-icon name="check-double" class="logo-icon" />
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
      <div v-for="item in menuItems" :key="item.path" class="menu-group">
        <t-tooltip
          :content="item.title"
          placement="right"
          :disabled="!uiStore.sidebarCollapsed"
        >
          <div
            class="menu-item"
            :class="{ 'menu-item--active': isActive(item) }"
            @click="handleMenuClick(item.path)"
          >
            <div class="menu-icon"><t-icon :name="item.icon" /></div>
            <span v-if="!uiStore.sidebarCollapsed" class="menu-title">{{ item.title }}</span>
          </div>
        </t-tooltip>

        <!-- 任务清单子菜单 -->
        <template v-if="item.path === '/task-lists' && !uiStore.sidebarCollapsed">
          <div
            v-for="child in taskListChildren"
            :key="child.path"
            class="menu-item menu-item--sub"
            :class="{ 'menu-item--active': route.path === child.path }"
            @click="handleMenuClick(child.path)"
          >
            <span class="menu-sub-index">{{ child.seq }}</span>
            <span class="menu-title">{{ child.title }}</span>
            <t-tag v-if="child.isDefault" size="small" variant="light" class="menu-sub-tag">默认</t-tag>
            <t-tag
              v-if="child.executingCount > 0"
              size="small"
              variant="light"
              theme="primary"
              class="menu-sub-tag"
            >{{ child.executingCount }}</t-tag>
          </div>
        </template>
      </div>
    </div>

    <!-- 底部用户区 -->
    <div class="menu-bottom">
      <t-dropdown placement="top-left" trigger="click" :popup-props="userDropdownPopupProps">
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
            <t-dropdown-item @click="showSettingsDialog = true">
              <template #prefix-icon>
                <t-icon name="setting" />
              </template>
              系统设置
            </t-dropdown-item>
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

    <SystemSettingsDialog v-model:visible="showSettingsDialog" />
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
  border-radius: var(--td-radius-default);
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
  border-radius: var(--td-radius-default);
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

/* 任务清单子菜单项 */
.menu-item--sub {
  height: 32px;
  padding: 6px 10px 6px calc(var(--sidebar-inset-x) + var(--sidebar-icon-size) + var(--sidebar-icon-gap));
}

.menu-item--sub .menu-title {
  font-size: 13px;
  font-weight: 400;
}

.menu-sub-tag {
  flex-shrink: 0;
  margin-left: 6px;
}

.menu-sub-index {
  flex-shrink: 0;
  margin-right: 6px;
  font-size: 13px;
  color: var(--td-text-color-secondary);
}

.menu-item--active .menu-sub-index {
  color: var(--td-brand-color);
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
  border-radius: var(--td-radius-default);
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

<!-- 弹框 teleport 到 body,scoped 样式作用不到 -->
<style>
.sidebar-user-dropdown .t-dropdown__menu {
  width: 100%;
}

.sidebar-user-dropdown .t-dropdown__item {
  width: 100%;
  max-width: none !important;
}
</style>
