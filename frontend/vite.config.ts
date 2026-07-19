import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
      // semi-ui-19 的 exports 未导出 dist/css，别名直连文件路径绕过 exports 校验
      {
        find: /^@douyinfe\/semi-ui-19\/dist\/css\/semi\.min\.css$/,
        replacement: fileURLToPath(
          new URL('./node_modules/@douyinfe/semi-ui-19/dist/css/semi.min.css', import.meta.url)
        ),
      },
      // 本项目不使用 Semi 的 Lottie 组件，stub 掉 lottie-web 以消除构建 [EVAL] 警告
      {
        find: /^lottie-web$/,
        replacement: fileURLToPath(new URL('./src/shims/lottie-web-stub.ts', import.meta.url)),
      },
    ],
  },
  server: {
    port: 5000,
    allowedHosts: ['task.sunnymix.com', 'task-dev.sunnymix.com'],
    proxy: {
      // AI 终端 WebSocket:需 ws:true 才会转发 upgrade 请求(放在 /api 之前,更具体的前缀优先)
      '/api/v1/terminal': {
        target: 'ws://localhost:5001',
        ws: true,
        changeOrigin: true,
        secure: false,
      },
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        secure: false,
      },
      '/health': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  build: {
    // Semi 的 Form+DatePicker/Upload 等组件族构成 ~716KB 的共享 chunk（baseForm），
    // 属固有体积且已被路由懒加载共享复用，将告警阈值上调至 800KB
    chunkSizeWarningLimit: 800,
    rolldownOptions: {
      output: {
        // 框架库单独分包（内容稳定，利于长期缓存）；semi 交给按需引入 + 自动分包，
        // 重组件（table/date-picker 等）随懒加载路由 chunk 下发，不进首屏
        codeSplitting: {
          groups: [
            { name: 'vendor', test: /node_modules[\\/](react|react-dom|react-router|scheduler|zustand|axios)[\\/]/ },
          ],
        },
      },
    },
  },
})
