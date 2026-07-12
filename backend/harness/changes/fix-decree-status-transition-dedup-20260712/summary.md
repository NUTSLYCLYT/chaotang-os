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

## Codex 停止前审查纠正(2026-07-12)

Codex 停止前审查指出:"状态收口破坏了史馆归档中的原始裁决动作"。复核确认属实:`_apply_task_decision` 第一版要求调用方(`shangshufang_task_decision`)先把 `body.action` 里的别名("approve"/"archive")归一化成 canonical "adopt" 再传入，导致 `_archive_task` 写进 `ShiguanArchive.emperor_decision_json` 的 `action` 字段恒为 "adopt"——原实现是把 `body.action` 原样传给 `_archive_task`，"approve"/"archive" 这类别名本应原样留在史馆归档记录里。

修复:把别名匹配逻辑移进 `_apply_task_decision` 内部(`if action in {"adopt", "approve", "archive"}:` 等)，调用方直接传原始 `body.action`，不再预先归一化——`_archive_task` 拿到的还是调用方传入的原始字面量，史馆归档记录不再失真。补 `test_archive_preserves_original_decision_action_alias`，直接查数据库验证提交 "approve"/"archive"/"adopt" 三个不同别名后，归档记录里存的 `action` 与提交值逐一相符，不会被抹平成同一个值。

验证：`python3 -m pytest -q tests/test_shangshufang_loop_api.py tests/test_shangshufang_entry.py tests/test_outbox_worker.py tests/test_commercial_loop_harness.py tests/test_legal_redteam_harness.py` 54 passed / 1 failed(同一条既有 flaky LLM 断言，与本次改动无关)。`python3 scripts/harness_doctor.py` 0 errors, 0 warnings。
