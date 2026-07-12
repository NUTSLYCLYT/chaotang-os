# Review Handoff

## Current Branch
feature-chaotang-ext

## Scope
- P0-1/P0-C：锦衣卫情报去重（`upsert_evidence`）此前是应用层"先查后写"，
  `(tenant_id, claim_key)` 只有索引没有唯一约束，并发写入可能都在对方提交前
  查到"不存在"，各自插入，产生重复行。
- P0-A（本轮新增）：`/api/court/build-ledger` 的 `BuildLedgerEntry`/
  `BuildLedgerAuditEvent` 完全没有租户/用户归属，GET(不带 taskId)会把最近
  50 条记录跨所有用户/租户返回给任意已登录调用方，transition/persist/prune
  也都不按归属校验——独立只读审查确认的 CRITICAL IDOR/broken access
  control。前端 `build-ledger.ts` 同时用裸 `fetch()`，从不带
  `Authorization: Bearer`，生产环境下每次调用都会 401，还被当成"空台账"
  静默吞掉。

## Files Changed

### P0-1/P0-C
- `backend/alembic/versions/007_jinyiwei_evidence_unique_constraint.py`（新增，本轮再次修改）
- `backend/src/jinyiwei_evidence_store.py`
- `backend/src/real_department_engines.py`
- `backend/tests/test_jinyiwei_evidence_store.py`
- `backend/tests/test_migration_007_jinyiwei_evidence_unique_constraint.py`（新增）
- `backend/web/routers/jinyiwei.py`

### P0-A
- `backend/alembic/versions/008_build_ledger_ownership.py`（新增）
- `backend/src/db/flow_store.py`
- `backend/src/db/models.py`
- `backend/web/main.py`
- `backend/web/routers/build_ledger.py`
- `backend/tests/test_build_ledger_tenant_isolation.py`（新增，第二轮再次修改：补
  includeUnowned 测试）
- `backend/tests/test_build_ledger_self_heal.py`（新增）
- `backend/tests/test_build_ledger_persist_concurrency.py`（第二轮新增：并发竞态测试）
- `backend/tests/test_migration_008_build_ledger_ownership.py`（新增）
- `frontend/src/features/operating-loop/lib/build-ledger.ts`
- `frontend/src/features/operating-loop/lib/build-ledger.nodetest.ts`（新增）

`backend/src/db/flow_store.py`、`backend/src/db/models.py`、`backend/web/main.py`
两轮都有改动（P0-1/P0-C 加 jinyiwei 唯一约束自愈，P0-A 加 build-ledger 归属列
自愈），归属关系见下方各自的 What Changed 小节。

## What Changed — P0-1/P0-C
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

---

## What Changed — P0-A

- `models.py`：`BuildLedgerEntry`/`BuildLedgerAuditEvent` 各加 `tenant_id: int`（default 1，
  经 `src.tenant.resolve_current_tenant_id()` 解析，沿用 Decree/Task/JinyiweiEvidence 的
  既有惯例）、`user_id: str`（default "anonymous"，沿用 DecisionTask 的 `_user_id(user)`
  惯例：`user.user_id or user.username or user.tenant_slug or "anonymous"`），各加一条
  `(tenant_id, user_id)` 组合索引。
- `flow_store.py`：新增 `ensure_build_ledger_ownership_columns(db)`，给老库补两张表的归属列
  + 组合索引；跟 `ensure_task_result_json_column` 同款(纯 `ADD COLUMN`，不是约束，
  PostgreSQL 上 `ADD COLUMN IF NOT EXISTS` 合法不报错，不需要 alembic 007 那种 SAVEPOINT)；
  `web/main.py` 的 `lifespan` 里调用它。
- `alembic/versions/008_build_ledger_ownership.py`：给已跑迁移的库补同样两列 + 两条索引的
  正式迁移，纯 `op.add_column`(不需要 batch 模式——只有约束才需要，加列不需要)。
- `web/routers/build_ledger.py`：新增 `_owner_id(user)` helper；`GET`(list/audit/export)、
  `_persist`、`_transition`、`_prune` 全部按 `(tenant_id, user_id)` 过滤：
  - `GET`/`_transition` 对"存在但不是自己的"和"真的不存在"统一返回同一个结果(空列表 /
    `entry_not_found`)，不泄露对方是否存在。
  - `_persist` 的 `id` 冲突处理：先按 owner 查，查不到再看这个 id 是否被别人占用；被占用时
    返回 `id_conflict`，既不会静默接管对方的行，也不会让主键冲突变成未处理的 500。
  - `_prune` 只按 `tenant_id` 收口(不含 `user_id`)——本项目没有独立的跨租户 super-admin
    角色，`admin` 权限本就局限在自己的 `tenant_slug` 内，admin 清理"本租户"所有用户的过期
    条目是这个动作本身的合理范围，但绝不碰其他租户的数据（这是一个记录在案的判断调用，见
    下方 Reviewer Focus）。
