# 编码报告 v1：chore-remove-bff-layer-20260708

## 变更

- 删除前端 BFF 路由树 `src/app/api/**`。
- 删除隐藏 SSE 代理路由 `src/app/api/**`。
- 从 `next.config.ts` 移除 Next.js API / proxy rewrites。
- 将通用 API client 与 外部 API client 改为使用显式外部运行 base URL。
- 更新 middleware、launch whitelist、release smoke scripts 与 harness 文档，移除前端 BFF 所有权。

## 备注

- 运行时页面仍可能包含旧 `/api/**` 展示文本或 fetch 路径；这些属于外部运行对齐 follow-up，不代表应恢复前端 route handler。
- 浏览器代码需要直连 外部 API 时，应配置 `NEXT_PUBLIC_EXTERNAL_RUNTIME_API_URL` 或 `NEXT_PUBLIC_CHAOTANG_API_URL`。

## 变更文件

- 已删除 `src/app/api/**` 与 `src/app/api/**` 运行时 route handlers。
- 已更新 `next.config.ts`、API adapters、middleware、release smoke scripts 与 harness ownership docs。

## 关键决策

- 前端不再拥有 runtime BFF 层或同源 proxy rewrites。
- 浏览器到外部 API的集成必须使用显式外部运行 base URL 环境变量。
- 剩余旧 `/api/**` caller 是外部运行对齐 follow-up，不是恢复前端 route handler 的理由。

## 验证

- `pnpm exec tsc --noEmit`：PASS。
- `NEXT_PUBLIC_API_MODE=real NEXT_DIST_DIR=.next-bff-removal-check pnpm build`：PASS。
- 残留搜索确认没有 `/api/` app route handlers。

