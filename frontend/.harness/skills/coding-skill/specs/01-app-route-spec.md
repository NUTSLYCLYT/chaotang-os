# App Route 规格

## 适用范围

`src/app/**` 下的页面、layout、route segment、server/client 入口。

## 规则

- 页面负责组合体验，不沉淀服务端运行事实。
- route handler 不能作为前端自有 BFF 承接生产运行逻辑。
- 鉴权、租户、source label、错误态必须在入口处清楚。
- 用户可见行为需要浏览器验证。

## 验证

- `pnpm exec tsc --noEmit`
- `pnpm build`
- 相关 Playwright 检查
