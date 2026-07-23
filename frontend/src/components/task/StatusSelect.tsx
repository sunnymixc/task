import { Select } from '@douyinfe/semi-ui-19'
import { IconChevronDown } from '@douyinfe/semi-icons'
import type { TaskStatus } from '@/types'
import StatusBadge, { statusConfig } from './StatusBadge'

const statusOptions = (Object.keys(statusConfig) as TaskStatus[]).map((value) => ({
  label: statusConfig[value].label,
  value
}))

interface Props {
  status: TaskStatus
  onChange: (status: TaskStatus) => void
}

// 状态列内联下拉框:触发器保留彩色状态标签外观,点开可切换任意状态(后端无流转限制)
export default function StatusSelect({ status, onChange }: Props) {
  return (
    <Select
      value={status}
      optionList={statusOptions}
      onChange={(v) => {
        if (v !== status) onChange(v as TaskStatus)
      }}
      triggerRender={() => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, cursor: 'pointer' }}>
          <StatusBadge status={status} />
          <IconChevronDown size="small" style={{ color: 'var(--semi-color-text-2)' }} />
        </span>
      )}
      dropdownStyle={{ minWidth: 96 }}
    />
  )
}
