# 规格说明：feat-agent-harness-task-trace-20260718-20260718

## 背景

M1 建立跨路由、部门与执行器的统一 `TaskEnvelopeV1` 与 `TraceContext`，先提供兼容适配，不迁移既有调用链。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 新增纯契约模块与 3 条单测 | task_trace.py、test_task_trace_contracts.py | pytest | 否 |
| 推测 | 待填写 | 待填写 | 待填写 | 待填写 |
| 未知问题 | 待填写 | 不适用 | 待填写 | 待填写 |

## 数据流与调用链

旧调用方 `trace_id` → `TaskEnvelope.from_legacy()` → 统一 `trace`；新调用方直接构造 envelope。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| 任务/追踪契约 | task_trace.py | 后续路由、观测、回执模块 | Pydantic + 单测 |

## 范围

新增 `backend/src/contracts/task_trace.py` 与单元测试，不改变已有业务行为。

## 非目标

不改现有路由、数据库、提示词或生产执行器，不声称全链路已迁移。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 空 task_id/intent | 拒绝 | 单测 |
| 旧式 trace_id | 转换为 TraceContext | 单测 |

## 风险与回滚边界

删除新增模块与测试即可回滚，不触碰现有调用方。

## 计划确认记录

- 批准人：
- 批准日期：
- 批准范围：
- 明确未批准：

## 验收标准

3 条单元测试通过；字段、版本与兼容适配明确；doctor 与 diff check 通过。

## 验证计划

运行 M1 单测、backend/root doctor 和 `git diff --check`。
