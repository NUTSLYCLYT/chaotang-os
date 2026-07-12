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

## Codex 停止前二次审查纠正(2026-07-12)

Codex 停止前二次审查指出:"keyword split still misses common unpunctuated follow-ups"。复核确认属实——第一版修复只解决了"整段当一个候选"这一半问题，仍然遗漏一个更常见的场景：`_candidate_keywords()` 靠标点/空白切分，遇到"某供应商资质尽调追加核实"这种中间**没有**逗号/句号的追加式后续问法(现实中相当常见——很多人打字不加标点直接续写)，`re.split()` 找不到分隔符会原样返回整段文本，退化回"整段当一个候选"的老问题——第一轮修复实际上只覆盖了"恰好带标点"这一种情况，没有真正解决 Codex 第一次指出的根本问题。

修复：不再依赖猜标点或猜一个刚好对齐的滑动窗口大小，改成双向判断：
1. 标点切分出的候选短语出现在历史 `claim`/`query` 里(带标点时能帮上忙)。
2. **新增**：反过来，历史 `query`(通常较短，是过去某次任务的完整描述)整个作为子串出现在这次的任务描述里——"旧问题 + 追加内容"这种最常见的后续问法(不管有没有标点)天然满足这条，因为新文本本来就是"旧文本+更多字"。

为了在 Python 侧做这个双向检查，`query_evidence()` 不再需要 `keyword: str | list[str]` 的列表支持——`_merge_known_evidence` 改成不传 `keyword`、直接拉一个按 `tenant_id`/`decision` 过滤的候选池(上限 200 行，`# 候选池上限` 注释标注了升级路径)，双向匹配逻辑整个放在 Python 侧做。因此把 `query_evidence()` 的 `keyword` 参数改回 `str | None`(移除上一轮加的列表支持——没有任何调用方还在用它，留着是死代码)，连带移除因此变成未使用的 `import sqlalchemy as sa`。

新增测试 `test_adapt_jinyiwei_reuses_evidence_for_unpunctuated_follow_up`：专门用没有标点分隔的追加式后续问法("某供应商资质尽调追加核实合同风险")验证反向包含检查。用负对照验证：临时去掉反向包含检查重跑这条新测试，确认失败(`assert any("资质核验"...)` 不成立)，恢复后确认转绿。

验证：`python3 -m pytest -q tests/test_real_department_engines.py tests/test_jinyiwei_evidence_store.py tests/test_jinyiwei_endpoint.py` 65 passed；全量 `pytest` 2414 passed，同一组 8 个既有无关失败；三层 `harness:doctor` 全绿。

## Codex 停止前三次审查纠正(2026-07-12)

Codex 停止前三次审查指出:"reverse substring match can merge unrelated historical evidence"。复核确认属实——上一版加的反向包含检查(历史 `query` 整个作为子串出现在新任务描述里)没有设最短长度门槛。一条很短、很通用的历史 `query`(比如"核实"这两个字)几乎必然是任何任务描述的子串——"核实"/"情况"/"是否"这类通用词在业务任务描述里到处都是，会把完全不相关主题的历史情报错误合并进来，污染六部派单的判断依据。

修复：新增共享常量 `_MIN_MATCH_LEN = 4`，同时应用到两处：
1. `_candidate_keywords()` 的标点切分候选过滤，从 `len(p) >= 2` 提高到 `len(p) >= _MIN_MATCH_LEN`。
2. 反向包含检查新增 `len(row["query"]) >= _MIN_MATCH_LEN` 门槛，只有历史 `query` 本身足够长(4 字中文短语通常已经带具体主题，跟 2 字通用词有质的区别)才纳入反向匹配。

新增测试 `test_merge_known_evidence_ignores_generic_short_historical_query`：第一次任务描述本身就是通用短词"核实"，第二次是完全不相关但恰好包含"核实"两字的任务描述，验证不会发生误合并。用负对照验证：临时去掉长度门槛重跑这条新测试，确认失败(误合并了不相关的历史结论)，恢复后确认转绿。

验证：`python3 -m pytest -q tests/test_real_department_engines.py tests/test_jinyiwei_evidence_store.py tests/test_jinyiwei_endpoint.py` 66 passed；全量 `pytest` 2415 passed，同一组 8 个既有无关失败；三层 `harness:doctor` 全绿。
