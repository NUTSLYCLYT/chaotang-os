# CI 摘要：fix-decree-execution-event-sequence-20260712

## 命令

- `python3 -m pytest -q`(后端全量)
- `pnpm exec tsc --noEmit`(前端)
- `pnpm harness:doctor`(前端)、`python3 backend/scripts/harness_doctor.py`(后端)、`node scripts/harness-doctor.mjs`(根级)
- 裸 SQLAlchemy Core 脚本独立重放迁移 005 的加列/索引/回填逻辑(见下方风险说明)

## 结果

- `pytest`：2390 passed / 8 failed / 25 skipped。8 个失败用 `git stash` 逐一核实，改动前(无 Phase 4 改动)同样失败，与本次改动无关：
  - `test_case_archive_rag.py::TestIngestAllApproved::test_ingest_all_approved_counts`/`test_ingest_all_approved_partial_failure`
  - `test_commit_closeout_check.py::test_check_doc_duplicates_flags_overlapping_new_topic`
  - `test_contract_alignment_p0.py::test_qintian_chat_contract_streams_fallback_tokens`
  - `test_production_observability.py::test_swarm_api_writes_production_events`
  - `test_system_communication_topology.py::test_swarm_api_config_run_and_session_replay`/`test_swarm_run_still_routes_real_ops_to_ai_ops`(根因是测试替身 `FakeApiOrchestrator.run()` 缺少 `project_id` 参数，跟本次改动的 timeline/sequence 完全无关)
  - `test_shangshufang_loop_api.py::test_chancellor_chat_streams_single_agent_reply`(此前阶段已记录过的既有 flaky LLM 文本断言)
- 新增测试 `test_load_timeline_orders_by_sequence_when_occurred_at_collides` 首次实现时失败(`[1,1,1]` 而非 `[1,2,3]`)，暴露了一个真实 bug：`SessionLocal`(`src/db/engine.py`)全局设置 `autoflush=False`，同一事务内连续两次调用 `record_timeline_event` 时，`MAX(sequence)` 查询看不到前一次 `db.add` 尚未 flush 的行，导致同一事务内多次调用会算出重复序号。修复：在 `record_timeline_event` 的 `MAX` 查询前显式 `db.flush()`。修复后测试通过。
- `tsc --noEmit`：绿，无新增错误。
- 三层 `harness:doctor`：0 errors 0 warnings。
- Alembic 迁移风险：本沙箱 `alembic` 未安装(`requirements-core.txt` 声明为依赖，但 `import alembic` 在当前 python3 环境里只解析到本地 `backend/alembic/` 目录，没有真正的库)，无法直接跑 `alembic upgrade head` 验证。改用裸 SQLAlchemy Core 脚本，在内存 SQLite 上手工重建 004 版本的旧 schema(无 `sequence` 列)，插入含同秒碰撞的种子数据，逐字重放迁移 005 的 `upgrade()` 函数体(加列、加索引、删旧索引、按 `task_id` 分组回填)，验证结果序号确定且按 `task_id` 独立计数——脚本输出与断言均通过。

## Codex 停止前审查纠正(2026-07-12)

Codex 停止前审查指出:"旧数据库在常规启动路径下缺少 `sequence`，状态接口和事件写入会直接失败"。复核确认属实且**在本沙箱是可复现的真实 bug**：`backend/data/fengqun.db` 是纯靠 `create_all(checkfirst=True)` 建的旧库(没有 `alembic_version` 表，从未跑过任何 alembic 迁移)，`decree_execution_events` 表当时确实缺 `sequence` 列。根因：`web/main.py::lifespan()` 的常规启动路径只用 `create_all(checkfirst=True)` 补建表(对已存在的表不做列级 diff)，此前只对 `tasks.result_json`(002)和 `retrospectives.outcome`(004)两处已知的"加列迁移"配了对应的 `ensure_*_column` 自愈函数(`src/db/flow_store.py`)，`sequence` 这次遗漏了同款自愈函数。

修复(照搬既有惯例，未发明新机制)：
1. `src/db/flow_store.py` 新增 `ensure_decree_execution_event_sequence_column()`，逻辑与 `ensure_retrospective_outcome_column` 完全对称(PRAGMA table_info 探测 → 缺列则 `ALTER TABLE ... ADD COLUMN sequence INTEGER NOT NULL DEFAULT 0`)。
2. `web/main.py::lifespan()` 里跟另外两个 `ensure_*` 一起调用。
3. 按既有惯例(`ensure_task_result_json_column`/`ensure_retrospective_outcome_column` 均在各自的 save/get 函数内部也调用一次)，在 `decree_status.py::record_timeline_event`/`_load_timeline` 内部也各调用一次——保证即使某条路径绕开了 `lifespan()`(例如测试用不同 DB_URL、或旧进程尚未重启)，读写这张表时依然会现场自愈，不是只靠一次性启动钩子。
4. 新增 `test_decree_execution_event_sequence_self_heals_on_old_table`(`backend/tests/test_flow_db_dualwrite.py`)，手工建一张缺 `sequence` 列的旧表，验证 `record_timeline_event`/`_load_timeline` 直接调用即可自愈，不崩。
5. 真实复现验证：本沙箱的 `backend/data/fengqun.db` 在修复前确认缺列(`PRAGMA table_info` 只有 6 列)；手动重放 `lifespan()` 里那段 schema-bootstrap 逻辑(`create_all` + 三个 `ensure_*`)后，`PRAGMA table_info` 确认 `sequence` 列已加上，23 条既有行全部拿到默认值 0(未做精确回填——这与另外两个既有 `ensure_*` 函数的行为完全一致：运行时自愈只保证"不崩"，不做 Alembic 迁移那种精确的历史数据回填；精确回填仍然是 `alembic upgrade head` 的职责)。`backend/data/fengqun.db` 本身在 `.gitignore` 里，这次手动验证不会进入提交。

