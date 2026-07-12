# 任务拆解：feat-jinyiwei-evidence-pool-department-passthrough-20260712

## 任务 1 —— 读写穿透实现

- 目标：`adapt_jinyiwei()` 检索前合并历史情报，检索后写回新条目。
- 输入：阶段1的 `upsert_evidence`/`query_evidence`。
- 输出：`_merge_known_evidence()`/`_persist_department_evidence()`，改造后的 `adapt_jinyiwei()`。
- 验收：保持既有两个 mock 测试通过，不触发真实网络请求。

## 任务 2 —— 惰性契约核实

- 目标：确认改造没有破坏"`gather_intel` 被 mock 时 `tavily_search` 不该被调用"的隐含惯例。
- 输入：`web.main` 导入时加载 `.env` 里真实 `TAVILY_API_KEY` 这一环境事实。
- 输出：用闭包(`_search_and_capture`)延迟检索/查历史到 `gather_intel` 内部真正调用 `search_fn` 时才触发。
- 验收：既有测试运行耗时正常(无真实网络超时痕迹)。

## 任务 3 —— 新增回归测试

- 目标：验证跨调用复用 + 去重。
- 输入：`isolated_session_local` fixture、monkeypatch `tavily_search`。
- 输出：`test_adapt_jinyiwei_reuses_persisted_evidence_without_duplicate_claims`。
- 验收：测试通过。

## 任务 4 —— 回归验证

- 目标：证明没有引入回归。
- 输出：全量 `pytest`、三层 harness doctor 的运行结果。
- 验收：无新增失败；三层 doctor 全绿。
