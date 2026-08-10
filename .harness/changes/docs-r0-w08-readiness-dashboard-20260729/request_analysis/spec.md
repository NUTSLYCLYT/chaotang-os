# 规格说明：docs-r0-w08-readiness-dashboard-20260729

## 背景

用户要求按 harness 把后续任务尽量做完。W08 当前自动化和证据护栏已经基本成型，但真实非开发用户验收不能由代码生成或模型假造。需要一个精确 HEAD 绑定的 readiness dashboard，作为下一阶段真实用户采集、closeout review 和 W09 前置判断的单一读数。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | W08 authority 为 GO；36 黄金合同 PASS；10 browser flow PASS；用户验收 BLOCKED | exact commands in CI summary | Codex | 否 |
| 推测 | 真实用户记录会由 Product Acceptance Owner 提供 | W08 runbook | Product Acceptance Owner | 否 |
| 未知问题 | 5 名真实非开发用户测试是否达标 | 不适用 | 真实测试后验证 | 是 |

## 数据流与调用链

exact EXT HEAD
-> W08 authority check
-> W08 closeout preflight
-> dashboard gate matrix
-> next required evidence
-> closeout/W09 decision boundary

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| `readiness_dashboard.md` | EXT Master Governance | Product Acceptance Owner / QA Auditor | exact HEAD + command evidence |
| W08 closeout preflight JSON | `run_w08_acceptance.py` | readiness dashboard | command output captured in CI summary |

## 范围

- Generate W08 readiness dashboard.
- Bind it to exact local EXT HEAD/tree.
- Record pass/block gates and next evidence.
- Preserve non-goal boundaries.

## 非目标

- Do not create real user acceptance evidence.
- Do not close W08.
- Do not activate W09.
- Do not alter product runtime code.
- Do not push, deploy, migrate DB, or operate 3050.

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| no approved records JSON | dashboard says BLOCKED | preflight output |
| W08 authority GO | dashboard says W08 active | authority output |
| production/deployment ambiguity | dashboard says not included | non-goals section |

## 风险与回滚边界

Primary risk is drift: teams may treat automation-ready as closeout-ready. The dashboard separates PASS gates from the remaining external evidence blocker. Rollback is limited to this docs-only change record.

## 计划确认记录

- 批准人：用户授权长时任务继续按 harness 完成后续
- 批准日期：20260729
- 批准范围：W08 readiness dashboard / governance evidence
- 明确未批准：fake user evidence、W08 closeout、W09 activation、push、deployment、database migration、listener 3050 operation

## 验收标准

- Dashboard references exact HEAD/tree.
- Dashboard reports golden/browser/user gates accurately.
- Dashboard states W08 is not closeout-ready until real records exist.
- Doctor and authority checks pass.

## 验证计划

- `git rev-parse HEAD && git rev-parse HEAD^{tree}`
- `python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py --closeout-preflight`
- `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08`
- `cd backend && python3 scripts/harness_doctor.py`
- `node scripts/harness-doctor.mjs`
- `git diff --check`
