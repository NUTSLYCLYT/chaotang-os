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

## Codex 停止前审查纠正(2026-07-12)

Codex 停止前审查(未跑完就中途失败，但 rawOutput 里的中间推理点出了一个真实问题)指出:"the current lookup treats the whole task text as one substring key"。复核确认属实，且比表面看起来更严重——分两部分：

1. **功能本身几乎不可用**：`_merge_known_evidence` 把 `task_text[:120]`(最多120字的一整段任务描述)整体当成一个 LIKE 子串去匹配 `query_evidence`。要命中，历史 `claim`/`query` 必须逐字包含这一整段(甚至上百字)文本——现实中两次任务描述只要措辞稍有不同(几乎总是如此)就永远不会命中，等同于"读历史复用"这个功能形同虚设，从来没有真正生效过。
2. **本轮验收测试是假阳性**：`test_adapt_jinyiwei_reuses_persisted_evidence_without_duplicate_claims` 第一版让两次调用的 mock 检索永远返回同一条 claim("该供应商已通过一手资质核验")，断言"第二次结果里能看到这条 claim"——但这个断言即使历史合并完全失效也会通过，因为第二次的新检索结果本身就包含这条 claim，测试没有能力区分"历史合并生效"和"纯粹是这次新检索又搜到了同一条"。

修复：
- `src/real_department_engines.py` 新增 `_candidate_keywords()`：按常见中文标点/空白把任务描述切成候选短语(取长度≥2的前5个)，不再把整段原文当一个整体子串。
- `src/jinyiwei_evidence_store.py::query_evidence()` 的 `keyword` 参数改成接受 `str | list[str]`，列表时对每个候选短语做 OR 匹配，一次查询搞定，不新增多次往返。`/api/intel/evidence?query=` 这类单字符串调用方完全不受影响(向后兼容)。
- 测试重写：两次调用的 mock 检索返回**互不相同**的 claim(第一次"资质核验"，第二次"合同条款审查")，断言第二次结果里**同时**出现两条内容——如果历史合并失效，只会看到"合同条款"这一条，"资质核验"这个断言会失败。新增 `test_merge_known_evidence_extracts_multiple_short_candidates` 直接验证候选词切分逻辑本身，不依赖整个 `adapt_jinyiwei` 链路。
- 用负对照验证测试真的能捕获这个回归：临时把 `_merge_known_evidence`/`query_evidence` 改回旧的整段子串写法重跑这条测试，确认失败(`assert any("资质核验"...)` 断言不成立)，再恢复修复确认转绿——不是一条只是"看起来测了什么"但实际测不出问题的假阳性测试。

验证：`python3 -m pytest -q tests/test_real_department_engines.py tests/test_jinyiwei_evidence_store.py tests/test_jinyiwei_endpoint.py` 64 passed；全量 `pytest` 2413 passed，同一组 8 个既有无关失败；三层 `harness:doctor` 全绿。
