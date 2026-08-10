# CI 摘要：fix-r0-w08-user-surfaces-gate-20260729

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `python3 -m pytest -q backend/tests/test_w08_product_acceptance_harness.py` | 1 | RED: `1 failed, 18 passed` | extra `/admin` surface incorrectly passed before the fix | local isolated packet |
| `python3 -m pytest -q backend/tests/test_w08_product_acceptance_harness.py` | 0 | GREEN: `19 passed` | W08 acceptance harness including `surfaces_used` validation | local isolated packet |
| `python3 -m pytest -q backend/tests/test_backend_harness_manifest.py backend/tests/test_w08_product_acceptance_harness.py` | 0 | `21 passed` | backend harness manifest + W08 acceptance focused regression | local isolated packet |
| `python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py --closeout-preflight; test $? -eq 1` | 0 | inner decision `BLOCKED` | W08 closeout remains blocked until real approved user acceptance record exists | local isolated packet |
| `cd backend && python3 scripts/harness_doctor.py` | 0 | `0 errors, 0 warning(s)` | backend harness inventory and required W08 files | local isolated packet |
| `node scripts/harness-doctor.mjs` | 0 | `0 errors, 0 warning(s)` | root harness inventory and authority shape | local isolated packet |
| `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08` | 0 | `GO` | current active work package authority | local isolated packet |
| `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W09 \|\| true` | 0 | `STOP / BLOCKED_DEPENDENCY` | W09 remains blocked while W08 is open | local isolated packet |
| `git diff --check` | 0 | no output | whitespace and diff hygiene | local isolated packet |

## 结果

`VERIFIED_PARTIAL`. The packet adds a machine-checkable closed-world surface gate for W08 final user acceptance records. Each participant record must declare `surfaces_used` exactly as `["/shangshufang", "/shiguan"]`; extra product surfaces such as `/admin` are rejected.

The packet does not create final user evidence and does not close W08. Closeout preflight still intentionally returns `BLOCKED` because `records/` has no approved final user acceptance JSON file.

## 未验证项

- No real final user acceptance session was conducted.
- No production deployment was attempted or claimed.
- No database migration was attempted.
- Listener 3050 was not operated.

## Diff 与回滚复核

- changed files：W08 acceptance runner, focused W08 tests, user acceptance template/fixture/docs, and this root change record.
- diff review：limited to W08 Product Acceptance Hardening and closed-world frontend surface evidence.
- 回滚是否演练：未执行 destructive rollback；回滚边界为本 packet commit。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| extra surfaces are rejected | RED/GREEN focused W08 harness | PASS |
| valid fixture/template remain parseable | focused harness and doctored fixture path | PASS |
| backend/root harness remain healthy | backend/root doctor commands | PASS |
| W08 active, W09 blocked | execution-authority-v2 commands | PASS |
| W08 not falsely closed | closeout preflight inner `BLOCKED` | PASS |

## 声明状态

- `DRAFT / VERIFIED_PARTIAL / VERIFIED_COMPLETE / BLOCKED`：`VERIFIED_PARTIAL`
