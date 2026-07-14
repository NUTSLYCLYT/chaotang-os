# 变更摘要：fix-chaotang-dispatch-durable-fact-20260714

| 字段 | 值 |
| --- | --- |
| Change ID | fix-chaotang-dispatch-durable-fact-20260714 |
| 类型 | fix |
| 状态 | VERIFIED_PARTIAL |
| Owner | Project Agent |
| 创建日期 | 20260714 |

## 范围

- 将旧 `/api/chaotang/decree/dispatch` 接入唯一 `DecisionTask` 创建内核。
- 正式任务、旧 decree/task 执行索引和 `dispatch.started` 事件在同一事务提交。
- 事务成功后才登记内存 execution run 并启动后台蜂群；失败时封驳并保持零执行副作用。

## 结论

旧派单入口不再产生“蜂群已启动、正式任务未落库”的幽灵任务。任务 ID 同时联结正式
决策事实、执行索引、事件账本和短生命周期队列。`legacy-chaotang-task-chain` 仍为
`MIGRATE_REQUIRED/PLANNED`，因为旧 `tasks/persist` 和奏折批阅入口尚未完成迁移。
