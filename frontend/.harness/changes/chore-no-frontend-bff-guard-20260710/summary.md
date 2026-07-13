# 变更摘要：chore-no-frontend-bff-guard-20260710

| Field | Value |
| --- | --- |
| Change ID | chore-no-frontend-bff-guard-20260710 |
| Type | chore |
| Status | DRAFT |
| Owner | Frontend Agent |
| Created | 20260710 |

## 阶段

| # | 阶段 | Status | 证据 |
| ---: | --- | --- | --- |
| 0 | 加载上下文 | DONE | 已加载 harness 上下文 |
| 1 | 需求分析 | TODO | request_analysis/spec.md, tasks.md |
| 2 | 需求复核 | TODO | request_analysis/review/spec_review_v1.md |
| 3 | 实现记录 | TODO | coding/coding_report_v1.md |
| 4 | 代码复核 | TODO | coding/review/code_review_v1.md |
| 5 | 测试计划 | TODO | unit_test/test_plan.md, e2e_test/e2e_plan.md |
| 6 | 测试复核 | TODO | unit_test/review/test_review_v1.md |
| 7 | 提交 / 收口 | TODO | commit message |
| 8 | CI 验证 | TODO | ci_result/ci_summary.md |
| 9 | E2E 验证 | TODO | e2e_test/e2e_summary.md |
| 10 | 部署验证 | TODO | deployment/preview_report.md |
| 11 | 用户确认 | TODO | 等待用户确认 |

## 说明

- 范围：前端入口文档、前端 harness 边界规则、项目结构规则、API 契约 wiki、架构 wiki 与 `frontend/scripts/harness-doctor.mjs`。
- 风险：阻断所有 `src/app/**/route.*`，如未来确有非 BFF 的 Next.js route handler 需求，必须先通过架构评审调整规则；当前约定下前端不允许增加 BFF 层。
- 验证：运行 `pnpm harness:doctor`，确认 `src/app/api/**` 与 `src/app/**/route.*` 会被前端 harness doctor 拦截。

