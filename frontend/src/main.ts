import { createApp } from 'vue'
import { createPinia } from 'pinia'
// tdesign 组件由 unplugin-vue-components 按需自动注册（见 vite.config.ts），
// 这里只引入全局基础样式（reset + 主题变量）
import 'tdesign-vue-next/esm/style/index.js'
import '@/assets/theme.css'

import App from './App.vue'
import router from './router'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

app.mount('#app')
