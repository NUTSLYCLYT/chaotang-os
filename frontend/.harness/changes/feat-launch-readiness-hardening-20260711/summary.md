# 变更摘要：feat-launch-readiness-hardening-20260711

| Field | Value |
| --- | --- |
| Change ID | feat-launch-readiness-hardening-20260711 |
| Type | feat |
| Status | DRAFT |
| Owner | Frontend Agent |
| Created | 20260711 |

## 阶段

| # | 阶段 | Status | 证据 |
| ---: | --- | --- | --- |
| 0 | 加载上下文 | DONE | 已加载 harness 上下文 |
| 1 | 需求分析 | DONE | request_analysis/spec.md, tasks.md |
| 2 | 需求复核 | AWAITING_REVIEW | 等待用户对密旨降级文案与 E2E 范围确认 |
| 3 | 实现记录 | PARTIAL | coding/coding_report_v1.md(任务 1、3 完成；任务 1 复用既有 e2e spec 揪出 /enter 准入绕过 + /register 无前端拦截两个真 bug 并修复，8/8 转绿；任务 3 含 5 轮 Codex 停止前审查纠正；任务 2/4 未开始) |
| 4 | 代码复核 | TODO | coding/review/code_review_v1.md |
| 5 | 测试计划 | TODO | unit_test/test_plan.md, e2e_test/e2e_plan.md |
| 6 | 测试复核 | TODO | unit_test/review/test_review_v1.md |
| 7 | 提交 / 收口 | TODO | commit message |
| 8 | CI 验证 | TODO | ci_result/ci_summary.md |
| 9 | E2E 验证 | TODO | e2e_test/e2e_summary.md |
| 10 | 部署验证 | TODO | deployment/preview_report.md |
| 11 | 用户确认 | TODO | 等待用户确认 |

## 说明

- 范围：注册→登录 E2E 底线测试、下旨提交→终态 E2E 底线测试、密旨入口诚实降级(UI 层)、契约漂移检查脚本(接入 harness:doctor)。详见 request_analysis/tasks.md 任务 1-4。
- 风险：E2E 依赖真实后端(8081)与真实邀请码/账号；密旨路由本身的产品决策(接入真实调度 vs 保持占位)不在本轮范围内，只做诚实标注。
- 验证：`pnpm exec playwright test`、`pnpm exec tsc --noEmit`、`pnpm build`、`pnpm harness:doctor`。

