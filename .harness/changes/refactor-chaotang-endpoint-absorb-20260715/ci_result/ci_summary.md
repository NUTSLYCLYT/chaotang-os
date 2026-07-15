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
| P3e RED：tripwire/task/review/retrospective focused | 1 | 10 failed / 44 passed（预期 RED） | production writer 尚在白名单；旧端点仍写；detail 仍回退旧 result | 2026-07-15 本地终端 |
| P3e focused GREEN | 0 | 54 passed | 白名单精确清零、端点只读、canonical review/detail | 2026-07-15 本地终端 |
| P3a–P3e backend 联合集 | 0 | 131 passed | 五检查点核心与 P0-B/rollback 相邻回归 | 2026-07-15 本地终端 |
| backend 全量（P3e clean snapshot） | 1（基线） | 2625 passed / 26 skipped / 7 known failed | 全仓回归与基线对账 | 2026-07-15 本地终端 |
| P3e API exact / P0-B / tripwire / architecture | 0 | 65 passed | 前端已用路由契约、所有权、写入阻断、AST gate | 2026-07-15 本地终端 |
| P3e frontend canonical stream adapter | 0 | 3 passed | canonical/legacy rollback 事件同形消费 | 2026-07-15 本地终端 |
| 根 / backend / frontend harness doctor（P3e） | 0 | 三层均 0 errors / 0 warnings | P3e 根变更与三层结构 | 2026-07-15 本地终端 |
| P3a repair RED：`pytest -q tests/test_scribe_canonical_outcome_red.py` | 1 | 5 failed | summary 冒充 lesson、DB 故障伪空、缺 outcome/backfill、拒绝案错误 | 2026-07-15 本地终端 |
| P3a repair focused | 0 | 16 passed | 历史保真/幂等、no-archive reject、correction supersedes、503 | 2026-07-15 本地终端 |
| P3a repair P0-B + adjacent | 0 | 72 passed；扩展 91 passed / 1 base-env skip | 无新增 DecisionTask 裸查面；史馆/正式奏折/golden 相邻 | 2026-07-15 本地终端 |
| P3a 011 真实迁移 | 0 | 2 passed | `/tmp` system-site venv 补 Alembic；真实 SQLite 010→011 upgrade/downgrade、约束/索引 | 2026-07-15 本地终端 |
| P3a repair 最终 backend 全量 | 1（基线） | 2632 passed / 27 skipped / 7 known failed | 最终代码全仓回归；失败集合与登记基线一致 | 2026-07-15 本地终端 |
| P3a repair compile/diff/三层 doctor | 0 | compile/diff PASS；三层 0 errors / 0 warnings | 语法、提交边界与项目结构 | 2026-07-15 本地终端 |
| 独立预审 P3-F1 | N/A | HIGH：默认 canonical decree 静默丢 budget/departments/groups/stakes/intent | `e595818` 外部独立预审记录 | 2026-07-15 |
| P3-F1 RED | 1 | 3 failed / 2 passed（预期 RED） | 部门约束未落账；预算/high stakes/不支持 group 仍假成功 | 2026-07-15 clean worktree |
| P3-F1 related GREEN | 0 | 80 passed | constraints、routing/golden、outbox、P0-B、API exact | 2026-07-15 clean worktree |
| P3-F1 后 P3 联合集 | 0 | 179 passed | P3a–P3e + chancellor/outbox/constraints | 2026-07-15 clean worktree |
| backend 全量（P3-F1 clean snapshot） | 1（基线） | 2628 passed / 26 skipped / 7 known failed | 无新增失败；尚未包含随后落入任务分支的 P3a repair | 2026-07-15 clean worktree |

## 结果

P3a stop-gate repair、P3b–P3e 聚焦、相邻、API 契约与前端 adapter 全绿；P3d 按证据门
只完成 flag-only，未物理删除。P3a repair 与 P3-F1 各自的全量快照均无新增失败，
组合分支将在回灌后再次全量对账；整包等待 P3-F1 独立复核。

## 未验证项

- frontend 全量 type/build 仍受下述 worktree 依赖环境限制；目标 adapter 与全仓 API exact
  audit 已通过。backend 全量已执行并完成 known-red 对账。
- P3 worktree 未安装独立 `frontend/node_modules`，从主工作树借用 `tsc` 可执行文件时模块
  解析仍以 P3 worktree 为根，因缺 `react` / `next` / Node typings 等依赖产生环境性失败；
  本检查点以可实际解析目标文件的 `tsx --test` 3 项通过为准，全量前端检查留到 P3e
  的已安装依赖环境，不把本次无效 `tsc` 结果登记为产品 known-red。
- 项目基础解释器未安装 `ruff` / `black` / `alembic`；全量中的迁移测试因此 skip 1。
  已在 `/tmp` 临时 system-site venv 补 Alembic，真实执行 010→011 upgrade/downgrade 2 passed；
  另以 `py_compile`、模型 create_all 与 `diff --check` 复核。

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
| canonical 单读源 | append-only outcome projection tests + structural grep | PASS |
| 正常/失败/权限 | focused pytest | PASS |
| 冻结王座不修改 | changed-files + deferred record | PASS |
| P3b task/stream canonical 投影 | backend 25 focused + 76 expanded；frontend 3 passed | PASS |
| P3c direct court canonical outbox | RED→GREEN + focused 5 + adjacent 40 + expanded 135 | PASS |
| P3d daemon default-off / canonical decree | evidence audit + RED→GREEN + 42 + 20 + joint 196 | PASS_FLAG_ONLY |
| P3d 物理删除 | 缺真实观测窗口 | DEFERRED_BY_GATE |
| P3e writer whitelist zero / legacy production read-only | RED→GREEN + 54 + 131 + 65 | PASS |
| 后端全量快照 | P3a repair 2632/27/7；P3-F1 clean 2628/26/7 | PASS_WITH_BASELINE |
| 组合分支后端全量 | 回灌后复验 | PENDING |
| P3-F1 canonical constraints | RED 3 + related 80 + P3 joint 179 | PASS_PENDING_REREVIEW |
| 整个 P3 完成 | P3-F1 独立复核 | PENDING_REREVIEW |

## 声明状态

- `DRAFT / VERIFIED_PARTIAL / VERIFIED_COMPLETE / BLOCKED`：VERIFIED_PARTIAL（仅待审查）
