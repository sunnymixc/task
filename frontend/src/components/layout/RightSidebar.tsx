import { useState, type ReactNode } from 'react'
import { Tooltip } from '@douyinfe/semi-ui-19'
import { IconApps, IconChevronRight } from '@douyinfe/semi-icons'
import { useUiStore } from '@/stores/ui'
import TaskWorkbench from '@/components/workbench/TaskWorkbench'
import styles from './RightSidebar.module.css'

// 右侧工作台栏的面板定义。将来新增工作台组件 = 在 panels 数组加一项;
// panels.length > 1 时收起态竖条按面板逐个渲染图标,展开态头部可升级为 Tabs。
interface SidePanelDef {
  key: string
  title: string
  icon: ReactNode
  render: () => ReactNode
}

const panels: SidePanelDef[] = [
  {
    key: 'task-workbench',
    title: '任务工作台',
    icon: <IconApps />,
    render: () => <TaskWorkbench />
  }
]

export default function RightSidebar() {
  const collapsed = useUiStore((s) => s.rightSidebarCollapsed)
  const toggle = useUiStore((s) => s.toggleRightSidebar)
  const setCollapsed = useUiStore((s) => s.setRightSidebarCollapsed)
  const [activeKey, setActiveKey] = useState(panels[0].key)

  const activePanel = panels.find((p) => p.key === activeKey) ?? panels[0]

  return (
    <aside className={`${styles.asideBox}${collapsed ? ` ${styles.asideBoxCollapsed}` : ''}`}>
      {/* 收起态:竖条,每个面板一个展开入口 */}
      <div className={styles.railBox}>
        {panels.map((panel) => (
          <Tooltip key={panel.key} content={panel.title} position="left">
            <div
              className={styles.railItem}
              onClick={() => {
                setActiveKey(panel.key)
                setCollapsed(false)
              }}
            >
              {panel.icon}
            </div>
          </Tooltip>
        ))}
      </div>

      {/* 展开态:头部 + 面板主体。收起时仅 CSS 隐藏不卸载,保留面板中未保存的编辑 */}
      <div className={styles.panelBox}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}>{activePanel.title}</span>
          <Tooltip content="收起工作台" position="left">
            <div className={styles.collapseToggle} onClick={toggle}>
              <IconChevronRight />
            </div>
          </Tooltip>
        </div>
        <div className={styles.panelBody}>{activePanel.render()}</div>
      </div>
    </aside>
  )
}
