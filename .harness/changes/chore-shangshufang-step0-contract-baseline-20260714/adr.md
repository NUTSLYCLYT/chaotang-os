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
