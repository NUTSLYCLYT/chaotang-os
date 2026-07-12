# 需求说明：feat-jinyiwei-evidence-pool-department-passthrough-20260712

## 背景

阶段1建好了持久情报池(`JinyiweiEvidence` 表 + `upsert_evidence`/`query_evidence`)，但只有 `/api/intel/brief` 一个入口读写它。六部真实派单(`real_department_engines.py::adapt_jinyiwei`，被 `swarm_execution_loop.py::_run_departments_cross_referenced` 调用)仍然每次都从零检索，看不到其他任务已经核实过的情报。

## 范围

- `adapt_jinyiwei()` 读写穿透持久池：检索前合并已核实历史情报，检索/分级后写回新条目。

## 非目标

- 不改 `_run_departments_cross_referenced` 喂给其余部门的文本拼接方式。
- 不做 `dept_affinity` 真实分类(留空，因为当前调用点没有"谁在问"的上下文)。
- 不改前端。

## 验收标准

- 两次主题重叠的 `adapt_jinyiwei` 调用，第二次能读到第一次写回的历史情报（合并进检索结果，仍会重新过 vet 门）。
- 不产生重复的 `claim_key` 行。
- 既有的两个 mock 掉 `gather_intel` 的测试无需修改继续通过，且不触发真实网络请求。
- 全量 `pytest` 无新增失败；三层 `harness:doctor` 全绿。

## 风险

- `adapt_jinyiwei` 检索前先自己直接调 `tavily_search()`(而不是通过 `gather_intel` 内部的 `search_fn` 调用点)会破坏既有测试对"`gather_intel` 被 mock 时 `tavily_search` 不应该被真实调用"这一隐含惰性契约的依赖——测试环境里 `TAVILY_API_KEY` 是从 `.env` 加载的真实有效值，一旦意外触发就是真实网络请求。改用闭包保持惰性，只有 `gather_intel` 内部真的调用 `search_fn` 时才检索/查历史。

## 验证计划

`python3 -m pytest -q tests/test_real_department_engines.py`(以及相邻 jinyiwei/swarm 测试)、全量 `python3 -m pytest -q`、`python3 scripts/harness_doctor.py`、`node scripts/harness-doctor.mjs`(根级)。
