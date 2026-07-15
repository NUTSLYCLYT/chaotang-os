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
