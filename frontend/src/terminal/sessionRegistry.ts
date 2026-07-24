import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

// AI 终端会话注册表:把 xterm 实例 / WebSocket / 挂载用的 DOM 节点从 React 组件生命周期里剥离出来。
// 面板(TaskForm 的 AI终端 tab)挂载时把 host 节点搬进容器,卸载时只是把它摘出 DOM 搬回内存,
// 因此任务编辑、保存、改状态、切 tab、关弹窗都不会中断会话。
//
// 生命周期:
//   - 点「终止」  → terminateSession:结束后端 shell,但保留 term 与历史,可「重连」
//   - 退出登录 / 任务被删除 → destroySession(All):彻底释放
//   - 刷新/关页面 → WS 断开,后端自然回收 PTY
//
// 本模块是叶子模块:不 import 任何 store(token 直接读 localStorage),
// 以便 stores/auth.ts、stores/task.ts 反向 import 而不产生循环依赖。

export type TermConnState = 'connecting' | 'open' | 'closed'

interface TerminalSession {
  key: string
  term: Terminal
  fit: FitAddon
  // xterm 的挂载节点,常驻内存,可游离于 DOM 树之外
  host: HTMLDivElement
  ws: WebSocket | null
  state: TermConnState
  // 初始工作目录(任务所属清单的项目路径,空路径时为 '~');连接与重连时以 ?cwd= 传给后端
  cwd?: string
  // 当前占有 host 的组件实例标识(同一任务可能同时出现在工作台面板与编辑弹窗)
  owner: object | null
  // 所有权每变更一次自增,参与快照,使 useSyncExternalStore 能感知"被别处抢占"
  ownerSeq: number
  listeners: Set<() => void>
}

const sessions = new Map<string, TerminalSession>()
const encoder = new TextEncoder()

const notify = (session: TerminalSession) => {
  session.listeners.forEach((fn) => fn())
}

const setState = (session: TerminalSession, state: TermConnState) => {
  if (session.state === state) return
  session.state = state
  notify(session)
}

// 键盘输入走二进制帧,控制消息(resize/terminate)走文本 JSON 帧,两者分离避免歧义
const sendResize = (session: TerminalSession) => {
  const ws = session.ws
  if (!ws || ws.readyState !== WebSocket.OPEN) return
  ws.send(JSON.stringify({ type: 'resize', cols: session.term.cols, rows: session.term.rows }))
}

// token 通过 Sec-WebSocket-Protocol 子协议传递(浏览器 WebSocket 无法设置 Authorization 头,
// 且子协议不会进后端访问日志);https 页面用 wss
const connect = (session: TerminalSession) => {
  const token = localStorage.getItem('task_token')
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const cwdQuery = session.cwd ? `?cwd=${encodeURIComponent(session.cwd)}` : ''
  const url = `${proto}://${window.location.host}/api/v1/terminal/ws${cwdQuery}`
  const ws = token ? new WebSocket(url, [token]) : new WebSocket(url)
  ws.binaryType = 'arraybuffer'
  session.ws = ws
  setState(session, 'connecting')

  ws.onopen = () => {
    setState(session, 'open')
    fitSession(session.key)
    session.term.focus()
  }
  ws.onmessage = (ev) => {
    if (typeof ev.data === 'string') {
      session.term.write(ev.data)
    } else {
      session.term.write(new Uint8Array(ev.data as ArrayBuffer))
    }
  }
  ws.onclose = () => {
    // 已被新连接替换时忽略旧连接的关闭事件
    if (session.ws !== ws) return
    session.ws = null
    setState(session, 'closed')
    // 保留 term 与滚动缓冲,等待用户「重连」
    session.term.write('\r\n\x1b[33m[连接已关闭]\x1b[0m\r\n')
  }
}

// get-or-create:term 与 onData 只在首次创建时注册一次
// cwd 仅在显式传入(!== undefined)时更新已有会话,内部无 cwd 的调用不会覆盖已存值
export function acquireSession(key: string, cwd?: string): TerminalSession {
  const existing = sessions.get(key)
  if (existing) {
    if (cwd !== undefined) existing.cwd = cwd
    return existing
  }

  const term = new Terminal({
    cursorBlink: true,
    fontSize: 13,
    fontFamily: 'Menlo, Consolas, "DejaVu Sans Mono", monospace',
    theme: { background: '#1e1e1e', foreground: '#d4d4d4' },
    scrollback: 5000
  })
  const fit = new FitAddon()
  term.loadAddon(fit)

  const host = document.createElement('div')
  host.style.width = '100%'
  host.style.height = '100%'
  term.open(host)

  const session: TerminalSession = {
    key,
    term,
    fit,
    host,
    ws: null,
    state: 'connecting',
    cwd,
    owner: null,
    ownerSeq: 0,
    listeners: new Set()
  }
  sessions.set(key, session)

  term.onData((d) => {
    const ws = session.ws
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(encoder.encode(d))
    }
  })

  connect(session)
  return session
}

export function hasSession(key: string): boolean {
  return sessions.has(key)
}

