# 根路径欢迎页与健康检查迁移

## ADR 0026

## Status

Accepted — 2026-07-22（决策已接受；实现与验证由产品任务 `2026-07-22-pre-auth-ui-migration.md` 跟踪）

## Context

当前前端根路径 `/` 显示后端健康检查。`dev` 分支则将根路径用作登录前欢迎引导页；用户明确要求迁移该页面，并确认根路径应呈现欢迎页。继续保留前端健康检查展示对本地联调和验收仍有价值。

## Decision

根路径 `frontend/src/app/page.tsx` 改为欢迎页，前端健康检查展示迁至 `frontend/src/app/health/page.tsx`。后端 `GET /health` 契约、服务端 `backendClient.ts`、既有 BFF 和业务页面不变。欢迎页仅做本地演示与页面导航，不创建认证状态或调用业务后端。

## Consequences

访问 `/` 不再直接显示后端状态；需要健康检查展示时访问 `/health`。前端约束、架构事实和产品任务必须同步反映这一迁移。欢迎页新增的视觉资源限定为 `dev` 中已跟踪的英雄背景图，不引入 `dev` 的认证、Tailwind 或图标/动效依赖。

## Verification

从 `frontend/` 运行 `npm run lint`、`npm run typecheck`、`npm test` 和 `npm run build`。生产模式请求 `/` 与 `/health`，确认均返回 200：前者包含欢迎页标题，后者包含后端状态展示。最后从仓库根目录运行 `node scripts/check_harness.mjs` 与 `git diff --check`。
