# 变更摘要：fix-decision-task-single-writer-20260714

| 字段 | 值 |
| --- | --- |
| Change ID | fix-decision-task-single-writer-20260714 |
| 类型 | fix |
| 状态 | VERIFIED_PARTIAL |
| Owner | Project Agent |
| 创建日期 | 20260714 |

## 范围

- 主线：`DecisionTask` 正式业务任务的唯一运行时创建入口。
- 文件：`backend/src/decision_task_kernel.py`、上书房四个任务创建调用点、结构性回归门与能力入口清单。
- 验证：65 项朝堂专项、3 项能力入口治理、根/后端 Harness Doctor 全绿。

## 结论

正式拟旨、PACK、finance-intel 与 research-budget 不再直接构造 ORM 模型，统一经
`create_decision_task` 登记。旧 `chaotang`/`court_compat`/`orchestration_compat`
仍持有独立的短生命周期 execution registry，因此整个入口迁移继续保持
`MIGRATE_REQUIRED`，本变更不宣称第三关全部完成。
