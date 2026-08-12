# Next.js Route Handler 导出边界设计

## 问题

Next.js 16 对 App Router 的 `route.ts` 执行导出白名单校验。当前 17 个路由文件除 `GET`、`POST` 等合法入口外，还导出了供 Node 单元测试注入依赖的 `create*Handler` 工厂，导致 `next build` 在类型检查阶段失败。

## 选择

每个受影响目录新增相邻 `handler.ts`。原 `route.ts` 中的依赖注入工厂及其辅助类型、常量和纯逻辑整体迁入 `handler.ts`；`route.ts` 只从 `handler.ts` 导入工厂并导出 Next.js 允许的 HTTP 方法。对应测试直接从 `handler.ts` 导入工厂，继续使用内存依赖和确定性响应，不启动 HTTP 服务。

受影响的 17 个路由属于每日奏折、异步下旨、锦衣卫、军机处、钦天监和报告成果六组。拆分只改变模块边界，不改变 URL、HTTP 方法、认证、请求体、响应体、错误映射或后端调用。

## 守卫

新增源码守卫测试，递归读取 `src/app/api/**/route.ts`，拒绝任何 `export function create*Handler` 或 `export const create*Handler`。该守卫防止后续为了测试便利再次破坏 Next.js 入口约束；业务测试继续验证工厂行为，`npm run typecheck` 与 `npm run build` 验证框架集成。

## 验证

- 先运行守卫测试并确认当前代码 RED，报告 17 个非法路由。
- 完成拆分后运行全部 Route Handler 测试与守卫测试。
- 运行前端全量 test、lint、typecheck、build。
- 回到下旨无回奏任务的完整验证与连续 10 轮验收；任何代码或流程变化重置计数。

## 非目标

不改业务 API，不合并不同领域的 handler，不引入测试框架或路径别名，不改 ADR 0028/0039，不提交、推送或部署。
