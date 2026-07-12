# 需求说明

## 背景

后端"锦衣卫共享情报池"阶段1完成后，`upsert_evidence()` 把 vet 门判"拒"的情报也存进 `JinyiweiEvidence.decision`(虽然 `query_evidence()` 服务端会强制过滤掉，永远不出查询端点)，对应到前端 `EvidenceTrust` 契约的语义应该是 `jinyiwei_rejected`——但这个字面量此前不存在，`isUsableByDept()`/`checkEvidenceGate()` 两处安全门都只认识 `jinyiwei_pending`，没有对 `jinyiwei_rejected` 的显式处理。

## 范围

- `frontend/src/lib/contracts/evidence.ts`：`EvidenceTrust` 加 `jinyiwei_rejected`；`isUsableByDept()` 显式拦截它。
- `frontend/src/lib/swarm/evidence-gate.ts`：`checkEvidenceGate()` 的 blocked 原因判断补上 `jinyiwei_rejected` 分支。
- 对应 `.nodetest.ts` 补测试。

## 非目标

- 不改 `useIntelSignals`/`GET /api/court/intel/signals`(跨 4 个功能共用，不属于本次范围)。
- 不重新设计 `JinyiweiPage.tsx` 左栏的渲染模型——发现这需要独立的设计工作，留作后续任务(见 summary.md「顺带发现」)。
- 不新增后端接口。

## 验收标准

- `EvidenceTrust` 包含 `jinyiwei_rejected`。
- `isUsableByDept()` 对 `trust==='jinyiwei_rejected'` 的记录返回 `false`，不管 `deptAffinity` 是否命中。
- `checkEvidenceGate()` 对全是 `jinyiwei_rejected` 的某类证据，标记为 `blocked` 且给出明确原因，而不是静默落进 `missing` 却不说明为什么。
- `tsc --noEmit`/`test:node`/`harness:doctor` 无新增失败或错误。

## 风险

- `isUsableByDept()` 已经通过 `checkEvidenceGate()` 的 `present` 判断间接生效，容易漏掉 `blocked` 原因文案这个单独的分支——两处安全门要保持一致，否则会出现"确实挡住了但 UI 不会说明是因为脏情报"的信息缺口。

## 验证计划

`pnpm exec tsc --noEmit`、`pnpm test:node`、`pnpm harness:doctor`。