// 把常驻 host 节点搬进容器并接管所有权(后挂载者抢占,原持有者转为占位提示)
export function mountSession(key: string, container: HTMLElement, owner: object, cwd?: string) {
  const session = acquireSession(key, cwd)
  container.appendChild(session.host)
  if (session.owner !== owner) {
    session.owner = owner
    session.ownerSeq += 1
    notify(session)
  }
  // 等布局稳定(弹窗/面板展开动画)再 fit
  window.setTimeout(() => {
    fitSession(key)
    session.term.focus()
  }, 50)
}

// 仅把 host 摘出 DOM 树,不 dispose、不 close —— 会话继续存活
export function unmountSession(key: string, owner: object) {
  const session = sessions.get(key)
  // 所有权已被别处抢占时不摘节点,否则会把对方正在显示的终端拔掉
  if (!session || session.owner !== owner) return
  session.host.remove()
  session.owner = null
  session.ownerSeq += 1
  notify(session)
}

// host 是否被"别人"占着(owner 为空时不算,避免首帧挂载前误报)
export function isStolenFrom(key: string, owner: object): boolean {
  const current = sessions.get(key)?.owner
  return !!current && current !== owner
}

export function fitSession(key: string) {
  const session = sessions.get(key)
  if (!session) return
  // 游离态(未挂载或容器尚无尺寸)下 fit 会抛错或算出无意义的行列数
  if (!session.host.isConnected || !session.host.clientHeight || !session.host.clientWidth) return
  try {
    session.fit.fit()
  } catch {
    // 忽略
  }
  sendResize(session)
}

// 复用同一 term(保留历史滚动缓冲),重新拨 WS 建一个新 shell
export function reconnectSession(key: string, cwd?: string) {
  const session = acquireSession(key, cwd)
  if (session.ws) return
  session.term.write('\r\n\x1b[36m[正在重连…]\x1b[0m\r\n')
  connect(session)
}

// 「终止」:通知后端结束 shell 并断开,但保留 term/host 与历史,可再「重连」
export function terminateSession(key: string) {
  const session = sessions.get(key)
  if (!session) return
  const ws = session.ws
  session.ws = null
  if (ws) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: 'terminate' }))
      } catch {
        // ignore
      }
    }
    try {
      ws.close()
    } catch {
      // ignore
    }
  }
  setState(session, 'closed')
}

// 彻底释放(退出登录 / 任务被删除):断连 + 释放 term + 移出注册表
export function destroySession(key: string) {
  const session = sessions.get(key)
  if (!session) return
  terminateSession(key)
  session.host.remove()
  session.term.dispose()
  session.owner = null
  session.ownerSeq += 1
  sessions.delete(key)
  notify(session)
}

export function destroyAllSessions() {
  Array.from(sessions.keys()).forEach(destroySession)
}

// useSyncExternalStore 订阅:状态或所有权变化时触发重渲染
// subscribe 先于挂载 effect 执行且可能是会话的创建者,因此必须带上 cwd,否则首连丢参
export function subscribeSession(key: string, cb: () => void, cwd?: string) {
  const session = acquireSession(key, cwd)
  session.listeners.add(cb)
  return () => {
    session.listeners.delete(cb)
  }
}

// 快照必须是原始值:state 与 ownerSeq 拼成字符串,按值比较
export function getSessionSnapshot(key: string): string {
  const session = sessions.get(key)
  if (!session) return 'closed|-1'
  return `${session.state}|${session.ownerSeq}`
}

export function getSessionState(key: string): TermConnState {
  return sessions.get(key)?.state ?? 'closed'
}

// 供快捷指令使用:把文本作为二进制帧写入 PTY(与键盘输入 term.onData 同通道,
// 后端原样 ptmx.Write)。WS 未 OPEN 时返回 false,由调用方决定中止或重试。
export function sendSessionText(key: string, text: string): boolean {
  const ws = sessions.get(key)?.ws
  if (!ws || ws.readyState !== WebSocket.OPEN) return false
  ws.send(encoder.encode(text))
  return true
}

// 确保会话就绪:closed 时经 reconnectSession 自动重连(保留滚动缓冲),等待进入 open;
// 超时或连接再次失败则 reject。connecting 状态只等待落定,不重复建连。
export function ensureSessionOpen(key: string, cwd?: string, timeoutMs = 10000): Promise<void> {
  const session = acquireSession(key, cwd)
  if (session.state === 'open') return Promise.resolve()
  if (session.state === 'closed') reconnectSession(key, cwd)
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      unsub()
      reject(new Error('终端连接超时'))
    }, timeoutMs)
    // notify 也会因 ownerSeq 变化触发,回调里必须重读状态而非假定发生了状态迁移
    const unsub = subscribeSession(key, () => {
      const state = getSessionState(key)
      if (state === 'open') {
        window.clearTimeout(timer)
        unsub()
        resolve()
      } else if (state === 'closed') {
        window.clearTimeout(timer)
        unsub()
        reject(new Error('终端连接失败'))
      }
    })
  })
}
