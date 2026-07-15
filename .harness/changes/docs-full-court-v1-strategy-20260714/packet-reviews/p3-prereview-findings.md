# P3 滚动预审发现（整包审查前必须处置）

> 记录时点：P3a–P3d 四个 checkpoint（`c21127e`/`4606715`/`7cefefc`/`bf05102`）。
> 独立验证基线：后端 19 passed、前端 adapter 3 passed、daemon gate 测试在。
> 本文件是 P3 整包审查的输入；每项须在 token 前修复或在 change 记录显式裁决。

## P3-F1（HIGH，阻塞整包 GO）：默认 canonical 路径静默丢弃派单/预算/风险约束

- 位置：`backend/web/routers/chaotang.py` `_legacy_chaotang_daemon_enabled()` 为
  假时的分支（约 :270-300）调用 `dispatch_compat_court_task(task_id, user_id,
  command=body.rawCommand, compat_entrypoint=...)`。
- 事实：请求体中用户明确设定的以下字段在默认路径被丢弃且无任何告警/降级标注：
  - `body.budget`（maxCalls / maxSubagentsPerGroup——成本硬约束）；
  - `selectedCategories` 派生的 ministers/groups/task_type（派单约束）；
  - `stakes`（风险档位）；`intent`。
  legacy 路径（gate 开）则消费 budget_calls/min_success/stakes/departments。
- 影响：用户设了预算和部门约束，系统答 `ok` 但按无约束执行——违反"失败是一等
  状态/约束不得静默吞掉"铁律；成本与风险控制失效。
- 最小修正方向（三选一，由 Codex 定）：
  a) `dispatch_compat_court_task` 增加 constraints 参数并落入 canonical
     路由/执行上下文（预算进 execution policy，部门约束进 routing hint）；
  b) 暂不支持的约束显式拒绝（fail with reason），不静默降级；
  c) 响应中显式标注 `constraintsDropped:[...]` + sourceLabel 降级——最弱解，
     仅当 a/b 均超 P3 范围时可临时用，且须进 deferred-boundaries。
- 验收：带 budget/departments/stakes 的请求在默认路径要么被真实尊重、要么
  显式拒绝/标注；新增测试覆盖三类字段。

## P3-Q1（已解）：`direct_completed` 入队即置

与 canonical shangshufang 现行语义一致（`shangshufang.py:1032` 同款终态），
属继承的 direct-receipt ADR 缺口（census ING-04），非新回归。
要求：change 记录注明继承关系，不在 P3 修。

## P3-Q2（登记）：EmperorDecision 新构造点

`compat_court_dispatch` action 延续 DEC-01 已知"确认下旨与圣裁混表"问题。
要求：登记进奏折/裁决收口（FCV1-009 对应）构造点清单。

## 已确认的优点（免重复审）

canonical 事务完整（compat adapter/幂等路由/timeline 幂等/outbox）；
前端 adapter 无第二状态机；deferred-boundaries 边界声明合格
（王座冻结、P3d 计数窗口门、兼容桥删除点）。