- `frontend/.../build-ledger.ts`：所有裸 `fetch()` 换成 `backendFetch()`(自动附带
  `Authorization: Bearer` + 401 时刷新重试)；顺手把 `pruneBuildLedger` 从"失败静默返回
  `null`"改成跟 `persist`/`dispatch`/`transition` 一致的"失败就 `throw`"(它是本文件里唯一
  一个批量写操作，静默失败风险最大)。

### 独立只读审查（code-reviewer agent，2026-07-12）

针对完整 P0-A diff 的独立只读审查判定 **Go, no CRITICAL**，逐点核实：`_persist` 的 id 冲突
处理正确(不接管、不 500)；`_prune` 按 tenant_id 收口是可辩护的判断调用；GET/transition 的
"不存在"框定对两种真实场景（真不存在 / 存在但不是自己的）确实产生完全相同的响应，无法
从响应区分；测试是真实的，不是套套逻辑（用 `isolated_session_local` + FastAPI
`dependency_overrides` 真的跑通了鉴权/查询/过滤全链路）。给了两条 MEDIUM 建议（均已在本轮
采纳修复,不是遗留 TODO）：① `ensure_build_ledger_ownership_columns` 当时没有直接测试覆盖
（`test_build_ledger_tenant_isolation.py` 全部用 `isolated_session_local`，表天生从当前
`models.py` 建，从没真正跑过"老库缺列 → ALTER TABLE 补列"这条分支）——已新增
`test_build_ledger_self_heal.py`，直接对手搭的旧 schema(缺列)跑这个函数，验证列/索引被
正确补上、旧行被 DEFAULT 正确回填、幂等重复调用不报错，外加一条 Mock 断言覆盖 PostgreSQL
分支用的是 `ADD COLUMN IF NOT EXISTS` 而不是裸 `ADD CONSTRAINT`（这片代码区域已经连续出过
两次 P0，`ensure_jinyiwei_evidence_unique_constraint` 的 SAVEPOINT 缺失 + 错误消息误判，
不能靠"看起来安全"跳过测试）。② 自愈路径原来只补列、不补组合索引——`create_all
(checkfirst=True)` 对已存在的表不做索引级 diff，只靠自愈升级过的老库会一直缺这个索引(过滤
仍然正确，只是没走索引)——已补上 `CREATE INDEX IF NOT EXISTS`(SQLite/PostgreSQL 都合法，
不需要 dialect 分支)。

## Tests Run — P0-A
- `python3 -m pytest -q tests/test_build_ledger.py tests/test_build_ledger_tenant_isolation.py tests/test_build_ledger_self_heal.py -v`：
  13 passed。
- 隔离测试(`test_build_ledger_tenant_isolation.py`，7 条，全部先跑 RED 确认针对改动前实现
  真的失败，再实现让它们变绿)：跨用户 list/taskId 查询/export/audit/transition 全部验证
  "看不到对方的数据"；`id` 冲突不接管、不 500；`prune` 只影响自己租户(用假的内存 tenants
  表 + `dependency_overrides` 让 `get_current_user` 真的调用
  `set_current_tenant()`，跟 `test_jinyiwei_endpoint.py::test_brief_endpoint_evidence_is_isolated_per_tenant`
  同款手法)。
- 自愈单测(`test_build_ledger_self_heal.py`，2 条，独立审查后新增)：手搭缺列的旧 SQLite
  schema 验证真实 ALTER 路径 + DEFAULT 回填 + 幂等；Mock 断言 PostgreSQL 分支语句正确。
- 迁移测试(`test_migration_008_build_ledger_ownership.py`，2 条，需要真实 alembic——本仓库
  当前交互式 shell 没装，`pytest.importorskip` 会跳过；CI/正常 dev 环境会真实执行)：对真实
  SQLite 文件跑完整 upgrade+downgrade，验证旧行正确回填、索引正确创建/移除。
- 前端(`build-ledger.nodetest.ts`，3 条，`npx tsx --test`)：mock 真实 `fetch`/`Headers`，
  断言 `fetchBuildLedger`/`dispatchBuildLedgerEntry` 真的带上了 `Authorization: Bearer
  <token>`(不是伪造 backendFetch 本身)，`pruneBuildLedger` 失败时真的 `throw`。
