# 变更摘要：release-functional-smoke-hardening-20260712

| 字段 | 值 |
| --- | --- |
| Change ID | release-functional-smoke-hardening-20260712 |
| 类型 | fix |
| 状态 | IN_PROGRESS |
| Owner | Project Agent |
| 创建日期 | 20260712 |

## 范围

- 主线：release 前功能冒烟三个 P0，逐个修复、逐个提交，交接给独立审查（见
  `review-handoff.md`）：
  1. P0-1（已完成，`d88c17a` + `19454fd`）：锦衣卫共享情报去重从应用层"先查后写"改为
     数据库级 `UniqueConstraint` + SAVEPOINT 插入冲突回退，堵住并发竞态重复行；同一批
     一并修复了约束自愈函数在 PostgreSQL 上因重复 `ADD CONSTRAINT` 而毒死事务的问题
     （Codex 停止前审查发现，已用真实 PostgreSQL 16 手工复现并验证修复）。
  2. P0-2（未开始）：上书房任务归属过滤——`status`/`decision`/`latest_memorial` 需要
     按归属过滤，尚无具体复现材料，需先确认问题来源再动手。
  3. P0-3（未开始）：`/api/intel/brief` 卡住/阻塞——情报持久化失败时接口不应阻塞调用方，
     尚无具体复现材料。
- 文件：`backend/src/db/flow_store.py`、`backend/src/db/models.py`、
  `backend/src/jinyiwei_evidence_store.py`、`backend/src/real_department_engines.py`、
  `backend/web/main.py`、`backend/web/routers/jinyiwei.py`、
  `backend/alembic/versions/007_jinyiwei_evidence_unique_constraint.py`、
  `backend/tests/test_jinyiwei_evidence_store.py`。
- 验证：`pytest` 相关面 88 passed；全量后端套件 2418 passed / 8 failed（既有失败，与
  本次改动前一致）；`python3 backend/scripts/harness_doctor.py` 与
  `node scripts/harness-doctor.mjs` 均 0 errors；PostgreSQL 事务毒死问题额外用真实
  Postgres 16 容器手工 `psql` 复现 + 验证修复。详见 `review-handoff.md`。
