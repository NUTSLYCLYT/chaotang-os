# 测试计划：chore-remove-bff-layer-20260708

## 单元 / Node 测试

- TypeScript 编译覆盖 adapter 与路由引用影响。
- 路由残留搜索覆盖前端 API handlers 是否意外保留。

## 命令

- `pnpm exec tsc --noEmit`
- 搜索 `src/app/**/api/**/route.ts`

