# CI 摘要：docs-r0-w08-user-acceptance-execution-packet-20260729

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08` | 0 | GO | W08 execution authority | local / 2026-07-29T15:07:03Z |
| `python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py` | 0 | PASS | 36 golden contracts | local / 2026-07-29 |
| `python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py --closeout-preflight` | 1 | EXPECTED BLOCKED | closeout gate | local / 2026-07-29 |
| `/tmp/chaotang-w08-pytest-venv/bin/python -m pytest backend/tests/test_w08_product_acceptance_harness.py -q` | 0 | 19 passed | W08 harness tests | local / 2026-07-29 |
| `/tmp/chaotang-w08-pytest-venv/bin/python -m pytest backend/tests/test_shangshufang_loop_api.py -q` | 0 | 25 passed | Shangshufang contract loop API | local / 2026-07-29 |
| `/tmp/chaotang-w08-pytest-venv/bin/python -m pytest backend/tests/test_contract_task_projection.py backend/tests/test_contract_task_read_model_api.py -q` | 0 | 67 passed | contract projection/read model | local / 2026-07-29 |
| `cd frontend && pnpm exec tsc --noEmit` | 0 | PASS | frontend typecheck | local / 2026-07-29 |
| `cd frontend && pnpm exec playwright test --config=playwright.w08-browser-batch2.config.ts` | 0 | 3 passed | W08 browser flows 2-4 | local / 2026-07-29 |
| `cd frontend && pnpm exec playwright test --config=playwright.w08-browser-batch3.config.ts` | 0 | 3 passed | W08 browser flows 5-7 | local / 2026-07-29 |
| `cd frontend && pnpm exec playwright test --config=playwright.w08-browser-batch4.config.ts` | 0 | 3 passed | W08 browser flows 8-10 | local / 2026-07-29 |

## 结果

`VERIFIED_PARTIAL`。

机器可验证的 W08 产品验收材料已通过；最终 closeout 仍因真实用户验收记录缺失而正确 fail-closed。

## 未验证项

- 尚未收到 5 名非开发用户的 approved record。
- 尚未运行 `--user-acceptance records/<approved-record>.json`。
- 尚未生成 W08 quiescent closeout candidate。
- 未验证生产部署；本 Packet 不包含生产部署。

## Diff 与回滚复核

- changed files：
  - `.harness/changes/docs-r0-w08-user-acceptance-execution-packet-20260729/summary.md`
  - `.harness/changes/docs-r0-w08-user-acceptance-execution-packet-20260729/request_analysis/spec.md`
  - `.harness/changes/docs-r0-w08-user-acceptance-execution-packet-20260729/request_analysis/tasks.md`
  - `.harness/changes/docs-r0-w08-user-acceptance-execution-packet-20260729/ci_result/ci_summary.md`
- diff review：docs-only Packet；不改产品代码，不改 authority manifest。
- 回滚是否演练：未演练；删除本 Packet 目录即可回滚。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| W08 authority 可执行 | v2 authority GO | PASS |
| 黄金合同矩阵完整 | 36/36 runner PASS | PASS |
| browser flow 达到 10/10 | harness closeout gate browser flow PASS；fresh batch2/3/4 为 9/9 | PASS |
| 用户验收记录存在 | records/ 下 approved JSON | BLOCKED |
| W08 closeout ready | `--closeout-preflight` READY_FOR_CLOSEOUT | BLOCKED |

## 声明状态

- `VERIFIED_PARTIAL / BLOCKED_ON_REAL_USER_RECORDS`
