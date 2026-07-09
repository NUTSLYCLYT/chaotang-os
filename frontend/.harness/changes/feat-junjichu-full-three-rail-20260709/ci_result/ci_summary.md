# CI 验证摘要

结论：PASS

## 命令

- `pnpm exec tsc --noEmit`
- `NEXT_PUBLIC_API_MODE=real pnpm build`

## 结果

- TypeScript 通过。
- Next.js production build 通过。
- 首次未带 `NEXT_PUBLIC_API_MODE=real` 的 build 被发布门禁拒绝，按门禁要求补环境变量后通过。
