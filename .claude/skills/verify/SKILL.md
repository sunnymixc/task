---
name: verify
description: 本仓库的端到端验证方法 — 启动前后端、注入登录态、用 puppeteer-core 驱动真实浏览器验证前端改动
---

# 验证方法（Go 后端 + Vue 前端）

## 启动

```bash
./start.sh restart    # 后端 :5001 + 前端 :5000，日志在 logs/
```

## 准备登录态（跳过 UI 登录）

1. 注册测试用户拿 token：
   ```bash
   curl -s -X POST http://localhost:5001/api/v1/auth/register \
     -H 'Content-Type: application/json' \
     -d '{"username":"verifyuser","email":"<unique>@test.com","password":"pass123456"}'
   # 响应含 .token 和 .user；refresh_token 可能为 null（15 分钟内够用）
   ```
2. 用 token 直接调 `/api/v1/task-lists`、`/api/v1/tasks` 造测试数据。
3. 浏览器端注入 localStorage 即视为已登录：`task_token`（JWT）、`task_user`（user JSON 字符串）。先打开 `/login` 页再 `localStorage.setItem`，然后跳转目标路由。

## 驱动浏览器

- 系统 Chrome 在 `/usr/bin/google-chrome`；在 scratchpad `npm i puppeteer-core`，`executablePath` 指向系统 Chrome，`args: ['--no-sandbox']`。
- 监听 `page.on('request')` 过滤 `/api/v1/tasks` 可断言实际请求参数（如 `task_list_id`、`page`）。

## 选择器要点（tdesign + 自定义样式）

- 侧边栏菜单是手写 div：`.menu-item`、`.menu-item--sub`（清单子菜单）、`.menu-item--active`、折叠按钮 `.sidebar-toggle` / `.sidebar-toggle-collapsed`。
- 页面标题 `.title`；筛选区每个下拉计数用 `.filters .t-select__wrap`（勿同时数 `.t-select`，会重复计数）。
- 表格行标题 `.task-title`；空态 `.empty-state`；弹窗按钮遍历 `.t-dialog .t-button` 按文本匹配「确定」。

## 已知坑

- `t-table` 空数据时 tbody 仍有 1 行占位。
- 注册响应的 `refresh_token` 为 null 时不影响短时验证。
