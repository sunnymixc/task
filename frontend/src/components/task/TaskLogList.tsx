import { useEffect, useState } from 'react'
import { Spin, Timeline } from '@douyinfe/semi-ui-19'
import type { TaskLog } from '@/types'
import { taskAPI } from '@/api/task'
import styles from './TaskLogList.module.css'

// 字段名 → 中文标签(与基础表单的措辞一致)
const fieldLabels: Record<string, string> = {
  title: '标题',
  description: '描述',
  result: '结果',
  status: '任务状态',
  execution_status: '执行状态',
  execution_plan: '执行计划',
  execution_log: '执行日志',
  execution_result: '执行结果',
  priority: '优先级',
  task_list_id: '任务清单',
  due_date: '截止日期'
}

// 枚举 wire 值 → 中文(status/execution_status/priority 之外的字段原样展示)
const enumLabels: Record<string, Record<string, string>> = {
  status: { draft: '草稿', pending: '待执行', executing: '执行中', completed: '已完成' },
  execution_status: { unplanned: '未计划', planning: '计划中', planned: '已计划', working: '工作中', completed: '已完成' },
  priority: { high: '高', medium: '中', low: '低' }
}

const actionText = (log: TaskLog) => {
  switch (log.action) {
    case 'create':
      return '创建了任务'
    case 'delete':
      return '删除了任务'
    default:
      return `修改了「${fieldLabels[log.field_name] ?? log.field_name}」`
  }
}

const MAX_VALUE_LEN = 120

// 变更值展示:空值占位、枚举翻译、长文本截断(完整内容走 title 提示)
const displayValue = (log: TaskLog, value: string) => {
  if (!value) return '（空）'
  const mapped = enumLabels[log.field_name]?.[value] ?? value
  return mapped.length > MAX_VALUE_LEN ? mapped.slice(0, MAX_VALUE_LEN) + '…' : mapped
}

const fullValue = (log: TaskLog, value: string) => enumLabels[log.field_name]?.[value] ?? value

const formatTime = (dateString: string) => {
  return new Date(dateString).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export default function TaskLogList({ taskId }: { taskId: string }) {
  const [logs, setLogs] = useState<TaskLog[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    taskAPI
      .listLogs(taskId, { page: 1, page_size: 200 })
      .then((res) => {
        if (!cancelled) setLogs(res.data || [])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [taskId])

  return (
    <Spin spinning={loading} size="small">
      <div className={styles.list}>
        {!loading && logs.length === 0 ? (
          <div className={styles.empty}>暂无日志</div>
        ) : (
          <Timeline>
            {logs.map((log) => (
              <Timeline.Item key={log.id} time={formatTime(log.created_at)}>
                <div className={styles.line}>
                  <span className={styles.operator}>{log.operator?.username || '-'}</span>
                  <span>{actionText(log)}</span>
                </div>
                {(log.action === 'update' || log.action === 'status_change') && (
                  <div className={styles.diff}>
                    <span className={styles.old} title={fullValue(log, log.old_value)}>
                      {displayValue(log, log.old_value)}
                    </span>
                    <span className={styles.arrow}>→</span>
                    <span className={styles.new} title={fullValue(log, log.new_value)}>
                      {displayValue(log, log.new_value)}
                    </span>
                  </div>
                )}
              </Timeline.Item>
            ))}
          </Timeline>
        )}
      </div>
    </Spin>
  )
}