验证：`python3 -m pytest -q tests/test_flow_db_dualwrite.py tests/test_decree_execution_status.py tests/test_chancellor_contracts.py` 26 passed；全量 `pytest` 重跑确认无新增失败(2391 passed，同一组 8 个既有无关失败)；三层 `harness:doctor` 全绿。

## Codex 停止前二次审查纠正(2026-07-12)

Codex 停止前二次审查指出:"自愈避免了崩溃，但没有完成旧库的正确迁移"。复核确认属实且是比第一次更根本的问题：第一版 `ensure_decree_execution_event_sequence_column` 只加列，旧表里本来就有的历史行全部落到 `DEFAULT 0`——同一 `task_id` 下的多条历史事件互相之间仍然没有确定顺序，这正是 `sequence` 列本身要解决的问题，第一版自愈"没崩但也没真的修"。而这条运行时自愈路径(而非 `alembic upgrade head`)恰恰是本仓库实际会被走到的路径(dev 环境、乃至任何忘记手动跑迁移的旧进程)，不能只满足"不报错"这一个更低的门槛。

修复：给 `ensure_decree_execution_event_sequence_column` 加一个"只在本次调用真的把列加上时才触发"的回填分支 `_backfill_decree_execution_event_sequence`——按 `task_id` 分组、`occurred_at`/`id` 排序，逐行编号，跟 `alembic/versions/005_decree_execution_event_sequence.py` 的回填逻辑同源(只是用 ORM 查询而不是裸 SQL table()，因为 `flow_store.py` 本来就允许直接 import ORM 模型)。为 postgres 分支也补了"先查 `information_schema.columns` 确认列是否已存在"的判断(此前直接无条件 `ADD COLUMN IF NOT EXISTS`，无法区分"新加"还是"已存在"，回填也就无法安全地只在新加时触发一次)。

把 `test_decree_execution_event_sequence_self_heals_on_old_table` 升级成 `test_decree_execution_event_sequence_self_heals_and_backfills_existing_rows`：老表里预先插入 3 条同 `task_id` 的历史行(含两条 `occurred_at` 完全相同，模拟历史同秒碰撞)，再调用 `record_timeline_event` 触发自愈，断言 4 条事件(3 条历史+1 条新写入)的 `sequence` 是 `[1,2,3,4]`，而不只是断言新写入的那一条不报错。

真实复现闭环：本沙箱 `backend/data/fengqun.db` 在第一版自愈(未回填)修复后，确认全部 23 条既有行的 `sequence` 都是 `0`(可复现"没真的修"的确切现象)；手动调用新的 `_backfill_decree_execution_event_sequence` 后，`SELECT id, task_id, sequence, occurred_at ... ORDER BY task_id, sequence` 确认每个 `task_id` 下的多条历史行都拿到了按 `occurred_at` 顺序单调递增、互不相同的序号。`backend/data/fengqun.db` 仍在 `.gitignore` 内，这次手动验证同样不会进入提交，但真实证明了修复对已经处于"第一版自愈中间状态"的库同样有效(不需要重建 DB 文件)。

验证：`python3 -m pytest -q tests/test_flow_db_dualwrite.py tests/test_decree_execution_status.py tests/test_chancellor_contracts.py` 26 passed；全量 `pytest` 2391 passed，同一组 8 个既有无关失败；`tsc --noEmit` 绿；三层 `harness:doctor` 全绿。

## Codex 停止前三次审查纠正(2026-07-12)

Codex 停止前三次审查指出:"自愈仍然没有修复此前遗留在中间坏状态的数据库"。复核确认属实——这正是本沙箱 `backend/data/fengqun.db` 在上一轮修复过程中真实经历过的状态：上一版 `ensure_decree_execution_event_sequence_column` 只在"本次调用真的把列加上"时才触发回填(`column_newly_added` 门槛)；如果一个库已经在这次修复上线前跑过一次(此前遗留的、只加列不回填的版本)，`sequence` 列已经存在但全部卡在 `DEFAULT 0`，那么修复上线之后，每次调用都会在 PRAGMA/`information_schema` 探测到"列已存在"就直接放行，永远不会再触发回填——本沙箱的库就正处于这个状态(上一轮我用手动脚本临时修复了它，但代码本身并不会自动修复同类库)。