- `pnpm exec tsc --noEmit -p tsconfig.json`：0 errors(全量，非仅改动文件)。
- 全量后端套件：`python3 -m pytest -q`：2427 passed，8 failed(跟 P0-C 交接时同一批既有失败，
  没有新增失败，`build_ledger` 相关用例全绿)。
- `python3 backend/scripts/harness_doctor.py` / `node scripts/harness-doctor.mjs`：均
  0 errors。

## Tests Run — P0-A 第二轮
- `test_admin_can_see_unowned_entries_with_include_unowned_flag`、
  `test_include_unowned_never_leaks_other_real_users_entries`、
  `test_include_unowned_scoped_to_own_tenant`(3 条，追加进
  `test_build_ledger_tenant_isolation.py`)：admin 不带 flag 看不到孤儿行；带 flag 才能看到
  本租户孤儿行；非 admin 带 flag 被忽略；孤儿桶不会顺带暴露其他真实用户自己拥有的行；孤儿桶
  按 tenant_id 收口(另一个租户的孤儿行看不到)。
- `test_build_ledger_persist_concurrency.py`(新增，2 条)：两个真实线程 + 两个共享同一文件型
  sqlite 的独立 Session，暂停点精确打在 `session.add()` 之后、flush/commit 之前(不是暂停某次
  读查询——`_persist` 插入前有不止一次读检查，暂停哪次读只能精确复现某一种特定实现，换实现
  就失真)。先针对改动前的 `_persist` 跑通确认 RED：两条测试都真实复现了
  `IntegrityError: UNIQUE constraint failed: build_ledger_entries.id` 崩溃，逐字匹配 review
  描述的场景。改完后 GREEN，额外单独跑 5 次确认非 flaky。验证：不同 owner 竞态——赢家成功、
  输家拿到稳定的 `id_conflict`、最终只有一行落库；同 owner 竞态——两次都成功、不产生重复行、
  不产生未处理异常、最终内容是"最后一个真正把更新应用上去的"那次。
- `python3 -m pytest -q tests/test_build_ledger.py tests/test_build_ledger_tenant_isolation.py tests/test_build_ledger_self_heal.py tests/test_build_ledger_persist_concurrency.py -v`：
  18 passed。
- `<venv-with-alembic>/python3 -m pytest -q ... tests/test_migration_008_build_ledger_ownership.py tests/test_migration_007_jinyiwei_evidence_unique_constraint.py -v`：
  22 passed（真实 alembic 对真实 SQLite 跑完整 upgrade/downgrade，回归确认第一轮的迁移仍然
  正确）。
- 全量后端套件：`python3 -m pytest -q`：2434 passed，8 failed(跟第一轮交接时同一批既有失败，
  逐一核对用例名完全相同，没有新增失败)。
- `python3 backend/scripts/harness_doctor.py` / `node scripts/harness-doctor.mjs`：均
  0 errors。
- 独立只读 code-reviewer agent 审查(全部 4 个新增点逐条核实 + 独立跑了并发测试 15 遍 +
  40 轮压力测试验证非 flaky)：判定 **GO**，0 CRITICAL/HIGH/MEDIUM。发现两条低优先级、
  超出本轮范围的既有项(见下方 Known Risks 的 `_transition` audit id 竞态)。

### P0-A 第二轮独立审查纠正(2026-07-12，用户直接指出，本次交接新增)

针对 e012203 的独立审查发现两个新问题，均已修复：

**① 历史数据归属**——migration 008 / `ensure_build_ledger_ownership_columns` 把迁移前的行
回填成 `tenant_id=1, user_id="anonymous"`。调查确认(见下方 Reviewer Focus)：`"anonymous"`
是任何真实请求的 `_owner_id()` 都不可能算出来的哨兵值(`CurrentUser.tenant_slug` 永远有
非空默认值 `"default"`)，这些行默认对所有人(包括 admin)永久不可见——不是"低权限"而是
"静默永久丢失"。也确认了没有任何字段能可靠推断真实 owner(`entry_json` 无归属字段、
`Task` 表没有 `user_id` 列、`BuildLedgerAuditEvent.actor` 是用户名字符串且跟 `_owner_id()`
偏好数字 `user_id` 的取值方式不一致、也不是每条记录都有)。把三个选项摆出来交给用户拍板，
选中"admin 可见的孤儿桶"：GET 端点新增 `?includeUnowned=1`，只对 `role=="admin"` 生效，
按 `tenant_id` 收口，只多 OR 进 `user_id == "anonymous"` 这一种情况，不会暴露其他真实用户
自己拥有的行。migration/self-heal 的回填策略本身没有改变(仍然是 `tenant_id=1,
user_id="anonymous"`)，天然保持一致，不需要额外同步。

