# Spec: chore-remove-bff-layer-20260708

## Background

用户要求前端项目完全移除 BFF 层。前端不再拥有 Next.js route handler 或同源 proxy rewrite；运行事实应归明确外部 API与 运行证据。

## Scope

- Delete frontend-owned `src/app/api/**` route handlers.
- 删除隐藏的 `src/app/api/**` SSE proxy route。
- Remove Next.js rewrite proxy configuration for `/api/v1`, `/socket.io`, and `/api`.
- Update frontend runtime adapters to use explicit 外部 API URLs instead of same-origin BFF paths.
- Update harness ownership docs and release scripts that assumed frontend BFF endpoints.

## Non-goals

- 不在前端仓实现替代外部运行 endpoint。
- Do not migrate deleted route logic into another frontend directory.
- Do not change product pages beyond removing BFF assumptions.

## 验收标准

- `src/app/api` no longer exists.
- No route handler remains under an `/api/` app path.
- `next.config.ts` no longer defines API/proxy rewrites.
- TypeScript and production build complete.

## Risks

- Pages that still call old `/api/**` URLs at runtime will need 外部 API endpoint alignment.
- 浏览器直接调用外部 API时，可能需要在前端之外配置 CORS/auth。
- 部分旧 nodetest 和脚本仍记录旧 API route 名称，后续需要继续清理。

## 验证计划

- `pnpm exec tsc --noEmit`
- `NEXT_PUBLIC_API_MODE=real NEXT_DIST_DIR=.next-bff-removal-check pnpm build`
- Search for remaining app route handlers under `/api/`.

