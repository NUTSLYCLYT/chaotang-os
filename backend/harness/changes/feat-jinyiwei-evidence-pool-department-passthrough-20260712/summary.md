# 后端变更摘要：feat-jinyiwei-evidence-pool-department-passthrough-20260712

| Field | Value |
| --- | --- |
| Change ID | feat-jinyiwei-evidence-pool-department-passthrough-20260712 |
| Status | DELIVERED |
| Owner | 后端 harness |
| Date | 20260712 |

## 摘要

"锦衣卫作为跨阶段共享证据服务"阶段2：六部派单(`real_department_engines.py::adapt_jinyiwei`)读写穿透阶段1建好的持久情报池，而不只是阶段1里 `/api/intel/brief` 这一个入口在维护它。

## 范围

- `backend/src/real_department_engines.py`：`adapt_jinyiwei()` 改用闭包捕获 `search_fn` 实际检索到的 findings，检索前先 `query_evidence()` 合并已核实过的"入库"级历史情报，检索/分级完成后 `upsert_evidence()` 写回新条目。新增 `_merge_known_evidence()`/`_persist_department_evidence()` 两个模块级辅助函数。
- `backend/tests/test_real_department_engines.py`：新增 `test_adapt_jinyiwei_reuses_persisted_evidence_without_duplicate_claims`，验证两次主题重叠调用第二次能读到第一次写回的历史情报，且不产生重复 `claim_key` 行。

## 非目标

- 不改变 `_run_departments_cross_referenced` 喂给其余部门上下文的方式(仍是文本拼接进 `refined_edict`)。
- `dept_affinity_json` 暂时留空——`adapt_jinyiwei(task_text)` 目前没有"谁在问"的上下文，不硬编造。
- 不碰前端(阶段3可选)。

## 风险与设计要点

- **惰性陷阱**：本仓库测试环境里 `web.main` 导入时会把 `.env` 里真实有效的 `TAVILY_API_KEY` 加载进 `os.environ`。第一版实现打算在 `adapt_jinyiwei` 里提前调用 `tavily_search()` 拿到原始 findings 用于落库配对(照搬阶段1路由层的写法)，但这样会让既有的两个 mock 掉 `gather_intel` 本身的测试(`test_adapt_jinyiwei_no_findings_is_honest_not_none`/`test_adapt_jinyiwei_failure_returns_none`)意外触发真实网络请求——因为原来 `search_fn=tavily_search` 只是传了个引用，从未被调用过(mock 掉的 `gather_intel` 根本不会调用它)。改用闭包(`_search_and_capture`)在 `gather_intel` 内部真的调用 `search_fn(query)` 时才触发检索+查历史+合并，保持跟改动前完全一致的惰性，两个既有测试无需修改就继续通过、且不会打真实网络请求(用运行耗时验证：39 个测试 3.47s 完成，没有网络超时痕迹)。

## 验证

- `python3 -m pytest -q tests/test_real_department_engines.py tests/test_jinyiwei_endpoint.py tests/test_jinyiwei_evidence_store.py tests/test_jinyiwei_agent.py tests/test_jinyiwei_vet.py tests/test_jinyiwei_search.py tests/test_swarm_execution_loop_api.py`：81 passed。
- 全量 `python3 -m pytest -q`：见 ci_result/ci_summary.md。
- `python3 scripts/harness_doctor.py`/`node scripts/harness-doctor.mjs`：见 ci_result/ci_summary.md。