**② `_persist` 并发同 ID 竞态**——原来是"查当前 owner 范围内有没有 → 查全局 id 冲突 →
INSERT"三步 check-then-insert，两个并发请求可能都在对方提交前通过检查，第二个 commit 时
撞主键抛 `IntegrityError`，变成未处理的 500。用两个共享同一个文件型 sqlite 的独立 Session +
monkeypatch 精确暂停点(暂停在 `session.add()` 之后、真正 flush/commit 之前——不是暂停某次
读查询，那样精确度依赖具体实现的读查询次数，换实现就失真)真实复现了这个崩溃(报错文本
`IntegrityError: UNIQUE constraint failed: build_ledger_entries.id`，逐字匹配 review 描述的
场景)。改成跟 `upsert_evidence`(P0-1/P0-C)同源的手法：插入包进 `db.begin_nested()`
(SAVEPOINT)，捕获 `IntegrityError`，原地查出真正冲突的是谁——同一个 `(tenant_id, user_id)`
就当成同 owner 并发写入(退回去原地更新，不是错误)，不同 owner 才是真正的 `id_conflict`。

## Known Risks — P0-A
- `_prune` 按 `tenant_id` 收口而不是 `(tenant_id, user_id)`——admin 能清理同租户内其他用户
  的过期条目。这是记录在案的判断调用(见上方 What Changed)，不是遗漏；如果产品期望 admin
  权限也要按用户收窄，需要另开一轮明确这个语义。
- `_persist` 的 `id_conflict` 响应是一个弱"这个 id 是否存在"的 oracle(不泄露是谁的、内容是
  什么)——独立审查判定风险低(id 是不透明的 hash/时间戳字符串)，未处理，不阻塞。
- `pruneBuildLedger`(前端)目前在真实业务代码里没有调用方(只有测试和已退休的
  `build-ledger-store.ts` 提到同名但不同的函数)，改成 throw 不会破坏现有调用方，但也意味着
  这条改进暂时没接入任何 UI 错误提示。
- `_transition` 的 audit 事件 id(`_make_id("audit", task_id, from_status, to_status, 秒级
  时间戳)`)没有跟 `_persist` 一样的 SAVEPOINT/IntegrityError 保护，同一秒内的重复
  transition 竞态理论上还是有主键冲突风险——本轮独立审查指出，判定为超出这次交接范围(只
  要求修 `_persist`)，记录为未来可能需要跟进的低优先级项。
- **环境问题(非本次改动引入，跨整个后端测试套件)**：`python3 -m pytest -q
  tests/test_build_ledger.py tests/test_build_ledger_tenant_isolation.py
  tests/test_build_ledger_self_heal.py -v` 在独立 Codex 环境里卡在第一条测试超过 60 秒。
  根因已确认：`conftest.py` 的 autouse fixture 在整个测试会话第一次收集到的测试上导入
  `web.main`，传递触发 `import litellm`——litellm 默认会在 import 时去
  `raw.githubusercontent.com` 抓一份定价表，除非设了 `LITELLM_LOCAL_MODEL_COST_MAP=True`；
  这个仓库自己的 `.env`/配置里没有设这个变量(只在本次交接所在的这个交互式 shell 里被
  单独 export 过，不是项目配置的一部分)。已经手工验证：去掉这个变量后 litellm 确实会真的
  发一次远程请求(`source: 'remote'`)，在本机网络畅通的情况下只要 ~3.5s；在网络受限/出站
  被静默丢包的沙箱里，DNS 解析本身可能不受 httpx 声明的 5s 超时约束，可以卡到远超 60 秒——
  跟报告的症状精确吻合。这是一个跨全套件的既有环境配置缺口，不是死锁，也不是本次两个修复
  引入的资源泄漏或未释放的测试资源；按"不修改无关代码"的要求未处理，建议后续单独在项目
  `.env`/pytest 配置里补 `LITELLM_LOCAL_MODEL_COST_MAP=True`。

## Not Touched
- `feature-chaotang-release`（未切换、未 push）
- `.playwright-cli/`
- `.playwright-mcp/`
- `backend/knowledge/docs/ima_archived/doc-*.md`

## Reviewer Focus

### P0-1/P0-C
- SAVEPOINT 冲突回滚后，`existing` 查询是否真的能看到并发对手已提交的行（session 隔离级别、
  是否需要 `db.expire_all()`）——这是本次修复能否真正生效的关键点，值得单独核实而不是只看
  测试通过。
