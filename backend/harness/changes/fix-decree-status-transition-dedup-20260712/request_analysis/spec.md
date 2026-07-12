# 需求说明：fix-decree-status-transition-dedup-20260712

## 背景

"统一决策任务生命周期"架构讨论的落地第一阶段。两轮 Explore 摸清现状后发现，`RouteDecisionV2`/`DecreeExecutionStatusV1` 契约本身已经只有一个构造点，真正需要收口的是 `DecisionTask.status`/`CourtReview.review_status` 的转移逻辑——它散在 5 个函数、2 个文件里，其中两对是逐字/完全重复的代码，这正是这次 session 里多轮 bug 的共同病根类型：两处独立维护同一个事实，迟早会算出不一样的答案。

## 范围

- 新增 `_apply_task_decision()`(`shangshufang.py`，因需要调用同文件的 `_archive_task`，放 `decree_status.py` 会成环)。
- 新增 `decide_post_review_status()`(`decree_status.py`，两个真正的调用方都能干净导入)。
- `shangshufang_task_decision`/`shangshufang_brief_decision_advance`/`shangshufang_swarm_deepen`/`outbox_worker._execute_council` 四处改为调用共享函数。

## 非目标

- 不改对外契约、不改前端、不处理密旨/各司/timeline 序号(阶段 2-4)。

## 验收标准

- 两个决策入口对等价动作(adopt/followup/recheck/reject)产生完全一致的 `task.status`。
- 现有测试不回归。

## 验证计划

`pytest tests/test_shangshufang_loop_api.py tests/test_shangshufang_entry.py tests/test_outbox_worker.py tests/test_commercial_loop_harness.py tests/test_legal_redteam_harness.py`，`python3 scripts/harness_doctor.py`。
