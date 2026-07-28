# CI 摘要：test-r0-w08-user-acceptance-fixture-20260729

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `python3 -m pytest -q backend/tests/test_w08_product_acceptance_harness.py` | 1 | RED：1 failed / 9 passed | fixture 缺失 | 2026-07-29 |
| `python3 -m pytest -q backend/tests/test_w08_product_acceptance_harness.py` | 0 | 10 passed | W08 fixture/user/preflight focused tests | 2026-07-29 |
| `python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py --user-acceptance backend/harness/chaotang-true-loop/product_acceptance/user_acceptance/fixtures/valid_closeout_example.json` | 0 | passed / records 5 / successes 5 | fixture shape validation | 2026-07-29 |
| `python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py --closeout-preflight; test $? -eq 1` | 0 | expected `BLOCKED` observed | no real records fail-closed | 2026-07-29 |
| `cd backend && python3 scripts/harness_doctor.py` | 0 | backend-harness-doctor: 0 errors, 0 warnings | backend harness manifest | 2026-07-29 |
| `node scripts/harness-doctor.mjs` | 0 | project-harness-doctor: 0 errors, 0 warnings | root harness inventory | 2026-07-29 |
| `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08` | 0 | GO / APPROVED_WORK_PACKAGE | R0-W08 authority | 2026-07-29 |
| `git diff --check` | 0 | pass | whitespace sanity | 2026-07-29 |

## 结果

`VERIFIED_PARTIAL`。W08 用户验收 fixture 已建立并受测试/manifest 保护。fixture 不在 `records/` 目录，不能作为真实验收证据。

## 未验证项

- 未执行 5 名真实非开发用户测试。
- 未提交真实 `records/<approved-record>.json`。
- 未关闭 W08。
- 未激活 W09。
- 未验证生产部署、数据库迁移或 listener 3050。

## Diff 与回滚复核

- changed files：fixture README/JSON、user acceptance README、backend harness manifest、focused tests、root change record。
- diff review：测试/fixture/harness 清单；无产品运行时代码。
- 回滚是否演练：未演练；回退本 Packet 即移除 fixture。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| fixture validates expected shape | CLI + pytest | PASS |
| fixture not in real records path | pytest path assertion | PASS |
| no-real-record preflight remains BLOCKED | CLI expected failure | PASS |
| harness manifest protects fixture | backend/root doctor | PASS |
| real user records submitted | records directory unchanged | BLOCKED_FOR_REAL_USERS |

## 声明状态

- `VERIFIED_PARTIAL`
