# 任务：fix-r0-w08-user-surfaces-gate-20260729

## 任务 1

- 目标：用 RED 测试证明 final user record 不限制 participant surfaces
- 前置条件：EXT HEAD `714d4f3a`
- 输入：包含 `/admin` 的完整五用户 payload
- 输出：focused test fails because payload incorrectly passes
- 涉及文件：`backend/tests/test_w08_product_acceptance_harness.py`
- 状态 / 数据变化：已完成
- 验证命令与证据：`python3 -m pytest -q backend/tests/test_w08_product_acceptance_harness.py` -> `1 failed, 18 passed`
- 回滚边界：focused test
- 完成定义：failure is `assert True is False`

## 任务 2

- 目标：实现 per-record `surfaces_used` closed-world validation
- 前置条件：RED 已确认
- 输入：`surfaces_used`
- 输出：missing/extra surfaces rejected
- 涉及文件：`run_w08_acceptance.py`
- 状态 / 数据变化：已完成
- 验证命令与证据：focused W08 harness `19 passed`
- 回滚边界：one constant + one validation requirement
- 完成定义：records must use exactly `/shangshufang` and `/shiguan`

## 任务 3

- 目标：同步模板、fixture、说明与 Packet evidence
- 前置条件：任务 2 完成
- 输入：user acceptance template/docs/fixture
- 输出：VERIFIED_PARTIAL Packet
- 涉及文件：W08 user acceptance docs and `.harness/changes/fix-r0-w08-user-surfaces-gate-20260729/`
- 状态 / 数据变化：已完成；模板、fixture、observer checklist、submission checklist、records README 和 Packet evidence 已同步
- 验证命令与证据：
  - `python3 -m pytest -q backend/tests/test_backend_harness_manifest.py backend/tests/test_w08_product_acceptance_harness.py` -> `21 passed`
  - `python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py --closeout-preflight; test $? -eq 1` -> exit 0, inner decision `BLOCKED` because no approved final user acceptance JSON exists
  - `cd backend && python3 scripts/harness_doctor.py` -> `0 errors, 0 warning(s)`
  - `node scripts/harness-doctor.mjs` -> `0 errors, 0 warning(s)`
  - `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08` -> `GO`
  - `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W09 || true` -> `STOP / BLOCKED_DEPENDENCY`
  - `git diff --check` -> exit 0
- 回滚边界：template/docs/change record
- 完成定义：authority、focused tests、preflight、backend/root doctors、diff hygiene 通过
