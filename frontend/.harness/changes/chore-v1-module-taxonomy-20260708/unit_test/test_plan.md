# 测试计划：chore-v1-module-taxonomy-20260708

## 单元 / Node 测试

- Launch whitelist 契约测试。
- Department page-view builder 测试。
- Department vitrine 测试。

## 命令

- `pnpm exec tsc --noEmit`
- `npx --yes tsx --test src/features/court-console/lib/launch-whitelist.nodetest.ts src/features/departments/lib/department-page-view-builder.nodetest.ts src/features/departments/lib/department-vitrine.nodetest.ts`

