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

/* 固定视口布局（#app 100vh + 内部滚动），body 层面不允许出现页面滚动条 */
html,
body {
  height: 100%;
  overflow: hidden;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

/* t-dialog：header/body/footer 统一增加内边距，避免内部控件的 focus 阴影被 overflow 截断 */
.t-dialog .t-dialog__header,
.t-dialog .t-dialog__body,
.t-dialog .t-dialog__footer {
  padding: var(--td-comp-paddingTB-l) var(--td-comp-paddingLR-xs);
}
</style>
