# 变更摘要：fix-canonical-jiqun-smoke-start-help-20260714

| Field | Value |
| --- | --- |
| Change ID | fix-canonical-jiqun-smoke-start-help-20260714 |
| Type | fix |
| Status | DELIVERED |
| Owner | Frontend Agent |
| Created | 20260714 |

## 阶段

| # | 阶段 | Status | 证据 |
| ---: | --- | --- | --- |
| 0 | 加载上下文 | DONE | 已加载 harness 上下文 |
| 1 | 需求分析 | DONE | request_analysis/spec.md, tasks.md |
| 2 | 需求复核 | APPROVED | request_analysis/review/spec_review_v1.md |
| 3 | 实现记录 | DONE | coding/coding_report_v1.md |
| 4 | 代码复核 | APPROVED | coding/review/code_review_v1.md |
| 5 | 测试计划 | DONE | unit_test/test_plan.md, e2e_test/e2e_plan.md |
| 6 | 测试复核 | APPROVED | unit_test/review/test_review_v1.md |
| 7 | 提交 / 收口 | DONE | `fix: route smoke help to canonical backend launcher` |
| 8 | CI 验证 | PASSED | ci_result/ci_summary.md |
| 9 | E2E 验证 | N/A | 无浏览器行为 |
| 10 | 部署验证 | PARTIAL | 真实 DOWN CLI；未部署 |
| 11 | 用户确认 | CONFIRMED | 用户要求下一步 |

## 说明

- 范围：smoke DOWN 分支的操作员启动帮助。
- 风险：相对路径只适用于 frontend cwd；输出已明确该前提。
- 验证：RED→GREEN、实际 DOWN、type/build、主链、doctor、prod STOP。
