import { lazy, Suspense, type ComponentType, type ReactNode } from 'react'
import { createBrowserRouter, Navigate, useLocation } from 'react-router'
import App from '@/App'
import Layout from '@/views/Layout'
import { useAuthStore } from '@/stores/auth'

// 登录守卫：未登录访问受保护路由则跳登录页并携带 redirect
function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation()
  const token = useAuthStore((s) => s.token)
  if (!token) {
    const redirect = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?redirect=${redirect}`} replace />
  }
  return children
}

// 已登录访问登录/注册页则跳任务列表
function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const token = useAuthStore((s) => s.token)
  if (token) {
    return <Navigate to="/tasks" replace />
  }
  return children
}

const lazyEl = (factory: () => Promise<{ default: ComponentType }>) => {
  const Comp = lazy(factory)
  return (
    <Suspense fallback={null}>
      <Comp />
    </Suspense>
  )
}

const router = createBrowserRouter([
  {
    element: <App />,
    children: [
      {
        path: '/login',
        element: <RedirectIfAuthed>{lazyEl(() => import('@/views/auth/Login'))}</RedirectIfAuthed>
      },
      {
        path: '/register',
        element: <RedirectIfAuthed>{lazyEl(() => import('@/views/auth/Register'))}</RedirectIfAuthed>
      },
      {
        path: '/',
        element: (
          <RequireAuth>
            <Layout />
          </RequireAuth>
        ),
        children: [
          { index: true, element: <Navigate to="/tasks" replace /> },
          { path: 'tasks', element: lazyEl(() => import('@/views/task/TaskList')) },
          { path: 'tasks/:id', element: lazyEl(() => import('@/views/task/TaskDetail')) },
          { path: 'task-lists', element: lazyEl(() => import('@/views/task-list/TaskListManage')) },
          // 复用任务列表视图，组件内通过 useParams 的 listId 区分清单范围
          { path: 'task-lists/:listId/tasks', element: lazyEl(() => import('@/views/task/TaskList')) }
        ]
      },
      { path: '*', element: <Navigate to="/tasks" replace /> }
    ]
  }
])

export default router
