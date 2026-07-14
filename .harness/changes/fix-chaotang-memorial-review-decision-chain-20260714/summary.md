# 变更摘要：fix-chaotang-memorial-review-decision-chain-20260714

| 字段 | 值 |
| --- | --- |
| Change ID | fix-chaotang-memorial-review-decision-chain-20260714 |
| 类型 | fix |
| 状态 | VERIFIED_PARTIAL |
| Owner | Project Agent |
| 创建日期 | 20260714 |

## 范围

- 将旧 `/api/chaotang/memorials/{run_id}/review` 接入正式 `DecisionTask` 裁决链。
- 建立 `run_id/Memorial → execution Task → owned DecisionTask` 的唯一归属解析。
- 正式裁决、状态转换、事件账本、旧 Review DB 索引和 loop 审计在同一事务提交。
- `approve` 强制通过 `FinalMemorial` 质量与来源门；`inquire` 映射补证，`reject` 映射驳回。

## 结论

旧奏折批阅不再能绕过正式奏折门、跨用户裁决或独立修改业务终态。至此
`legacy-chaotang-task-chain` 清单中的派单、任务投影和奏折 review 三个入口均已有
验证替代实现，replacement 升为 `VERIFIED`；仍保留 `MIGRATE_REQUIRED`，等待遥测满足删除门。
