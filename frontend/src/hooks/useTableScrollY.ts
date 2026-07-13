import { useLayoutEffect, useRef, useState } from 'react'

const MIN_Y = 120 // 极矮窗口保底,避免表体高度为 0/负数

// 计算 Semi Table scroll.y: 容器高度 - 表头高度 - 分页条高度。
// 容器即 flex:1 的剩余空间; ResizeObserver + window resize 双保险跟随窗口变化
export function useTableScrollY<T extends HTMLElement = HTMLDivElement>() {
  const containerRef = useRef<T>(null)
  const [scrollY, setScrollY] = useState<number>()

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const compute = () => {
      // scroll.y 生效前表头在 .semi-table-thead 内,生效后是独立 .semi-table-header
      const header =
        el.querySelector<HTMLElement>('.semi-table-header') ??
        el.querySelector<HTMLElement>('.semi-table-thead')
      const pagination = el.querySelector<HTMLElement>('.semi-table-pagination-outer')
      const next = Math.max(
        MIN_Y,
        Math.floor(el.clientHeight - (header?.offsetHeight ?? 0) - (pagination?.offsetHeight ?? 0))
      )
      // 1px 容差,避免测量抖动导致循环 setState
      setScrollY((prev) => (prev !== undefined && Math.abs(prev - next) <= 1 ? prev : next))
    }
    compute()
    const raf = requestAnimationFrame(compute) // 首帧后校正:切换到固定表头结构会有 1-2px 差异
    const ro = new ResizeObserver(compute)
    ro.observe(el)
    window.addEventListener('resize', compute)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('resize', compute)
    }
  }, [])

  return { containerRef, scrollY }
}
