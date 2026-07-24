// AI 终端快捷指令编排层:每个导出函数是一条快捷指令的完整步骤序列。
// 只依赖 sessionRegistry 的原语,与 React 无关;以 sessionKey 为粒度做并发守卫
// (同一任务可能同时出现在工作台面板与编辑弹窗,组件内状态不足以防止跨实例并发)。
import { ensureSessionOpen, sendSessionText } from './sessionRegistry'

// 各步骤之间的延迟(ms),集中在此便于调参
const DELAY_AFTER_OPEN = 400 // 连接就绪后等 shell 提示符
const DELAY_AFTER_CD = 300
const DELAY_CLAUDE_STARTUP = 3000 // claude TUI 启动需要数秒才能接收输入
const DELAY_AFTER_SLASH = 300 // 等斜杠命令面板完成匹配
const DELAY_AFTER_PLAN = 800 // 等 plan 模式切换完成
const DELAY_AFTER_PASTE = 400 // 粘贴结束与回车之间留出 TUI 处理时间

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms))

const running = new Set<string>()

export function isQuickCommandRunning(key: string): boolean {
  return running.has(key)
}

export interface StartTaskOptions {
  // 重连时传给 ensureSessionOpen(空路径时为 '~',与 TaskTerminal 的 cwd prop 一致)
  cwd?: string
  // 原始项目路径,空串则跳过 cd 步骤(会话本就开在主目录)
  projectPath: string
  // 与「拷贝」一致:title + "\n\n" + description
  taskText: string
}

// 「启动任务」:cd 项目目录 → 启动 claude → /plan 切换 plan 模式 → 粘贴任务内容 → 回车提交。
// 若会话中已有前台程序在运行,这些字节会被当作其输入照发不误——前端无法可靠探测
// pty 内的前台进程,该风险由用户自担。
export async function runStartTaskCommand(key: string, opts: StartTaskOptions): Promise<void> {
  if (running.has(key)) throw new Error('已有快捷指令在执行中')
  running.add(key)
  try {
    // 序列中途断连时 fail-fast,避免向重连后的新会话发送残缺的后半段
    const send = (text: string) => {
      if (!sendSessionText(key, text)) throw new Error('终端连接已断开,指令中止')
    }

    await ensureSessionOpen(key, opts.cwd)
    await sleep(DELAY_AFTER_OPEN)

    if (opts.projectPath) {
      // 转义与后端 initialCdInput 一致:' → '\'';行首空格配合 HIST_IGNORE_SPACE 不进历史
      const escaped = opts.projectPath.replace(/'/g, "'\\''")
      send(` cd '${escaped}'\r`)
      await sleep(DELAY_AFTER_CD)
    }

    send('claude\r')
    await sleep(DELAY_CLAUDE_STARTUP)

    // 斜杠命令必须"像键入的"才会触发命令面板,不能走括号粘贴;回车单独一帧确认
    send('/plan')
    await sleep(DELAY_AFTER_SLASH)
    send('\r')
    await sleep(DELAY_AFTER_PLAN)

    // 括号粘贴:内嵌换行被视作粘贴块的一部分,不会提前提交
    send(`\x1b[200~${opts.taskText}\x1b[201~`)
    await sleep(DELAY_AFTER_PASTE)
    send('\r')
  } finally {
    running.delete(key)
  }
}
