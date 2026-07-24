import { useSyncExternalStore } from 'react'
import { Tooltip } from '@douyinfe/semi-ui-19'
import {
  getTerminalStatus,
  subscribeTerminalStatus,
  type TerminalActivityStatus
} from '@/terminal/sessionRegistry'
import styles from './TerminalStatusDot.module.css'

// 订阅某任务 AI 终端的运行状态。全局边沿事件触发时各订阅组件重读快照,
// 快照是原始字符串,值不变则 React 不重渲染 —— 每个圆点独立订阅即可
export function useTerminalStatus(taskId: string): TerminalActivityStatus {
  return useSyncExternalStore(subscribeTerminalStatus, () => getTerminalStatus(taskId))
}

const STATUS_CONFIG: Record<Exclude<TerminalActivityStatus, 'none'>, { tooltip: string; className: string }> = {
  connecting: { tooltip: '终端连接中…', className: styles.connecting },
  running: { tooltip: 'AI 输出中', className: styles.running },
  idle: { tooltip: '终端已连接 · 空闲', className: styles.idle },
  closed: { tooltip: '终端已断开(历史保留)', className: styles.closed }
}

interface Props {
  taskId: string
  // 点击进入该任务的 AI 终端(由调用方决定打开弹窗或切换 tab)
  onClick?: () => void
}

// 任务 AI 终端运行状态圆点:无会话时不渲染
export default function TerminalStatusDot({ taskId, onClick }: Props) {
  const status = useTerminalStatus(taskId)
  if (status === 'none') return null
  const cfg = STATUS_CONFIG[status]
  return (
    <Tooltip content={cfg.tooltip}>
      <span
        className={`${styles.dot} ${cfg.className}${onClick ? ` ${styles.clickable}` : ''}`}
        aria-label={cfg.tooltip}
        onClick={onClick}
      />
    </Tooltip>
  )
}
