# Review Handoff

## Current Branch
feature-chaotang-ext

## Scope
P0-1：锦衣卫情报去重（`upsert_evidence`）此前是应用层"先查后写"，`(tenant_id, claim_key)`
只有索引没有唯一约束，并发写入可能都在对方提交前查到"不存在"，各自插入，产生重复行。

## Files Changed
- `backend/alembic/versions/007_jinyiwei_evidence_unique_constraint.py`（新增）
- `backend/src/db/flow_store.py`
- `backend/src/db/models.py`
- `backend/src/jinyiwei_evidence_store.py`
- `backend/src/real_department_engines.py`
- `backend/tests/test_jinyiwei_evidence_store.py`
- `backend/web/main.py`
- `backend/web/routers/jinyiwei.py`

## What Changed
- `models.py`：`JinyiweiEvidence.__table_args__` 把 `(tenant_id, claim_key)` 从普通索引
  改为 `sa.UniqueConstraint(..., name="uq_jinyiwei_evidence_tenant_claim_key")`。
- `flow_store.py`：新增 `ensure_jinyiwei_evidence_unique_constraint(db)`，幂等地给
  老库（`create_all` 建的、没跑过 alembic 迁移的）补这条唯一约束；`web/main.py` 的
  `lifespan` 启动时调用它，和其余 `ensure_*_column` 放在同一批 startup 自愈逻辑里。
- `alembic/versions/007_...py`：给已跑迁移的库补同一条唯一约束的正式迁移。
- `jinyiwei_evidence_store.py`：`upsert_evidence` 改成"先查（常见路径的性能优化）→
  没查到就在 `db.begin_nested()`（SAVEPOINT）里插入并 `flush()`→ 捕获 `IntegrityError`
  就说明并发对手抢先提交了同一行，回滚 SAVEPOINT 后原地查出冲突行、退回更新路径"。
  查不到冲突行（唯一约束报错但查不到对应行）时不静默吞掉，直接 `raise`。
- `real_department_engines.py` / `web/routers/jinyiwei.py`：顺手把两处情报入库失败的
  `except Exception: pass` 换成 `_logger.warning(..., exc_info=True)`——这两处不是本次
  并发修复的核心，但都是同一个"情报写回共享池"路径上会静默吞错误的旁路，一并处理。

### Codex 停止前审查纠正(2026-07-12)

Codex 指出："PostgreSQL 写入路径会因重复添加约束而使事务失效"——`ensure_jinyiwei_evidence_
unique_constraint` 的 PostgreSQL 分支原来是裸 `session.execute(ALTER TABLE ... ADD
CONSTRAINT ...)`。PostgreSQL 的 `ADD CONSTRAINT` 不支持 `IF NOT EXISTS`（只有 `ADD COLUMN`
才支持），约束已存在时（每次重启后都是这个状态）这条语句必然报错；PostgreSQL 里失败的语句
会把当前事务标记为 aborted，即便 Python 这边 try/except 接住了异常，同一 session 后续任何
语句（下一个 `ensure_*_column`、lifespan 里的 `db.commit()`）都会因为
"current transaction is aborted, commands ignored until end of transaction block"
级联失败——生产如果真的跑 PostgreSQL，第一次成功启动之后每一次重启都会在这里炸穿 lifespan。

