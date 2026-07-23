import { Tag } from '@douyinfe/semi-ui-19'
import type { TagColor } from '@douyinfe/semi-ui-19/lib/es/tag'
import type { TaskStatus } from '@/types'

export const statusConfig: Record<TaskStatus, { label: string; color: TagColor }> = {
  draft: { label: '草稿', color: 'grey' },
  pending: { label: '待执行', color: 'orange' },
  executing: { label: '执行中', color: 'blue' },
  completed: { label: '已完成', color: 'green' }
}

export default function StatusBadge({ status }: { status: TaskStatus }) {
  const config = statusConfig[status] ?? { label: status, color: 'grey' as TagColor }
  return (
    <Tag type="solid" color={config.color} shape="circle" style={{ minWidth: 56, textAlign: 'center' }}>
      {config.label}
    </Tag>
  )
}
