# 单测计划

## 覆盖范围

- `evidence-gate.nodetest.ts` 新增 `jinyiwei_rejected` 被安全门挡的用例，镜像既有 `jinyiwei_pending` 用例结构。

## 命令

- `pnpm test:node`

## 未覆盖风险

- `isUsableByDept()` 本身没有独立的 `.nodetest.ts`(它是通过 `evidence-gate.nodetest.ts` 间接覆盖的)——如果未来有其它直接调用 `isUsableByDept()` 而不经过 `checkEvidenceGate()` 的消费方，需要另外补测试，目前没有这样的消费方。

