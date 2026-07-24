import { useEffect, useRef } from 'react'
import css from './InlineEditable.module.css'

// Firefox <136 不支持 plaintext-only(设置抛异常或读回不生效),降级为 true + onPaste 拦截去富文本
const supportsPlaintextOnly = (() => {
  const div = document.createElement('div')
  try {
    div.contentEditable = 'plaintext-only'
  } catch {
    return false
  }
  return div.contentEditable === 'plaintext-only'
})()

// 读取编辑内容:innerText 按渲染结果把 <br>/分段归一为 \n(textContent 会丢换行);
// 清空全文后浏览器残留的占位 <br> 会带出一个尾部幽灵换行,剥掉一个
const readValue = (el: HTMLElement) => el.innerText.replace(/\r\n/g, '\n').replace(/\n$/, '')

// 经 Selection 在光标处插入纯文本(execCommand 虽废弃但对 contentEditable 仍是唯一
// 能保留撤销栈的插入方式,全浏览器可用)
const insertText = (text: string) => {
  if (text) document.execCommand('insertText', false, text)
}

const placeCursorAtEnd = (el: HTMLElement) => {
  const range = document.createRange()
  range.selectNodeContents(el)
  range.collapse(false)
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(range)
}

interface InlineEditableProps {
  /** 初始文本,仅挂载时写入(非受控,内容由 DOM 自持,避免受控 contentEditable 的光标重置) */
  defaultValue: string
  /** false(默认):Enter 提交并阻止换行;true:Enter 正常换行 */
  multiline?: boolean
  maxLength?: number
  /** 内容为空时经 :empty::before 显示 */
  placeholder?: string
  /** 调用方传入阅读态排版类,保证编辑态字号/行高/换行与阅读态一致 */
  className?: string
  ariaLabel?: string
  /** 每次输入回报归一化后的纯文本 */
  onInput?: (value: string) => void
  /** 仅单行模式,Enter 触发 */
  onSubmit?: () => void
  /** Escape 触发 */
  onCancel?: () => void
}

export default function InlineEditable({
  defaultValue,
  multiline = false,
  maxLength,
  placeholder,
  className,
  ariaLabel,
  onInput,
  onSubmit,
  onCancel
}: InlineEditableProps) {
  const ref = useRef<HTMLDivElement>(null)
  const composingRef = useRef(false)
  // Safari 的 compositionend 先于确认键 keydown 且届时 isComposing 已为 false,
  // 用该标记再拦一层,避免 IME 确认的 Enter 被当作提交
  const justComposedRef = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.textContent = defaultValue
    el.focus()
    placeCursorAtEnd(el)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 剩余可输入额度(选中的内容会被本次输入替换,计入额度)
  const remainingRoom = (el: HTMLElement) => {
    if (maxLength === undefined) return Infinity
    const selectedLength = window.getSelection()?.toString().length ?? 0
    return maxLength - (readValue(el).length - selectedLength)
  }

  // 归一化外部文本:统一换行符;单行模式把换行折成空格
  const normalizeIncoming = (text: string) => {
    const t = text.replace(/\r\n?/g, '\n')
    return multiline ? t : t.replace(/\n+/g, ' ')
  }

  // React 的 onBeforeInput 是基于 textInput 的 polyfill,拿不到 inputType,须挂原生 beforeinput
  const beforeInputRef = useRef<(ev: InputEvent) => void>(() => {})
  beforeInputRef.current = (ev: InputEvent) => {
    if (ev.isComposing) return // IME 组合中不可取消,交给 compositionend 兜底
    const el = ref.current
    if (!el) return
    if (!multiline && (ev.inputType === 'insertParagraph' || ev.inputType === 'insertLineBreak')) {
      ev.preventDefault()
      return
    }
    // 拖放等带 dataTransfer 的输入:改为手动插入纯文本并截断(粘贴已由 onPaste 拦截)
    if (ev.dataTransfer) {
      ev.preventDefault()
      const text = normalizeIncoming(ev.dataTransfer.getData('text/plain'))
      insertText(text.slice(0, Math.max(0, remainingRoom(el))))
      return
    }
    if (ev.data && ev.data.length > remainingRoom(el)) {
      ev.preventDefault()
    }
  }

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const listener = (ev: Event) => beforeInputRef.current(ev as InputEvent)
    el.addEventListener('beforeinput', listener)
    return () => el.removeEventListener('beforeinput', listener)
  }, [])

  // 超长兜底截断(IME 提交、beforeinput 拦截失手等场景);组合中不能动 DOM,推迟到 compositionend
  const truncateIfNeeded = (el: HTMLElement) => {
    const value = readValue(el)
    if (maxLength !== undefined && value.length > maxLength) {
      const truncated = value.slice(0, maxLength)
      el.textContent = truncated
      placeCursorAtEnd(el)
      return truncated
    }
    return value
  }

  const handleInput = () => {
    const el = ref.current
    if (!el) return
    onInput?.(composingRef.current ? readValue(el) : truncateIfNeeded(el))
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault()
    const el = ref.current
    if (!el) return
    const text = normalizeIncoming(e.clipboardData.getData('text/plain'))
    insertText(text.slice(0, Math.max(0, remainingRoom(el))))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !multiline) {
      e.preventDefault() // 单行任何情况下都不换行
      if (e.nativeEvent.isComposing || e.keyCode === 229 || justComposedRef.current) return
      onSubmit?.()
      return
    }
    if (e.key === 'Escape') {
      e.stopPropagation() // 组合中的 Escape 只取消组合,不让外层容器把编辑器一并关掉
      if (e.nativeEvent.isComposing || justComposedRef.current) return
      onCancel?.()
    }
  }

  const handleCompositionStart = () => {
    composingRef.current = true
  }

  const handleCompositionEnd = () => {
    composingRef.current = false
    justComposedRef.current = true
    window.setTimeout(() => {
      justComposedRef.current = false
    }, 0)
    const el = ref.current
    if (el) onInput?.(truncateIfNeeded(el))
  }

  return (
    <div
      ref={ref}
      role="textbox"
      aria-multiline={multiline}
      aria-label={ariaLabel}
      contentEditable={supportsPlaintextOnly ? 'plaintext-only' : true}
      suppressContentEditableWarning
      spellCheck={false}
      className={className ? `${css.editable} ${className}` : css.editable}
      data-placeholder={placeholder}
      onInput={handleInput}
      onPaste={handlePaste}
      onKeyDown={handleKeyDown}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
    />
  )
}
