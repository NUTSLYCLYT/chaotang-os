# 变更摘要：refactor-chaotang-endpoint-absorb-20260715

| 字段 | 值 |
| --- | --- |
| Change ID | refactor-chaotang-endpoint-absorb-20260715 |
| 类型 | refactor |
| 状态 | VERIFIED_PARTIAL（P3a–P3d 完成，P3d 为 flag-only；P3e 待执行） |
| Owner | Project Agent |
| 创建日期 | 20260715 |

## 范围

- 主线：P3 chaotang legacy 链逐端点吸收；同一 change、同一任务分支，严格按 P3a→P3e。
- 当前检查点：P3a 已把史官 `lessons` / `archive-docs` 从 legacy 双读切到
  `ShiguanArchive` + 可选 `FinalMemorial` canonical 投影；返回信封与 CourtDoc 形状不变。
- P3b 已把 `taskDetail` 与终态 `/api/chaotang/stream/*` 切到
  `DecisionTask` / `SwarmRun` / `DecreeExecutionEvent` 投影，前端用同形 adapter
  消费 canonical SSE；活动旧任务 queue 桥留至 P3d，view-only result 桥留至 P3e。
- P3c 已把 `direct.py` 的 `mode=court` 从 `chaotang_orchestrator` daemon 派发切到
  canonical 路由决定、会审壳、时间线与事务 outbox；响应保留原五字段形状。
  `manor.py` 自导入以来没有生产派发路径，本步只记录事实，不制造空改动。
- P3d 因 P2 没有满足连续观测窗口的拆除证据，没有物理删 daemon/runstate；新增默认
  关闭、显式可回滚的 `FENGQUN_LEGACY_CHAOTANG_DAEMON`。`decree/dispatch` 默认走
  canonical outbox；study live async 在旧 daemon 关闭时明确拒绝，不伪装已启动。
- 当前文件：P3a–P3d 后端投影/dispatch adapter/路由、P3b 前端 adapter、相邻测试及
  本 change 证据。
- 验证：P3a RED 见 6 failed / 5 passed，实现后 22 passed；P3b RED 证明旧
  registry/RunLog 与缺失 adapter，GREEN 为后端 focused 25、扩展契约 76、前端 3，
  三层 doctor 均 0 errors / 0 warnings。
- P3c RED 为 2 failed / 2 passed，证明 direct court 仍进入旧 orchestrator；GREEN
  为 focused 5 passed，核心安全/worker/终态相邻集 40 passed。
- P3d RED 为 2 failed，证明两条 daemon 默认仍可达；实现后聚焦/相邻 42 passed、
  P0-B/ownership 20 passed。
- 冻结边界：`backend/web/routers/throne.py` 未修改，其旧读依赖登记为
  `DEFERRED_REQUIRES_USER_DECISION`。
- 未完成：P3e 白名单清零；P3d 物理删除延期至满足观测窗口。P3e 前不得输出顶层
  Packet 停审 token。
