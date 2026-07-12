# 任务：fix-decree-execution-event-sequence-20260712

## 任务 1 —— 模型与查询改动

- 目标：给 `DecreeExecutionEvent` 加 `sequence` 列，`record_timeline_event`/`_load_timeline` 改用它。
- 输入：`backend/src/db/models.py`、`backend/src/chancellor/decree_status.py` 现状(见 Explore 报告)。
- 输出：模型加列+改索引；`record_timeline_event` 按 `task_id` 计算 `MAX(sequence)+1` 并写入；`_load_timeline` 改 `ORDER BY sequence`。
- 验收：新增测试通过。

## 任务 2 —— 契约同步(后端 pydantic + 前端 Zod)

- 目标：`TimelineEvent`/`ZTimelineEvent` 都加 `sequence: int`，避免后端已经返回、前端却校验不出的字段漂移。
- 输入：任务1完成后的后端契约。
- 输出：`contracts.py::TimelineEvent.sequence`、`chancellor-routing.ts::ZTimelineEvent.sequence`、两处对应测试补齐必填字段。
- 验收：`tsc --noEmit` 绿；后端契约测试通过。

## 任务 3 —— Alembic 迁移

- 目标：给已有 `decree_execution_events` 表(生产/开发 DB 文件)补迁移路径，而不只是靠 `create_all` 覆盖新建 DB。
- 输入：`alembic/versions/004_retrospective_outcome.py` 作为格式模板。
- 输出：`005_decree_execution_event_sequence.py`：加列(`server_default="0"`)+ 新索引 + 删旧索引 + 按 `task_id` 分组回填历史行的序号。
- 验收：本沙箱未装 `alembic` 包，改用裸 SQLAlchemy Core 独立重放同一段 SQL 逻辑验证正确性(见 coding report)。

## 任务 4 —— 回归验证与自建同秒碰撞测试

- 目标：证明"同一秒内多个事件排序确定"这一验收标准，且没有引入回归。
- 输入：任务1-3 完成后的代码。
- 输出：`test_load_timeline_orders_by_sequence_when_occurred_at_collides` 新测试；全量 `pytest`、`tsc`、三层 harness doctor 的运行结果。
- 验收：无新增失败；三层 doctor 全绿。
