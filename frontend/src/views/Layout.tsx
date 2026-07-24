import { useEffect } from 'react'
import { Outlet } from 'react-router'
import Sidebar from '@/components/layout/Sidebar'
import RightSidebar from '@/components/layout/RightSidebar'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { useWorkbenchStore } from '@/stores/workbench'
import styles from './Layout.module.css'

export default function Layout() {
  // 刷新用户信息（is_admin 可能被迁移回填而 localStorage 里的是旧值）并加载服务端系统设置;
  // 工作台清单整体拉取(整体替换,顺带覆盖切换账号的残留)
  useEffect(() => {
    useAuthStore.getState().fetchUserInfo()
    useUiStore.getState().fetchSystemSettings()
    useWorkbenchStore.getState().fetchWorkbench()
  }, [])

  return (
    <div className={styles.layoutRoot}>
      <Sidebar />
      <div className={styles.layoutOutlet}>
        <Outlet />
      </div>
      <RightSidebar />
    </div>
  )
}
