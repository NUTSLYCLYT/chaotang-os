# 任务：fix-r0-w08-reject-fixture-records-20260729

## 任务 1：RED

- 目标：证明 fixture payload 可被最终验收误接受。
- 前置条件：W08 fixture 已存在。
- 输入：focused tests。
- 输出：pytest 失败。
- 涉及文件：`backend/tests/test_w08_product_acceptance_harness.py`。
- 状态 / 数据变化：无。
- 验证命令与证据：focused pytest -> 2 failed / 9 passed。
- 回滚边界：删除测试 hunk。
- 完成定义：失败原因是缺少 `allow_fixture` 和 `fixture-*` 拒绝规则。

## 任务 2：GREEN

- 目标：拒绝 fixture payload / fixture IDs 作为最终证据。
- 前置条件：RED 已确认。
- 输入：W08 user acceptance validator。
- 输出：`allow_fixture` rehearsal mode and final rejection.
- 涉及文件：`run_w08_acceptance.py`。
- 状态 / 数据变化：无真实记录写入。
- 验证命令与证据：focused pytest -> 11 passed。
- 回滚边界：回退 runner hunk。
- 完成定义：fixture only passes shape rehearsal; final validation fails closed.

## 任务 3：Documentation

- 目标：记录 fixture 前缀为保留测试前缀。
- 前置条件：GREEN 通过。
- 输入：fixture README / acceptance rules。
- 输出：文档更新。
- 涉及文件：`user_acceptance/fixtures/README.md`、`acceptance_rules.md`。
- 状态 / 数据变化：无。
- 验证命令与证据：root/backend doctor。
- 回滚边界：回退 docs hunk。
- 完成定义：文档明确 fixture 不能关闭 W08。
