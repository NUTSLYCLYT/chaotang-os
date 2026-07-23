# 任务：feat-r0-w04-canonical-completion-implementation-20260723-20260723

## 任务 1：REQ-013 门下省死代码假放行分支删除

- 目标：门下仍有否决理由时持续阻断，不因达到最大轮次自动准奏
- 前置条件：execution-authority v2 对 R0-W04 返回 GO
- 输入：`review_route()` 的 `round_number < MAX_REVIEW_ROUNDS` 假放行分支（唯一调用方从不传
  round_number，是死代码但方向错，且被黄金测试锁成了预期）
- 输出：删除 `MAX_REVIEW_ROUNDS`/`round_number`，`veto = bool(reasons)`
- 涉及文件：`backend/src/menxia_veto.py`、`backend/tests/test_menxia_veto.py`
- 状态 / 数据变化：纯逻辑删除，无 DB 变化
- 验证命令与证据：见 `ci_result/ci_summary.md`
- 回滚边界：`git revert`
- 完成定义：`test_repeated_review_never_auto_approves_while_veto_reasons_remain` 全绿

## 任务 2：REQ-014 reject 关闭 FinalMemorial 裁决闸门

- 目标：唯一、未被替代且质量门通过的 FinalMemorial 才可供人裁决
- 前置条件：任务 1 完成
- 输入：`apply_task_decision` 的 `reject` 分支不碰 `FinalMemorial.status` 的真实 gap
- 输出：reject 时 `formal.status = "rejected"`
- 涉及文件：`backend/web/routers/shangshufang.py`、`backend/tests/test_final_memorial_gate.py`
- 状态 / 数据变化：既有列的行为修复，无 schema 变化
- 验证命令与证据：见 `ci_result/ci_summary.md`
- 回滚边界：`git revert`
- 完成定义：`test_reject_supersedes_formal_memorial_and_blocks_later_adopt` 全绿

## 任务 3：REQ-022 DELIVERED 服务端公式（人类可见层对齐 execution_state）

- 目标：direct 接单回执/worker ACK/部分结果只能表示已受理/办理中；DELIVERED 只能由服务端
  完成公式派生
- 前置条件：任务 2 完成（DELIVERED 复用 REQ-014 的质量门作为真值输入）
- 输入：`_STAGE_MAP` 把 `direct_completed`（零质量门）和 `archived`（唯一需先过质量门）都
  映射成同一个 `"completed"` 字面量；另发现 2 处姊妹漏洞（`memorial.direct_completed`/
  `dispatch.queued` 时间线事件自身的 `stage` 字段也写了 `"completed"`）
- 输出：`direct_completed→receipt_only`、`archived→delivered`，`_OWNER_MAP`/`_NEXT_STAGE_MAP`/
  `_department_status_for` 同步；2 处姊妹漏洞一并修复
- 涉及文件：`backend/src/chancellor/decree_status.py`、`backend/web/routers/shangshufang.py`、
  `backend/src/execution/canonical_court_dispatch.py`、`backend/tests/test_decree_execution_status.py`、
  `backend/tests/test_final_memorial_gate.py`（新增 delivered 断言）、
  `backend/tests/test_decree_stage_never_fakes_completion.py`（新增源码哨兵）
- 状态 / 数据变化：纯字符串字面量改动
- 验证命令与证据：见 `ci_result/ci_summary.md`
- 回滚边界：`git revert`
- 完成定义：`test_status_shows_receipt_only_owner_for_direct_task`、
  `test_status_shows_delivered_only_after_final_memorial_gate` 全绿

## 任务 4：REQ-018 execution_failed 终态 + cancel 幂等围栏

- 目标：超时/断线/provider 故障支持局部重试、取消、查单和人工介入
- 前置条件：任务 3 完成（复用同一批映射表，避免 diff 冲突）
- 输入：`apply_failure_state` 打满重试上限（dead_letter）只写 `OutboxEvent.status`，从不碰
  `DecisionTask.status`；`DecisionRequest.action` 无 `cancel`
