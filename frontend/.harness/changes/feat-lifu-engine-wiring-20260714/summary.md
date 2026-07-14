# 变更摘要：feat-lifu-engine-wiring-20260714

| Field | Value |
| --- | --- |
| Change ID | feat-lifu-engine-wiring-20260714 |
| Type | feat |
| Status | DELIVERED |
| Owner | Frontend Agent |
| Created | 20260714 |

## 阶段

| # | 阶段 | Status | 证据 |
| ---: | --- | --- | --- |
| 0 | 加载上下文 | DONE | 根级与前端 AGENTS、边界、架构和 API 契约已读取 |
| 1 | 需求分析 | DONE | request_analysis/spec.md, tasks.md |
| 2 | 需求复核 | DONE | request_analysis/review/spec_review_v1.md |
| 3 | 实现记录 | DONE | coding/coding_report_v1.md |
| 4 | 代码复核 | DONE | coding/review/code_review_v1.md |
| 5 | 测试计划 | DONE | unit_test/test_plan.md, e2e_test/e2e_plan.md |
| 6 | 测试复核 | DONE | unit_test/review/test_review_v1.md |
| 7 | 提交 / 收口 | DONE | 分支 feat/lifu-engine-wiring-20260714，提交带 Change trailer |
| 8 | CI 验证 | DONE | ci_result/ci_summary.md |
| 9 | E2E 验证 | N/A | e2e_test/e2e_summary.md（任务指定聚焦 adapter nodetest） |
| 10 | 部署验证 | N/A | deployment/preview_report.md（未部署、未推送） |
| 11 | 用户确认 | AWAITING_REVIEW | 实现、文档、回归测试和验证证据齐备 |

## 说明

- 礼部工作台 `commitment_gate` 通过类型化 adapter 调用后端 canonical endpoint `/api/swarm/lipu/compliance-report`。
- 用户可见硬灯只展示后端 `lipu_vet` 确定性判定；两路软意见不覆盖硬灯。
- 所有后端 `source_label` 原样展示；网络、HTTP 或响应形状失败只返回 `FALLBACK` 错误态。
- 花名册仅 `commitment_gate` 标记真实引擎；其它礼部本地交互模块改回 `engine:false`。
- 没有新增 `src/app/api/**`、`route.*`、BFF、后端逻辑或 dadian 变更。

## 回滚

回滚本 change 对应提交即可同时移除 adapter/UI、恢复 roster 与产品文档，并删除本变更记录；后端无需回滚。
