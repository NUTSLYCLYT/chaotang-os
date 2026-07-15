# 任务：refactor-chaotang-endpoint-absorb-20260715

## 任务 1 — P3a scribe canonical outcome repair

- 目标：移除史官对旧复盘存储与冻结王座投影的双读，并修复首次实现把奏折摘要
  冒充事后教训、DB 故障伪装空态、拒绝案消失的问题。
- 前置条件：P2 tripwire/观测守门已合入 ext；王座保持冻结。
- 输入：append-only `ArchiveOutcomeEvent` + 可选 `ShiguanArchive` / `FinalMemorial` 标题快照。
- 输出：既有 lessons / CourtDoc 响应形状。
- 涉及文件：outcome model/service/migration/dry-run backfill、`scribe.py`、scribe/flywheel
  相邻测试、本 change 证据。
- 状态 / 数据变化：新增 `archive_outcome_events` append-only 表；旧 `Retrospective`
  仅通过显式、幂等、默认 dry-run 的离线程序追加，绝不原地改写账本。
- 验证命令与证据：`ci_result/ci_summary.md`；聚焦 16、P0-B/相邻 91、最终全量
  2632 passed / 27 skipped / 7 known-red；三层 doctor 全绿。
- 回滚边界：P3a repair 原子 commit；已有 outcome event 后不得直接 downgrade 丢账，
  应先停写/回退读投影并保留表。
- 完成定义：结构依赖清零；正常/失败/权限/租户/去重/来源测试通过。
- 状态：REPAIRED_PENDING_INDEPENDENT_REVIEW；原提交 `c21127e` 已被 stop-gate BLOCK。

## 任务 2 — P3b taskDetail / stream

- 目标：用 canonical task/run/event 投影替代 taskDetail 旧内存/RunLog 读链，并让
  `/api/chaotang/stream/*` 可重启后重放终态事件。
- 输出：既有 task detail shape；`canonical.event` + `canonical.snapshot` SSE；前端
  same-shape BattleStream adapter。
- 状态 / 数据变化：只读投影；无 schema/迁移/新 writer。P3d/P3e 前保留两项显式桥。
- 验证：P3b focused 25 passed；后端扩展契约 76 passed；前端 adapter 3 passed；
  三层 doctor 均为 0 errors / 0 warnings，详见 CI summary。
- 回滚边界：P3b 独立原子 commit，不影响 P3a。
- 状态：VERIFIED，随本 P3b 检查点原子提交。

## 任务 3 — P3c manor / direct dispatch

- 目标：将实际存在的 `direct.py mode=court` 旧 orchestrator 派发改为 canonical
  routing + transaction outbox，同时保持兼容响应五字段；核实 manor 是否有写链。
- 输出：`canonical_court_dispatch` 等形适配器；direct/council 两种 outbox 事件；
  canonical terminal direct 状态；P0-B 显式边界证据。
- 状态 / 数据变化：写入既有 canonical 表，无 schema/迁移；`manor.py` 无生产派发，
  不修改、不裁决去留。
- 验证：RED 2 failed / 2 passed；focused 5 passed；核心安全/worker/终态相邻 40 passed；
  完整扩展结果见 CI summary。
- 回滚边界：P3c 独立原子 commit，不影响 P3a/P3b。
- 状态：VERIFIED，随本 P3c 检查点原子提交。

## 任务 4 — P3d daemon / runstate

- 目标：审计 P2 计数证据；满足门才物理删除，否则只默认关闭旧 daemon 并保留回滚。
- 证据结论：P2 canonical 三阶段单次快照均为 0.0，且无旧链连续窗口归零；不满足门。
- 输出：`FENGQUN_LEGACY_CHAOTANG_DAEMON` 默认 off；decree 默认 canonical outbox；
  study live async flag-off 明确失败；flag=1 保留旧链。
- 状态 / 数据变化：无 schema/迁移；默认不写 legacy Decree/Task，不注册旧 queue；
  `_spawn_run`、study daemon、`_RUNSTATE_TO_TASKSTATUS` 物理保留。
- 验证：RED 2 failed；focused/affected 42 passed；P0-B/ownership 20 passed；更广结果见 CI。
- 回滚边界：设 flag=1 恢复两条旧 daemon；仍受 P2 tripwire 与 telemetry 约束。
- 状态：VERIFIED_FLAG_ONLY，随本 P3d 检查点原子提交。

## 任务 5 — P3e whitelist zero

- 目标：清空 production legacy writer allowlist；把已吸收写端点改成显式只读，并删除
  task detail 的 `Task.result_json` fallback 与 memorial review legacy 双写。
- 输出：allowlist 仅保留 pytest writer；persist/retrospective 稳定只读错误；批阅结果从
  formal decision 投影；旧 daemon 仅在 daemon=1 + tripwire=0 双开关下紧急回滚。
- 状态 / 数据变化：无 schema/迁移；production legacy 表只读，历史 GET 保留。
- 验证：RED 10 failed / 44 passed；focused 54 passed；P3 联合集 131 passed；精确 API /
  P0-B / tripwire 65 passed；frontend adapter 3 passed；全量后端 2625 passed、26 skipped，
  另 7 条与登记基线完全一致；三层 doctor 0 errors / 0 warnings。
- 回滚边界：紧急旧链需同时设 `FENGQUN_LEGACY_CHAOTANG_DAEMON=1` 和
  `FENGQUN_LEGACY_WRITE_TRIPWIRE=0`，并按 P2 程序登记；不得重新加生产 allowlist。
- 独立预审：`e595818` 记录 P3-F1 HIGH，指出默认 canonical dispatch 静默丢约束。
- P3-F1 修复：可映射 ministers/groups 真实驱动 route/worker；budget/high stakes/不支持
  group 在落库前明确拒绝。RED 3 failed；相关扩展 80 passed；P3 联合集 179 passed；
  全量 2628 passed / 26 skipped / 7 known baseline failed。
- 状态：VERIFIED_PENDING_REREVIEW；P3-F1 需独立 reviewer 复核后才宣告 P3 完成。
