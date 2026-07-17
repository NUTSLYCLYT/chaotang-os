# CI 摘要：docs-absorption-closeout-20260717

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 |
| --- | ---: | --- | --- |
| `pytest -q ...::test_check_doc_duplicates_flags_overlapping_new_topic`（修复前） | 1 | 1 failed，`warnings == []` | 陈旧真实文档 fixture RED |
| `pytest -q tests/test_commit_closeout_check.py` | 0 | 9 passed | 查重重叠、tracked/non-doc 与 closeout 分类 |
| backend P7 四文件定向集 | 0 | 35 passed | closeout、legacy writer、department SSOT、P4 distillation |
| frontend architecture + dept SSOT/parity | 0 | 21 passed | production import 0、backend1+frontend1 事实源 |
| `python3 -m pytest -q` | 1 | 2691 passed / 37 skipped / 6 failed | 后端全量；6 项与 ledger 剩余项精确同名 |
| `pnpm run test:node` | 0 | 1041 passed / 0 failed | 前端全量；P6 七红核销复验 |
| `pnpm exec tsc --noEmit` | 0 | PASS | 前端类型 |
| `/home/ubuntu/.local/bin/ruff check tests/test_commit_closeout_check.py` | 0 | PASS | P7 Python 静态检查 |
| `python3 -m compileall -q ...` | 0 | PASS | checker/test 编译 |
| root/backend/frontend doctor | 0 | 0 errors / 0 warnings × 3 | 三层护栏 |
| `python3 scripts/commit_closeout_check.py` | 0 | 0 staged risk / 0 dirty risk；4 个范围内 candidate | 提交边界 |
| P0 LOC 固定命令 | 0 | `240856 total` | P0 `238894` 对比，net `+1962` |
| `git diff --check` | 0 | 无输出 | whitespace |

首次误用 `pnpm test` 时 package 无该 script，命令退出 1 且无测试输出；随后读取
`package.json`，按本仓权威脚本改跑 `pnpm run test:node` 并得到 1041/1041。该次命令纠正
不是产品测试失败。

后端全量测试产生一个 untracked IMA 测试文档；已核对内容为测试 fixture 副产物并删除，
最终 status 不含该文件。

## 后端剩余 6 项

- `tests/test_lawyer_rag.py`：4 项，真实法条资源不可用/未命中。
- `tests/test_persona_registry.py::test_real_roster_splits_into_two_benches`：Munger roster 1 项。
- `tests/test_tianjian_verdict.py::test_forecast_endpoint_end_to_end`：6 vs 9 契约 1 项。

`test_commit_closeout_check.py` 已不在失败集合。三类剩余项均有唯一后续 change owner，P7
未修改它们。

## 浏览器冒烟

`NOT_RUN_PORT_OWNERSHIP_BLOCKED`。P7 不修改 UI/route/runtime；前端 tree 与已审 P6 相同。
项目允许的 3002、3050 均由其他长期工作树的 Next 服务占用（PID 2299468 / 2207），未获
授权停止、替换或把其他工作树页面冒充本候选证据。替代证据为 frontend full 1041/1041、
TypeScript、architecture guard 与三层 doctor。

这项未验证残留不会被隐藏：它继续阻止 campaign DONE。P4 的历史 fixture-driven smoke
只证明当时 frontend 投影契约，未被复用为本 SHA 的运行证据。

## 结果

P7 指定 known-red 已修复，KPI/状态/deferred 对账完成；P7 包本身可进入独立 Claude
review。campaign 仍为 `PARTIAL`：LOC、连续流量、物理定义清零、P8/P9 与后端 6 红未闭环。

## 未验证项

- canonical 上升 / legacy 连续归零生产观测窗口：缺失。
- P7 精确 SHA browser smoke：端口所有权阻塞，未运行。
- P8：未开工；P9：无顶层 Packet GO/残段核销。
- backend 6 个范围外 known-red；frontend lint script 仍待用户裁决。
- production DB/service：P7 未连接、未修改；不以测试替代生产流量。

## Diff 与回滚复核

- changed files：P7 root change、campaign mainline/known-red、commit-closeout test fixture。
- diff review：无生产实现、schema、API、lockfile 或 runtime 数据变更；KPI 未改口径。
- 回滚是否演练：测试 fixture 可单文件 revert；docs 为追加/状态回填，不执行数据回滚。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| closeout known-red RED→GREEN | 1 failed → 9 passed；backend full 不再含该项 | PASS |
| P0 KPI 原口径复算 | `kpi-reconciliation.md` | PASS_EVIDENCE；目标部分未达 |
| mainline / known-red / deferred 一致 | 三份状态表交叉引用 | PASS |
| related/full/doctor | 35 backend、21 frontend、1041 frontend、backend 2691/37/6、0/0 doctors | VERIFIED_PARTIAL |
| campaign DONE 硬门 | LOC/traffic/P8/P9/smoke/6 red | NOT_MET |
| 独立 review / D6 / push | 待执行 | PENDING |

## 声明状态

- `VERIFIED_PARTIAL / READY_FOR_CLAUDE_REVIEW`
