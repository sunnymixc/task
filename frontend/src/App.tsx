import { useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router'
import { useAuthStore } from '@/stores/auth'

export default function App() {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    // 检查登录状态：token 过期则退出并跳转登录页
    const checkAuth = () => {
      const { token, isTokenExpired, logout } = useAuthStore.getState()
      if (!token) {
        return
      }
      if (isTokenExpired()) {
        // 已在登录/注册页则不再跳转，避免循环
        if (location.pathname === '/login' || location.pathname === '/register') {
          return
        }
        logout()
        navigate('/login', { replace: true })
      }
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
