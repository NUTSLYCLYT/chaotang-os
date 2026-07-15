# CI 摘要：refactor-chaotang-endpoint-absorb-20260715

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `python3 -m pytest -q tests/test_scribe_lessons.py tests/test_scribe_archive_docs.py tests/test_court_flywheel_button.py`（实现前） | 1 | 6 failed / 5 passed（预期 RED） | 旧实现未读 canonical、仍依赖旧双读 | 2026-07-15 本地终端 |
| `python3 -m pytest -q tests/test_scribe_lessons.py tests/test_scribe_archive_docs.py tests/test_court_flywheel_button.py tests/test_shiguan_page_contract.py tests/test_shiguan_unified_read.py` | 0 | 22 passed | P3a 正常/失败/权限/租户/重复归档、相邻史馆契约 | 2026-07-15 本地终端 |
| `python3 -m py_compile ... && python3 -m pytest -q tests/test_final_memorial_gate.py tests/test_chaotang_memorials.py tests/test_contract_alignment_p0.py tests/test_commercial_loop_harness.py tests/test_legal_redteam_harness.py` | 0 | compile PASS；65 passed | canonical 正式奏折、旧契约、两组 golden harness | 2026-07-15 本地终端 |
| `frontend/node_modules/.bin/tsx --test .../court-doc-adapter.nodetest.ts .../shiguan-view-model.nodetest.ts` | 0 | 3 passed | 前端 CourtDoc adapter 同形消费 | 2026-07-15 本地终端 |
| 根 / backend / frontend harness doctor | 0 | 三层均 0 errors / 0 warnings | 护栏结构与边界 | 2026-07-15 本地终端 |
| P3b backend RED：`python3 -m pytest -q tests/test_chaotang_canonical_task_projection.py` | 1 | 2 failed / 1 passed（预期 RED） | taskDetail/stream 仍读取 registry/RunLog | 2026-07-15 本地终端 |
| P3b frontend RED：`tsx --test .../chaotang-canonical-stream.nodetest.ts` | 1 | module not found（预期 RED） | canonical SSE adapter 尚不存在 | 2026-07-15 本地终端 |
| P3b focused backend suite（canonical projection、tasks、study-live、decree、compat、execution status） | 0 | 25 passed | 正常/失败/权限、终态重放、活动 queue 兼容 | 2026-07-15 本地终端 |
| P3b frontend canonical stream adapter | 0 | 3 passed | canonical→BattleStream 同形映射、失败诚实性、旧事件透传 | 2026-07-15 本地终端 |
| P3b backend 相邻/API 契约扩展集 | 0 | 76 passed | 全前端已用路由精确契约、P0/P0b 权限、canonical 指标与 flow dual-write 相邻回归 | 2026-07-15 本地终端 |
| 根 / backend / frontend harness doctor（P3b） | 0 | 三层均 0 errors / 0 warnings | P3b 跨线变更后的护栏结构与边界 | 2026-07-15 本地终端 |
| P3c RED：`python3 -m pytest -q tests/test_direct_canonical_dispatch.py` | 1 | 2 failed / 2 passed（预期 RED） | direct court 仍进入旧 chaotang_orchestrator；权限/manor 基线已绿 | 2026-07-15 本地终端 |
| P3c focused GREEN | 0 | 5 passed | canonical council/direct outbox、原响应形状、DB failure、认证、manor 无派发 | 2026-07-15 本地终端 |
| P3c 核心安全/worker/终态相邻集 | 0 | 40 passed | direct canonical、P0-B、outbox、event ledger、P3b terminal projection | 2026-07-15 本地终端 |
| P3c backend 扩展集 | 0 | 135 passed | outbox/decree ledger、丞相 routing/golden、swarm direct、P3b、compat/API/P0-B | 2026-07-15 本地终端 |
| 根 / backend / frontend harness doctor（P3c） | 0 | 三层均 0 errors / 0 warnings | P3c 后端写链与根 change 证据更新后的护栏结构 | 2026-07-15 本地终端 |
| P3d evidence audit | N/A | BLOCKED_PHYSICAL_DELETE：canonical 三阶段单次快照均 0.0，无连续旧链归零窗口 | P2 门，只阻塞物理删除 | 2026-07-15 本地文档/源码复核 |
| P3d RED：`pytest -q tests/test_chaotang_daemon_feature_gate.py` | 1 | 2 failed（预期 RED） | decree 仍 assemble/spawn；study async 仍起 daemon | 2026-07-15 本地终端 |
| P3d focused + affected chaotang | 0 | 42 passed | 默认 canonical、study gate、rollback 双写/async、task/stream 相邻 | 2026-07-15 本地终端 |
| P3d P0-B / ownership | 0 | 20 passed | 服务端随机自建 task 显式边界、攻击面派生门 | 2026-07-15 本地终端 |
| P3a–P3d backend 联合扩展集 | 0 | 196 passed | scribe、task/stream、direct/decree outbox、daemon flag、routing/golden、tripwire/P0-B | 2026-07-15 本地终端 |
| P3d frontend canonical stream adapter | 0 | 3 passed | 默认 canonical 终态与 rollback legacy 事件同形消费 | 2026-07-15 本地终端 |
| 根 / backend / frontend harness doctor（P3d） | 0 | 三层均 0 errors / 0 warnings | flag-only 决策与跨线证据更新后的护栏结构 | 2026-07-15 本地终端 |