- `ensure_jinyiwei_evidence_unique_constraint` 的幂等性：多进程/多次调用是否会互相竞态
  报错（"约束已存在"之类），目前实现方式需要复核。
- 是否遗漏了其他调用 `upsert_evidence` 的路径，没有走到新的 SAVEPOINT 分支。

### P0-A
- `_prune` 按 `tenant_id`(不含 `user_id`)收口这个判断调用是否符合产品预期——见上方
  Known Risks，这是本轮唯一一个"故意做出但可能需要产品拍板"的范围决定。
- `_persist` 的 `id_conflict` 弱 oracle 是否需要进一步处理，还是维持现状。
- 是否还有其他地方(前端或后端)构造/依赖 `BuildLedgerEntry`/`BuildLedgerAuditEvent` 但没有
  经过这次的归属过滤——已用 grep 确认 `build_ledger.py` 是全仓库唯一的构造点，值得独立复核
  一次。

### P0-A 第二轮(历史数据 + 并发竞态，已通过独立 code-reviewer 只读审查判定 GO)
- 历史数据的"admin 孤儿桶"方案是用户在三个选项里拍板选定的(见上方"第二轮独立审查纠正")——
  如果产品后续改变主意(比如想要更自动化的回填、或想彻底不暴露孤儿数据)，这是一处需要重新
  拍板而不是代码层面能单方面调整的决定。
- `_transition` 的 audit 事件 id 生成没有跟 `_persist` 一样的并发保护(见上方 Known Risks 新
  增项)——本轮范围明确只要求修 `_persist`，这条留作已知、记录在案的后续项。
- `LITELLM_LOCAL_MODEL_COST_MAP` 环境变量缺口(见上方 Known Risks)——已确认是环境问题、
  不是死锁/资源泄漏，按"不修改无关代码"要求本轮未处理，是否要在项目配置里补上需要你决定。

### 下一步(P0-B/P0-D，本次交接**均未开始**)
- P0-B(上书房任务归属过滤，`shangshufang.py`)：范围、复现材料、要求已在用户消息里给出
  完整 spec（`DecisionTask.user_id` 存在但未被十几个按 `task_id` 查询的端点使用，`/home`
  列表会把其他用户的 `task_id` 暴露出去），下一阶段可以直接按那份 spec 开工，不需要再确认
  来源。
- P0-D(`/api/intel/brief` 阻塞/可靠性)：上一轮独立只读审查已经追完整条链路(tavily 超时
  8s+兜底、gather_intel 包裹、`_persist_brief_items` best-effort)，**没有找到**未加保护的
  同步调用或裸写入，判定为"看起来已经不是问题"——建议下一阶段开工前先跟最初报告这个问题的
  人核实具体复现步骤，而不是假设审查结论一定全面。

---

## P0-A 真实闭环验证(2026-07-12，第三轮：真实服务 + 浏览器)

目标：不再改 P0-A 功能本身，只用真实运行的后端(8081)+ production 前端(3050)+ 真实浏览器
证明 P0-A 业务闭环是否跑通，同时查清此前 handoff 里"litellm 抓价目表"这个 pytest 卡住根因
结论是否站得住(用户明确指出:设了 `LITELLM_LOCAL_MODEL_COST_MAP=True` 依然会卡，不能照抄
上一轮结论)。

### 阶段一:pytest 卡住根因——诚实结论是"本环境复现不了，但修了一个真实隔离缺口"

用 `faulthandler_timeout=15` 跑给定复现命令，本机环境**未能复现卡住**(1.97s~4s 正常通过)。
逐条排除了以下假设，每条都有直接验证证据，不是猜测：
- litellm 抓价目表：直接 unset `LITELLM_LOCAL_MODEL_COST_MAP` 测试，本机网络通畅只需 3.5s
  完成一次真实抓取——机制存在，但不足以解释 60 秒级卡住，且用户已证实设成 True 依然会卡，
  这个理论对用户环境不成立。
- TestClient(app) 触发 lifespan 重跑全部 `ensure_*` 自愈：直接写小脚本验证，`TestClient(app)`
  不用 `with` 语法时**根本不触发** startup 事件——排除。
- `data/fengqun.db` 文件锁竞争：手工模拟另一个连接持有 `BEGIN IMMEDIATE` 独占锁 8 秒，
  `_get_db()` 仍然 0.02s 完成(因为表已存在，多数写入是条件性 no-op)——排除。
- 全新库首次初始化耗时：对临时空文件跑 `_get_db()`，0.018s——排除。

