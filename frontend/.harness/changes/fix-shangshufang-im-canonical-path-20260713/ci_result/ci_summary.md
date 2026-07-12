# CI 验证摘要

结论：PASS（本路径修复）。

## 命令

- `pnpm exec tsx --test ...shangshufang-im-path.nodetest.ts src/lib/backend-api.nodetest.ts`
- `pnpm exec tsc --noEmit`
- `NEXT_PUBLIC_API_MODE=real pnpm build`

## 结果

- 5 passed；TypeScript/build 通过；production 浏览器 IM 请求全 200、0 console error。
