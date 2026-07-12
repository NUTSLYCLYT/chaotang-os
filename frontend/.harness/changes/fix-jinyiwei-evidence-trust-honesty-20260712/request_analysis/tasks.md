# 任务拆解

## 任务 1 —— 契约补字面量

- 目标：`EvidenceTrust` 加 `jinyiwei_rejected`，`isUsableByDept()` 拦截它。
- 输入：`frontend/src/lib/contracts/evidence.ts` 现状。
- 输出：新增字面量 + 安全门改动。
- 验收：`tsc --noEmit` 绿。
- 依赖：无。

## 任务 2 —— evidence-gate 一致性

- 目标：`checkEvidenceGate()` 的 `blocked` 判断跟 `isUsableByDept()` 保持一致。
- 输入：任务1完成后的契约。
- 输出：`evidence-gate.ts` 补 `jinyiwei_rejected` 分支。
- 验收：新增测试通过。

## 任务 3 —— 回归验证

- 目标：证明没有引入回归。
- 输出：`tsc --noEmit`、`test:node`、`harness:doctor` 的运行结果。
- 验收：无新增失败/错误。

