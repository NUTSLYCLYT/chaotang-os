# 任务：chore-ready-for-review-triage-20260714

## 任务 1：发现与定位

- 目标：列出全部精确 `READY_FOR_REVIEW` 状态并定位合入提交。
- 前置条件：保留并行脏文件。
- 输入：root/backend change records、git history。
- 输出：11 项矩阵。
- 涉及文件：`triage.md`。
- 状态 / 数据变化：无运行变化。
- 验证命令与证据：`rg READY_FOR_REVIEW`、`git show --name-only`。
- 回滚边界：删除矩阵。
- 完成定义：无遗漏、每项有 commit 或明确未知。

## 任务 2：独立验收与唯一裁决

- 目标：用现行测试而非旧总结裁决。
- 前置条件：任务 1 完成。
- 输入：专项测试、当前 prod doctor。
- 输出：10 验收合入、1 退回修正、0 未决。
- 涉及文件：11 个原 summary。
- 状态 / 数据变化：只改元数据。
- 验证命令与证据：前端 13/13、true-chain 3/3、lease 9/9、closeout 8/9、prod STOP。
- 回滚边界：恢复原状态会重新打开队列。
- 完成定义：每项只出现一个结论，失败如实保留。

## 任务 3：计划收口与 verification-loop

- 目标：更新 S1 事实并精确提交。
- 前置条件：任务 2 完成。
- 输入：验收矩阵。
- 输出：计划不再声称队列未清算；doctor/diff/security 证据。
- 涉及文件：上线蓝图、S1 inventory、本 change record。
- 状态 / 数据变化：git commit，不 push。
- 验证命令与证据：精确 rg、doctor、diff/secret、当前 prod STOP。
- 回滚边界：revert 单提交。
- 完成定义：状态队列归零且并行代码未被暂存。
