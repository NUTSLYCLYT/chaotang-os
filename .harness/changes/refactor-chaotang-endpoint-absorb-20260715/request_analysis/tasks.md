# 任务：refactor-chaotang-endpoint-absorb-20260715

## 任务 1 — P3a scribe canonical read

- 目标：移除史官对旧复盘存储与冻结王座投影的双读，改读 canonical 归档。
- 前置条件：P2 tripwire/观测守门已合入 ext；王座保持冻结。
- 输入：`ShiguanArchive` + 可选 `FinalMemorial`。
- 输出：既有 lessons / CourtDoc 响应形状。
- 涉及文件：`backend/web/routers/scribe.py`、scribe/flywheel 相邻测试、本 change 证据。
- 状态 / 数据变化：只读投影；无 schema、写入或迁移。
- 验证命令与证据：`ci_result/ci_summary.md`，22 passed。
- 回滚边界：P3a 原子 commit；恢复 legacy 需走 P2 临时程序。
- 完成定义：结构依赖清零；正常/失败/权限/租户/去重/来源测试通过。
- 状态：VERIFIED，已提交（`c21127e`）。

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
  P0-B / tripwire 65 passed；frontend adapter 3 passed；全量后端 2619 passed、26 skipped，
  另 7 条与登记基线完全一致；三层 doctor 0 errors / 0 warnings。
- 回滚边界：紧急旧链需同时设 `FENGQUN_LEGACY_CHAOTANG_DAEMON=1` 和
  `FENGQUN_LEGACY_WRITE_TRIPWIRE=0`，并按 P2 程序登记；不得重新加生产 allowlist。
- 状态：VERIFIED_PENDING_REVIEW；整包独立审查完成后才宣告 P3 完成。
