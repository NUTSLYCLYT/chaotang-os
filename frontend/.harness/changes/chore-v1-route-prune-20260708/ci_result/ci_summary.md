# CI 摘要：chore-v1-route-prune-20260708

## 命令

- `pnpm exec tsc --noEmit`
- `NEXT_PUBLIC_API_MODE=real pnpm build`
- `node scripts/harness-doctor.mjs`

## 结果

- TypeScript：通过。
- Build：通过。
- 当时 `node scripts/harness-doctor.mjs` 因既有 skill frontmatter 与 `chore-remove-bff-layer-20260708` 占位符问题失败；该 change 目录自身没有未解析模板标记。

