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
    ],
  },
  server: {
    port: 5000,
    allowedHosts: ['task.sunnymix.com', 'task-dev.sunnymix.com'],
    proxy: {
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
