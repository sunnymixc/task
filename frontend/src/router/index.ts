import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/auth/Login.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/views/auth/Register.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    name: 'Layout',
    component: () => import('@/views/Layout.vue'),
    meta: { requiresAuth: true },
    redirect: '/tasks',
    children: [
      {
        path: 'tasks',
        name: 'TaskList',
        component: () => import('@/views/task/TaskList.vue'),
        meta: { title: '任务列表' }
      }
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    redirect: '/tasks'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Navigation guard for authentication
router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()
  authStore.init()

  const requiresAuth = to.meta.requiresAuth !== false
  const isLoggedIn = authStore.isLoggedIn

  if (requiresAuth && !isLoggedIn) {
    // Redirect to login if trying to access protected route
    next({ name: 'Login', query: { redirect: to.fullPath } })
  } else if ((to.name === 'Login' || to.name === 'Register') && isLoggedIn) {
    // Redirect to tasks if already logged in
    next({ name: 'TaskList' })
  } else {
    next()
  }
})

export default router
