# 变更摘要：fix-launch-s1-p0-canonical-deploy-paths-20260714

| Field | Value |
| --- | --- |
| Change ID | fix-launch-s1-p0-canonical-deploy-paths-20260714 |
| Type | fix |
| Status | DRAFT |
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
| 7 | 提交 / 收口 | AWAITING_REVIEW | 尚未 commit/push |
| 8 | CI 验证 | PARTIAL | 代码检查通过；systemd 目标机 executable 前置条件未满足 |
| 9 | E2E 验证 | N/A | 无浏览器行为变更，且未接管 3050 |
| 10 | 部署验证 | PARTIAL | compose 通过；prod:doctor 诚实 STOP |
| 11 | 用户确认 | AWAITING_REVIEW | 等待用户确认 |

## 说明

- 范围：只收敛本批 P0 compose、service、恢复文档的代码真源路径。
- 风险：backend executable/venv 安装契约尚未统一；3050 仍属外部工作区。
- 验证：逐文件 RED→GREEN；type/build、24 项 production 回归、28 项 backend 代表测试与三层 doctor；完整结果见 CI/部署报告。
