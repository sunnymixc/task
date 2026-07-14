import { createRoot } from 'react-dom/client'
// React 19 下 Semi 的命令式 API（Toast/Modal 等）需要先注入 createRoot
import '@douyinfe/semi-ui-19/react19-adapter'
import '@douyinfe/semi-ui-19/dist/css/semi.min.css'
import '@/assets/theme.css'
import '@/styles/global.css'
import '@/styles/semi-overrides.css'
import { RouterProvider } from 'react-router'
// 主动加载 ui store 模块，使持久化的圆角设置在任意入口路由（含登录页）都立即生效
import '@/stores/ui'
import router from '@/router'

// 不启用 StrictMode:Semi 的命令式弹层(useModal/Modal.confirm)在 React 19 StrictMode
// 双重渲染下不能正常挂载,且生产构建本就不含 StrictMode 行为
createRoot(document.getElementById('root')!).render(<RouterProvider router={router} />)
