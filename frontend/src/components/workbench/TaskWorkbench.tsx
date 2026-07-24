import { useEffect, useRef } from 'react'
import { Button, Space, Spin, Tag, Toast, Tooltip } from '@douyinfe/semi-ui-19'
import { IconChevronDown, IconChevronUp, IconInfoCircle } from '@douyinfe/semi-icons'
import { useWorkbenchStore } from '@/stores/workbench'
import { useTaskStore } from '@/stores/task'
import type { Task, UpdateTaskRequest } from '@/types'
import TaskForm, { type TaskFormHandle } from '@/components/task/TaskForm'
import StatusSelect from '@/components/task/StatusSelect'
import TerminalStatusDot from '@/components/task/TerminalStatusDot'
import { copyToClipboard } from '@/utils/clipboard'
import styles from './TaskWorkbench.module.css'

// 任务工作台:垂直平铺的任务面板列表,每个面板复用 TaskForm(任务窗口组件)。
export default function TaskWorkbench() {
  const tasks = useWorkbenchStore((s) => s.tasks)
  const loading = useWorkbenchStore((s) => s.loading)
  const scrollTargetId = useWorkbenchStore((s) => s.scrollTargetId)

  const panelRefs = useRef(new Map<string, HTMLDivElement>())
  const formRefs = useRef(new Map<string, TaskFormHandle>())

  // 已折叠面板的任务 id;按用户按任务落库,由 store 在 fetch 时初始化、toggle 时持久化
  const collapsedIds = useWorkbenchStore((s) => s.collapsedIds)

  // 加入任务后滚动到对应面板;延迟等待右栏 0.25s 展开动画结束后再测量位置
  useEffect(() => {
    if (!scrollTargetId) return
    // 定位目标若处于折叠态则先展开(同样持久化),再滚动
    const store = useWorkbenchStore.getState()
    if (store.collapsedIds.has(scrollTargetId)) {
      store.setCollapsed(scrollTargetId, false)
    }
    const timer = setTimeout(() => {
      panelRefs.current.get(scrollTargetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      // 滚动后清空目标,同一任务再次加入时 null → id 的变化能再次触发本效果
      useWorkbenchStore.getState().clearScrollTarget()
    }, 260)
    return () => clearTimeout(timer)
  }, [scrollTargetId])

  // 保存走 task store:自带成功/失败 Toast、任务列表行与清单计数刷新,
  // 并经 task.ts 的钩子回写本 store 副本(updated_at 变化触发面板重挂载取新值)
  const handleSave = (id: string, data: UpdateTaskRequest) => {
    void useTaskStore.getState().updateTask(id, data)
  }

  // 与任务列表操作列一致的拷贝逻辑:复制已保存的标题+描述(两个换行分隔)
  const handleCopyTask = async (task: Task) => {
    const text = task.description ? `${task.title}\n\n${task.description}` : task.title
    try {
      await copyToClipboard(text)
      Toast.success('已复制到剪贴板')
    } catch {
      Toast.error('复制失败')
    }
  }

  if (!tasks.length) {
    return (
      <div className={styles.emptyState}>
        {loading ? (
          <Spin size="large" />
        ) : (
          <>
            <IconInfoCircle style={{ fontSize: 40 }} />
            <p>暂无任务，点击「工作」添加</p>
          </>
        )}
      </div>
    )
  }

  return (
    <div className={styles.stack}>
      {tasks.map((task) => {
        const collapsed = collapsedIds.has(task.id)
        return (
          <div
            key={task.id}
            className={styles.panel}
            ref={(el) => {
              if (el) panelRefs.current.set(task.id, el)
              else panelRefs.current.delete(task.id)
            }}
          >
            <div className={collapsed ? `${styles.panelHeader} ${styles.panelHeaderCollapsed}` : styles.panelHeader}>
              <StatusSelect
                status={task.status}
                onChange={(status) => void useTaskStore.getState().updateStatus(task.id, status)}
              />
              {task.task_list?.title && (
                <span className={styles.listTag} title={task.task_list.title}>
                  <Tag color="grey" style={{ maxWidth: '100%' }}>
                    {task.task_list.title}
                  </Tag>
                </span>
              )}
              <TerminalStatusDot
                taskId={task.id}
                onClick={() => {
                  // 展开面板并切到 AI终端 tab
                  useWorkbenchStore.getState().setCollapsed(task.id, false)
                  formRefs.current.get(task.id)?.showTerminalTab()
                }}
              />
              <span className={styles.panelTitle} title={task.title}>
                {task.title}
              </span>
              <Space spacing={4} wrap className={styles.panelActions}>
                <Button size="small" onClick={() => handleCopyTask(task)}>
                  拷贝
                </Button>
                <Button size="small" type="primary" onClick={() => formRefs.current.get(task.id)?.save()}>
                  保存
                </Button>
                <Button size="small" onClick={() => useWorkbenchStore.getState().removeTask(task.id)}>
                  移除
                </Button>
                <Tooltip content={collapsed ? '展开' : '折叠'}>
                  <div className={styles.panelToggle} onClick={() => useWorkbenchStore.getState().toggleCollapsed(task.id)}>
                    {collapsed ? <IconChevronDown /> : <IconChevronUp />}
                  </div>
                </Tooltip>
              </Space>
            </div>
            {/* 折叠时仅隐藏不卸载,保留 TaskForm 未保存的编辑 */}
            <div className={collapsed ? `${styles.panelBody} ${styles.panelBodyCollapsed}` : styles.panelBody}>
              {/* key 含 updated_at:任务在他处保存后面板重挂载取最新数据(未保存的面板编辑随之丢弃,预期行为) */}
              <TaskForm
                key={`${task.id}:${task.updated_at}`}
                ref={(h) => {
                  if (h) formRefs.current.set(task.id, h)
                  else formRefs.current.delete(task.id)
                }}
                task={task}
                onSubmit={(data) => handleSave(task.id, data as UpdateTaskRequest)}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
