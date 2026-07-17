# 朝堂 OS 世界级 Agent Harness 执行方案

> 状态：PROPOSED，等待业主批准后执行
> 日期：2026-07-17
> 目标：在不破坏现有 FlowEngine、SwarmOrchestrator、御史门和史馆事实链的前提下，
> 把朝堂 OS 建成证据驱动、自适应、可观测、可回滚的决策操作系统。

## 0. 执行纪律

- 一个模块一个 Harness change、一个分支、一个可回滚提交。
- Codex 是唯一写入者；Claude 只做只读独立复审。
- 每个模块必须先 RED，再 GREEN，再跑专项测试、全量回归和 doctor。
- 未获得当前精确 HEAD 的独立 `PACKET_REVIEW_GO`，不得进入下一个依赖模块。
- 不把本地 hook、mock、dry-run 或单元测试解释为生产强制能力。
- 不修改生产数据库、provider 密钥、外部 required check 配置。

## 1. 目标架构

```text
TaskEnvelope
  → Capability Router
  → 门下省（是否该派）
  → Adaptive Executor（system / agent / flow / swarm）
  → EvidencePacket
  → 御史门（结果是否可信）
  → 人工裁决
  → 史馆回执与质量飞轮
```

模型只产生候选建议；风险等级、权限、状态机、人工签字、证据门和归档由确定性代码拥有。

## 2. 依赖图与模块清单

```text
M0 基线与契约冻结
 ├─ M1 TaskEnvelope / TraceContext
 ├─ M2 CapabilityCard 注册与能力健康
 │   ├─ M3 自适应路由与 shadow routing
 │   └─ M4 Agent 懒加载与预算治理
 ├─ M5 EvidencePacket / 统一证据协议
 │   └─ M6 御史证据门与冲突门
 ├─ M7 真实结果回执与史馆飞轮
 ├─ M8 六部能力补齐（礼/吏/锦衣卫/工部/兵部）
 ├─ M9 生产 Trace 与 KPI 仪表盘
 └─ M10 LangGraph 隔离 PoC（仅当 M0-M9 证明需要）
```

推荐串行顺序：`M0 → M1 → M2 → M5 → M6 → M3 → M4 → M7 → M8 → M9 → M10`。

可并行但仍需独立复审：M2 与 M5；M8 的部门补齐任务之间互不共享运行时文件时可拆分排队。

## 3. 模块执行卡

### M0：事实源与黄金基线冻结

**Change**：`chore-agent-harness-baseline-20260717`

**范围**：冻结 canonical taxonomy、当前路由、known-red、真实引擎注册表和黄金任务集。

**产物**：

- `capability-baseline.json`
- 50–100 个分层黄金任务（D0-D2、部门、证据完整度、拒答样本）
- 7 项已知红灯基线及归属
- 每项断言的事实源和验证命令

**验收**：重复运行结果稳定；不修改运行时逻辑；doctor 全绿。

### M1：TaskEnvelope 与 TraceContext

**Change**：`feat-task-envelope-trace-context-20260717`

**范围**：统一任务输入、租户、风险、可逆性、证据状态和 trace 标识。

**核心字段**：`task_id`、`tenant_id`、`trace_id`、`goal`、`risk_level`、`reversibility`、`evidence_state`、`source_label`。

**验收**：所有上书房入口、chancellor 路由、FlowEngine、SwarmOrchestrator 都能透传；缺字段 fail closed；跨租户测试通过。

**回滚**：边界适配器回退旧 dict，不改数据库事实源。

### M2：CapabilityCard 注册与能力健康

**Change**：`feat-capability-card-registry-20260717`

**范围**：六部及专署登记 in-scope、out-of-scope、工具、版本、成本、延迟、成功率、证据率和 fallback。

**验收**：能力卡来自唯一 taxonomy；每个 active 部门有拒答样本和最小黄金集；未知能力不得被路由。

### M3：自适应路由与 Shadow Routing

**Change**：`feat-adaptive-capability-routing-20260717`

**范围**：用能力、风险、证据、历史质量、成本和延迟替代单纯关键词；新路由先 shadow，不接管生产。

**验收**：与旧路由并行记录；连续 100 个真实/回放任务达到准确率、误派率、成本阈值后才允许灰度。

**回滚**：feature flag 关闭，恢复确定性路由。

### M4：Agent 懒加载与预算治理

**Change**：`feat-agent-lazy-load-budget-guard-20260717`

