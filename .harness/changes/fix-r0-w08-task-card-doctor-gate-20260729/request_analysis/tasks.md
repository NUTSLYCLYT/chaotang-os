# 任务：fix-r0-w08-task-card-doctor-gate-20260729

## 任务 1

- 目标：用 RED 测试证明 W08 task card 未进入 backend doctor required surface
- 前置条件：EXT HEAD `4bea049a`
- 输入：`backend/harness/manifest.json`
- 输出：focused manifest test fails
- 涉及文件：`backend/tests/test_backend_harness_manifest.py`
- 状态 / 数据变化：已完成
- 验证命令与证据：`python3 -m pytest -q backend/tests/test_backend_harness_manifest.py` -> `1 failed`
- 回滚边界：focused test
- 完成定义：failure points to missing `participant_task_card.zh-CN.md` in `chaotang-true-loop.required`

## 任务 2

- 目标：将 W08 task card 加入 backend harness manifest required list
- 前置条件：RED 已确认
- 输入：manifest required surface
- 输出：backend doctor checks task card presence
- 涉及文件：`backend/harness/manifest.json`
- 状态 / 数据变化：已完成
- 验证命令与证据：focused manifest test `1 passed`；backend doctor lists task card and returns 0 errors / 0 warnings
- 回滚边界：manifest entry
- 完成定义：task card deletion becomes doctor-detectable

## 任务 3

- 目标：完成 Packet evidence 与 post-integration verification
- 前置条件：任务 1、2 完成
- 输入：change record
- 输出：VERIFIED_PARTIAL Packet
- 涉及文件：`.harness/changes/fix-r0-w08-task-card-doctor-gate-20260729/`
- 状态 / 数据变化：已完成
- 验证命令与证据：focused regression set 18 passed；W08 preflight expected BLOCKED；backend/root doctors 0 errors / 0 warnings；R0-W08 authority GO；diff check clean
- 回滚边界：change record
- 完成定义：authority、focused tests、W08 preflight、backend/root doctors、diff hygiene 通过
