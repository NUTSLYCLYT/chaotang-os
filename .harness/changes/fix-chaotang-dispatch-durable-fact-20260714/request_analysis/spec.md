# 规格说明：fix-chaotang-dispatch-durable-fact-20260714

## 问题与证据

旧派单入口先调用 `register_task` 和 `_spawn_run`，再以 best-effort 方式写数据库；数据库
失败只记日志，接口仍返回成功。TDD RED 证明：正式 `DecisionTask` 不存在、失败响应仍为
success、后台执行已经启动。

## 目标数据流

认证用户派单 → 组装计划 → 单事务写入 `DecisionTask + decree + task + dispatch.started`
→ commit → execution registry → 后台 FlowEngine。

## 关键语义

- POST dispatch 是用户显式确认执行，因此正式任务状态为 `executing`，草案中记录
  `human_confirmed=true`、确认时间和派单计划。
- registry 的 `fact_kind=execution_run`，并以 `decision_task_id` 关联正式任务。
- 持久化失败返回统一失败信封，不登记内存任务、不启动线程。
- 来源为 `MIXED`：用户明确选择与规则编排共同构成计划，不伪装外部实时证据。

## 非目标

不迁移 `tasks/persist`、奏折 review、FlowEngine 内部进度实现；不删除旧表或旧 API；
不改变成功响应字段；不做数据库 schema 迁移。

## 风险与回滚

行为变化是数据库故障从“假成功”改为“失败封驳”，这是有意的安全收紧。回滚可整体
revert 本提交，无 schema 和历史数据变更。

## 批准记录

- 批准人：用户
- 日期：2026-07-14
- 范围：继续按唯一正式任务主链、事件溯源、TDD 和 verification-loop 收口。
