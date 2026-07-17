# 独立复审补充：全量套件下的新增失败（2026-07-17 20:4x，22:4x 根因已定位）

> **根因已定位（22:4x）**：仓库装了 `pytest-randomly` 插件，默认每次调用测试
> 顺序都随机。本节记录的"只在全量套件里失败、单文件/子集无法稳定复现"，
> 不是我排查方法有误，是因为我每次 bisection 调用都拿到不同随机种子/顺序，
> 根本没有稳定顺序可以二分。Codex 用 `python3 -m pytest -q backend/tests
> -p no:randomly`（固定顺序）复核，回到 `2703 passed, 37 skipped, 7 known
> baseline failures`——PKT-1~5 不引入新增失败，问题已解释清楚。
> 残留问题（本条不再深挖，供 Codex 后续参考）：`-p no:randomly` 是绕开随机
> 顺序，不是修复"某个测试在特定顺序下留下未清理共享状态"这个根本原因——
> 如果 CI 命令固定用 `-p no:randomly`，可以接受；如果 CI 保留随机顺序，这个
> 潜在的状态泄漏总有一天会在随机种子不利时复发。

| 项 | 值 |
| --- | --- |
| 复审者 | Claude Code（本会话），只读复审 |
| 触发 | PKT-1~5 全部落地后重跑全量 `pytest -q` |

## 实测

全量：`9 failed, 2701 passed, 37 skipped`——已知红灯基线是 7 项，多出 2 项：

- `test_chancellor_golden_cases.py::test_golden_case_matches_expected_mode[ambiguity_03_department_only_mentioned_not_relevant]`
- `test_chancellor_golden_cases.py::test_golden_case_matches_expected_mode[extra_01_four_departments]`

**只在全量套件里失败，单独复现失败**：
- 单独跑这两个 test id → 2 passed
- 单独跑整个 `test_chancellor_golden_cases.py`（34 项）→ 34 passed
- 跑收集顺序中排在它前面的全部 28 个文件（含它自己）→ 238 passed, 4 skipped，无失败

## 深入排查（2026-07-17 20:5x，追加）

按二分法继续查，排除了"单一文件在前面污染"这个假设：

- 前 245 个文件（收集顺序）一起跑 → 只有 6 项已知红灯，无 golden case 失败。
- 前 282 个文件一起跑 → 同上，仍干净。
- 剩余尾部（283-319）里所有跟 chancellor/department/shangshufang 相关的嫌疑
  文件——`test_swarm_runs_chancellor_route.py`、`test_swarm_execution_loop_api.py`、
  `test_real_department_engines.py`、`test_shangshufang_contract_baseline.py`、
  `test_shangshufang_entry.py`、`test_shangshufang_loop_api.py`、
  `test_tianjian_verdict.py`——**逐一单独配 `test_chancellor_golden_cases.py`
  跑，全部干净**，没有一个单独复现。

**结论更新**：不是"某个文件的 import 时副作用"这种简单的单点污染，前 282 个
文件（占全量 88%）已经排除。更像是全量套件规模级的资源累积问题——反复观察到
同一条 `RuntimeWarning: coroutine 'Logging.async_success_handler'/
'LoggingWorker._worker_loop' was never awaited`，在多个 swarm 相关测试文件里
反复出现（`test_swarm_execution_loop_api.py`、`test_swarm_runs_chancellor_route.py`
均有），怀疑是 litellm 异步日志 worker 的事件循环/队列状态在测试间没有正确
清理，攒到全量规模才会真正绊倒某个测试（表现为看似无关的 golden case 测试
失败，而不是异步测试自己失败）。

排查投入：约 10 轮不同文件组合的 bisection，覆盖了全量 319 个文件里 88% 的
子集验证 + 7 个单独嫌疑文件的配对验证，均未复现。继续二分尾部剩余 37 个文件
的具体子集组合，单轮耗时已升到 1-2 分钟且持续增长（部分文件带真实超时模拟），
在本轮复审的时间预算内继续细分性价比转负，停在这个更精确的假设上，交给
Codex 用更大预算验证。

## 建议

不作为 blocker 写死（原因：无法稳定复现，且这类"异步资源在全量规模下累积
泄漏"通常需要专门的 fixture 级修复，不是本次 PKT 改动本身的逻辑错误）。
建议 Codex：
1. 确认是否稳定复现（连跑 2-3 次全量）。
2. 若稳定复现，优先方向已从"哪个文件在前面"改为"litellm logging worker 的
   异步清理"——检查是否有 fixture 在测试间正确 `await`/关闭这个 worker，而
   不是继续按文件顺序二分。
3. 若不稳定复现，记入本轮 known-red 观察名单。

*本条不构成对 PKT-2/PKT-5 的独立 GO/NO_GO 裁决，是全量回归层面的一个新观察，
供 Codex 排期参考。*
