# 规格说明：feat-jiqun-official-task-event-ledger-20260714

## 背景

正式下旨主链已经具备 `DecisionTask -> ChancellorRouteDecision -> OutboxEvent -> SwarmRun -> CourtReview`，但 `decree_execution_events` 目前只保存展示用的 stage/actor/message，无法结构化追溯“哪类事件、哪个 trace、什么来源等级、什么不可变业务载荷”。本变更把既有时间线升级为正式任务事件账本的第一版，不新建平行事件表。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 当前正式 confirm-edict 会写路由、review、outbox 和展示时间线 | `backend/web/routers/shangshufang.py`、`backend/src/chancellor/decree_status.py`，2026-07-14 只读检查 | Project Agent | 否 |
| 已确认事实 | 当前事件表缺 event_type/trace/source/payload/idempotency | `sqlite3 -readonly backend/data/fengqun.db '.schema decree_execution_events'` | Project Agent | 是 |
| 已确认事实 | 目标路由/蜂群/奏折测试基线 exit 0 | `/home/linuxbrew/.linuxbrew/bin/python3 -m pytest ...`，2026-07-14 | Project Agent | 否 |
| 未知问题 | 完整 30 条黄金旨意尚未建立，本 PR 不宣称端到端质量达标 | 不适用 | 后续质量门变更 | 否 |

## 数据流与调用链

`confirm-edict -> ChancellorRoutingService -> outbox -> outbox_worker -> run_swarm_execution_loop -> quality gate -> CourtReview`。每个关键转换继续写入既有 `decree_execution_events`，但升级为结构化、幂等、按 task sequence 排序的事件信封。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| `DecreeExecutionEventV1` | 后端 `decree_execution_events` | 状态接口、审计、后续史馆归档 | 新字段有默认值，旧 timeline 字段保持兼容；pytest + migration/self-heal 测试 |

## 范围

- 扩展既有事件模型和 Alembic 迁移。
- 为老数据库提供运行时 self-heal，延续当前 sequence 修复策略。
- 扩展 `record_timeline_event()`，支持 event_type/trace/source/payload/idempotency。
- 状态接口 timeline 暴露结构化元数据。
- 正式下旨和后台派单关键转换写入结构化事件。

## 非目标

- 不收敛旧 `/api/swarm/run`；该工作留给后续独立 PR。
- 不新增 FinalMemorial 表，不修改前端页面。
- 不运行真实模型和高成本 30 例评测。
- 不修改 `.env`、provider、生产数据或现有用户改动。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 同一 idempotency_key 重放相同事件 | 返回原事件，不新增行 | 单元测试 |
| 同一 idempotency_key 重放不同载荷 | fail closed | 单元测试 |
| 旧表缺新增列 | self-heal 后可写可读 | 临时 SQLite 集成测试 |
| 未提供新元数据的旧调用方 | 使用兼容默认值 | 既有测试回归 |

## 风险与回滚边界

风险：旧 SQLite 未跑迁移时写入失败、幂等键冲突、状态接口契约漂移。通过 Alembic + self-heal + 可选字段向后兼容控制。回滚时可回退代码；新增列保留不影响旧代码，不做破坏性降级。

## 计划确认记录

- 批准人：用户
- 批准日期：2026-07-14
- 批准范围：使用 TDD 与 verification-loop，收敛唯一正式任务主链并引入事件溯源；本 PR 为事件账本第一纵切面
- 明确未批准：生产发布、真实客户数据写入、密钥/Provider 修改

## 验收标准

1. 新增测试先 RED，再由最小实现变 GREEN。
2. 结构化事件可按 task_id/sequence 重放，且保留旧 timeline 字段。
3. 幂等重放不重复，冲突重放 fail closed。
4. 旧表自愈测试通过；目标回归、doctor 与 diff review 通过。

## 验证计划

- 小测试：`python3 -m pytest -q tests/test_decree_event_ledger.py`
- 目标回归：丞相路由、outbox、swarm-run、奏折相关测试。
- verification-loop：后端 doctor、目标测试、Python compile/lint 可用项、根 doctor、diff/security review。
