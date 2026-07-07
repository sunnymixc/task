import { createApp } from 'vue'
import { createPinia } from 'pinia'
// tdesign 组件由 unplugin-vue-components 按需自动注册（见 vite.config.ts），
// 这里只引入全局基础样式（reset + 主题变量）
import 'tdesign-vue-next/esm/style/index.js'
// MessagePlugin 只在 ts 代码中调用，esm 构建的 message 样式副作用挂在 Message 组件模块上，
// 生产 tree-shaking 会将其裁掉（toast 无样式落入文档流，撑出页面滚动条），需显式引入
import 'tdesign-vue-next/esm/common/style/web/components/message/_index.less'
import '@/assets/theme.css'

import App from './App.vue'
import router from './router'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

app.mount('#app')
