import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Avatar, Button, Card, Spin } from '@douyinfe/semi-ui-19'
import { IconArrowLeft, IconInfoCircle } from '@douyinfe/semi-icons'
import type { Task } from '@/types'
import { taskAPI } from '@/api/task'
import StatusBadge from '@/components/task/StatusBadge'
import PriorityBadge from '@/components/task/PriorityBadge'
import TaskLinkList from '@/components/task/TaskLinkList'
import styles from './TaskDetail.module.css'

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export default function TaskDetail() {
  const { id: taskId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [task, setTask] = useState<Task | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)

  // 直接走 API 不进 store:详情页只读,失败时本地降级为空态
  // 详情页内打开另一个任务详情(同窗口路由跳转)时复用组件实例,依赖 taskId 重取
  useEffect(() => {
    if (!taskId) return
    let cancelled = false
    setLoading(true)
    setLoadFailed(false)
    taskAPI
      .getById(taskId)
      .then((t) => {
        if (!cancelled) setTask(t)
      })
      .catch(() => {
        if (!cancelled) {
          setTask(null)
          setLoadFailed(true)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [taskId])

  const goBack = () => {
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate('/tasks')
    }
  }

  return (
    <div className={styles.container}>
      <Spin spinning={loading}>
        {task ? (
          <>
            <div className={styles.pageHeader}>
              <Button theme="borderless" icon={<IconArrowLeft />} onClick={goBack} />
              <div className={styles.title}>{task.title}</div>
              <StatusBadge status={task.status} />
              <PriorityBadge priority={task.priority} />
            </div>

            <Card bordered={false} className={styles.detailCard}>
              <div className={styles.metaGrid}>
                <div>
                  <div className={styles.metaLabel}>序号</div>
                  <div className={styles.metaValue}>{task.sort_order > 0 ? task.sort_order : '-'}</div>
                </div>
                <div>
                  <div className={styles.metaLabel}>任务清单</div>
                  <div className={styles.metaValue}>{task.task_list?.title || '-'}</div>
                </div>
                <div>
                  <div className={styles.metaLabel}>创建者</div>
                  <div className={`${styles.metaValue} ${styles.creatorInfo}`}>
                    <Avatar size="extra-small" src={task.creator?.avatar || undefined}>
                      {task.creator?.username?.charAt(0) || 'U'}
                    </Avatar>
                    <span>{task.creator?.username || '-'}</span>
                  </div>
                </div>
                <div>
                  <div className={styles.metaLabel}>截止时间</div>
                  <div className={styles.metaValue}>{task.due_date ? formatDate(task.due_date) : '-'}</div>
                </div>
                <div>
                  <div className={styles.metaLabel}>创建时间</div>
                  <div className={styles.metaValue}>{formatDate(task.created_at)}</div>
                </div>
                <div>
                  <div className={styles.metaLabel}>更新时间</div>
                  <div className={styles.metaValue}>{formatDate(task.updated_at)}</div>
                </div>
              </div>

              <div className={styles.section}>
                <div className={styles.sectionTitle}>描述</div>
                <div className={styles.description}>{task.description || '-'}</div>
              </div>

              <div className={styles.section}>
                <div className={styles.sectionTitle}>结果</div>
                <div className={styles.description}>{task.result || '-'}</div>
              </div>

              <div className={styles.section}>
                <div className={styles.sectionTitle}>链接</div>
                <TaskLinkList links={task.links} />
              </div>
            </Card>
          </>
        ) : loadFailed ? (
          <div className={styles.emptyState}>
            <IconInfoCircle style={{ fontSize: 48 }} />
            <p>任务不存在或已被删除</p>
            <Button type="primary" onClick={() => navigate('/tasks')}>
              返回任务列表
            </Button>
          </div>
        ) : null}
      </Spin>
    </div>
  )
}
