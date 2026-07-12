# 任务：fix-decree-status-transition-dedup-20260712

## 任务 1：收口决策动作状态转移

- 目标：消除 `shangshufang_task_decision`/`shangshufang_brief_decision_advance` 之间重复的 adopt/request_evidence/recheck/reject 分支。
- 输出：`_apply_task_decision()`，两处调用点改造。
- 验收：已完成，见 summary.md。

## 任务 2：收口质量门后置状态判断

- 目标：消除 `shangshufang_swarm_deepen`/`outbox_worker._execute_council` 之间重复的三元表达式。
- 输出：`decide_post_review_status()`，两处调用点改造。
- 验收：已完成，见 summary.md。

## 任务 3：补一致性回归测试

- 目标：证明两个决策入口对等价动作产生一致状态，而不是分别断言两次可能悄悄不一致的期望值。
- 输出：`test_task_decision_and_brief_decision_advance_agree`。
- 验收：已完成，通过。
