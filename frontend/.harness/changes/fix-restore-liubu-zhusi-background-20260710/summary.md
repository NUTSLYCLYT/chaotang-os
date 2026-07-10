# 变更摘要：fix-restore-liubu-zhusi-background-20260710

| Field | Value |
| --- | --- |
| Change ID | fix-restore-liubu-zhusi-background-20260710 |
| Type | fix |
| Status | DRAFT |
| Owner | Frontend Agent |
| Created | 20260710 |

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
| 7 | 提交 / 收口 | N/A | 未请求提交 |
| 8 | CI 验证 | PASSED | ci_result/ci_summary.md |
| 9 | E2E 验证 | PASSED | e2e_test/e2e_summary.md |
| 10 | 部署验证 | N/A | deployment/preview_report.md |
| 11 | 用户确认 | AWAITING_REVIEW | 等待用户确认 |

## 说明

- 范围：恢复六部宫苑背景主页与专署写实背景门户，专署通过入口卡进入锦衣卫二级页面。
- 风险：本机后端部分既有接口状态异常，不影响背景和静态入口。
- 验证：TypeScript、production build、Playwright 截图/DOM/图片资源、harness doctor。

