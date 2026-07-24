import { useCallback, useImperativeHandle, useLayoutEffect, useRef, useSyncExternalStore, type Ref } from 'react'
import { Button } from '@douyinfe/semi-ui-19'
import {
  acquireSession,
  fitSession,
  forceReconnectSession,
  getSessionSnapshot,
  isSessionDetached,
  isStolenFrom,
  mountSession,
  subscribeSession,
  terminateSession,
  unmountSession,
  type TermConnState
} from '@/terminal/sessionRegistry'
import {
  getAutoResponderSnapshot,
  stopAutoResponder,
  subscribeAutoResponder
} from '@/terminal/autoResponder'
import styles from './TaskTerminal.module.css'

export interface TaskTerminalHandle {
  // 终止:结束后端 shell 并断开连接(历史保留,可重连);组件卸载不再销毁会话
  terminate: () => void
}

interface Props {
  // 会话标识,当前为 task.id:每个任务一个独立的常驻终端会话
  sessionKey: string
  // 初始工作目录(所属清单的项目路径,空路径时传 '~')
  cwd?: string
  ref?: Ref<TaskTerminalHandle>
}

// 终端本体(xterm + WebSocket + DOM 节点)常驻在 sessionRegistry 中,本组件只负责:
// 挂载时把常驻 DOM 搬进来、卸载时搬回去,以及渲染状态栏。
export default function TaskTerminal({ sessionKey, cwd, ref }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  // 稳定的实例标识,用于向注册表声明 host 的所有权
  const ownerRef = useRef({})

  // subscribe 可能是会话的创建者(先于挂载 effect 执行),cwd 必须在此传入
  const subscribe = useCallback(
    (cb: () => void) => subscribeSession(sessionKey, cb, cwd),
    [sessionKey, cwd]
  )
  // 快照形如 "open|3":连接状态 + 所有权序号,任一变化都触发重渲染
  const snapshot = useSyncExternalStore(subscribe, () => getSessionSnapshot(sessionKey))
  const state = snapshot.split('|')[0] as TermConnState
  const stolen = isStolenFrom(sessionKey, ownerRef.current)
  // 抢占方卸载后 host 游离(owner=null,与 stolen 互斥),显示「恢复」入口
  const detached = isSessionDetached(sessionKey)

  // 自动应答器状态(module 级 per-key 单例,双面板同开时两处状态天然同步)
  const autoSubscribe = useCallback(
    (cb: () => void) => subscribeAutoResponder(sessionKey, cb),
    [sessionKey]
  )
  const autoSnap = useSyncExternalStore(autoSubscribe, () => getAutoResponderSnapshot(sessionKey))
  const [autoActive, answeredCount] = autoSnap.split('|')

  const attach = useCallback(() => {
    if (!containerRef.current) return
    acquireSession(sessionKey, cwd)
    mountSession(sessionKey, containerRef.current, ownerRef.current, cwd)
  }, [sessionKey, cwd])

  // useLayoutEffect:attach 在浏览器绘制前完成,mountSession 的 notify 同步触发重渲染,
  // 避免首帧(subscribe 已建会话但尚未挂载,owner=null)闪现假阳性的「恢复」覆盖层
  useLayoutEffect(() => {
    const owner = ownerRef.current
    attach()

    // 容器尺寸变化 → 重新 fit 并通知后端调整 PTY 窗口大小
    const ro = new ResizeObserver(() => fitSession(sessionKey))
    if (containerRef.current) ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      // 只摘 DOM,不销毁会话
      unmountSession(sessionKey, owner)
    }
  }, [sessionKey, attach])

  useImperativeHandle(ref, () => ({
    terminate: () => terminateSession(sessionKey)
  }))

  return (
    <div className={styles.wrapper}>
      <div className={styles.statusBar}>
        <span className={`${styles.dot} ${styles[state]}`} />
        <span className={styles.statusText}>
          {state === 'connecting' ? '连接中…' : state === 'open' ? '已连接 (root)' : '已断开'}
        </span>
        {state === 'closed' && (
          <Button size="small" theme="borderless" onClick={() => forceReconnectSession(sessionKey, cwd)}>
            重连
          </Button>
        )}
        {autoActive === 'true' && (
          <>
            <span className={styles.autoTag}>
              自动执行中{Number(answeredCount) > 0 ? ` · 已应答 ${answeredCount}` : ''}
            </span>
            <Button size="small" theme="borderless" onClick={() => stopAutoResponder(sessionKey)}>
              停止自动
            </Button>
          </>
        )}
      </div>
      <div className={styles.term} ref={containerRef} />
      {/* host 被其他面板抢占(stolen)或抢占方已卸载致 host 游离(detached)时,
          本处容器为空,覆盖提示与取回/恢复入口;两态互斥,共用同一覆盖层 */}
      {(stolen || detached) && (
        <div className={styles.stolenHint}>
          <span>{stolen ? '终端已在其他面板打开' : '终端已从此面板移出'}</span>
          <Button size="small" onClick={attach}>
            {stolen ? '移到此处' : '恢复'}
          </Button>
        </div>
      )}
    </div>
  )
}
