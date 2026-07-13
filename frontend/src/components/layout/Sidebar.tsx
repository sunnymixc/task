import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { Avatar, Dropdown, Tag, Tooltip } from '@douyinfe/semi-ui-19'
import {
  IconChevronLeft,
  IconChevronRight,
  IconChevronUp,
  IconExit,
  IconListView,
  IconOrderedList,
  IconSetting
} from '@douyinfe/semi-icons'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { useTaskListStore } from '@/stores/taskList'
import SystemSettingsDialog from '@/components/settings/SystemSettingsDialog'
import Logo from '@/components/common/Logo'
import styles from './Sidebar.module.css'

interface MenuItem {
  title: string
  icon: ReactNode
  path: string
}

const menuItems: MenuItem[] = [
  { title: '任务列表', icon: <IconListView />, path: '/tasks' },
  { title: '任务清单', icon: <IconOrderedList />, path: '/task-lists' }
]

// 折叠态下菜单项加右侧 Tooltip，展开态直接渲染
function CollapsedTooltip({ enabled, content, children }: { enabled: boolean; content: string; children: ReactNode }) {
  if (!enabled) return children
  return (
    <Tooltip content={content} position="right">
      {children}
    </Tooltip>
  )
}

export default function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const collapsed = useUiStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)
  const allLists = useTaskListStore((s) => s.allLists)

  const [showSettingsDialog, setShowSettingsDialog] = useState(false)

  // 任务清单子菜单(每个清单一项)
  const taskListChildren = useMemo(
    () =>
      allLists.map((list, index) => ({
        seq: index + 1, // 纯展示序号,按侧边栏显示顺序编号
        title: list.title,
        path: `/task-lists/${list.id}/tasks`,
        isDefault: list.is_default,
        executingCount: list.executing_count || 0
      })),
    [allLists]
  )

  const isActive = (item: MenuItem) =>
    location.pathname === item.path || location.pathname.startsWith(item.path + '/')

  useEffect(() => {
    useTaskListStore.getState().fetchAllLists()
  }, [])

  const handleMenuClick = (path: string) => {
    if (location.pathname !== path) {
      navigate(path)
    }
  }

  const handleLogout = () => {
    useAuthStore.getState().logout()
    navigate('/login')
  }

  const userName = user?.username || ''
  const avatarText = userName.charAt(0)?.toUpperCase() || 'U'

  // 用户信息弹框与侧边栏菜单同宽(折叠时保持默认自适应宽度)；打开时量取触发器宽度
  const [dropdownWidth, setDropdownWidth] = useState<number | undefined>(undefined)
  const handleDropdownVisible = (visible: boolean) => {
    if (visible && !collapsed) {
      const box = document.getElementById('sidebar-user-box')
      setDropdownWidth(box ? box.offsetWidth : undefined)
    } else if (collapsed) {
      setDropdownWidth(undefined)
    }
  }

  const asideClass = collapsed ? `${styles.asideBox} ${styles.asideBoxCollapsed}` : styles.asideBox

  return (
    <aside className={asideClass}>
      {/* 顶部 Logo 行 */}
      {!collapsed ? (
        <div className={styles.logoRow}>
          <div className={styles.logoBox} onClick={() => navigate('/tasks')}>
            <Logo />
          </div>
          <div className={styles.sidebarToggle} onClick={toggleSidebar}>
            <IconChevronLeft />
          </div>
        </div>
      ) : (
        <Tooltip content="展开侧边栏" position="right">
          <div className={`${styles.menuItem} ${styles.sidebarToggleCollapsed}`} onClick={toggleSidebar}>
            <div className={styles.menuIcon}>
              <IconChevronRight />
            </div>
          </div>
        </Tooltip>
      )}

      {/* 中部菜单区 */}
      <div className={styles.menuTop}>
        {menuItems.map((item) => (
          <div key={item.path} className={styles.menuGroup}>
            <CollapsedTooltip enabled={collapsed} content={item.title}>
              <div
                className={`${styles.menuItem} ${isActive(item) ? styles.menuItemActive : ''}`}
                onClick={() => handleMenuClick(item.path)}
              >
                <div className={styles.menuIcon}>{item.icon}</div>
                {!collapsed && <span className={styles.menuTitle}>{item.title}</span>}
              </div>
            </CollapsedTooltip>

            {/* 任务清单子菜单 */}
            {item.path === '/task-lists' &&
              taskListChildren.map((child) => (
                <CollapsedTooltip key={child.path} enabled={collapsed} content={child.title}>
                  <div
                    className={`${styles.menuItem} ${styles.menuItemSub} ${
                      location.pathname === child.path ? styles.menuItemActive : ''
                    }`}
                    onClick={() => handleMenuClick(child.path)}
                  >
                    {collapsed ? (
                      <span className={styles.menuSubInitial}>{child.title.charAt(0)}</span>
                    ) : (
                      <>
                        <span className={styles.menuSubIndex}>{child.seq}</span>
                        <span className={styles.menuTitle}>{child.title}</span>
                        {child.isDefault && (
                          <Tag size="small" color="grey" className={styles.menuSubTag}>
                            默认
                          </Tag>
                        )}
                        {child.executingCount > 0 && (
                          <Tag size="small" color="blue" className={styles.menuSubTag}>
                            {child.executingCount}
                          </Tag>
                        )}
                      </>
                    )}
                  </div>
                </CollapsedTooltip>
              ))}
          </div>
        ))}
      </div>

      {/* 底部用户区 */}
      <div className={styles.menuBottom}>
        <Dropdown
          trigger="click"
          position="topLeft"
          onVisibleChange={handleDropdownVisible}
          render={
            <Dropdown.Menu className="sidebar-user-dropdown" style={dropdownWidth ? { width: dropdownWidth } : undefined}>
              <Dropdown.Item>
                <div className={styles.userEmail}>{user?.email || ''}</div>
              </Dropdown.Item>
              <Dropdown.Divider />
              <Dropdown.Item icon={<IconSetting />} onClick={() => setShowSettingsDialog(true)}>
                系统设置
              </Dropdown.Item>
              <Dropdown.Item icon={<IconExit />} onClick={handleLogout}>
                退出登录
              </Dropdown.Item>
            </Dropdown.Menu>
          }
        >
          <div
            id="sidebar-user-box"
            className={collapsed ? `${styles.userBox} ${styles.userBoxCollapsed}` : styles.userBox}
          >
            <Avatar size="small" src={user?.avatar || undefined}>
              {avatarText}
            </Avatar>
            {!collapsed && <span className={styles.userName}>{userName}</span>}
            {!collapsed && <IconChevronUp className={styles.userCaret} />}
          </div>
        </Dropdown>
      </div>

      <SystemSettingsDialog visible={showSettingsDialog} onClose={() => setShowSettingsDialog(false)} />
    </aside>
  )
}
