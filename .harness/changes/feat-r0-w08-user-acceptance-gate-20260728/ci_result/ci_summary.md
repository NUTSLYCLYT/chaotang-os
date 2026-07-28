# CI 摘要：feat-r0-w08-user-acceptance-gate-20260728

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `python3 -m pytest -q backend/tests/test_w08_product_acceptance_harness.py` | 1 | RED：4 failed / 3 passed | 缺少用户验收 validator / runner | 2026-07-28 |
| `python3 -m pytest -q backend/tests/test_w08_product_acceptance_harness.py` | 0 | 7 passed | golden + user acceptance focused tests | 2026-07-28 |
| `python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py` | 0 | passed / cases 36 | W08 golden acceptance matrix | 2026-07-28 |
| `python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py --user-acceptance backend/harness/chaotang-true-loop/product_acceptance/user_acceptance/w08_user_acceptance_template.json; test $? -eq 1` | 0 | expected fail observed | template cannot pass as final user evidence | 2026-07-28 |
| `cd backend && python3 scripts/harness_doctor.py` | 0 | backend-harness-doctor: 0 errors, 0 warnings | backend harness manifest and required assets | 2026-07-28 |
| `node scripts/harness-doctor.mjs` | 0 | project-harness-doctor: 0 errors, 0 warnings | root harness and delegated doctors | 2026-07-28 |
| `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08` | 0 | GO / APPROVED_WORK_PACKAGE | R0-W08 authority | 2026-07-28 |
| `git diff --check` | 0 | pass | whitespace sanity | 2026-07-28 |

## 结果

W08 非开发用户验收门已建立，自动化验证通过。真实用户验收记录尚未产生，因此本 Packet 为 `VERIFIED_PARTIAL`，不能关闭 W08。

## 未验证项

- 5 名真实非开发用户测试未执行。
- 未验证生产部署、生产数据库、外部 listener 3050。

## Diff 与回滚复核

- changed files：后端 product acceptance runner/tests/docs/template/manifest，根级 change record。
- diff review：范围内，无产品运行时代码修改。
- 回滚是否演练：未演练；回退本 Packet 可完整移除验收门。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| 用户验收记录格式固定 | template + README | PASS |
| 缺失/非法记录 fail closed | pytest + expected template failure | PASS |
| 黄金合同 runner 不回退 | 36 cases passed | PASS |
| harness 清单同步 | backend/root doctor | PASS |
| 真实 5 用户验收 | records 目录无最终记录 | BLOCKED_FOR_REAL_USERS |

## 声明状态

- `VERIFIED_PARTIAL`
