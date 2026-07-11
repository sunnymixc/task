import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { TDesignResolver } from 'unplugin-vue-components/resolvers'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    // tdesign 组件按需自动注册（模板中的 t-xxx 标签），样式随 esm 构建按需引入
    Components({
      resolvers: [TDesignResolver({ library: 'vue-next', esm: true })],
      dts: 'src/components.d.ts',
    }),
  ],
  resolve: {
    alias: [
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
      // 统一走 esm 按需构建，避免 es/esm 两份 tdesign 代码同时打包
      { find: /^tdesign-vue-next$/, replacement: 'tdesign-vue-next/esm' },
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
        // 框架库单独分包（内容稳定，利于长期缓存）；tdesign 交给按需引入 + 自动分包，
        // 重组件（table/date-picker 等）随懒加载路由 chunk 下发，不进首屏
        codeSplitting: {
          groups: [
            { name: 'vendor', test: /node_modules[\\/](vue|@vue|vue-router|pinia|axios|dayjs)[\\/]/ },
          ],
        },
      },
    },
  },
})
