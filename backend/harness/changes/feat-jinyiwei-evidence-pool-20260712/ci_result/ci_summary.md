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

## Codex 停止前审查纠正(2026-07-12)

Codex 停止前审查指出:"tenant-scoped evidence uses the default tenant"。复核确认属实：`web/routers/jinyiwei.py` 的写入/查询路径此前一律调用 `src.chaotang_store._get_default_tenant_id()`，这个函数硬查 `slug='default'`，完全不看当前请求实际是哪个租户在调用——等同于假装系统是单租户，所有租户的情报都会被错误地写进同一个 `tenant_id`。

排查发现本仓库已经有一套**正确**的每请求租户解析模式：`src/dept_admin_store.py::_current_tenant_id()`(给部门管理端点用)读 `get_current_tenant()`(线程本地，由 `get_current_user()` 在请求进入时从 JWT 设好)再查 `tenants` 表，是真正按调用者解析的。但这个正确模式只服务了部门管理端点，`chaotang_store.py`/`chaotang.py`/`chaotang_orchestrator.py`(decrees/tasks/memorials/reviews/retrospectives 五张表)和我这次新加的 `jinyiwei.py` 都独立漂移到了 `_get_default_tenant_id()` 这条捷径上。

修复：把 `_current_tenant_id()` 的实现提炼成 `src/tenant.py::resolve_current_tenant_id()`(公开函数，逻辑不变)，`dept_admin_store._current_tenant_id()` 改为委托它(保留原有私有名字，不改动内部调用方)，`jinyiwei.py` 的两处 `_get_default_tenant_id()` 调用都换成 `resolve_current_tenant_id()`。**范围说明**：`chaotang_store.py`/`chaotang.py`/`chaotang_orchestrator.py` 里同款的 `_get_default_tenant_id()` 硬编码是同一根因的既有缺口，本次只修复被点名的 `jinyiwei.py`，不顺手扩大范围去改这三个文件——留作后续单独跟踪。

验证过程中发现一个更深的坑：第一版回归测试直接在测试自己的线程里用 `tenant_context()` 设置线程本地变量，然后指望 FastAPI 同步 endpoint(跑在 Starlette `run_in_threadpool` 派发的独立工作线程里)能读到——运行失败，报 `sqlite3.ProgrammingError: SQLite objects created in a thread can only be used in that same thread`，暴露测试方法论本身的错误(不是被测代码的 bug)。写了一个最小复现脚本验证 FastAPI 对"同步依赖 + 同步 endpoint"是否共享同一个工作线程——确认**是共享的**(anyio 对同一次请求内连续的同步调用会复用同一个工作线程)，说明生产路径本身没问题；问题只在于测试没有通过真实的依赖注入路径(`get_current_user()` 内部调用 `set_current_tenant()`)去设置线程本地状态。改用 `app.dependency_overrides` 覆盖 `get_current_user()`，让"设置租户"发生在依赖解析阶段(与 endpoint 函数体共享同一工作线程)，测试才真实覆盖生产路径。

新增：
- `src/tenant.py::resolve_current_tenant_id()`。
- `tests/test_tenant_resolve_current_tenant_id.py`：直接单测该函数对不同 slug 解析出不同 tenant_id(用内存假 sqlite 表，不碰真实 `data/fengqun.db`)。
- `tests/test_jinyiwei_endpoint.py::test_brief_endpoint_evidence_is_isolated_per_tenant`：通过真实 `POST /api/intel/brief`/`GET /api/intel/evidence` 端到端验证，租户甲写入的情报，切换到默认租户身份查询时看不到。

验证：`python3 -m pytest -q tests/test_tenant_resolve_current_tenant_id.py tests/test_jinyiwei_endpoint.py tests/test_jinyiwei_evidence_store.py` 20 passed；全量 `pytest` 2406 passed，同一组 8 个既有无关失败；三层 `harness:doctor` 全绿。
