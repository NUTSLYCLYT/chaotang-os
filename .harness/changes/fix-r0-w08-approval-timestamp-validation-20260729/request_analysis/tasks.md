# 任务：fix-r0-w08-approval-timestamp-validation-20260729

## 任务 1

- 目标：用 RED 测试证明 invalid `approval.approved_at` 可通过 closeout
- 前置条件：EXT HEAD `e0c2fa1b`，W08 authority GO
- 输入：`approved_at = approved yesterday`
- 输出：focused tests 失败
- 涉及文件：`backend/tests/test_w08_product_acceptance_harness.py`
- 状态 / 数据变化：已完成
- 验证命令与证据：focused pytest 1 failed / 16 passed
- 回滚边界：focused test
- 完成定义：失败断言为 closeout should be BLOCKED

## 任务 2

- 目标：实现 UTC ISO-8601 `Z` timestamp validation
- 前置条件：RED 已确认
- 输入：`approval.approved_at`
- 输出：invalid timestamp BLOCKED
- 涉及文件：`run_w08_acceptance.py`
- 状态 / 数据变化：已完成
- 验证命令与证据：focused pytest 17 passed
- 回滚边界：timestamp regex + closeout approval validation
- 完成定义：new and existing focused tests pass

## 任务 3

- 目标：同步 template、docs、dashboard 与 Packet evidence
- 前置条件：GREEN 已确认
- 输入：template、records docs、submission checklist、dashboard
- 输出：VERIFIED_PARTIAL Packet
- 涉及文件：本 change 目录、user acceptance docs、readiness dashboard
- 状态 / 数据变化：已完成
- 验证命令与证据：focused pytest 17 passed；closeout preflight 按预期 BLOCKED；backend/root doctors 0 errors / 0 warnings；R0-W08 authority GO；diff check clean
- 回滚边界：docs/template/change record
- 完成定义：doctor、authority、diff check 通过并提交候选
