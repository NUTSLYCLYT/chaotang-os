# 变更摘要：fix-k0c-retire-feed-flywheel-action-20260714

| Field | Value |
| --- | --- |
| Change ID | fix-k0c-retire-feed-flywheel-action-20260714 |
| Type | fix |
| Status | DRAFT |
| Owner | Frontend Agent |
| Created | 20260714 |

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
| 7 | 提交 / 收口 | TODO | commit message |
| 8 | CI 验证 | DONE | ci_result/ci_summary.md |
| 9 | E2E 验证 | PARTIAL | foreign 3050，见 e2e_test/e2e_summary.md |
| 10 | 部署验证 | PARTIAL | deployment/preview_report.md |
| 11 | 用户确认 | AWAITING_REVIEW | 等待用户确认 |

## 说明

- 范围：从 CourtDoc 类型、mock、adapter allowlist 与 ArchiveCard 移除 legacy `feed_flywheel` 特权写动作。
- 风险：旧后端数据仍可能携带该 action；adapter 必须过滤，旧客户端由 backend 409 tripwire 保护。
- 验证：adapter RED→GREEN 3 passed、TypeScript 0 errors、真实模式 production build PASS、frontend/root doctor PASS；浏览器证据因 foreign 3050 保持 BLOCKED。
