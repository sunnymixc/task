// lottie-web 是 @douyinfe/semi-foundation（Lottie 组件）的传递依赖，本项目未使用
// Lottie 组件。stub 掉以消除构建时的 [EVAL] 警告并避免解析 ~625KB 的 lottie 源码。
// 若将来需要使用 Semi 的 <Lottie/>，删除 vite.config.ts 中对应的 alias 即可。
export default {} as Record<string, unknown>
