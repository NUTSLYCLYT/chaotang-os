# 规格说明：fix-chaotang-task-projection-boundary-20260714

## 问题与 RED 证据

旧持久化接口允许省略或任意指定 task ID，并用前端 command 创建 `tasks/decrees` 行。
TDD RED 证明六类问题：孤儿任务可创建、前端文本覆盖正式原问、跨用户 POST 可写、
PATCH 仅因执行行缺失偶然失败、两个新权限探针失败、攻击面登记与实现不一致。

## 目标数据流

调用方 task ID → 统一归属 accessor → 已有且属于当前用户的 `DecisionTask` →
以正式 `raw_question` 创建或更新旧 execution projection。

## 接口规则

- POST 必须显式提供 task ID；不再自动生成。
- 正式任务不存在时封驳，不创建 `Task/Decree`。
- 正式任务属于其他用户时以“无权”原因封驳。
- PATCH 也经过相同归属门；允许为已有正式任务补建缺失的执行投影。
- 本接口不修改 `DecisionTask` 状态；正式状态只能由主链和事件处理器推进。

## 非目标与风险

不迁移奏折 review，不改变成功信封，不做 schema 迁移，不清理旧表。行为收紧可能使
仍在调用孤儿持久化的外部客户端收到失败；仓内搜索确认生产前端没有调用该 POST helper。

## 回滚与批准

可整体 revert，无历史数据变更。用户于 2026-07-14 批准继续按唯一任务事实源、TDD、
verification-loop 推进下一刀。