过程中发现一个**真实的、独立成立的测试隔离缺口**：`resolve_current_tenant_id()`(P0-A 让
`build_ledger.py` 第一次用上它)走 `src.tenant.get_db()`——这个函数直接连接真实的
`data/fengqun.db` 磁盘文件，完全独立于 `isolated_session_local` fixture(那个 fixture 只
换 `src.db.engine.SessionLocal`，是另一套机制)。`test_build_ledger.py`/
`test_build_ledger_tenant_isolation.py` 这两个用 `TestClient(app)` 发真实 HTTP 请求的文件，
因此在跑测试时会真的读写共享磁盘文件——`jinyiwei` 那边已经有过同样问题的先例
(`test_jinyiwei_endpoint.py::test_brief_endpoint_evidence_is_isolated_per_tenant` 早就
monkeypatch 了 `get_db`)，但 build-ledger 的普通测试没有跟进。已修:给这两个文件加
`autouse=True` fixture，换成内存 sqlite，不再碰真实文件。**诚实说明：这个修复不能证明是
原始 60 秒卡住的根因(本环境复现不了那个卡住)，但它是一个独立成立、值得修的真实缺口，
修完后不会让隔离问题掩盖未来其他真正的卡住原因。**

验证:`python3 -m pytest -q tests/test_build_ledger.py tests/test_build_ledger_tenant_isolation.py tests/test_build_ledger_self_heal.py tests/test_build_ledger_persist_concurrency.py -v`
→ **18 passed**，进程正常退出(exit 0)，非 timeout 强制判定。独立 code-reviewer 只读审查
判定 GO：确认 autouse fixture 在 `TestClient` 发请求前生效、两个自带多租户场景的测试的
`monkeypatch` 覆盖正确不冲突、连接正确关闭、tenant_slug 覆盖面确认无遗漏。

### 阶段二:前端 tsx 测试恢复

根因:`tsx` 从未作为依赖固定过，`test:node` 脚本一直靠 `npx --yes tsx` 每次现抓，这正是
"受限网络卡住"的原因。仓库里已有 ~30 个 `.nodetest.ts` 文件依赖它，早就是事实上的永久测试
依赖，只是没锁定——最小修复:`pnpm add -D tsx`(4.23.0)，diff 干净(`package.json` 只加一行，
lockfile 只加 tsx + 其 esbuild/fsevents 可选依赖，无其它包变动)。

验证:`pnpm exec tsx --test src/features/operating-loop/lib/build-ledger.nodetest.ts` →
**3 passed**，exit 0。`pnpm exec tsc --noEmit` 全量 0 errors(确认新依赖没破坏类型检查)。

### 阶段三:真实服务链路 + release gate

- 发现两个陈旧进程仍在监听 8081/3050，都是本次改动**之前**启动的(分别 17:25、13:01)，
  没有反映今天的代码——已终止并用当前代码重启。
- 后端 8081：`python3 -m web.main`，`/api/health` 200，真实 JWT 登录(`/api/auth/login`
  对错误密码正确返回 401)。
- 前端 3050：`NEXT_PUBLIC_API_MODE=real pnpm start`(production build，非 dev/mock)，
  `/chaotang` 200，3001 端口未被占用。
- `NEXT_PUBLIC_API_MODE=real pnpm gate:prod-release`：
  - `prod-doctor` ✅、`prod-doctor-decision — PROD` ✅
  - `http-health`/`true-chain` ✅ (frontend/backend/database/swarmRun 均 liveReady=true)
  - `final-release-harness` ❌——卡在 `checkResourceGallery`(`/court-briefing` 页面里
    `ChaotangTopNav.tsx`/`ResourceGallery.tsx` 的"朝堂资源阁"按钮，30s 超时点不到)。这个
    组件跟 build-ledger、P0-A 完全无关，本次会话从未碰过，判定为既有缺口，未修(不修改无关
    代码/不碰大殿冻结区域)。

### 阶段四:Playwright 真实业务闭环——发现一个新的、严重的、跟 P0-A 无关的生产问题

先按计划走真实登录 → `/junjichu`，发现 `/junjichu` 无 `taskId` 时会重定向到 `/court-briefing`
(需要先走"立项"决策派发向导才能进入，那是 shangshufang/军机处的另一套流程，不是
build-ledger 自己的入口)。为了不越界去逆向另一个功能的多步向导，改用同一个真实登录会话拿到
的真实 token，通过浏览器 `fetch()` 直接调 `/api/court/build-ledger`——这仍然是 100% 真实
登录、真实 token、真实后端、真实数据库，只是不点击那个跟 build-ledger 无关的多步向导 UI。

