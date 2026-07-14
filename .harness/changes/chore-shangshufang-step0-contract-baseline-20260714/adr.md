# ADR：上书房到蜂群控制面基线

状态：APPROVED_FOR_PLANNING；运行时尚未实施。

## ADR-001 两段 outbox：durable planning 后再 execution

**决定**：confirm 事务只保存最终圣旨快照、丞相路由、状态事件和 `planning_requested` outbox。durable planning worker 在事务外调用规则/LLM，随后在一个新事务里原子保存版本化 `JunjichuDeliberation` 与 `execution_requested` outbox。execution worker 只执行已持久化计划。

**理由**：网络/LLM 不占用数据库事务；计划可重放、可审计；planning worker 重试用 planning idempotency key 复用已落计划，不重新猜测。

**supersedes**：替代旧 DRAFT 设计“写 OutboxEvent 前在同一路径完成一次军机处 LLM”的条款；保留“execution 前必须有 JunjichuDeliberation”的不变量。

**迁移前置**：control-plane Step 2 先增加 planning 状态；control-plane Step 3B 提供 planning/execution 两类 outbox、幂等键和恢复；对应 launch 阶段为 S4/S8。未完成前沿用现链但不得宣称 durable planning。

## ADR-002 direct 使用 durable 单节点 executor

**决定**：direct 不进入多部门军机处会审，但进入与 council 相同的 durable command/outbox 控制面，执行一个明确 agent node。没有 execution receipt 时不得写 `completed` 或 LIVE execution。

**理由**：统一幂等、恢复、权限、日志和状态语义；避免同步网络调用拖住 HTTP；避免“生成回执等于完成”的假成功。

**兼容**：现有 `direct_completed` 在迁移前视为 legacy receipt 状态；新状态机需区分 `direct_queued/direct_running/direct_completed`。

**supersedes**：替代旧 DRAFT 设计“direct 同步完成”的条款；继续保持 direct 不进入多部门军机处会审。

## ADR-003 增量持久化 DAG，不重写蜂群算法

**决定**：新增 DepartmentAssignment/NodeAttempt/ResultRef 持久化控制面；第一阶段复用现有 `swarm_execution_loop` 和部门算法，在部门边界 checkpoint。只有指标证明需要更细恢复时才拆 office/agent 级节点。

**理由**：满足重启恢复与可观测性，同时控制改造面；不因“前沿趋势”直接替换为 Temporal 或重写 ThreadPool 业务算法。

**supersedes**：只替代旧 DRAFT 的“完全不增加持久化编排底座”非目标，不替代其复用 SWARM_DEFS、部门实现和现有算法的决定。

**框架触发条件**：并发、长等待、人机审批、跨日流程或补偿复杂度超过 Postgres worker 的量化 SLO 后，另建 Temporal/外部引擎 ADR。

## ADR-004 sourceLabel 与 engineTier 正交

**决定**：sourceLabel 描述来源可信度，engineTier 描述执行引擎。禁止用 `engineTier=real` 自动推导 `sourceLabel=LIVE`。

**理由**：真实模型也可能缺证据，规则模板也可能使用真实用户材料；两者合并会继续制造伪 LIVE。

**迁移**：当前 `LIVE_ENGINE` 是 legacy wire alias，不是目标 sourceLabel。Launch S4 兼容 adapter 将其拆为 `engineTier=real`，并根据证据引用、用户材料和降级状态另算 sourceLabel；新写入不再生产 `LIVE_ENGINE`。

## ADR-005 D0/D1/D2 processing_depth 与动态升级

**状态**：APPROVED_FOR_PLANNING；在状态机、权限和事件契约落地前不得声称运行时已实施。

**决定**：`processing_depth=D0|D1|D2` 是同一个 canonical ingress 的处理深度，不是三套任务系统。最终等级由确定性策略裁决：

```text
effective_depth = max(complexity_depth, hard_gate_depth, authorized_user_depth)
```

模型可以输出建议等级和结构化理由，但不能覆盖风险硬门、授权边界或状态转换。策略结果必须记录 `policy_version`、输入特征、命中的硬门、建议等级、最终等级和理由。

| 深度 | 语义 | 持久化边界 | 执行与结果 | 允许的下一步 |
| --- | --- | --- | --- | --- |
| D0 | 咨询、解释、查询、起草 | 不创建正式 `DecisionTask`；只保留最小安全审计元数据和可选上下文引用 | 不调用有业务副作用的工具，不声称已经执行；回答必须带真实来源/降级标记 | 结束咨询，或由用户显式升级为一个新的 canonical command |
| D1 | 单部门、低风险、证据充分、可逆的正式直办 | 创建一个 `DecisionTask`，写 `processing_depth=D1` 和版本化路由 | 走 ADR-002 durable 单节点 executor；只有真实 execution receipt 才能完成 | 完成、失败、补证，或在原 task 上升级 D2 |
| D2 | 多部门、缺证、冲突、长任务、高风险或需审批的会办 | 创建一个 `DecisionTask`，写 `processing_depth=D2`、军机处计划和全部事件 | 走 ADR-001/003 durable planning + assignments；只允许 CAN-05 晋升唯一正式奏折 | 质量阻断、人工裁决、归档或在同一 task 上重审 |

