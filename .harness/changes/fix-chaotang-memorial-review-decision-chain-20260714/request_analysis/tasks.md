# 任务：fix-chaotang-memorial-review-decision-chain-20260714

## 任务 1：正式归属链

- 解析 run/memorial 到唯一 DecisionTask。
- 孤儿、冲突和跨用户映射全部封驳。

## 任务 2：统一裁决

- 复用上书房公开裁决状态机与事件记录器。
- 原子写 EmperorDecision、任务状态、事件、Review 和 loop 审计。
- 批准强制经过 FinalMemorial 门。

## 任务 3：兼容与验证

- 提交后写旧 JSON 副本，保留详情与列表兼容。
- 迁移旧测试的孤儿 run 假设。
- 回归朝堂、权限、账本、正式奏折与 Harness 治理。
