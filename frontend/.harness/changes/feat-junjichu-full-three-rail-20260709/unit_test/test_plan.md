# 单测计划

## 覆盖范围

- TypeScript 覆盖新模型、API client、hook、组件和页面接入。
- Production build 覆盖 Next.js 编译、页面静态生成和类型检查。
- 浏览器烟测覆盖页面可打开、关键文案可见和响应式横向溢出。

## 命令

- `pnpm exec tsc --noEmit`
- `NEXT_PUBLIC_API_MODE=real pnpm build`
- Playwright inline smoke：`/chaotang/junjichu` at 320 / 768 / 1440

## 未覆盖风险

- 未跑真实 `/api/swarm-runs` 后端任务，只验证了前端 client、按钮入口和静态构建。
- 未验证真实 governance / archive 写入，因为本轮未改后端。