**过程中发现一个严重的、独立于 P0-A 的生产问题**：production 前端(3050)到后端(8081)的
rewrite 代理对 `/api/court/*` 前缀的请求**系统性损坏**——不只是 build-ledger，用完全不相关
的既有端点 `shangshufang/draft-edict` 直接复现同样的问题(通过 3050 得到
`{"error":"unauthorized"}`，直连 8081 正确处理请求)。现象：
- POST 请求：`Authorization` 头没有正确转发到后端，得到 `{"error":"unauthorized"}` 401 或
  `{"success":false,"error":"jiqun_dispatch_failed:未登录，请先认证","status":401}` 502
  (取决于是否带 Cookie，两种响应都不是我的后端会产生的格式)。
- GET 请求更隐蔽：返回 HTTP 200 加合法 JSON 形状，但内容是错的(空列表，而直连 8081 同一个
  查询能看到真实数据)——**不报错，静默返回错误结果**，比 POST 的显式失败更危险。
- 响应头带 `vary: rsc, next-router-state-tree, next-router-prefetch,
  next-router-segment-prefetch`——这是 Next.js App Router **页面** RSC 协商专属的 header，
  不该出现在一个纯 API 代理响应上，说明这条路径根本没有真正走到 `next.config.ts` 里配置的
  `/api/:path*` rewrite，而是被某个页面路由层面的东西拦截了。
- 排除过的假设(全部有直接验证，不是猜测)：`middleware.ts` 的 `/api/` 早退分支(代码逻辑
  上应该命中，但观测行为不符)；`shouldRedirectForLaunch` 首发白名单(该函数显式排除
  `/api/` 前缀)；沙箱系统级 `HTTP_PROXY`/`HTTPS_PROXY`(去掉这两个环境变量重启前端后问题
  依旧)；`next.config.ts` 里 rewrite 的目标地址(manifest 里确认写的就是正确的
  `http://127.0.0.1:8081`)；`.next` 构建产物比 `middleware.ts` 源码旧(构建时间反而更新)；
  App Router 里存在字面匹配的动态路由文件(逐级 `find` 确认没有)。**没有查到框架内部机制
  层面的最终根因**——这已经超出本次"验证 P0-A"的授权范围(不修改冻结页面/不做无关代码变更)，
  停止深挖，如实报告，不擅自去改 `middleware.ts`/`next.config.ts`。
- 影响面：浏览器 console 里能看到同一个问题在页面自己的后台请求上真实发生
  (`502 @ .../api/court/build-ledger`、`ERR_CONNECTION_REFUSED @
  .../api/court/chaotang/tasks`、`ERR_INCOMPLETE_CHUNKED_ENCODING @
  .../api/court/events/stream`)——不止 build-ledger，任务轮询、事件流等其它真实功能在生产
  前端下也会受影响。

**绕过方式(为了完成 Playwright 验收，不是修复)**：浏览器导航到 8081 的 origin(它是纯 API
服务，没有页面，但足够承载 `fetch()` 调用)，在那个 tab 里用真实登录拿到的 token 直连
8081——仍然是真实浏览器、真实 session、真实后端、真实数据库，只是不经过这个坏掉的 3050
代理层。

### Playwright 12 项验收结果

| # | 项目 | 结果 | 证据 |
|---|---|---|---|
| 1 | 用户 A 登录 | ✅ 真实 UI 登录(`/chaotang/login`)，`/api/auth/local-login` 200，重定向到 `/overview` | 截图 `p0a-e2e-01-login-page.png`、`p0a-e2e-02-logged-in-overview.png` |
| 2 | 创建构建台账 | ✅ `ledger-p0a-usera-real` 真实创建成功(8081 直连，真实 token) | 见上方响应 JSON |
| 3 | 页面重新查询显示 | ✅(经workaround)按 taskId 查询正确返回刚创建的条目 | 同上 |
| 4 | dispatched → reviewing | ✅ transition 成功，状态真实变更 | 同上 |
| 5 | audit 出现对应事件 | ✅ `actor: p0a_user_a`，`fromStatus/toStatus` 正确记录 | 同上 |
| 6 | 刷新后数据仍存在(非 localStorage) | ✅ 在 8081 origin(该 origin 的 localStorage 从未写过 build-ledger key)重新拉取，数据仍在且状态正确 | `localStorageHasEntry: false` + 服务端数据仍在 |
| 7 | 用户 B 看不到 A 的 list/taskId/audit/export | ✅ 四项全部返回空 | 见上方 JSON |
| 8 | 用户 B 不能 transition/覆盖 A 的台账 | ✅ transition→`entry_not_found`；覆盖→`id_conflict`；事后确认 A 的条目原样未受影响 | 见上方 JSON |
| 9 | 本租户 admin `includeUnowned=1` 看到历史无主数据 | ✅ 看到真实历史孤儿行 `e1`/`t1`(2026-07-11 遗留测试数据)，不带 flag 看不到 | 见上方 JSON |
| 10 | 普通用户 + 其他租户 admin 看不到无主数据 | ✅ 普通用户带 flag 仍只看到自己的 2 条；租户乙 admin 带 flag 得到空列表 | 见上方 JSON |
| 11 | console 无关键错误/无 401-403-500 泄漏 | ⚠️ **有错误，但全部可归因**：见上方"阶段四"发现的 `/api/court/*` 代理 bug(页面自身后台请求触发)、`localhost:4000` socket.io 服务未起(跟本次改动无关的既有服务)、我自己测试脚本产生的 CORS/429/401(跨源尝试+限流+过期 token 重试)。没有发现新的数据泄漏类错误。 | console log 见 Playwright 会话记录 |
| 12 | 截图/trace | ✅ 2 张截图(登录页、已登录 overview)存于本机 `/tmp/.../scratchpad/p0a-e2e-evidence/`(未提交进仓库，属临时验收产物) | 见上方路径 |

