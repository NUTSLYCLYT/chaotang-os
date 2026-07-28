# 任务：test-r0-w08-user-acceptance-fixture-20260729

## 任务 1：RED

- 目标：证明缺少可运行的用户验收 fixture。
- 前置条件：W08 user acceptance validator 已存在。
- 输入：新增 focused test。
- 输出：pytest 失败。
- 涉及文件：`backend/tests/test_w08_product_acceptance_harness.py`。
- 状态 / 数据变化：无。
- 验证命令与证据：focused pytest -> 1 failed / 9 passed。
- 回滚边界：删除测试 hunk。
- 完成定义：失败原因是 fixture 缺失。

## 任务 2：GREEN

- 目标：增加 fixture，并确保它只用于测试/演练。
- 前置条件：RED 已确认。
- 输入：`w08-user-acceptance.v1` shape。
- 输出：`fixtures/valid_closeout_example.json`。
- 涉及文件：`user_acceptance/fixtures/**`。
- 状态 / 数据变化：无真实用户记录写入。
- 验证命令与证据：focused pytest -> 10 passed。
- 回滚边界：删除 fixture。
- 完成定义：fixture 能通过 validator 和 preflight，但路径不在 `records/`。

## 任务 3：Harness 登记

- 目标：让 fixture 成为受保护测试资产。
- 前置条件：GREEN 通过。
- 输入：backend harness manifest。
- 输出：manifest required list 增加 fixture 文件。
- 涉及文件：`backend/harness/manifest.json`。
- 状态 / 数据变化：无。
- 验证命令与证据：backend/root doctor。
- 回滚边界：回退 manifest hunk。
- 完成定义：doctor 通过。