修复：不再用"列是不是本次调用加的"做回填触发条件，改成检测"表里是否存在退化行"——合法 `sequence` 永远从 1 开始(本函数的回填逻辑、`alembic/versions/005_decree_execution_event_sequence.py` 的回填逻辑、以及 `record_timeline_event` 的 `MAX(已有值)+1` 写入逻辑，三处产生的最小值都是 1)，所以任何 `sequence=0` 的行只可能是"从未被回填过"的残留状态，不可能是合法产生的值。新增 `_repair_decree_execution_event_sequence_if_degenerate()`：查一次"是否存在 `sequence=0` 的行"，有就重新触发全量回填。回填函数本身是幂等的纯重新推导(按 `occurred_at`/`id` 排序重新编号整张表)，多次调用不会破坏已经正确的排序，也不会因为"回填过一次"而跳过后续修复。

新增测试 `test_decree_execution_event_sequence_repairs_previously_broken_intermediate_state`：预先建一张**已经带 `sequence` 列**的表(不是"列不存在"，是"列存在但是坏的")，同一 `task_id` 下插入 3 条历史行全部卡在 `sequence=0`，验证下一次任意 `record_timeline_event` 调用(即使是操作另一个不相关的 `task_id`)能检测到这个退化状态并重新回填出确定顺序 `[1,2,3]`。

验证：`python3 -m pytest -q tests/test_flow_db_dualwrite.py tests/test_decree_execution_status.py tests/test_chancellor_contracts.py` 27 passed；全量 `pytest` 无新增失败；三层 `harness:doctor` 全绿。本沙箱 `backend/data/fengqun.db` 复查确认 `sequence=0` 的退化行数为 0(上一轮已手动修复过)，本轮修复让这种情况以后能被代码自身检测并自动修复，不再需要手动介入。

## Codex 停止前四次审查纠正(2026-07-12)

Codex 停止前四次审查指出:"只读状态请求触发的'自愈'会在关闭 Session 时回滚，数据库仍停留在坏状态"。复核确认属实——`GET /tasks/{task_id}/status`(`web/routers/shangshufang.py:1157` 起)是纯读端点，全程只 `db.query(...)`，从不调用 `db.commit()`，只在 `finally` 里 `db.close()`。`_load_timeline` 里触发的 `ensure_decree_execution_event_sequence_column`/`_repair_decree_execution_event_sequence_if_degenerate` 如果不自己提交，回填产生的 UPDATE 会在 session 关闭时被回滚——用真实调用序列复现确认：sqlite DBAPI 对 DDL(`ALTER TABLE`)有隐式自动提交的怪癖，所以"加列"本身会侥幸留下，但真正修复排序问题的"回填"数据(ORM 层面的 `UPDATE`)每次都在 session 关闭时被丢弃，状态接口会陷入"检测到坏数据→重新回填→白做"的死循环，从未真正落盘。

排查过程中发现这不是本次改动独有的新问题：`web/routers/dadian.py::_task_rows()`(被 3 个纯 GET 端点调用)对 `ensure_task_result_json_column` 也是同样"调用但从不 commit"的既有模式，是这个代码库里已经存在、跟本次改动无关的同类缺口；反而 `web/routers/chaotang.py` 的 `tasks_list`/`task_detail` 已经在类似位置正确地加了 `_db.commit()`。本次只修复被 Codex 点名的 `_load_timeline` 这一处，不顺手扩大范围去修 `dadian.py` 的既有缺口。

修复：在 `_load_timeline` 里 `ensure_decree_execution_event_sequence_column(db)` 之后立即 `db.commit()`——这里安全的原因是 `_load_timeline`/`build_decree_execution_status` 全程是纯读，提交之前没有任何待写入的业务状态会被这次提前 commit 误伤(唯一调用方 `shangshufang_task_status` 本来就只读不写)。没有对 `record_timeline_event` 做同样处理：核实过它当前所有调用方(`shangshufang.py:1109-1125`、`outbox_worker.py` 的 `_execute_direct`/`_execute_council` 两条路径)都会在函数返回后不久可靠地 `db.commit()`，提前插入一次 commit 反而会破坏该函数文档里明确写着的"跟其余下旨记录同一事务，避免不一致窗口"这个设计意图。

新增测试 `test_decree_execution_event_sequence_backfill_persists_after_read_only_session_closes`：模拟真实只读端点的调用形态——一个 session 只调用 `_load_timeline`(不写入、不显式 commit)后关闭，再用一个全新独立的 session 直接查库，断言回填结果真的持久化了。为确认这条测试真的能捕获这个回归，临时把 `_load_timeline` 里的 `db.commit()` 去掉重跑这条测试，确认它会失败(`{0} == {1, 2}`，回填数据被回滚)，再恢复修复确认测试转绿——不是一条只是“看起来测了什么”但实际测不出问题的假阳性测试。

验证：`python3 -m pytest -q tests/test_flow_db_dualwrite.py tests/test_decree_execution_status.py tests/test_chancellor_contracts.py` 28 passed；全量 `pytest` 无新增失败；三层 `harness:doctor` 全绿。
