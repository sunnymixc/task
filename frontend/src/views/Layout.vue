<script setup lang="ts">
import { onMounted } from 'vue'
import Sidebar from '@/components/layout/Sidebar.vue'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'

const authStore = useAuthStore()
const uiStore = useUiStore()

// 刷新用户信息（is_admin 可能被迁移回填而 localStorage 里的是旧值）并加载服务端系统设置
onMounted(() => {
  authStore.fetchUserInfo()
  uiStore.fetchSystemSettings()
})
</script>

<template>
  <div class="layout-root">
    <Sidebar />
    <div class="layout-outlet">
      <router-view />
    </div>
  </div>
</template>

<style scoped>
.layout-root {
  display: flex;
  align-items: stretch;
  width: 100%;
  height: 100vh;
  background: var(--td-bg-color-container);
}

.layout-outlet {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--td-bg-color-page);
}
</style>
