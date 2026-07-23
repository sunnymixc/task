import { Button, Space } from '@douyinfe/semi-ui-19'
import type { Task, TaskStatus } from '@/types'

// Define available status transitions based on current status
const statusActions: Record<TaskStatus, { label: string; value: TaskStatus }[]> = {
  draft: [
    { label: '确认', value: 'pending' },
    { label: '执行', value: 'executing' }
  ],
  pending: [
    { label: '执行', value: 'executing' },
    { label: '草稿', value: 'draft' }
  ],
  executing: [
    { label: '完成', value: 'completed' },
    { label: '暂停', value: 'pending' }
  ],
  completed: []
}

// 无操作的状态需在父级跳过渲染，避免空容器产生多余间距
export function hasStatusActions(status: TaskStatus): boolean {
  return (statusActions[status] || []).length > 0
}

interface Props {
  task: Task
  onStatusChange: (status: TaskStatus) => void
  size?: 'default' | 'small' | 'large'
}

export default function StatusActions({ task, onStatusChange, size }: Props) {
  const availableActions = statusActions[task.status] || []
  if (!availableActions.length) return null

  return (
    <Space spacing={size === 'small' ? 4 : 8}>
      {availableActions.map((action) => (
        <Button key={action.value} size={size} onClick={() => onStatusChange(action.value)}>
          {action.label}
        </Button>
      ))}
    </Space>
  )
}
