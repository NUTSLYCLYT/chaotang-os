# 实现报告 v1

## 改动

- `frontend/src/lib/contracts/evidence.ts`：`EvidenceTrust` 加 `jinyiwei_rejected` 字面量；`isUsableByDept()` 显式拦截它(同 `jinyiwei_pending` 一样直接返回 `false`，不落进 `deptAffinity` 命中就算可用的默认分支)。
- `frontend/src/lib/swarm/evidence-gate.ts`：`checkEvidenceGate()` 的 `blocked` 原因判断补 `jinyiwei_rejected` 分支(措辞区分"待核"和"已判定为脏"，不是同一句文案套用两种情况)。
- `frontend/src/lib/swarm/evidence-gate.nodetest.ts`：新增 `已拒(jinyiwei_rejected)被安全门挡 → blocked 且记未满足 → reject` 测试。

## 取舍

- 原计划设想"JinyiweiPage 左栏信号流切到 `GET /api/intel/evidence`"，实现前核实发现 `useIntelSignals`(`GET /api/court/intel/signals`)是户部/钦天监/flywheel-recap 等 4 个功能共用的 hook，且 `JinyiweiPage.tsx` 左栏当前的渲染模型(`category`/`level`/`region`/`credibility`)跟 `jinyiwei_evidence` 实际字段(`claim`/`grade`/`trust`/`deptAffinity`)结构不同——直接切换数据源需要重新设计整块左栏渲染，不是替换一个 URL 就能做完的事。本轮范围收窄为类型层面的诚实修复，左栏数据源改造记录为独立后续任务(见 summary.md)。
- 没有改 `isUsableByDept()` 的返回类型或签名——只是多加一行判断，保持调用方无感知升级。

## 验证

- `pnpm exec tsc --noEmit`：绿，无新增错误。
- `pnpm test:node`：989 条测试，983 通过 / 6 失败，同一组既有无关失败(与本次改动无关的既有缺口：BFF 写隔离、`dispatchDeptToSwarm` 鉴权守门、学习持久化解耦、e2e 后门安全、bureau page view)。
- `pnpm harness:doctor`：0 errors, 0 warnings。

