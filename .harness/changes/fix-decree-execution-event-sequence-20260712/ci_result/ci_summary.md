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
