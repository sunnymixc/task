<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()

// 检查登录状态：token 过期则退出并跳转登录页
const checkAuth = () => {
  if (!authStore.token) {
    return
  }
  if (authStore.isTokenExpired()) {
    // 已在登录/注册页则不再跳转，避免循环
    if (route.name === 'Login' || route.name === 'Register') {
      return
    }
    authStore.logout()
    router.replace('/login')
  }
}

let intervalId: number | undefined

onMounted(() => {
  // 定时检查登录状态
  intervalId = window.setInterval(checkAuth, 30000)
  // 所有操作点击时检查（捕获阶段，先于元素自身处理器执行）
  document.addEventListener('click', checkAuth, true)
})

onUnmounted(() => {
  if (intervalId !== undefined) {
    clearInterval(intervalId)
  }
  document.removeEventListener('click', checkAuth, true)
})
</script>

<template>
  <router-view />
</template>

<style>
#app {
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}
</style>
