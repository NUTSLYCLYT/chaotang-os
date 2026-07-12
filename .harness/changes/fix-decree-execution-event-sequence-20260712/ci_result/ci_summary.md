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

验证：`python3 -m pytest -q tests/test_flow_db_dualwrite.py tests/test_decree_execution_status.py tests/test_chancellor_contracts.py` 26 passed；全量 `pytest` 重跑确认无新增失败(结果见下方补充记录)。
