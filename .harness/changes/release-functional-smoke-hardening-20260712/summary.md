# 变更摘要：release-functional-smoke-hardening-20260712

| 字段 | 值 |
| --- | --- |
| Change ID | release-functional-smoke-hardening-20260712 |
| 类型 | fix |
| 状态 | IN_PROGRESS |
| Owner | Project Agent |
| 创建日期 | 20260712 |

## 范围

- 主线：release 前功能冒烟四个 P0（P0-1 是最早的编号，后续跟用户给的更细 spec 对齐为
  P0-A/B/C/D；P0-1 = P0-C），逐个修复、逐个提交，交接给独立审查（见 `review-handoff.md`）：
  1. P0-1/P0-C（已完成，`d88c17a` + `19454fd` + 本轮收尾）：锦衣卫共享情报去重从应用层
     "先查后写"改为数据库级 `UniqueConstraint` + SAVEPOINT 插入冲突回退，堵住并发竞态
     重复行；一并修复了约束自愈函数在 PostgreSQL 上因重复 `ADD CONSTRAINT` 而毒死事务的
     问题、错误消息分支误判导致去重永远不触发的问题、alembic 007 对默认 SQLite DB_URL
     直接跑不通的问题（均已用真实 PostgreSQL 16 / 真实 alembic+SQLite 验证修复）。
  2. P0-A（本轮完成）：`/api/court/build-ledger` 的 `BuildLedgerEntry`/
     `BuildLedgerAuditEvent` 补齐 `(tenant_id, user_id)` 归属过滤(独立只读审查确认的
     CRITICAL IDOR)，前端 `build-ledger.ts` 改用 `backendFetch` 修复认证从不生效的问题。
  3. P0-B（未开始）：上书房任务归属过滤——`DecisionTask.user_id` 存在但十几个按 `task_id`
     查询的端点未使用它，`/home` 列表会把其他用户的 `task_id` 暴露出去；用户已给出完整
     spec，下一阶段可直接开工。
  4. P0-D（未开始，上一轮独立审查判定"看起来已不是问题"）：`/api/intel/brief` 卡住/
     阻塞——追完整条链路(tavily 8s 超时+兜底、gather_intel 包裹、best-effort 持久化)未
     发现未加保护的同步调用/裸写入；建议开工前先跟最初报告者核实具体复现步骤。
- 文件：见 `review-handoff.md` 的 Files Changed（按 P0 分小节列出）。
- 验证：P0-1/P0-C 相关面 88 passed；P0-A 相关面 13 passed（隔离 7 + 自愈 2 + 既有 4）+
  迁移 2 passed + 前端 nodetest 3 passed + `tsc --noEmit` 0 errors；全量后端套件
  2427 passed / 8 failed（与改动前同一批既有失败，无新增失败）；
  `python3 backend/scripts/harness_doctor.py` 与 `node scripts/harness-doctor.mjs` 均
  0 errors；P0-1/P0-C 的 PostgreSQL 问题额外用真实 Postgres 16 容器手工 `psql` 复现 +
  验证修复；P0-1/P0-C 与 P0-A 的迁移额外起了一个 Python 3.12 隔离 venv 装满
  `requirements-core.txt`，用真实 alembic 对真实 SQLite 文件跑完整 upgrade/downgrade
  验证。详见 `review-handoff.md`。
