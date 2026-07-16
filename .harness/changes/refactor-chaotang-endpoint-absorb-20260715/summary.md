# 变更摘要：refactor-chaotang-endpoint-absorb-20260715

| 字段 | 值 |
| --- | --- |
| Change ID | refactor-chaotang-endpoint-absorb-20260715 |
| 类型 | refactor |
| 状态 | VERIFIED_COMPLETE（已本地合入 ext；P3d 物理删除按证据门延期） |
| Owner | Project Agent |
| 创建日期 | 20260715 |

## 范围

- 主线：P3 chaotang legacy 链逐端点吸收；同一 change、同一任务分支，严格按 P3a→P3e。
- 当前检查点：P3a 原实现 `c21127e` 被 stop-gate BLOCK；repair 已新增 append-only
  `ArchiveOutcomeEvent`、默认 dry-run 幂等 backfill，并让史官只投影真实 terminal outcome。
  奏折 summary 不再冒充 lesson，DB 故障显式 503，拒绝/无 archive 结果保留红灯且未签署。
- P3b 已把 `taskDetail` 与终态 `/api/chaotang/stream/*` 切到
  `DecisionTask` / `SwarmRun` / `DecreeExecutionEvent` 投影，前端用同形 adapter
  消费 canonical SSE；活动旧任务 queue 桥留至 P3d，view-only result 桥留至 P3e。
- P3c 已把 `direct.py` 的 `mode=court` 从 `chaotang_orchestrator` daemon 派发切到
  canonical 路由决定、会审壳、时间线与事务 outbox；响应保留原五字段形状。
  `manor.py` 自导入以来没有生产派发路径，本步只记录事实，不制造空改动。
- P3d 因 P2 没有满足连续观测窗口的拆除证据，没有物理删 daemon/runstate；新增默认
  关闭、显式可回滚的 `FENGQUN_LEGACY_CHAOTANG_DAEMON`。`decree/dispatch` 默认走
  canonical outbox；study live async 在旧 daemon 关闭时明确拒绝，不伪装已启动。
- P3e 已把 runtime production writer allowlist 清零，仅保留 pytest writer；task persist
  与 retrospective 旧写端点显式只读，task detail 不再回退 `Task.result_json`，memorial
  review 不再双写 legacy review 表/JSON，详情改读 formal decision 投影。
- 独立预审 `e595818` 发现 P3-F1 HIGH：canonical decree 静默丢预算、风险和派单约束。
  当前已改为“可等价的部门约束真实落 route/worker；不可等价的硬约束落库前拒绝”。
- 同次预审的 P3-Q1 `direct_completed` 语义与 P3-Q2 `EmperorDecision` 构造点已登记为
  ING-04 / DEC-01（FCV1-009）继承项，不在 P3 扩张修复范围。
- 独立增量复审已核验 `5a4c712`、重跑 gate/dispatch 12 tests 并给出
  `PACKET_REVIEW_GO`；审查证据随 `c94d4e3` 落入本分支。
- 2026-07-16 已通过 merge `71ff159` 本地合入 `feature-chaotang-ext`；合并后 backend
  2635 passed / 27 skipped / 7 known-red，frontend adapter 3 passed，三层 doctor 0/0。
- 当前文件：P3a–P3e 后端投影/dispatch adapter/路由、P3b 前端 adapter、相邻测试及
  本 change 证据。
- 验证：P3a repair RED 5 failed，GREEN 16 passed；P0-B/相邻最终 91 passed；最终后端
  全量 2632 passed / 27 skipped / 7 known-red，三层 doctor 0/0。P3b RED 证明旧
  registry/RunLog 与缺失 adapter，GREEN 为后端 focused 25、扩展契约 76、前端 3，
  三层 doctor 均 0 errors / 0 warnings。
- P3c RED 为 2 failed / 2 passed，证明 direct court 仍进入旧 orchestrator；GREEN
  为 focused 5 passed，核心安全/worker/终态相邻集 40 passed。
- P3d RED 为 2 failed，证明两条 daemon 默认仍可达；实现后聚焦/相邻 42 passed、
  P0-B/ownership 20 passed。
- P3e RED 为 10 failed / 44 passed；GREEN focused 54、精确 API/P0-B 65、frontend
  adapter 3。P3-F1 RED 3 failed；修正后相关 80、P3 联合 179。P3a repair 与 P3-F1
  回灌后的组合分支最终全量 2635 passed / 27 skipped / 7 known-red，无新增失败。
- 冻结边界：`backend/web/routers/throne.py` 未修改，其旧读依赖登记为
  `DEFERRED_REQUIRES_USER_DECISION`。
- 延期项：P3d 物理删除须等待连续观测窗口；该证据门不阻塞本次 flag-only 检查点完成。
