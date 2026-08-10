# 任务：fix-r0-w08-task-prompt-ref-gate-20260729

## 任务 1

- 目标：用 RED 测试证明 final user acceptance payload 不要求 task prompt ref
- 前置条件：EXT HEAD `7fc2867b`
- 输入：缺少 `task_prompt_ref` 的完整五用户 payload
- 输出：focused test fails because payload incorrectly passes
- 涉及文件：`backend/tests/test_w08_product_acceptance_harness.py`
- 状态 / 数据变化：已完成
- 验证命令与证据：`python3 -m pytest -q backend/tests/test_w08_product_acceptance_harness.py` -> `1 failed, 17 passed`
- 回滚边界：focused test
- 完成定义：failure is `assert True is False`

## 任务 2

- 目标：实现 `task_prompt_ref` fail-closed validation
- 前置条件：RED 已确认
- 输入：`task_prompt_ref`
- 输出：缺失或错误值被拒绝
- 涉及文件：`run_w08_acceptance.py`
- 状态 / 数据变化：已完成
- 验证命令与证据：focused W08 harness `18 passed`
- 回滚边界：one constant + one validation requirement
- 完成定义：valid payloads require `participant_task_card.zh-CN.md`

## 任务 3

- 目标：同步模板、fixture、说明与 Packet evidence
- 前置条件：任务 2 完成
- 输入：user acceptance template/docs/fixture
- 输出：VERIFIED_PARTIAL Packet
- 涉及文件：W08 user acceptance docs and `.harness/changes/fix-r0-w08-task-prompt-ref-gate-20260729/`
- 状态 / 数据变化：已完成
- 验证命令与证据：focused regression set 20 passed；W08 preflight expected BLOCKED；backend/root doctors 0 errors / 0 warnings；R0-W08 authority GO；R0-W09 STOP / BLOCKED_DEPENDENCY；diff check clean
- 回滚边界：template/docs/change record
- 完成定义：authority、focused tests、preflight、backend/root doctors、diff hygiene 通过
