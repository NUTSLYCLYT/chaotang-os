# 任务：fix-r0-w08-records-auto-discovery-20260729

## 任务 1

- 目标：建立 W08 records 自动发现 RED 测试
- 前置条件：EXT HEAD `ac5a7174`，W08 authority GO
- 输入：现有 W08 closeout preflight
- 输出：缺少 `records_dir` 支持导致 focused tests 失败
- 涉及文件：`backend/tests/test_w08_product_acceptance_harness.py`
- 状态 / 数据变化：已完成
- 验证命令与证据：`pytest` 3 failed / 10 passed
- 回滚边界：测试文件
- 完成定义：失败原因指向缺少自动发现实现

## 任务 2

- 目标：实现 deterministic records discovery
- 前置条件：RED 已确认
- 输入：`user_acceptance/records/*.json`
- 输出：0/多文件 BLOCKED，1 文件进入现有 validator
- 涉及文件：`run_w08_acceptance.py`
- 状态 / 数据变化：已完成
- 验证命令与证据：focused pytest 13 passed
- 回滚边界：runner discovery helper
- 完成定义：新旧 tests 全部通过

## 任务 3

- 目标：补齐文档和 Packet 证据
- 前置条件：GREEN 已确认
- 输入：W08 runbook / checklist
- 输出：records 目录规则、submission checklist、change evidence
- 涉及文件：本 change 目录、user acceptance docs
- 状态 / 数据变化：已完成
- 验证命令与证据：focused pytest、expected BLOCKED preflight、fixture rejection、backend/root doctor、authority、diff check
- 回滚边界：文档与 change 记录
- 完成定义：doctor、authority、diff check 通过并提交候选
