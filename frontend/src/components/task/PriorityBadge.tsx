import { Tag } from '@douyinfe/semi-ui-19'
import type { TagColor } from '@douyinfe/semi-ui-19/lib/es/tag'
import type { TaskPriority } from '@/types'

const priorityConfig: Record<TaskPriority, { label: string; color: TagColor }> = {
  high: { label: '高', color: 'red' },
  medium: { label: '中', color: 'orange' },
  low: { label: '低', color: 'green' }
}

export default function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const config = priorityConfig[priority] ?? { label: priority, color: 'grey' as TagColor }
  return <Tag color={config.color}>{config.label}</Tag>
}
