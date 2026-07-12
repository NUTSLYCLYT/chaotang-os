# CI 验证摘要：feat-jinyiwei-evidence-pool-20260712

## 命令

- `python3 -m pytest -q tests/test_jinyiwei_evidence_store.py tests/test_jinyiwei_endpoint.py`
- `python3 -m pytest -q`(后端全量)
- `python3 scripts/harness_doctor.py`
- `node scripts/harness-doctor.mjs`(根级)

## 结果

- `tests/test_jinyiwei_evidence_store.py`/`tests/test_jinyiwei_endpoint.py`：17 passed。
  - `upsert_evidence` 幂等更新(同 claim_key 两次调用只留一行、字段被更新)。
  - `query_evidence` 三个过滤维度：默认排除"待核"、任何情况下排除"拒"(即使 `include_pending=True`)、部门过滤(空 affinity 视为不限部门)。
  - 租户隔离：不同 `tenant_id` 的查询互不可见。
  - `create_all` 建表冒烟测试：全新表，`checkfirst=True` 正确建表，无需 `ensure_*_column` 自愈。
  - 集成测试：真实调用 `POST /api/intel/brief`(CALLER_FINDINGS 模式)后，`GET /api/intel/evidence?query=` 能查到对应情报。
  - 集成测试：Tavily 真检索路径(`LIVE_SEARCH`)下，验证路由层持久化的是未截断的完整 claim，不是 `_finding_to_item` 截断的 60 字 `title`——首次实现时用了一条会被确定性 vet 门判成"拒"的 claim，暴露测试本身写错(不是代码 bug)：脏情报按设计永不出 `GET /api/intel/evidence`，即使 `include_pending=True`。改用会被判成"二手(单源)/待核"的 source tier 后测试通过，确认待核情报的完整 claim 正确落库。
- 全量 `pytest`：2403 passed / 8 failed(既有无关失败，逐条比对与改动前基线一致：`test_case_archive_rag.py` 两个、`test_commit_closeout_check.py` 一个、`test_contract_alignment_p0.py` 一个、`test_production_observability.py` 一个、`test_shangshufang_loop_api.py::test_chancellor_chat_streams_single_agent_reply`(已知 flaky LLM 文本断言)、`test_system_communication_topology.py` 两个)/ 25 skipped。
- `python3 scripts/harness_doctor.py`：0 errors, 0 warnings。
- `node scripts/harness-doctor.mjs`(根级)：0 errors, 0 warnings。

## 备注

- 本沙箱未安装 `alembic` 包(`requirements-core.txt` 声明为依赖但当前 python3 环境里没有真正的库)，无法直接跑 `alembic upgrade head` 验证 `006_jinyiwei_evidence.py` 迁移文件本身的执行；迁移文件结构对齐 `005_decree_execution_event_sequence.py` 的既有格式，且是全新建表(无历史行需要回填)，风险低于此前给已有表加列的迁移。
- `data/fengqun.db`(gitignore 内，不提交)会在下次应用启动时通过 `create_all(checkfirst=True)` 自动获得 `jinyiwei_evidence` 表，无需额外自愈函数。
