# 变更摘要：fix-decree-execution-event-sequence-20260712

| 字段 | 值 |
| --- | --- |
| Change ID | fix-decree-execution-event-sequence-20260712 |
| 类型 | fix |
| 状态 | DELIVERED |
| Owner | Project Agent |
| 创建日期 | 20260712 |

## 范围

- 主线：跨后端(schema/contract)与前端(契约镜像)的第四阶段变更——`统一决策任务生命周期`架构落地方案(`/home/ubuntu/.claude/plans/valiant-crunching-candy.md`)阶段4：给 `DecreeExecutionEvent`/`TimelineEvent` 加 `sequence` 字段，消除 `occurred_at`(仅精确到秒)在同一秒内多个事件时的排序脆弱性。
- 文件：
  - `backend/src/db/models.py`(`DecreeExecutionEvent.sequence` 列 + 索引)
  - `backend/src/chancellor/decree_status.py`(`record_timeline_event` 写入序号、`_load_timeline` 改按序号排序)
  - `backend/src/chancellor/contracts.py`(`TimelineEvent.sequence: int`)
  - `backend/alembic/versions/005_decree_execution_event_sequence.py`(新迁移：加列+索引+历史数据回填)
  - `backend/tests/test_decree_execution_status.py`(新增同秒碰撞排序测试)、`backend/tests/test_chancellor_contracts.py`(补 `sequence` 字段)
  - `frontend/src/lib/contracts/chancellor-routing.ts`(`ZTimelineEvent.sequence`)、`chancellor-routing.nodetest.ts`(补字段)
- 验证：`python3 -m pytest`(全量 2390 passed，8 个既有无关失败与改动前基线一致)、`pnpm exec tsc --noEmit`、三层 `harness:doctor`、迁移回填逻辑用裸 SQLAlchemy Core 独立重放验证(见 ci_result/ci_summary.md)。
