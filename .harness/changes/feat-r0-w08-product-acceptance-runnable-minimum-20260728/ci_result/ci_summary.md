# CI 摘要：feat-r0-w08-product-acceptance-runnable-minimum-20260728

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `python3 -m pytest -q backend/tests/test_w08_product_acceptance_harness.py` | 1 | RED：runner missing | TDD negative baseline | 20260728 |
| `python3 -m pytest -q backend/tests/test_w08_product_acceptance_harness.py` | 0 | 3 passed | W08 acceptance harness positive/negative rules | 20260728 |
| `python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py` | 0 | passed true / cases 1 | W08 RUNNABLE_MINIMUM validator | 20260728 |
| `python3 backend/scripts/harness_doctor.py` | 0 | 0 errors / 0 warnings | backend harness manifest and change record | 20260728 |
| `node scripts/harness-doctor.mjs` | 0 | 0 errors / 0 warnings | root, frontend, backend delegated harness | 20260728 |
| `git diff --check` | 0 | clean | whitespace/conflict marker check | 20260728 |

## 结果

`VERIFIED_PARTIAL`。W08 RUNNABLE_MINIMUM harness 已建立并通过 focused verification。

## 未验证项

- 36 黄金合同尚未完成。
- 10/10 real backend browser flow 尚未执行。
- 5 名非开发用户至少 4 成功尚未执行。
- 本 Packet 未执行 push、部署、数据库迁移或 3050 操作。

## Diff 与回滚复核

- changed files：见 `git diff --stat`。
- diff review：待最终 Codex review。
- 回滚是否演练：未演练；回滚边界为新增 harness/test 和 manifest 单项登记。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| RUNNABLE_MINIMUM case exists | `w08_contracts.json` | PASS |
| Validator rejects mock/replay/artifact lineage gaps | focused pytest | PASS |
| Final W08 acceptance complete | 36/10/5 evidence | NOT_STARTED |

## 声明状态

- `DRAFT / VERIFIED_PARTIAL / VERIFIED_COMPLETE / BLOCKED`：VERIFIED_PARTIAL
