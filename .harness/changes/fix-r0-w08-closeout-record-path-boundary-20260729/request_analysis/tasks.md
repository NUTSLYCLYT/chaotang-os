# 任务：fix-r0-w08-closeout-record-path-boundary-20260729

## 任务 1

- 目标：用 RED 测试证明 records 外显式路径可绕过 closeout 目录边界
- 前置条件：EXT HEAD `3fc0cef2`，W08 authority GO
- 输入：`run_closeout_preflight(user_acceptance_path=<drafts/file>, records_dir=<records>)`
- 输出：测试失败，证明当前实现错误接受 records 外路径
- 涉及文件：`backend/tests/test_w08_product_acceptance_harness.py`
- 状态 / 数据变化：已完成
- 验证命令与证据：focused pytest 1 failed / 13 passed
- 回滚边界：focused test
- 完成定义：失败断言为 `result["passed"] is False`

## 任务 2

- 目标：实现 closeout-only explicit path boundary
- 前置条件：RED 已确认
- 输入：显式 `user_acceptance_path` 与受治理 `records_dir`
- 输出：records 外路径 BLOCKED，records 内路径进入现有 validator
- 涉及文件：`run_w08_acceptance.py`
- 状态 / 数据变化：已完成
- 验证命令与证据：focused pytest 14 passed
- 回滚边界：path-boundary helper
- 完成定义：新旧 focused tests 全部通过

## 任务 3

- 目标：补齐文档、CI 证据和 EXT 整合
- 前置条件：GREEN 已确认
- 输入：W08 records docs、submission checklist、change record
- 输出：VERIFIED_PARTIAL Packet
- 涉及文件：本 change 目录、user acceptance docs
- 状态 / 数据变化：进行中
- 验证命令与证据：待 final verification
- 回滚边界：文档与 change 记录
- 完成定义：doctor、authority、diff check 通过并提交候选
