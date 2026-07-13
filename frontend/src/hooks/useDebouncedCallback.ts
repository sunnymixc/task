import { useEffect, useMemo, useRef } from 'react'

// 防抖回调：延迟期内重复调用只保留最后一次；组件卸载时清理未触发的定时器
// 返回值带 cancel()，供调用方主动丢弃未触发的调用（如重置/清空搜索时避免旧关键词延迟发出）
export function useDebouncedCallback<A extends unknown[]>(
  fn: (...args: A) => void,
  delay: number
): ((...args: A) => void) & { cancel: () => void } {
  const fnRef = useRef(fn)
  fnRef.current = fn
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return useMemo(() => {
    const debounced = (...args: A) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        fnRef.current(...args)
      }, delay)
    }
    debounced.cancel = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
    return debounced
  }, [delay])
}
