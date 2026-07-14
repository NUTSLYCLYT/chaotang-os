# 单测计划

## 覆盖范围

- 输入 payload 故意包含 legacy action；输出 actions 必须过滤为三项。
- malformed payload 行为保持不变。

## 命令

- `npx --yes tsx --test src/features/scribe/lib/court-doc-adapter.nodetest.ts`
- `pnpm exec tsc --noEmit`

## 未覆盖风险

- Node test 不证明真实页面 DOM；由 E2E 计划保持 BLOCKED，不能用 mock 代替。
