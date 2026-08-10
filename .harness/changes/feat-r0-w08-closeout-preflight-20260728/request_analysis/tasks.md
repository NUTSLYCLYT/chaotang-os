# 任务：feat-r0-w08-closeout-preflight-20260728

## 任务 1：RED

- 目标：证明当前 W08 runner 不能聚合 closeout 硬门。
- 前置条件：R0-W08 authority 为 GO。
- 输入：现有 W08 runner 和 evidence packets。
- 输出：新增 focused tests。
- 涉及文件：`backend/tests/test_w08_product_acceptance_harness.py`。
- 状态 / 数据变化：无。
- 验证命令与证据：focused pytest -> 2 failed / 7 passed，缺少 `run_closeout_preflight`。
- 回滚边界：删除新增测试 hunk。
- 完成定义：测试因缺少 preflight API 失败。

## 任务 2：GREEN

- 目标：增加最小 closeout preflight。
- 前置条件：RED 已确认。
- 输入：golden cases、browser batch evidence、user acceptance record path。
- 输出：`READY_FOR_CLOSEOUT` 或 `BLOCKED`。
- 涉及文件：`run_w08_acceptance.py`。
- 状态 / 数据变化：无。
- 验证命令与证据：focused pytest -> 9 passed。
- 回滚边界：回退 runner hunk。
- 完成定义：缺用户记录 fail closed，合格 fixture 通过。

## 任务 3：Documentation

- 目标：记录 preflight 使用方式和 W08 仍未关闭的事实。
- 前置条件：GREEN 通过。
- 输入：W08 hard gates。
- 输出：README 与 root change record。
- 涉及文件：`product_acceptance/README.md`、`.harness/changes/feat-r0-w08-closeout-preflight-20260728/`。
- 状态 / 数据变化：无。
- 验证命令与证据：root/backend doctor。
- 回滚边界：删除 change record 并回退 README hunk。
- 完成定义：文档清楚声明无真实用户记录时 `BLOCKED`。
