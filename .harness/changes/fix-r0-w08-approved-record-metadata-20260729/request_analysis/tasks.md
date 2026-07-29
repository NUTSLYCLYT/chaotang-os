# 任务：fix-r0-w08-approved-record-metadata-20260729

## 任务 1

- 目标：用 RED 测试证明无 approval metadata 的 records JSON 可误 closeout
- 前置条件：EXT HEAD `b7971bb7`，W08 authority GO
- 输入：records 内形状正确但无 approval 的 JSON
- 输出：focused tests 失败，证明 closeout-only approved metadata 缺失
- 涉及文件：`backend/tests/test_w08_product_acceptance_harness.py`
- 状态 / 数据变化：已完成
- 验证命令与证据：focused pytest 2 failed / 14 passed
- 回滚边界：focused tests
- 完成定义：失败断言为 closeout should be BLOCKED

## 任务 2

- 目标：实现 closeout-only approval metadata validation
- 前置条件：RED 已确认
- 输入：`approval` object
- 输出：closeout requires APPROVED status and owner/approved_at/evidence_review_id
- 涉及文件：`run_w08_acceptance.py`
- 状态 / 数据变化：已完成
- 验证命令与证据：focused pytest 16 passed
- 回滚边界：approval helper + closeout call path
- 完成定义：草稿文件级 check 保持可用，closeout fail-closed

## 任务 3

- 目标：同步 template、docs、dashboard 与 Packet evidence
- 前置条件：GREEN 已确认
- 输入：user acceptance template/checklist/readiness dashboard
- 输出：VERIFIED_PARTIAL Packet
- 涉及文件：本 change 目录、user acceptance docs、readiness dashboard
- 状态 / 数据变化：已完成
- 验证命令与证据：focused pytest、expected BLOCKED preflight、backend/root doctor、authority、diff check
- 回滚边界：docs/template/change record
- 完成定义：doctor、authority、diff check 通过并提交候选