**起始复杂度规则**：每增加一个参与部门 `+1`；关键证据缺失 `+2`；外部写操作 `+2`；金额/合同/安全/人事 `+3`；不可逆动作 `+3`；人工审批 `+2`；预计超过 5 分钟 `+1`；部门意见冲突 `+2`。`0–1 → D0`、`2–4 → D1`、`>=5 → D2`。这些阈值是 `policy_version=v1` 的规划基线，必须用 Step 0 黄金资产回放后才能进入运行时默认值。

**hard gate**：涉及法律结论、资金支付或预算承诺、合同签署、凭据/安全配置、人事决定、对外发布或承诺、删除/覆盖等不可逆动作时，无条件至少 D2。硬门只能由版本化确定性 policy 修改；模型、普通用户和前端参数均无 override 权限。

**override 权限**：

- 用户可以把 D0/D1 主动提高到 D1/D2；提高必须记录 actor、原因和时间。
- 普通用户、模型和部门 agent 不得降低 policy 结果。
- 只有具备 `workflow_policy_admin` 的授权管理员可以提出降级；已经命中 hard gate、已产生外部副作用或已进入 D2 execution 的任务禁止降级，即使管理员也只能终止后重新建案。
- 管理员 override 必须是结构化审计事件，包含旧值、新值、policy version、审批人和理由；不能通过编辑数据库或前端隐藏字段实现。

**D0 ingress 与审计边界**：D0 共用 canonical ingress 的身份、tenant、限流、内容安全、来源标签和 trace id，但不写业务事实表，不创建“轻量任务”替身，也不调用外部写工具。允许的最小审计仅包含 actor/tenant、时间、trace id、policy version、最终深度、命中规则、provider/engine 元数据和不可逆摘要 hash；默认不复制咨询正文或附件。若合规 owner 要求保存正文，必须另有 retention、删除与访问控制决策。

**D0 → 正式任务**：只有用户显式选择“转为正式事项”才创建新的 canonical command 和一个 D1/D2 `DecisionTask`；新任务记录 `origin_trace_id/context_snapshot_ref`，不得把 D0 会话 id 冒充 task id。上下文快照必须版本化、最小化并经过用户确认。

**D1 → D2 escalation**：执行中发现缺证、冲突、新硬门、越权、超时/成本越界或需要第二部门时，写 `escalation.requested`，冻结当前输出为候选 evidence，保持原 `DecisionTask.id`，把 `processing_depth` 单调升级为 D2，增加 route/plan version，然后进入 durable planning。不得新建第二任务，不得覆盖旧路由和尝试记录。

**降级规则**：自动降级一律禁止。未开始执行且未命中 hard gate 的任务，可由授权管理员在记录 override 后从 D2 调整到 D1；D1 不得降成 D0，因为它已经建立正式业务任务。取消任务使用明确终态，不以降级替代。

**兼容策略**：

1. 旧 `direct` 记录在迁移读模型中映射为 D1，旧 council/多部门记录映射为 D2；无法判断的记录标 `processing_depth=UNKNOWN_LEGACY`，不得据此自动执行。
2. API 迁移期可暂时不要求旧客户端发送 `processing_depth`；backend 必须自行计算并在响应中返回。客户端传值只视为用户提高等级的请求，不能降低 backend policy 结果。
3. `pack-swarm-loop`、finance/research 专线若属于正式任务，必须改为 CAN-01 的 profile/template 并复用同一 `DecisionTask`；在产品 owner 裁决前保持 `UNKNOWN`，见 `entry-inventory.md` UNK-01。
4. `/api/orchestration/run` 等兼容咨询只能标 D0/FALLBACK 且无业务副作用；一旦需要正式执行必须转 CAN-01，不得继续在 registry 中伪造 done。

**不变量与验收**：

- 任一 D1/D2 用户意图最多对应一个 canonical `DecisionTask`；动态升级后 task id 不变。
- D0 的测试证明无业务表写入、无外部副作用、无 LIVE execution 声称。
- hard gate 的对抗测试证明模型提示、客户端字段和普通用户均不能降级。
- D1 只有 durable receipt 才完成；D2 只有质量与来源门通过才产生一个 `FinalMemorial`。
- 30 条正式工作流黄金旨意按 10 D1、10 D2、10 失败/对抗/恢复验证；D0 另用咨询契约验证，不计入正式奏折对账。

**与既有 ADR 的关系**：本 ADR 只裁决处理深度、硬门和升级语义；D1 durable executor 复用 ADR-002，D2 durable planning/outbox 复用 ADR-001，持久化执行边界复用 ADR-003，来源可信度复用 ADR-004，不重新裁决这些设计。
