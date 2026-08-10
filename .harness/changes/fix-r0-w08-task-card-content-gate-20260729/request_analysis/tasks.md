# 任务：fix-r0-w08-task-card-content-gate-20260729

## 任务 1

- 目标：用 RED 测试证明 task card 未绑定 canonical acceptance objects
- 前置条件：EXT HEAD `fbace9e9`
- 输入：participant task card
- 输出：focused test fails
- 涉及文件：`backend/tests/test_backend_harness_manifest.py`
- 状态 / 数据变化：已完成
- 验证命令与证据：`python3 -m pytest -q backend/tests/test_backend_harness_manifest.py` -> `1 failed, 1 passed`
- 回滚边界：focused test
- 完成定义：failure points to missing canonical object terms

## 任务 2

- 目标：补齐 task card canonical object wording
- 前置条件：RED 已确认
- 输入：MissionContract、RiskItem、ContractReviewPack、ArtifactManifest、ArchiveReceipt
- 输出：task card 明确命名完整闭环对象
- 涉及文件：`participant_task_card.zh-CN.md`
- 状态 / 数据变化：已完成；无用户证据生成
- 验证命令与证据：focused manifest test `2 passed`
- 回滚边界：task card wording
- 完成定义：test covers canonical object terms

## 任务 3

- 目标：完成 Packet evidence 与 post-integration verification
- 前置条件：任务 1、2 完成
- 输入：change record
- 输出：VERIFIED_PARTIAL Packet
- 涉及文件：`.harness/changes/fix-r0-w08-task-card-content-gate-20260729/`
- 状态 / 数据变化：已完成
- 验证命令与证据：focused regression set 19 passed；W08 preflight expected BLOCKED；backend/root doctors 0 errors / 0 warnings；R0-W08 authority GO
- 回滚边界：change record
- 完成定义：authority、focused tests、preflight、backend/root doctors、diff hygiene 通过
