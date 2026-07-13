---
name: verify
description: 本仓库的端到端验证方法 — 启动前后端、注入登录态、用 puppeteer-core 驱动真实浏览器验证前端改动
---

# 验证方法（Go 后端 + React 前端）

## 启动

```bash
./start.sh restart    # 后端 :5001 + 前端 :5000，日志在 logs/
```

## 准备登录态（跳过 UI 登录）

1. 注册测试用户拿 token（username/email 都要唯一，重复注册会失败）：
   ```bash
   curl -s -X POST http://localhost:5001/api/v1/auth/register \
     -H 'Content-Type: application/json' \
     -d '{"username":"vu<unique>","email":"<unique>@test.com","password":"pass123456"}'
   # 响应含 .token 和 .user；refresh_token 为 null（15 分钟内够用）
   ```
2. 用 token 直接调 `/api/v1/task-lists`、`/api/v1/tasks` 造测试数据。
3. 浏览器端注入 localStorage 即视为已登录：`task_token`（JWT）、`task_user`（user JSON 字符串）。先打开 `/login` 页再 `localStorage.setItem`，然后跳转目标路由。
4. 管理员场景：注册后直接改库 `UPDATE users SET is_admin = TRUE WHERE email = '...'`（可用 `docker exec WeKnora-postgres psql "postgresql://task:$DB_PASSWORD@172.19.0.3:5432/task"`），再重新 login 注入。

## 驱动浏览器

- 系统 Chrome 在 `/usr/bin/google-chrome`；在 scratchpad `npm i puppeteer-core`，`executablePath` 指向系统 Chrome，`args: ['--no-sandbox']`。
- 监听 `page.on('request')` 过滤 `/api/v1/tasks` 可断言实际请求参数（如 `task_list_id`、`page`）。

## 选择器要点（Semi Design + CSS Modules）

- 自有样式类经 CSS Modules 哈希（如 `_menuItem_xxx`），用属性选择器模糊匹配：`[class*="menuItem"]`、`[class*="pageHeader"] [class*="title"]`。侧边栏子菜单 `[class*="menuItemSub"]`，用户区触发器有稳定 id `#sidebar-user-box`。
- Semi 组件类名稳定：表格行 `.semi-table-tbody .semi-table-row`、弹窗 `.semi-modal`、下拉菜单 `.semi-dropdown-item`、选择器 `.semi-select` / 选项 `.semi-select-option`、Toast `.semi-toast`。
- 弹窗按钮遍历 `.semi-modal button` 按文本匹配「确定」；`Typography.Text` 链接要点最内层 `.semi-typography-link-text`（点外层 span 不触发 onClick）。
- 断言弹窗关闭用轮询 `waitForFunction(() => !document.querySelector('.semi-modal'))`，不要用固定 sleep（有关闭动画 + 提交请求耗时）。

## 已知坑

- Semi Select 下拉打开有动画，点选项前先 `waitForSelector('.semi-select-option')`；打开偶发失败，失败时重点一次。
- 注册响应的 `refresh_token` 为 null 是正常的（后端 login 不发放独立 refresh token）。
- 控制台会有一条 Semi DatePicker 的 `rangeSeparatorNode` unknown-prop 告警（库自身问题），断言"无 JS 错误"时需白名单。
