# 变更摘要：fix-compat-decision-task-adapters-20260714

| 字段 | 值 |
| --- | --- |
| Change ID | fix-compat-decision-task-adapters-20260714 |
| 类型 | fix |
| 状态 | VERIFIED_PARTIAL |
| Owner | Project Agent |
| 创建日期 | 20260714 |

## 范围

- 将军机处立案、朝堂兼容编排和旧 orchestration SSE 三个业务入口接入正式 `DecisionTask`。
- 保留旧 JSON/SSE 形状与任务 ID 前缀；内存 `task_registry` 仅作为 execution run，并关联正式任务 ID。
- 不迁移 `chaotang.py` 的 FlowEngine 运行队列，不删除兼容路由，不宣称完整下旨闭环已经验证。

## 结论

三个兼容入口不再以进程内 registry 充当业务事实。每个成功请求先经唯一
`create_decision_task` 内核提交正式、待皇上确认的任务，再登记短生命周期执行状态。
能力入口仍保持 `MIGRATE_REQUIRED`，因为旧路由删除和真实调用量观察尚未完成。
