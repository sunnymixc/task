import { Button, Space } from '@douyinfe/semi-ui-19'
import type { Task, TaskStatus } from '@/types'

// 每个状态仅保留一个"推进到下一状态"的操作按钮
const statusActions: Record<TaskStatus, { label: string; value: TaskStatus }[]> = {
  draft: [{ label: '确认', value: 'pending' }],
  pending: [{ label: '执行', value: 'executing' }],
  executing: [{ label: '完成', value: 'completed' }],
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
