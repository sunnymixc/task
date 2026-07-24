// AI 终端自动应答器:输出静默后读取 xterm 活动屏,识别 Claude Code TUI 的
// 选择提示(❯ 指针 + 数字编号选项),自动回车选中推荐项 —— 计划确认框回车后
// 进入 auto-accept 模式,后续提问(AskUserQuestion、权限确认)也自动选推荐项。
// 只依赖 sessionRegistry 原语;module 级 per-key 状态,同一任务的工作台面板
// 与编辑弹窗共享同一个应答器。
import {
  getSessionLastUserInputAt,
  getSessionScreenLines,
  getSessionState,
  sendSessionText,
  subscribeSession,
  subscribeSessionOutput
} from './sessionRegistry'

const SILENCE_MS = 500 // 输出静默判定:最后一帧输出后等这么久再读屏
const ANSWER_COOLDOWN_MS = 1500 // 两次回车之间的最小间隔(防 TUI 迟滞导致连发)
const USER_INPUT_QUIET_MS = 3000 // 用户刚敲过键盘则暂缓,避免与人抢答
const RECHECK_MS = 1000 // 被冷却/用户输入压制后的复查间隔

// Claude Code 选择提示的选中行:可选盒线前缀 │ + ❯ 指针 + 数字编号选项,
// 如 "│ ❯ 1. Yes, and auto-accept edits"、"❯ 1. Yes"。
// 斜杠命令面板的选中行形如 "❯ /plan …",无数字编号,天然不匹配。
// 若任务/输出文本恰好含 "❯ 1." 字样会误发一个空回车(claude 输入框空回车无害),
// 指纹机制防连发,接受该低概率风险。
const POINTER_RE = /^\s*(?:│\s*)?❯\s*\d+[.)]\s/

interface AutoResponder {
  key: string
  answeredCount: number // 已自动应答次数(UI 展示)
  answeredFingerprint: number | null // 当前提示帧指纹,同帧只回车一次
  lastAnswerAt: number
  timer: number | null // 静默 debounce 与压制复查共用一个定时器
  unsubs: (() => void)[] // output 订阅 + state 订阅
}

const responders = new Map<string, AutoResponder>()

// UI 订阅表独立于 responder 生命周期:先挂 UI 后启动也能收到通知
const uiListeners = new Map<string, Set<() => void>>()

const notifyUi = (key: string) => {
  uiListeners.get(key)?.forEach((fn) => fn())
}

const djb2 = (s: string): number => {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return h
}

function scheduleCheck(r: AutoResponder, delay: number) {
  if (r.timer !== null) window.clearTimeout(r.timer)
  r.timer = window.setTimeout(() => {
    r.timer = null
    checkScreen(r)
  }, delay)
}

function checkScreen(r: AutoResponder) {
  if (!responders.has(r.key)) return
  // 用户刚敲过键盘(含方向键手动选择):暂缓,稍后复查
  if (Date.now() - getSessionLastUserInputAt(r.key) < USER_INPUT_QUIET_MS) {
    scheduleCheck(r, RECHECK_MS)
    return
  }
  if (Date.now() - r.lastAnswerAt < ANSWER_COOLDOWN_MS) {
    scheduleCheck(r, RECHECK_MS)
    return
  }

  const lines = getSessionScreenLines(r.key)
  const p = lines.findIndex((l) => POINTER_RE.test(l))
  if (p < 0) {
    // 屏上已无提示:解除指纹锁,下一个(哪怕文本相同的)提示可再次应答
    r.answeredFingerprint = null
    return
  }
  // 指纹 = 指针行上下文区域(上方含问题文本,下方含其余选项);
  // TUI 重绘同一帧(spinner、token 计数刷新)时指纹不变,不重复回车
  const region = lines
    .slice(Math.max(0, p - 12), p + 7)
    .map((l) => l.trim())
    .join('\n')
  const fp = djb2(region)
  if (fp === r.answeredFingerprint) return

  // WS 已断时静默放弃,state 订阅随后会收尾停止
  if (!sendSessionText(r.key, '\r')) return
  r.answeredFingerprint = fp
  r.lastAnswerAt = Date.now()
  r.answeredCount += 1
  notifyUi(r.key)
}

// 幂等;仅对 open 的会话生效
export function startAutoResponder(key: string): void {
  if (responders.has(key)) return
  if (getSessionState(key) !== 'open') return
  const r: AutoResponder = {
    key,
    answeredCount: 0,
    answeredFingerprint: null,
    lastAnswerAt: 0,
    timer: null,
    unsubs: []
  }
  responders.set(key, r)
  // 输出活动 → 重置静默 debounce
  r.unsubs.push(subscribeSessionOutput(key, () => scheduleCheck(r, SILENCE_MS)))
  // 会话进入 closed(终止/销毁/断线)→ 自动停止
  r.unsubs.push(
    subscribeSession(key, () => {
      if (getSessionState(key) === 'closed') stopAutoResponder(key)
    })
  )
  notifyUi(key)
}

export function stopAutoResponder(key: string): void {
  const r = responders.get(key)
  if (!r) return
  if (r.timer !== null) window.clearTimeout(r.timer)
  r.unsubs.forEach((fn) => fn())
  responders.delete(key)
  notifyUi(key)
}

export function isAutoResponding(key: string): boolean {
  return responders.has(key)
}

export function subscribeAutoResponder(key: string, cb: () => void): () => void {
  let set = uiListeners.get(key)
  if (!set) {
    set = new Set()
    uiListeners.set(key, set)
  }
  set.add(cb)
  return () => {
    set.delete(cb)
    if (set.size === 0) uiListeners.delete(key)
  }
}

// 原始值快照:"active|answeredCount",供 useSyncExternalStore 按值比较
export function getAutoResponderSnapshot(key: string): string {
  const r = responders.get(key)
  return r ? `true|${r.answeredCount}` : 'false|0'
}
