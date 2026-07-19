import { useEffect, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { Tooltip } from '@douyinfe/semi-ui-19'
import { IconApps, IconChevronRight } from '@douyinfe/semi-icons'
import { useUiStore, WORKBENCH_WIDTH_DEFAULT } from '@/stores/ui'
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
  const width = useUiStore((s) => s.workbenchWidth)
  const toggle = useUiStore((s) => s.toggleRightSidebar)
  const setCollapsed = useUiStore((s) => s.setRightSidebarCollapsed)
  const [activeKey, setActiveKey] = useState(panels[0].key)
  const [dragging, setDragging] = useState(false)

  // 拖拽期间禁用全局文本选中;effect cleanup 兜底拖拽中途组件卸载
  useEffect(() => {
    if (!dragging) return
    const prev = document.body.style.userSelect
    document.body.style.userSelect = 'none'
    return () => {
      document.body.style.userSelect = prev
    }
  }, [dragging])

  // 侧栏贴窗口右缘,宽度 = 窗口宽 - 指针 X;setPointerCapture 后 move/up 始终落在手柄上。
  // 不可 preventDefault:取消 pointerdown 会抑制兼容鼠标事件,双击恢复默认宽将失效
  const onHandlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
  }
  const onHandlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return
    useUiStore.getState().setWorkbenchWidth(window.innerWidth - e.clientX)
  }
  const onHandlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return
    e.currentTarget.releasePointerCapture(e.pointerId)
    setDragging(false)
  }

  const activePanel = panels.find((p) => p.key === activeKey) ?? panels[0]

  return (
    <aside
      className={`${styles.asideBox}${collapsed ? ` ${styles.asideBoxCollapsed}` : ''}${
        dragging ? ` ${styles.asideBoxDragging}` : ''
      }`}
      // 收起态保持 CSS 的 48px,展开态由缓存宽度驱动(覆盖样式表默认值)
      style={collapsed ? undefined : { width, minWidth: width }}
    >
      {/* 左缘拖拽手柄:调整宽度,双击恢复默认 */}
      {!collapsed && (
        <div
          className={styles.resizeHandle}
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
          onDoubleClick={() => useUiStore.getState().setWorkbenchWidth(WORKBENCH_WIDTH_DEFAULT)}
        />
      )}

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
      <div className={styles.panelBox} style={{ minWidth: width }}>
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