**范围**：按 D 级和能力需求启动最小 Agent 集；设置 token、时间、工具、重试和 Agent 数量预算。

**验收**：D0 不启动蜂群；D2 预算超限暂停并转人工；无无限循环；P50/P95 延迟和成本可测。

### M5：EvidencePacket 统一证据协议

**Change**：`feat-evidence-packet-contract-20260717`

**范围**：所有 Agent 输出统一为事实/推断/建议、证据、缺口、置信度、风险和下一动作。

**验收**：无来源硬数字自动标 `[missing]`；工具未调用不得声称已验证；旧输出可通过边界适配器消费。

### M6：御史证据门与冲突门

**Change**：`feat-yushi-evidence-conflict-gate-20260717`

**范围**：增加证据完整性、职责越权、部门冲突和不可逆动作四类确定性检查。

**验收**：GREEN/YELLOW/RED/BLACK 状态可解释；BLACK 必须人工签字；门下省审派不派，御史审结果对不对。

### M7：真实结果回执与史馆飞轮

**Change**：`feat-outcome-receipt-learning-loop-20260717`

**范围**：记录路由正确率、证据接地率、人工改判率、结果兑现率、成本、延迟和失败原因。

**验收**：每个正式任务都有回执状态；未产生真实结果不得标成功；回执可进入黄金集和路由评估。

### M8：部门能力补齐

拆成独立子包，禁止大包混做：

| 子包 | 目标 | 当前优先级 |
|---|---|---:|
| M8-A 礼部激活 | 从 pending 变成真实可验收能力 | 1 |
| M8-B 吏部边界 | 正式登记人员/权限 out-of-scope | 2 |
| M8-C 锦衣卫联网 | 接真实检索源并保留 vet 门 | 3 |
| M8-D 工部工具 | telemetry 与工单草稿审批链 | 4 |
| M8-E 兵部战情 | 多轮战情工具和结果回执 | 5 |

每个子包必须独立拥有工具契约、拒答集、真实回放和回滚方案。

### M9：生产 Trace 与 KPI 仪表盘

**Change**：`feat-agent-quality-observability-20260717`

**核心 KPI**：路由准确率、证据接地率、人工改判率、结果兑现率、拒答正确率、每次成功决策成本、P50/P95 延迟。

**验收**：指标可按租户、部门、Agent、工具、版本和风险级别切片；无数据时显示 `NO_DATA`，不显示假 0%。

### M10：LangGraph 隔离 PoC

**Change**：`experiment-langgraph-complex-subgraph-20260717`

**触发条件**：只有当现有 FlowEngine 无法可靠表达长时间暂停、动态子图、多次人工中断或复杂 checkpoint 时启动。

**约束**：

- 不替换主链
- 不接生产数据库
- 只跑 10 个复杂黄金任务
- 必须对比 FlowEngine 的恢复率、P95、成本和可解释性
- 连续两轮优于现有实现，才进入架构评审

## 4. 每个 Harness change 的固定结构

```text
.harness/changes/<change-id>/
├── summary.md
├── request_analysis/spec.md
├── request_analysis/tasks.md
├── ci_result/ci_summary.md
├── golden-cases/
├── rollback.md
└── packet_review/
```

每个 change 必须记录：事实源、调用链、测试 RED/GREEN、全量结果、known-red 对账、回滚边界、独立复审裁决。

## 5. 反模式黑名单

- 不因“世界领先”引入更多 Agent。
- 不让模型直接改变 D 级、权限、状态或归档。
- 不建立第二套路由、第二份任务真相或第二个正式奏折。
- 不把 mock、dry-run、局部测试当生产证据。
- 不在没有真实结果回执时训练或奖励 Agent。
- 不在 M0-M9 完成前把 LangGraph 接入主链。

## 6. 总体验收门

只有同时满足以下条件，才允许声明 `WORLD_CLASS_READY_FOR_EXTERNAL_REVIEW`：

1. 100 个分层黄金任务稳定回放。
2. 所有 active 部门有 CapabilityCard、拒答集、工具契约和 fallback。
3. 路由准确率、证据接地率、人工改判率和结果兑现率都有真实数据。
4. D0-D2 自适应执行预算可解释且无越权。
5. 全量回归无新增失败，known-red 有独立 ledger。
6. 每个模块获得精确 HEAD 的独立 `PACKET_REVIEW_GO`。
7. 外部 required check、签名信任锚和 protected branch 已由管理员配置。

在此之前，系统只能称为 `IMPLEMENTATION_PARTIAL / READY_FOR_ITERATION`。
