# Tasks: chore-remove-bff-layer-20260708

## Task 1

- 目标：移除前端 BFF route handler。
- 输入：`src/app/api/**`、`src/app/api/**`。
- 输出：删除 route handler 目录树。
- 验收：`Test-Path src/app/api` 为 false，且不再存在 `src/app/**/api/**/route.ts`。
- 依赖：用户明确要求直接删除。

## Task 2

- 目标：移除同源 proxy 假设。
- 输入：`next.config.ts`、`src/lib/api.ts`、`src/lib/api.ts`、`useJiqunRunProgress`。
- 输出：不再使用 Next rewrite；adapter 使用明确外部运行 base URL。
- 验收：TypeScript 通过。
- 依赖：部署环境必须提供外部运行 URL env。

## Task 3

- 目标：更新项目规则和发布检查。
- 输入：`.harness/**`、release scripts。
- 输出：前端所有权排除 BFF；smoke 检查避开已退役前端 API endpoint。
- 验收：build 通过，审计文件已更新。
- 依赖：无。

