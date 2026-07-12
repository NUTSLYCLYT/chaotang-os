# 后端变更摘要：fix-decree-status-transition-dedup-20260712

| Field | Value |
| --- | --- |
| Change ID | fix-decree-status-transition-dedup-20260712 |
| Status | DELIVERED |
| Owner | 后端 harness |
| Date | 20260712 |

## 摘要

收口 `DecisionTask.status`/`CourtReview.review_status` 的裁决状态转移逻辑——此前 `shangshufang_task_decision`(`/tasks/{id}/decision`)和 `shangshufang_brief_decision_advance`(`/briefs/{id}/decision/advance`)各自独立写了一份几乎逐字重复的 adopt/request_evidence/recheck/reject 分支；`shangshufang_swarm_deepen` 和 `outbox_worker._execute_council` 也各自独立写了一份完全相同的质量门通过/未通过三元表达式。这是"统一决策任务生命周期"这轮架构工作的第一阶段(见 `/home/ubuntu/.claude/plans/valiant-crunching-candy.md`)。

## 范围

- `backend/web/routers/shangshufang.py`：新增 `_apply_task_decision()`，收口两个决策入口的状态转移分支。
- `backend/src/chancellor/decree_status.py`：新增 `decide_post_review_status()`，收口两处质量门三元表达式。
- `backend/src/execution/outbox_worker.py`：改调共享函数。
- `backend/tests/test_shangshufang_loop_api.py`：新增 `test_task_decision_and_brief_decision_advance_agree`，参数化断言两个决策入口对等价动作产生一致状态。

## 非目标

- 不改变对外契约字段(`RouteDecisionV2`/`DecreeExecutionStatusV1` 不动，它们已经只有一个构造点)。
- 不改前端。
- 不处理密旨/各司手动派单/TimelineEvent 序号——这些是后续阶段 2-4，见同一份计划文件。

## 验证

- `python3 -m pytest -q tests/test_shangshufang_loop_api.py tests/test_shangshufang_entry.py tests/test_outbox_worker.py`：26 passed，1 failed(`test_chancellor_chat_streams_single_agent_reply`，对真实 LLM 输出文本的断言，`git stash` 验证过改动前就失败，与本次改动无关)。
- `python3 -m pytest -q tests/test_commercial_loop_harness.py tests/test_legal_redteam_harness.py`：33 passed。
- `python3 scripts/harness_doctor.py`：0 errors, 0 warnings。
