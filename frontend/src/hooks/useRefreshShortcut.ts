import { useEffect, useRef } from 'react'
import { Toast } from '@douyinfe/semi-ui-19'

// 全局「刷新快捷键」机制:拦截浏览器刷新快捷键,改为触发应用内刷新。
// 页面刷新参数(页码/搜索词/筛选)在组件本地闭包中,全局无法重建,
// 故由页面/面板经 useRefreshShortcut 注册回调,监听器只负责拦截与分发。
type RefreshHandler = () => Promise<unknown>

const handlers = new Set<RefreshHandler>()
// 刷新在途标志:防连按/按住叠加请求
let refreshing = false

// F5 不看修饰键(Ctrl+F5/Shift+F5 均为硬刷新);Cmd/Ctrl+R 含 Shift 硬刷新变体
// (目标是浏览器永不因快捷键重载;真需重载可走地址栏回车/浏览器菜单),
// 但排除 Alt 组合(非刷新快捷键,不劫持)
const isRefreshShortcut = (e: KeyboardEvent): boolean => {
  if (e.key === 'F5') return true
  return (e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'r'
}

// 仅在 App.tsx 调用一次:document 捕获阶段 keydown,无条件 preventDefault,
// 并发触发所有注册 handler,全部完成后统一提示一次
export function useRefreshShortcutListener() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isRefreshShortcut(e)) return
      // 始终拦截浏览器刷新,即使当前无可刷新内容
      e.preventDefault()
      if (e.repeat || refreshing) return
      if (handlers.size === 0) return // 无注册页面(如登录页):静默拦截,不提示
      refreshing = true
      // store 的 fetch 动作内部已 catch 错误并 resolve(失败时自行弹错误 toast),
      // Promise.all 必然落定,成功提示与其错误提示并存,与现有刷新按钮行为一致
      Promise.all([...handlers].map((h) => h()))
        .finally(() => {
          refreshing = false
        })
        .then(() => Toast.success('刷新成功'))
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [])
}

// 页面/面板注册刷新回调;enabled=false 时不注册(如工作台折叠时)。
// ref 保存最新 handler:重渲染不反复增删 Set,触发时总拿到最新闭包状态
export function useRefreshShortcut(handler: RefreshHandler, enabled = true) {
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    if (!enabled) return
    const stable: RefreshHandler = () => handlerRef.current()
    handlers.add(stable)
    return () => {
      handlers.delete(stable)
    }
  }, [enabled])
}
