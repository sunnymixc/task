import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { useAuthStore } from '@/stores/auth'
import styles from './TaskTerminal.module.css'

export interface TaskTerminalHandle {
  // 终止:通知后端结束会话并关闭连接(卸载组件时的 cleanup 也会做同样的事)
  terminate: () => void
}

interface Props {
  ref?: Ref<TaskTerminalHandle>
}

type ConnState = 'connecting' | 'open' | 'closed'

export default function TaskTerminal({ ref }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const [state, setState] = useState<ConnState>('connecting')

  // 键盘输入走二进制帧,控制消息(resize/terminate)走文本 JSON 帧,两者分离避免歧义
  const sendResize = () => {
    const term = termRef.current
    const ws = wsRef.current
    if (!term || !ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
  }

  const doFit = () => {
    try {
      fitRef.current?.fit()
    } catch {
      // 容器尚无尺寸时 fit 会抛错,忽略
    }
    sendResize()
  }

  useEffect(() => {
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'Menlo, Consolas, "DejaVu Sans Mono", monospace',
      theme: { background: '#1e1e1e', foreground: '#d4d4d4' },
      scrollback: 5000
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    termRef.current = term
    fitRef.current = fit
    if (containerRef.current) {
      term.open(containerRef.current)
    }
    // 挂载后等 Modal 布局稳定再 fit
    const fitTimer = window.setTimeout(doFit, 50)

    // token 通过 Sec-WebSocket-Protocol 子协议传递(浏览器 WebSocket 无法设置 Authorization 头,
    // 且子协议不会进后端访问日志);https 页面用 wss
    const token = localStorage.getItem('task_token') || useAuthStore.getState().token
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const url = `${proto}://${window.location.host}/api/v1/terminal/ws`
    const ws = token ? new WebSocket(url, [token]) : new WebSocket(url)
    ws.binaryType = 'arraybuffer'
    wsRef.current = ws

    ws.onopen = () => {
      setState('open')
      term.focus()
      doFit()
    }
    ws.onmessage = (ev) => {
      if (typeof ev.data === 'string') {
        term.write(ev.data)
      } else {
        term.write(new Uint8Array(ev.data as ArrayBuffer))
      }
    }
    ws.onclose = () => {
      setState('closed')
      term.write('\r\n\x1b[33m[连接已关闭]\x1b[0m\r\n')
    }

    const encoder = new TextEncoder()
    const dataDisp = term.onData((d) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(encoder.encode(d))
      }
    })

    // 容器尺寸变化 → 重新 fit 并通知后端调整 PTY 窗口大小
    const ro = new ResizeObserver(() => doFit())
    if (containerRef.current) ro.observe(containerRef.current)

    return () => {
      window.clearTimeout(fitTimer)
      ro.disconnect()
      dataDisp.dispose()
      try {
        ws.close()
      } catch {
        // ignore
      }
      term.dispose()
      wsRef.current = null
      termRef.current = null
      fitRef.current = null
    }
    // 只在挂载/卸载时执行:父组件通过 key 强制每次打开重挂载
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useImperativeHandle(ref, () => ({
    terminate: () => {
      const ws = wsRef.current
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: 'terminate' }))
        } catch {
          // ignore
        }
      }
      ws?.close()
    }
  }))

  return (
    <div className={styles.wrapper}>
      <div className={styles.statusBar}>
        <span className={`${styles.dot} ${styles[state]}`} />
        <span className={styles.statusText}>
          {state === 'connecting' ? '连接中…' : state === 'open' ? '已连接 (root)' : '已断开'}
        </span>
      </div>
      <div className={styles.term} ref={containerRef} />
    </div>
  )
}
