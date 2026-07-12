# Review Handoff

## Current Branch
feature-chaotang-ext

## Scope
P0-1：锦衣卫情报去重（`upsert_evidence`）此前是应用层"先查后写"，`(tenant_id, claim_key)`
只有索引没有唯一约束，并发写入可能都在对方提交前查到"不存在"，各自插入，产生重复行。

## Files Changed
- `backend/alembic/versions/007_jinyiwei_evidence_unique_constraint.py`（新增，本轮再次修改）
- `backend/src/db/flow_store.py`
- `backend/src/db/models.py`
- `backend/src/jinyiwei_evidence_store.py`
- `backend/src/real_department_engines.py`
- `backend/tests/test_jinyiwei_evidence_store.py`
- `backend/tests/test_migration_007_jinyiwei_evidence_unique_constraint.py`（新增）
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

### 独立审查纠正(2026-07-12，第二轮：code-reviewer agent 只读审查)

针对 P0-1 未提交 diff 的独立只读审查发现一个真实 bug（非本次交接前已提交的两个 commit，
是当时正在写、还没提交的后续修改）：`ensure_jinyiwei_evidence_unique_constraint` 的错误
消息分支判断顺序有问题——PostgreSQL 表里已有重复数据时建唯一索引报的是
`could not create unique index "..." DETAIL: Key (...) is duplicated.`，这条消息天然
包含"duplicate"(是"duplicated"的子串)，原代码先判断"already exists" or "duplicate"，
会把这个真正需要去重的场景误判成"约束已存在，直接返回"——`_dedupe_jinyiwei_evidence()`
永远不会被调用，约束永远建不成，等于白修了这个 P0 本来要挡的竞态坏数据场景。已修复
（先判定"是不是数据本身有重复"的精确消息模式，命中才去重重试；判定不出来才退回更宽泛的
"约束已存在"分支），补了一条 Mock 断言测试用真实 PostgreSQL 错误文案复现这个误判、验证
修复后不再误判。同一轮独立审查同时确认：`_dedupe_jinyiwei_evidence` 在 SAVEPOINT 回滚后
调用是安全的(纯新查询，不复用回滚前的 ORM 实例)；发现一个未阻塞的既存缺口——错误消息
分类只覆盖 SQLite/PostgreSQL 措辞，MySQL 的"Duplicate entry"文案两个分支都不匹配(本项目
无 MySQL 路径，不阻塞)。

### 独立审查纠正(2026-07-12，第三轮：用户直接指出，本次交接新增)

alembic 007 迁移脚本本身对本项目默认 SQLite DB_URL 不安全——`op.create_unique_constraint`
(非 batch 模式)编译到 SQLite 方言是 `ALTER TABLE ... ADD CONSTRAINT ...`，SQLite 语法
根本不支持这个语句，报的是 `OperationalError: near "UNIQUE": syntax error`，是迁移脚本
在默认配置下直接跑不通，不是运行时可以捕获、降级处理的错误。用纯 SQLAlchemy 直接对内存
SQLite 执行等价 DDL 复现确认。改用 `op.batch_alter_table`(SQLite 下整表重建复制；
PostgreSQL 等原生支持 ALTER 的方言下 batch 模式自动退化成普通 ALTER，行为不变)。新增
`backend/tests/test_migration_007_jinyiwei_evidence_unique_constraint.py`，用真实 alembic
(`pytest.importorskip("alembic")`，本仓库当前交互式 shell 的解释器没装—— alembic 是
`requirements-core.txt` 的核心依赖，非可选项，CI/正常 dev 环境装了这个测试就会真实执行)
对真实 SQLite 文件跑完整的 upgrade+downgrade：构造 P0-1 之前(git 历史里的旧 schema：普通
索引不是约束)的表结构、灌入旧竞态遗留的重复行(同 claim_key 两行)+ 一行干净数据，跑
`alembic upgrade head`，断言：去重只保留 `updated_at` 最新的一行、干净行不受影响、旧索引
被换成真正的 `UNIQUE (tenant_id, claim_key)` 约束、其余两个索引原样保留、新插入的重复行
被约束正确拒绝；再跑 `alembic downgrade -1`，断言约束消失、旧索引恢复。

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