- 输出：`_promote_task_to_execution_failed` 辅助函数（两个 dead_letter 写入点复用）；
  `cancel` action + 终态幂等围栏（`_TASK_DECISION_TERMINAL_STATUSES`）
- 涉及文件：`backend/src/execution/outbox_worker.py`、`backend/web/routers/shangshufang.py`、
  `backend/src/emperor_decision_kind.py`（cancel 语义分类）、
  `backend/tests/test_emperor_decision_kind.py`、`backend/tests/test_execution_state_projection.py`
  （event vocabulary 冻结集加 decision.cancelled）、`backend/tests/test_execution_failed_status.py`
  （新）、`backend/tests/test_task_cancellation.py`（新）
- 状态 / 数据变化：新增 `execution_failed`/`task_cancelled` 状态值，无 schema 变化
- 验证命令与证据：见 `ci_result/ci_summary.md`
- 回滚边界：`git revert`
- 完成定义：`test_execution_failed_status.py`、`test_task_cancellation.py` 全绿

## 任务 5：REQ-020 request_id/release_id 全链贯穿 + migration 018

- 目标：request_id/task_id/tenant_id/release_id/model_version 贯穿全链（task_id/tenant_id
  已有，只补 request_id/release_id/model_version）
- 前置条件：任务 1-4 完成（改动面最广，放最后避免被后续改动打扰）
- 输入：`task_trace.py`（W02 遗留）零引用，不是真实链路；`DecreeExecutionEvent` 是全链每步都写
  的 append-only 表，选它做唯一载体
- 输出：`DecisionTask.request_id`（创建时生成一次）、`DecreeExecutionEvent.request_id/
  release_id/model_version`；`record_timeline_event` 的 `_REQUEST_ID_FROM_TASK` 哨兵自动带出；
  `release_id` 走部署级环境变量；`model_version` 明确记为已知缺口（`run_swarm_execution_loop`
  返回契约不含模型标识，改契约不是本次范围）
- 涉及文件：`backend/src/decision_task_kernel.py`、`backend/src/chancellor/decree_status.py`、
  `backend/src/chancellor/contracts.py`、`backend/src/db/models.py`、
  `backend/alembic/versions/018_canonical_completion_identity_fields.py`（新）、
  `backend/tests/test_identity_fields_thread_through_chain.py`（新）、
  `backend/tests/test_migration_018_canonical_completion_identity_fields.py`（新）
- 状态 / 数据变化：2 张既有表各加若干 nullable 列，无表结构变更
- 验证命令与证据：见 `ci_result/ci_summary.md`
- 回滚边界：`alembic downgrade` 撤销新列；`git revert` 回滚代码
- 完成定义：`test_identity_fields_thread_through_chain.py` 全绿

## 任务 6：REQ-008 源码哨兵收口 + 冻结基线同步

- 目标：所有任务进入既有 canonical 主链，不新建第二 Mission 或完成事实源；确认任务 1-5 没有
  引入基线漂移
- 前置条件：任务 1-5 完成
- 输入：migration 018 只加列不加表；`src/db/models.py` 扫描无 Mission/CompletionFact/
  DeliveryRecord 命名的新类
- 输出：`test_canonical_completion_no_parallel_table.py`（新）；同步 2 处 repo 级冻结基线
  （`test_schema_authority.py` 的 head pin、`shangshufang_contract_baseline_v1.json` 的
  action_enum 加 `cancel`）
- 涉及文件：`backend/tests/test_canonical_completion_no_parallel_table.py`（新）、
  `backend/tests/test_schema_authority.py`、`backend/tests/fixtures/shangshufang_contract_baseline_v1.json`
- 状态 / 数据变化：无
- 验证命令与证据：见 `ci_result/ci_summary.md`
- 回滚边界：`git revert`
- 完成定义：全量 2964 passed + 38 skipped，backend/root doctor 0 errors
