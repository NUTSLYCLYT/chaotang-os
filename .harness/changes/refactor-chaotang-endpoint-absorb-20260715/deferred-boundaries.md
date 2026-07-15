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
  study live async 明确拒绝；flag=1 可回滚。旧函数和 `_RUNSTATE_TO_TASKSTATUS` 不删除。
- 后续物理删除条件：补齐真实观测窗口并证明 canonical 计数上升、对应 legacy 调用归零；
  或用户书面确认压缩窗口后重新审查。

## P3b→P3d/P3e 临时兼容桥

- 活动 queue：canonical row 尚不存在，或 canonical task 尚未到终态且仍由旧 daemon
  生产临时细粒度事件时，stream 保留 queue 输送；canonical 终态重放绝不触碰 queue。
  P3d 统一到 outbox worker 后删除。
- view-only result：`tasks/persist` 尚未被吸收且没有 `SwarmRun` 时，taskDetail 可从
  legacy `Task.result_json` 保持页面回读；一旦存在 canonical run，canonical 结果强制优先。
  P3e 白名单清零时删除。
- 安全边界：canonical owner 不匹配或 canonical DB 不可用时不得进入兼容桥。
