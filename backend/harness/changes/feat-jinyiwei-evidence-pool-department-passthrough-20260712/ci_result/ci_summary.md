# CI 验证摘要：feat-jinyiwei-evidence-pool-department-passthrough-20260712

## 命令

- `python3 -m pytest -q tests/test_real_department_engines.py tests/test_jinyiwei_endpoint.py tests/test_jinyiwei_evidence_store.py tests/test_jinyiwei_agent.py tests/test_jinyiwei_vet.py tests/test_jinyiwei_search.py tests/test_swarm_execution_loop_api.py`
- `python3 -m pytest -q`(后端全量)
- `python3 scripts/harness_doctor.py`
- `node scripts/harness-doctor.mjs`(根级)

## 结果

- 相邻测试：81 passed，66.59s(含 `test_swarm_execution_loop_api.py` 的真实较慢用例，非本次改动引入)。
- 新增测试 `test_adapt_jinyiwei_reuses_persisted_evidence_without_duplicate_claims`：两次调用 `adapt_jinyiwei`，第二次合并进了第一次写回的历史情报(`doc2["items"]` 里能看到)，`jinyiwei_evidence` 表按 `claim` 查询只有 1 行(原地更新，非重复插入)。
- 既有两个 mock 测试(`test_adapt_jinyiwei_no_findings_is_honest_not_none`/`test_adapt_jinyiwei_failure_returns_none`)无需修改继续通过：39 个测试 3.47s 完成，运行时间正常，确认闭包延迟检索的设计没有意外触发真实 Tavily 网络请求。
- 全量 `pytest`：2407 passed / 8 failed(既有无关失败，与此前基线一致：`test_case_archive_rag.py` 两个、`test_commit_closeout_check.py` 一个、`test_contract_alignment_p0.py` 一个、`test_production_observability.py` 一个、`test_shangshufang_loop_api.py::test_chancellor_chat_streams_single_agent_reply`(已知 flaky LLM 断言)、`test_system_communication_topology.py` 两个)/ 25 skipped。
- `python3 scripts/harness_doctor.py`：0 errors, 0 warnings。
- `node scripts/harness-doctor.mjs`(根级)：0 errors, 0 warnings。
