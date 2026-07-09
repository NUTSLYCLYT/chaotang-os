# CI 摘要：chore-remove-bff-layer-20260708

- `pnpm exec tsc --noEmit`：PASS。
- `NEXT_PUBLIC_API_MODE=real NEXT_DIST_DIR=.next-bff-removal-check pnpm build`：PASS。
- 路由残留检查：`src/app/api` 不存在，且没有残留 `src/app/**/api/**/route.ts`。

说明：首次未设置 `NEXT_PUBLIC_API_MODE=real` 的 build 被既有 release gate 阻止；补充必要环境变量后通过。

## 命令

- `pnpm exec tsc --noEmit`
- `NEXT_PUBLIC_API_MODE=real NEXT_DIST_DIR=.next-bff-removal-check pnpm build`
- 搜索 `src/app/**/api/**/route.ts` 路由残留

## 结果

PASS

