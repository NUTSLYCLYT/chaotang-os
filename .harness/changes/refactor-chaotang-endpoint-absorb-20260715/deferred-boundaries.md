# P3 延期与冻结边界

## DEFERRED_REQUIRES_USER_DECISION — throne legacy read

- 边界：`backend/web/routers/throne.py` 是冻结王座礼仪边界，P3 不修改。
- 证据（P3a 开始时）：该文件模块级导入旧存储，并在 `_build_memorial_list()` 中调用
  legacy memorial status 读取；`rg -n "chaotang_store|get_memorial_status|_build_memorial_list" backend/web/routers/throne.py` 可复核。
- 影响：P3a 只让 `scribe.py` 脱离该投影；王座自身的旧读仍存在，不得把 P3a 宣称为
  全仓 legacy read 清零。
- 解除条件：用户明确裁决允许修改王座，且另立带礼仪/浏览器体验证据的变更；后端 dry-run
  不足以证明王座体验。
- 当前动作：只登记，不改文件、不加 adapter、不顺便清理。

## P3d 物理拆除门

- 默认需要 P2 canonical 事件计数上升且旧端点在观测窗口归零。
- 若证据不足，只允许 feature flag 关闭，不物理删除 daemon/runstate。
- 是否压缩默认建议的三个真实使用日窗口，需要用户书面确认。
- 2026-07-15 P3d 审计结果：P2 只记录单次独立进程快照，canonical 三阶段均为
  `0.0`，没有旧链连续窗口归零数据；门不满足。
- 当前处置：`FENGQUN_LEGACY_CHAOTANG_DAEMON` 默认关闭；decree 转 canonical outbox；
  study live async 明确拒绝。P3e 后回滚需 daemon flag=1 且 tripwire=0；旧函数和
  `_RUNSTATE_TO_TASKSTATUS` 不删除。
- 后续物理删除条件：补齐真实观测窗口并证明 canonical 计数上升、对应 legacy 调用归零；
  或用户书面确认压缩窗口后重新审查。

## P3b→P3d 临时兼容桥

- 活动 queue：canonical row 尚不存在，或 canonical task 尚未到终态且仍由旧 daemon
  生产临时细粒度事件时，stream 保留 queue 输送；canonical 终态重放绝不触碰 queue。
  P3d 因物理拆除门未满足而保留，但 daemon 默认关闭；仅紧急回滚期间可生产旧事件。
- view-only result：P3e 已删除。即使旧 `Task.result_json` 存在且没有 `SwarmRun`，
  taskDetail 也只返回 canonical `DecisionTask` 状态与空 result。
- 安全边界：canonical owner 不匹配或 canonical DB 不可用时不得进入兼容桥。

## P3e 只读遗留边界

- 冻结王座与未迁移历史 GET 仍可读取 legacy memorial/review/retrospective；P3e 不宣称
  全仓 legacy read 清零。
- `chaotang_orchestrator.py`、`chaotang_store.py` 与 backfill 脚本的旧写函数物理保留，
  但其 production writer ID 已全部从 runtime allowlist 移除，默认调用会 fail closed。
- 测试专用 `pytest-flow-store` / `pytest-chaotang-store` 仅在
  `FENGQUN_TEST_DB_GUARD=1` 下授权，用于覆盖旧数据结构行为，不构成生产白名单。

## P3-F1 canonical 约束边界

- 已支持：可映射到 canonical swarm 的 ministers/groups，被展开为明确部门覆盖并落入
  task draft、route decision 与 worker `department_ids`。
- 默认且等价：`stakes=low`、`mode` 未指定或 `live`。
- 显式拒绝：任一逐请求 budget 字段、非 low stakes、scripted/hybrid mode、未知 group，
  或包含史官/钦天监等尚无 canonical department swarm 的 minister/group。
- 解除拒绝条件：先给 canonical worker 增加可审计、可测试的逐请求预算/风险执行策略或
  对应部门 swarm，再把该字段从 `canonical_constraints_unsupported` 移除；不得仅回显字段。

## 独立预审继承项

- P3-Q1：direct 路由入队即记 `direct_completed`，继承 canonical 上书房现行语义与
  census ING-04 的 ADR 缺口；P3 不另改终态模型。
- P3-Q2：`compat_court_dispatch` 是 DEC-01“确认下旨与最终圣裁共用
  `EmperorDecision`”的新增构造点，继续归入 FCV1-009 的奏折/裁决收口范围；P3 不扩表。
