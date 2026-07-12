# 变更摘要：fix-jinyiwei-evidence-trust-honesty-20260712

| Field | Value |
| --- | --- |
| Change ID | fix-jinyiwei-evidence-trust-honesty-20260712 |
| Type | fix |
| Status | DELIVERED |
| Owner | Frontend Agent |
| Created | 20260712 |

## 阶段

| # | 阶段 | Status | 证据 |
| ---: | --- | --- | --- |
| 0 | 加载上下文 | DONE | 已加载 harness 上下文 |
| 1 | 需求分析 | DONE | request_analysis/spec.md, tasks.md |
| 2 | 需求复核 | DONE | request_analysis/review/spec_review_v1.md |
| 3 | 实现记录 | DONE | coding/coding_report_v1.md |
| 4 | 代码复核 | DONE | coding/review/code_review_v1.md |
| 5 | 测试计划 | DONE | unit_test/test_plan.md, e2e_test/e2e_plan.md |
| 6 | 测试复核 | DONE | unit_test/review/test_review_v1.md |
| 7 | 提交 / 收口 | DONE | git commit |
| 8 | CI 验证 | DONE | ci_result/ci_summary.md |
| 9 | E2E 验证 | N/A | 纯类型/纯函数改动，无新增可见页面行为 |
| 10 | 部署验证 | N/A | |
| 11 | 用户确认 | DONE | 用户经 AskUserQuestion 选择"继续做前端接线" |

## 说明

- 范围："锦衣卫作为跨阶段共享证据服务"阶段3(前端部分)：给 `EvidenceTrust` 契约补 `jinyiwei_rejected` 字面量，并把 `isUsableByDept()`/`checkEvidenceGate()` 两处安全门都补上对它的拦截。
- 风险：实现前发现原计划设想的"JinyiweiPage 左栏信号流切到 `GET /api/intel/evidence`"比预期复杂得多——`useIntelSignals`/`GET /api/court/intel/signals` 是户部/钦天监/flywheel-recap 等 4 个消费方共用的 hook，不能直接改指向；`JinyiweiPage.tsx` 左栏当前的渲染模型(`IntelSignal` 的 `category`/`level`/`region`/`credibility`)跟 `jinyiwei_evidence` 的实际字段(`claim`/`grade`/`trust`/`deptAffinity`)结构上是两回事，直接"切换数据源"需要重新设计整块左栏渲染，不是简单的 URL 替换。已就此跟用户澄清，本轮范围收窄为类型层面的诚实修复，左栏数据源改造留作独立的、需要专门设计工作的后续任务。
- 验证：`pnpm exec tsc --noEmit`、`pnpm test:node`(989 条测试，983 通过/6 失败，同一组既有无关失败)、`pnpm harness:doctor`。

## 顺带发现，本轮不处理

- `JinyiweiPage.tsx` 左栏信号流仍然依赖恒定 fallback 的 `GET /api/court/intel/signals`——原计划设想的"切到 `GET /api/intel/evidence`"需要重新设计左栏的渲染模型(不同的数据形状)，且 `useIntelSignals` 是跨 4 个功能共用的 hook，不能直接改动。这是一个独立的、需要专门设计工作的后续任务，本轮只做了类型层面的诚实修复。

