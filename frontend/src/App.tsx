import { useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router'
import { useAuthStore } from '@/stores/auth'
import { useRefreshShortcutListener } from '@/hooks/useRefreshShortcut'

export default function App() {
  const navigate = useNavigate()
  const location = useLocation()

  // 全局拦截浏览器刷新快捷键(Cmd/Ctrl+R、F5),改为应用内刷新
  useRefreshShortcutListener()

  useEffect(() => {
    // 检查登录状态：token 过期先用 refresh token 静默续期，续期失败才退出并跳转登录页
    const checkAuth = () => {
      const { token, isTokenExpired, isRefreshing, refreshAccessToken } = useAuthStore.getState()
      if (!token || isRefreshing || !isTokenExpired()) {
        return
      }
      // 已在登录/注册页则不再跳转，避免循环
      if (location.pathname === '/login' || location.pathname === '/register') {
        return
      }
      refreshAccessToken().then((ok) => {
        if (!ok) {
          // 刷新失败时 refreshAccessToken 内部已 logout；无 refresh token 的旧会话在此兜底
          const { token: current, logout } = useAuthStore.getState()
          if (current) {
            logout()
          }
          navigate('/login', { replace: true })
        }
      })
    }

    // 定时检查登录状态；所有操作点击时检查（捕获阶段，先于元素自身处理器执行）
    const intervalId = window.setInterval(checkAuth, 30000)
    document.addEventListener('click', checkAuth, true)
    return () => {
      clearInterval(intervalId)
      document.removeEventListener('click', checkAuth, true)
    }
  }, [location.pathname, navigate])

  return <Outlet />
}
