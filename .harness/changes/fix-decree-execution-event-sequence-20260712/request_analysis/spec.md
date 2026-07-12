# 规格说明：fix-decree-execution-event-sequence-20260712

## 背景

"统一决策任务生命周期"架构落地方案(`/home/ubuntu/.claude/plans/valiant-crunching-candy.md`)阶段4：`DecreeExecutionEvent.occurred_at` 只精确到秒，同一秒内触发的多个事件(例如 confirm-edict 写的 chancellor "executing" 事件和几乎同一秒触发的 worker 事件)排序会退化成不确定的插入/主键顺序。加一个 `task_id` 内单调递增的 `sequence` 列，把 `_load_timeline()` 的排序依据从 `occurred_at` 换成 `sequence`。

## 范围

- `DecreeExecutionEvent` 模型加 `sequence: int` 列(ORM 层 `default=0`)，索引从 `(task_id, occurred_at)` 换成 `(task_id, sequence)`。
- `record_timeline_event()` 写入时按 `task_id` 查 `MAX(sequence)+1`；`_load_timeline()` 排序改 `ORDER BY sequence`。
- `TimelineEvent` pydantic 契约与前端 `ZTimelineEvent` 都加 `sequence: int` 字段，唯一构造点(`_load_timeline`)透传 `row.sequence`。
- 新 Alembic 迁移 `005_decree_execution_event_sequence`：加列(`server_default="0"`)+ 加新索引 + 删旧索引 + 对已有行按 `task_id` 分组、`occurred_at`/`id` 排序回填序号。

## 非目标

- 不改变 `occurred_at` 的展示用途——仍作为时间戳显示，只是不再承担排序职责。
- 不引入分布式协调(全局自增序列、分布式锁)——`MAX(sequence)+1` 加显式 `db.flush()` 足以在单进程 SQLAlchemy 会话内保证正确性，符合计划原文"不引入分布式协调复杂度"的要求。
- 不处理"锦衣卫作为跨阶段共享证据服务"/"史馆全量 timeline 归档"——计划中明确标注为阶段4之后的独立后续工作。

## 验收标准

- `pnpm exec tsc --noEmit` 无新增错误。
- `python3 -m pytest` 全量：无新增失败(既有 8 个无关失败——7 个 `FakeApiOrchestrator`/RAG/commit-closeout 相关 + 1 个已知 flaky LLM 文本断言——与改动前基线完全一致)。
- 新增测试 `test_load_timeline_orders_by_sequence_when_occurred_at_collides`：构造三个 `occurred_at` 被强制改成完全相同时间戳的事件，断言 `_load_timeline` 仍按插入顺序(即 `sequence`)返回确定结果。
- 三层 `harness:doctor`(前端/后端/根级)全绿。

## 验证计划

`pnpm exec tsc --noEmit`、`python3 -m pytest`(全量)、`pnpm harness:doctor`、`python3 backend/scripts/harness_doctor.py`、`node scripts/harness-doctor.mjs`，以及用裸 SQLAlchemy Core 独立重放迁移的加列/索引/回填逻辑(因为本沙箱未安装 `alembic` 包，无法直接跑 `alembic upgrade head`，见 ci_result/ci_summary.md 风险说明)。
