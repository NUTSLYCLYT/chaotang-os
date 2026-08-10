# 需求说明

## 背景

R0-W07 Checkpoint A 需要让现有 `/shangshufang` 与 `/shiguan` 消费同一个
`ContractTaskReadModelV1`，先跑通一条真实后端合同审查纵切面。父变更记录为根级
`.harness/changes/feat-r0-w07-a0-runnable-minimum-20260727/`。

## 范围

- 生成并消费后端 OpenAPI 合同。
- 新增 `src/features/contract-review/` adapter、action policy 和 panel。
- hunk 级接入现有 `ShangshufangPage.tsx`、`ShiguanPage.tsx`。
- 新增真实 JWT、真实后端 Playwright 最小流。
- 保护文件唯一写者：当前 Codex implementation worktree，候选冻结时释放。

## 非目标

- 不新增页面、BFF、Agent 或浏览器状态机。
- 不修改 Checkpoint B、数据库 schema 或 migration。
- 不以 mock、`alg:none` 或 `seedSession` 证明真实后端验收。
- 不 push、不部署、不操作 3050。

## 验收标准

- 浏览器仅呈现服务端 `allowed_actions`，未知 action fail closed。
- PARTIAL 刷新不显示 delivered 或 resume。
- 上书房显示 effective source/pack/delivery；史馆只在 URL `archiveId` 与 exact
  receipt 一致时重新打开，篡改 ID 显示错误且不回退普通索引。
- focused node tests、typecheck、build、doctors 与真实后端 Playwright 通过。

## 风险

- 两个大页面并发冲突：仅一个写者、hunk 级修改。
- 假认证导致假绿：E2E 必须调用 `/api/auth/login` 取得真实 `token`。
- 旧静态裁决入口与合同动作重复：合同任务由新面板独占动作入口。

## 验证计划

- `pnpm exec tsx --test src/features/contract-review/*.nodetest.ts`
- `pnpm exec tsc --noEmit`
- `pnpm build`
- `pnpm exec playwright test e2e/w07-contract-runnable-minimum.spec.ts`
- `pnpm harness:doctor`
