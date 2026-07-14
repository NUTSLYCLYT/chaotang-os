# 规格说明：fix-chaotang-memorial-review-decision-chain-20260714

## 问题与 RED 证据

旧 review 只验证磁盘 RunLog，随后直接写 JSON/Review 状态。TDD RED 实证：孤儿奏折可批、
跨用户奏折可批、补证不推进正式任务、批准绕过 `FinalMemorial`、正式事件缺失，以及攻击面
探针与代码不一致，共 7 个失败。

## 目标事务

run ID → 解析唯一正式 task ID → 校验当前用户归属 → 创建 `EmperorDecision` →
共享 `apply_task_decision` 状态机 → `record_task_decision_event` → 旧 Review DB 索引 →
CourtLoopRun → commit。JSON 兼容副本只在正式事务成功后写入。

## 动作语义

| 旧动作 | 正式动作 | 正式状态 |
| --- | --- | --- |
| approve | approve | archived；要求 ready_for_decision FinalMemorial |
| reject | reject | rejected |
| inquire | request_evidence | awaiting_evidence |

## 边界与非目标

- Task.run_id 与 Memorial.task_id 若指向不同正式任务，按映射冲突封驳。
- JSON 副本写失败只记录 warning，不回滚已经提交的正式裁决。
- 不删除旧 API/旧 JSON 读取，不改 schema，不替代 staging 发布验证。

## 回滚与批准

可整体 revert，无历史数据迁移。用户于 2026-07-14 批准继续执行“下一刀”。
