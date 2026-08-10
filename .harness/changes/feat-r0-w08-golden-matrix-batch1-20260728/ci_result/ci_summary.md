# CI 摘要：feat-r0-w08-golden-matrix-batch1-20260728

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `python3 -m pytest -q backend/tests/test_w08_product_acceptance_harness.py` | 1 | RED：expected 6 but got 1 | TDD baseline | 20260728 |
| `python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py` | 1 | exposed old risk-family whitelist | validator diagnosis | 20260728 |
| `python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py` | 0 | passed true / cases 6 | W08 Batch 1 runner | 20260728 |
| `python3 -m pytest -q backend/tests/test_w08_product_acceptance_harness.py` | 0 | 3 passed | Batch 1 focused tests | 20260728 |
| `python3 backend/scripts/harness_doctor.py` | 0 | 0 errors / 0 warnings | backend harness change record | 20260728 |
| `git diff --check` | 0 | clean | whitespace/conflict marker check | 20260728 |

## 结果

`VERIFIED_PARTIAL`。Batch 1 6/36 黄金合同矩阵通过 focused verification。

## 未验证项

- 30 个剩余黄金合同未完成。
- 10/10 real backend browser flow 未执行。
- 5 名非开发用户验收未执行。

## Diff 与回滚复核

- changed files：见 candidate diff。
- diff review：待 Codex final review。
- 回滚是否演练：未演练。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| 6 case matrix | runner / pytest | PASS |
| 36 final matrix | 后续扩展 | NOT_COMPLETE |
| browser / human acceptance | 后续 Packet | NOT_STARTED |

## 声明状态

- `DRAFT / VERIFIED_PARTIAL / VERIFIED_COMPLETE / BLOCKED`：VERIFIED_PARTIAL
