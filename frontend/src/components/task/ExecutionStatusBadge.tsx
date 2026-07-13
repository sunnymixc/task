import { Tag } from '@douyinfe/semi-ui-19'
import type { TagColor } from '@douyinfe/semi-ui-19/lib/es/tag'
import type { TaskExecutionStatus } from '@/types'

const statusConfig: Record<TaskExecutionStatus, { label: string; color: TagColor }> = {
  unplanned: { label: '未计划', color: 'grey' },
  planning: { label: '计划中', color: 'orange' },
  planned: { label: '已计划', color: 'blue' },
  working: { label: '工作中', color: 'blue' },
  completed: { label: '已完成', color: 'green' }
}

export default function ExecutionStatusBadge({ status }: { status: TaskExecutionStatus }) {
  const config = statusConfig[status] ?? { label: status, color: 'grey' as TagColor }
  return <Tag color={config.color}>{config.label}</Tag>
}