用本机真实 PostgreSQL 16（现成的 `litellm_db` 容器）手工建了一张临时表复现："先 ADD
CONSTRAINT 成功，再原样 ADD CONSTRAINT 一次" → 第二次报 `relation "uq_repro" already
exists`，紧接着任意语句都报 `current transaction is aborted`；同一实例上验证了
"`SAVEPOINT` → 失败的 `ADD CONSTRAINT` → `ROLLBACK TO SAVEPOINT`" 之后 session 仍然健康，
能正常 `COMMIT`。据此把该函数里两处裸 `ALTER TABLE ... ADD CONSTRAINT` 都包进
`session.begin_nested()`（SAVEPOINT），跟 `upsert_evidence` 里 `IntegrityError` 的处理
手法同源——失败只回滚这一个 SAVEPOINT，不拖累外层事务。

## Tests Run
- `python3 -m pytest -q tests/test_jinyiwei_evidence_store.py -v`：10 passed（新增
  `test_ensure_jinyiwei_evidence_unique_constraint_uses_savepoint_on_postgres`，用
  MagicMock 假 session 断言非 sqlite dialect 下 ALTER 语句必须走
  `session.begin_nested()`——本仓库测试只跑 SQLite，这条测试防止今后有人把它"简化"回裸
  execute 又引入同一个 PostgreSQL 问题）。
- 单独把新增的并发竞态用例跑 5 次确认非 flaky：
  `python3 -m pytest -q tests/test_jinyiwei_evidence_store.py::test_upsert_evidence_does_not_duplicate_under_concurrent_race`
  × 5 → 5/5 passed。
- `python3 -m pytest -q tests/test_jinyiwei_evidence_store.py tests/test_jinyiwei_endpoint.py tests/test_real_department_engines.py tests/test_flow_db_dualwrite.py`（相关面）：88 passed。
- 全量后端套件：`python3 -m pytest -q`：2418 passed，8 failed——与本次改动前一致的既有失败（未验证具体用例名，需在下次交接前补一次 `git stash` 对照）。
- `python3 backend/scripts/harness_doctor.py`：0 errors, 0 warnings。
- `node scripts/harness-doctor.mjs`：0 errors（root-level）。
- 手工验证（真实 PostgreSQL 16，非自动化）：见上方"Codex 停止前审查纠正"小节，直接对
  `litellm_db` 容器执行 `psql` 复现问题并验证 SAVEPOINT 修复有效。

## Known Risks
- 老库自愈路径（`ensure_jinyiwei_evidence_unique_constraint`）依赖 lifespan 启动时执行；
  如果某个部署路径跳过 lifespan（例如直接跑 alembic 之外的裸库脚本），唯一约束可能缺失，
  届时 `IntegrityError` 捕获分支不会触发，退化回旧的"先查后写"竞态。未加自动化测试覆盖
  "约束确实缺失时的降级行为"，仅靠人工确认。
- PostgreSQL 分支的修复只经过手工 `psql` 复现验证 + Mock 断言代码路径，没有针对真实
  PostgreSQL 跑自动化 SQLAlchemy 集成测试（本仓库 `psycopg2` 明确标注"dev/prod 用
  SQLite 不需要装"，没有既有的 Postgres 测试基建）——如果之后这个项目真的切到
  PostgreSQL 部署，建议在那之前补一次针对真实连接的集成测试。
- 全量套件的 8 个既有失败尚未逐条核对是否真的与本次改动无关（只是数量与改动前一致），
  建议下一次交接前跑一次 `git stash` 前后对照，把用例名写进这里。

## Not Touched
- `feature-chaotang-release`（未切换、未 push）
- `.playwright-cli/`
- `.playwright-mcp/`
- `backend/knowledge/docs/ima_archived/doc-*.md`

## Reviewer Focus
请重点审查：
- SAVEPOINT 冲突回滚后，`existing` 查询是否真的能看到并发对手已提交的行（session 隔离级别、
  是否需要 `db.expire_all()`）——这是本次修复能否真正生效的关键点，值得单独核实而不是只看
  测试通过。
- `ensure_jinyiwei_evidence_unique_constraint` 的幂等性：多进程/多次调用是否会互相竞态
  报错（"约束已存在"之类），目前实现方式需要复核。
- 是否遗漏了其他调用 `upsert_evidence` 的路径，没有走到新的 SAVEPOINT 分支。
- P0-2（上书房任务归属过滤）、P0-3（`/api/intel/brief` 阻塞）：本次交接**未开始**，
  尚无具体 bug 复现材料——下一阶段开工前需要先确认这两个问题的具体现象/复现步骤来源。
