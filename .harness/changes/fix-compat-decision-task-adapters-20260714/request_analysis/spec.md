# 规格说明：fix-compat-decision-task-adapters-20260714

## 背景与证据

`court_compat` 与 `orchestration_compat` 的业务入口只写模块级内存字典。进程重启后记录消失，
也无法进入上书房正式确认、权限和后续会审主链。TDD RED 证明三个成功响应对应的
`DecisionTask` 均不存在。

## 数据流

兼容 HTTP 请求 → deterministic 拟旨 → `create_decision_task` → 数据库提交 →
execution registry（`decision_task_id` 关联）→ 保持原 JSON/SSE 响应。

## 范围与非目标

- 范围：`/api/court/junjichu/cases`、`/api/court/orchestrate{,/all}`、
  `/api/orchestration/run`；registry 事实类型；隔离数据库契约测试；能力清单。
- 非目标：sign-off 语义重建、旧路由删除、FlowEngine 队列迁移、生产数据库迁移、前端改动。

## 边界与风险

- 正式任务状态固定为 `awaiting_emperor_confirm`，兼容入口不得越过人工确认门。
- 数据库提交失败时不登记执行记录，避免“内存成功、正式任务不存在”。
- `/orchestrate/all` 复用普通编排内部函数，避免把 FastAPI `Depends` 默认对象写成用户。
- 回滚为整体 revert；没有 schema 和历史数据变化。

## 验收标准

三个入口的任务都可从 `decision_tasks` 查询，owner 为当前用户；registry 明确为
`execution_run` 且关联相同 ID；既有 JSON/SSE 契约、权限门、唯一写入门和 Harness Doctor 全绿。

## 批准记录

- 批准人：用户
- 日期：2026-07-14
- 范围：按已批准的“唯一正式任务主链 + TDD + verification-loop”继续收口。
