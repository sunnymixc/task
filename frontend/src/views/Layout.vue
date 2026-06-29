<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const handleLogout = () => {
  authStore.logout()
  router.push('/login')
}
</script>

<template>
  <div class="layout-container">
    <t-layout>
      <!-- Header -->
      <t-layout class="header">
        <div class="header-content">
          <div class="logo">任务管理</div>
          <div class="user-info">
            <t-dropdown>
              <t-button variant="text">
                <template #icon>
                  <t-avatar :image="authStore.user?.avatar || ''">
                    {{ authStore.userName?.charAt(0) || 'U' }}
                  </t-avatar>
                </template>
                <span class="username">{{ authStore.userName }}</span>
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
              </t-button>
            </t-dropdown>
          </div>
        </div>
      </t-layout>

      <!-- Main Content -->
      <t-layout class="main-content">
        <router-view />
      </t-layout>
    </t-layout>
  </div>
</template>

<style scoped>
.layout-container {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.header {
  background: white;
  border-bottom: 1px solid #e7e7e7;
  padding: 0 24px;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 64px;
}

.logo {
  font-size: 20px;
  font-weight: 600;
  color: #0052d9;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.username {
  font-size: 14px;
  color: #333;
}

.user-email {
  font-size: 12px;
  color: #999;
  padding: 4px 12px;
}

.main-content {
  flex: 1;
  overflow: auto;
  background: #f3f3f3;
}
</style>
