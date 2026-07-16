# ADR：P4.5b 执行状态语义冻结

- 状态：Accepted
- 日期：2026-07-16
- 决策范围：DecisionTask 主链的执行事实投影

## 决策

保留 `DecisionTask.status` 的既有值域与兼容映射，不把它改写成新的状态机。新增
`execution_state` 读模型，只从正式事件、同代 outbox 与真实执行工件推导。

`direct_completed` 继续作为历史业务 status，含义固定为“直接受理并生成回执”，
不再被解释为真实异步执行完成。其执行投影是 `receipt_only`。

## 生产事件词表

| event_type | 事实含义 | 执行终态作用 |
| --- | --- | --- |
| `timeline.note` | 说明事件 | 无 |
| `routing.decided` | 路由快照已决定 | 无 |
| `route.direct / route.council` | 兼容派单入口记录所选 route | 无 |
| `dispatch.queued` | outbox 已登记 | 无 |
| `dispatch.started` | worker 已开始 | 无；不得作为 attempt 分界 |
| `dispatch.receipt_only` | direct worker 核验到回执、无异步执行 | `receipt_only` 终态 |
| `dispatch.failed` | 某 outbox attempt 失败 | 失败终态 |
| `reports.completed` | council 回奏事务完成 | 成功语义终态，仍须工件双证 |
| `quality.passed / quality.blocked` | 下游质量判定 | 无 |
| `memorial.formalized / memorial.blocked` | 下游奏折晋升 | 无 |
| `memorial.direct_completed` | 旧 direct 回执事件 | 仅单终态兼容为 `receipt_only` |
| `decision.*` | 人工裁决记账 | 无 |

Outbox 的事件值域仍只有 `route.direct / route.council`，状态值域仍是
`pending / processing / completed / failed / dead_letter`。

## Attempt 与代次

- worker claim 后立即捕获本次 `attempt = OutboxEvent.attempts + 1`。
- 新终态必须在 payload 和 idempotency key 中同时绑定精确
  `outbox_event_id + attempt`。
- 先选最高 attempt；同 attempt 再选最高 `DecreeExecutionEvent.sequence`。
- sequence 只表示写入顺序，不能跨 attempt 推断因果。
- `dispatch.started` 的幂等键故意跨重试复用，因此不能充当 attempt 分界。
- 无 attempt 的历史事件：只有一个终态时按其字面读取；多个终态无法区分代次，
  进入 `inconsistent + quarantine`。

## 工件证明

`reports.completed` 只有同时满足以下事实才能投影为 `completed`：

1. 精确关联同一 `outbox_event_id` 和所选 attempt；
2. payload 的 `swarm_run_id` 对应真实 `SwarmRun`；
3. run 已结束且状态为 `completed` 或 `quality_blocked`；
4. 至少一个 `SwarmTaskRun`，全部为 `completed` 且存在输出；
5. 存在对应 `SwarmQualityResult`。

`FinalMemorial` 是质量与来源晋升后的下游工件，不是执行完成的必要条件。
部分工件组合不是当前 worker 单事务边界允许的合法状态，必须 quarantine，不能猜成
“部分完成”。

## 有序判定表

| 顺序 | 条件 | execution_state | quarantine |
| ---: | --- | --- | --- |
| 1 | 未知 mode、非法 attempt 或代次绑定断裂 | `inconsistent` | 是 |
| 2 | 最高 attempt 终态为 `dispatch.failed` | `failed` | 否 |
| 3 | direct 回执终态与非空 direct CourtReview 对齐 | `receipt_only` | 否 |
| 4 | `reports.completed` 与完整 council 工件双证 | `completed` | 否 |
| 5 | 成功终态缺工件、部分工件或模式不符 | `inconsistent` | 是 |
| 6 | 无终态，outbox pending | `queued` | 否 |
| 7 | 无终态，outbox processing | `running` | 否 |
| 8 | 旧 outbox failed/dead_letter 且无正式失败终态 | `failed` | 否 |
| 9 | 其余组合 | `inconsistent` | 是 |

判定表是 first-match-wins，末行是显式 catch-all。性质测试穷举 mode、终态、outbox
状态、direct 回执和 council 工件组合，要求始终且只命中一行。

## 读模型

- `DecreeExecutionStatusV1` 暴露 snake_case 的执行投影、quarantine、原因和 attempt。
- 朝堂 task detail 与 canonical SSE snapshot 暴露同一派生器的 camelCase 投影。
- canonical SSE 的 `terminal` 由执行投影决定；direct outbox 尚为 pending 时不再仅凭
  `direct_completed` 提前宣告终止。

`/api/swarm-runs` 的独立执行路径当前没有 OutboxEvent/attempt/正式终态，不能把它的
工件单独晋升为官方 `completed`；接入主 outbox 前保持 fail closed。
