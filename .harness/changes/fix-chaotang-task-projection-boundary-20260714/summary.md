# 变更摘要：fix-chaotang-task-projection-boundary-20260714

| 字段 | 值 |
| --- | --- |
| Change ID | fix-chaotang-task-projection-boundary-20260714 |
| 类型 | fix |
| 状态 | VERIFIED_PARTIAL |
| Owner | Project Agent |
| 创建日期 | 20260714 |

## 范围

- 将旧 `POST/PATCH /api/chaotang/tasks/*persist` 限定为正式 `DecisionTask` 的执行投影。
- 禁止缺少 task ID、缺少正式任务或跨用户的投影写入。
- 执行投影的 command 固定读取正式任务 `raw_question`，不接受前端副本覆盖。
- 新增统一 `get_owned_decision_task` accessor，router 裸查表面积保持不增长。

## 结论

前端不能再通过旧持久化接口创造第二套业务任务事实，也不能篡改他人任务或权威原问。
`legacy-chaotang-task-chain` 继续保持 `MIGRATE_REQUIRED/PLANNED`，最后尚有旧奏折 review
需要接入正式裁决与事件账本。