**关于用 workaround 而非纯 3050 UI 完成验收的说明**：受阶段四发现的 3050 代理 bug 所限，
第 2/3/4/5/6/7/8/9/10 项无法通过 3050 的 API 可靠验证(GET 会静默返回错误的空结果，POST
会被拒绝)——这些项改用同一个真实登录会话拿到的真实 token 直连 8081 完成，仍然是真实浏览器
+ 真实鉴权 + 真实后端 + 真实数据库，没有用 mock/静态样例/单测代替。这证明的是 **P0-A 自身
后端逻辑闭环真实可用**；它不能证明"3050 生产前端这条链路"是可用的——那条链路本身有独立于
P0-A 的严重 bug，见上方说明。

### READY / NOT READY

- **P0-A 后端逻辑闭环：READY**——租户/用户隔离、并发竞态防护、历史数据孤儿桶、审计追踪，
  12 项验收里跟 P0-A 直接相关的全部通过，且是用真实浏览器会话+真实后端+真实数据库验证的，
  不是单测。
- **整体 production release：NOT READY**——原因不是 P0-A，是阶段四发现的
  `/api/court/*` 代理层 bug：生产前端(3050)对这整个前缀的请求要么被错误拒绝(POST)、
  要么静默返回错误数据(GET，返回 200 但内容是空/错的)。这个 bug 比 P0-A 本身更紧急，因为
  它会影响生产环境下**所有**走 `/api/court/*` 的真实功能(build-ledger、部分 shangshufang
  端点、任务轮询、事件流)，且已确认跟今天任何一次代码改动无关(该路径本会话完全没碰)。
  `final-release-harness` 的资源阁超时是另一个独立的、无关的既有缺口。

### 剩余阻塞项(按紧急度)

1. **P0(新发现，紧急，超出本次授权范围)**：`/api/court/*` 通过 3050 生产前端代理系统性
   损坏(POST 拒绝、GET 静默返回错误数据)。建议立刻单独立项调查，不要当成 P0-A 的一部分——
   本次会话已经排除了 middleware.ts 早退逻辑、首发白名单、系统代理环境变量、rewrite 目标
   地址、构建产物过期、字面匹配的动态路由这几个假设，下一步需要更深入调试 Next.js 16 的
   rewrite/RSC 内部行为(比如加临时 console.log 到 middleware 里重新构建观察，或者用
   Next.js 自己的 debug 日志)。
2. `final-release-harness` 的资源阁(`/court-briefing` 页 "朝堂资源阁" 按钮)30s 超时——
   跟 P0-A/build-ledger 无关的既有缺口，未处理。
3. 已知既有项(见上方各轮 Known Risks)：`_prune` 按 tenant 收口的产品判断调用、`_persist`
   的 `id_conflict` 弱 oracle、`_transition` audit id 无并发保护、
   `LITELLM_LOCAL_MODEL_COST_MAP` 环境配置缺口。
4. 本轮在真实 dev 数据库里创建了测试账号(`p0a_user_a`/`p0a_user_b`/`p0a_admin_a`/
   `p0a_admin_b`)和测试租户(`p0a-tenant-b`，tenant_id=2)、测试台账条目
   (`ledger-p0a-usera-real`/`task-p0a-usera-real`)——均带 `p0a_`/`P0A` 前缀明显可识别。
   验证完成后已删除全部测试账号/租户/台账条目/审计事件，凭据已彻底失效(重新登录验证返回
   "用户名或密码错误")。
