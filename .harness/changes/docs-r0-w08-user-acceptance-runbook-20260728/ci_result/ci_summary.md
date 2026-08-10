# CI 摘要：docs-r0-w08-user-acceptance-runbook-20260728

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `python3 -m pytest -q backend/tests/test_w08_product_acceptance_harness.py` | 0 | 9 passed | W08 product acceptance focused tests | 2026-07-28 |
| `python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py --closeout-preflight; test $? -eq 1` | 0 | expected `BLOCKED` observed | no real user evidence fail-closed | 2026-07-28 |
| `cd backend && python3 scripts/harness_doctor.py` | 0 | backend-harness-doctor: 0 errors, 0 warnings | backend harness manifest | 2026-07-28 |
| `node scripts/harness-doctor.mjs` | 0 | project-harness-doctor: 0 errors, 0 warnings | root harness inventory | 2026-07-28 |
| `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08` | 0 | GO / APPROVED_WORK_PACKAGE | R0-W08 authority | 2026-07-28 |
| `git diff --check` | 0 | pass | whitespace sanity | 2026-07-28 |

## 结果

`VERIFIED_PARTIAL`。W08 用户验收执行包已建立并纳入后端 harness manifest。真实用户验收记录仍未提交，W08 closeout 仍为 `BLOCKED`。

## 未验证项

- 未执行 5 名真实非开发用户测试。
- 未关闭 W08。
- 未激活 W09。
- 未验证生产部署、数据库迁移或 listener 3050。

## Diff 与回滚复核

- changed files：user acceptance runbook/checklists/rules、backend harness manifest、root change record。
- diff review：文档和 harness 清单；无产品运行时代码。
- 回滚是否演练：未演练；回退本 Packet 即移除执行包。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| session procedure defined | `session_runbook.md` | PASS |
| observer checklist defined | `observer_checklist.md` | PASS |
| acceptance rules defined | `acceptance_rules.md` | PASS |
| submission checklist defined | `submission_checklist.md` | PASS |
| harness manifest protects assets | backend/root doctor | PASS |
| real user records submitted | records directory still empty except README | BLOCKED_FOR_REAL_USERS |

## 声明状态

- `VERIFIED_PARTIAL`