## 结果

P3a–P3d 聚焦与相邻回归全绿；P3d 按证据门只完成 flag-only，未物理删除。
P3 整包仍为部分验证，P3e 未执行。

## 未验证项

- backend/frontend 全量与全仓 API contract 生成式 audit 留到 P3e 汇总；P3a 已跑接口
  精确/相邻契约、前端 adapter 与代表性 golden harness；P3b 已追加 76 项后端扩展集。
- P3 worktree 未安装独立 `frontend/node_modules`，从主工作树借用 `tsc` 可执行文件时模块
  解析仍以 P3 worktree 为根，因缺 `react` / `next` / Node typings 等依赖产生环境性失败；
  本检查点以可实际解析目标文件的 `tsx --test` 3 项通过为准，全量前端检查留到 P3e
  的已安装依赖环境，不把本次无效 `tsc` 结果登记为产品 known-red。
- 项目环境未安装 `ruff` / `black`；用 `py_compile`、`diff --check` 与现有 pytest 代替，
  此项不构成产品门禁缺失。

## Diff 与回滚复核

- changed files：P3a 已提交；P3b 生产文件为 canonical projection、chaotang 路由与前端
  adapter，另含聚焦/相邻测试和根 change 证据。
- diff review：`git diff --check` 通过；`scribe.py` 旧依赖 grep 为 0；P3b taskDetail
  不再调用 registry / RunLog；changed-files 未含 `throne.py` 或
  `backend/src/db/flow_store.py`。
- 回滚是否演练：未演练；P3a 单 commit 可精确 revert。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| canonical 单读源 | canonical projection tests + structural grep | PASS |
| 正常/失败/权限 | focused pytest | PASS |
| 冻结王座不修改 | changed-files + deferred record | PASS |
| P3b task/stream canonical 投影 | backend 25 focused + 76 expanded；frontend 3 passed | PASS |
| P3c direct court canonical outbox | RED→GREEN + focused 5 + adjacent 40 + expanded 135 | PASS |
| P3d daemon default-off / canonical decree | evidence audit + RED→GREEN + 42 + 20 + joint 196 | PASS_FLAG_ONLY |
| P3d 物理删除 | 缺真实观测窗口 | DEFERRED_BY_GATE |
| 整个 P3 完成 | P3e | PENDING |

## 声明状态

- `DRAFT / VERIFIED_PARTIAL / VERIFIED_COMPLETE / BLOCKED`：VERIFIED_PARTIAL
