# P4 规格审查

## 裁决

`APPROVED_FOR_P4a_RED`（2026-07-16，Project Agent）

## 审查结论

- 事实源明确：优先复用既有 court-owned status projection，无证据显示需要平台路由改造。
- 状态所有权明确：后端拥有 verdict/risk/gap/next action/quality gate/source；前端只拥有展示。
- 顺序明确：P4a → P4b → P4c；每步 RED 先行并形成原子回滚点。
- 二阶边界已纳入：正式奏折优先、候选不得冒充正式、终态空读不得提前停轮询、空数组
  不得解释为通过、无 trace 不得伪造。
- 回滚不恢复不可信事实：旗标关闭进入安全只读等待态；若恢复旧行为须显式回滚并重审。

## 开工门

允许写 P4a 测试并运行 RED；RED 前不允许修改生产实现。P4a 若只能通过平台路由补字段，
必须停止并请求用户裁决。
