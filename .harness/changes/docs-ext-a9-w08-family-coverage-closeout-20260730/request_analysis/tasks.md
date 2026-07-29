# 任务：docs-ext-a9-w08-family-coverage-closeout-20260730

## 任务 1：盘点 W08 refs 与 change records

- 目标：确认 W08 branch family 的库存范围。
- 前置条件：R0-W08 authority 为 GO，R0-W09 为 STOP。
- 输入：`refs/heads`、`refs/remotes`、`.harness/changes/*r0-w08*/summary.md`。
- 输出：W08 ref/change inventory。
- 涉及文件：本 Packet。
- 状态 / 数据变化：docs-only。
- 验证命令与证据：
  - `git for-each-ref --format=... refs/heads refs/remotes | rg 'r0-w08'`
  - `find .harness/changes -maxdepth 2 -path '*r0-w08*' -name summary.md`
- 回滚边界：删除本 Packet。
- 完成定义：W08 ref family and root change records are counted and grouped.

## 任务 2：确认是否还有未吸收分支库存

- 目标：逐个确认 W08 refs 是否已经是当前 EXT 祖先。
- 前置条件：任务 1 完成。
- 输入：W08 ref list。
- 输出：ancestor coverage result。
- 涉及文件：`w08_family_coverage_closeout.md`。
- 状态 / 数据变化：docs-only。
- 验证命令与证据：
  - `git merge-base --is-ancestor <r0-w08-ref> feature-chaotang-ext`
- 回滚边界：删除或修订本 Packet。
- 完成定义：所有 inspected W08 refs have `ANCESTOR` result or an open gap.
- 当前状态：`COMPLETE`，所有本地 W08 refs 均为 `ANCESTOR`。

## 任务 3：确认 W08 剩余阻塞不是分支融合问题

- 目标：运行 W08 closeout gate，确认剩余阻塞项。
- 前置条件：任务 2 完成。
- 输入：当前 EXT HEAD 的 W08 product acceptance harness。
- 输出：W08 branch family disposition and W08 closeout blocker。
- 涉及文件：`w08_family_coverage_closeout.md`、`ci_result/ci_summary.md`。
- 状态 / 数据变化：docs-only。
- 验证命令与证据：
  - `python3 -m pytest -q backend/tests/test_w08_product_acceptance_harness.py`
  - `python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py --closeout-preflight; test $? -eq 1`
- 回滚边界：删除或修订本 Packet。
- 完成定义：W08 branch family marked `SUPERSEDED_BY_EXT_HEAD`; W08 closeout remains blocked only by real user acceptance records.
