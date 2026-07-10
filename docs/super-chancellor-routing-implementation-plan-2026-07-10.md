# 超级丞相智能路由可实施方案

> 状态：实施设计稿  
> 日期：2026-07-10  
> 适用范围：上书房下旨、丞相路由、军机处编排、六部回奏、丞相决策建议  
> 事实源：后端运行服务；前端只展示后端契约，不新增 BFF，不在前端复制路由和裁决逻辑

## 1. 方案摘要

本方案把“超级丞相”建设成朝堂 OS 的唯一任务决策中枢，但不把所有能力塞进一个大模型提示词。系统采用“确定性规则守底线、模型理解语义、能力地图约束选择、反事实评审检查路线、结果回执驱动学习”的组合架构。

丞相承担两个严格分离的阶段：

1. **下旨路由阶段**：理解用户目标，判断简单任务或复杂任务，选择主责部门、参审部门和 Agent，解释理由并启动执行；不输出经营决策建议。
2. **回奏决策阶段**：在真实部门回奏和证据齐备后，综合分歧、风险和质量门，给出多个决策选项并明确最推荐的一项。

目标主链：

```text
用户输入 / 润色
  -> 用户确认下旨正文
  -> 圣意理解
  -> 硬规则与风险门
  -> 能力地图召回候选部门和 Agent
  -> 生成 direct / council 候选路线
  -> 反事实检查与路线裁定
  -> 落库下旨记录和路由快照
  -> 异步派单与状态流转
  -> 部门真实回奏
  -> 军机处汇总
  -> 丞相综合分析与多方案建议
  -> 皇上裁决
  -> 史馆记录结果并反哺后续路由
```

## 2. 当前基线与核心问题

当前上书房正式下旨主链使用 `backend/src/shangshufang_loop.py` 中的确定性规则：

- `infer_departments()` 通过关键词选择部门，无匹配时默认户部、工部。
- `chancellor_decide_route()` 根据明确会审词、高风险、部门数量和证据缺口输出 `direct` 或 `cluster`。
- `DIRECT_AGENT_MAP` 使用固定部门到 Agent 的映射。
- `confirm-edict` 优先读取客户端回传拟旨中的 `route`，路由不是根据最终确认正文重新生成。
- 复杂任务确认后记录为 `edict_recorded`，但当前没有自动消费 `await_async_memorial` 的后台执行链；只有显式调用 `swarm-deepen` 才继续。
- 前端 `confirmedEdictToView()` 会在部门尚未真实回奏时，本地重新运行六部评审、御史审计和统一决策逻辑，导致页面建议与后端事实源混合。

项目还存在 `backend/src/chancellor_router.py` 的另一套路由器，具备部门打分、军机处阈值、部门内蜂群选择和弃权能力，但服务于不同路径，尚未与上书房正式下旨收敛。

因此当前系统具备双轨路由雏形，但缺少：

- 对用户真实目标、限制条件和期望结果的结构化理解。
- 对 Agent 实际能力、工具、权限、可用性、成本和历史质量的感知。
- 多条路线比较、反事实检查和低置信度处理。
- 下旨后自动派单、持续状态追踪和动态改道。
- 基于真实回奏的多方案丞相建议及首选方案。
- 以最终业务结果为依据的学习闭环。

## 3. 目标与非目标

### 3.1 目标

- 后端只有一个权威 `ChancellorRoutingService`，统一上书房正式下旨的路由事实。
- 对外保持简单任务与复杂任务两条产品路径：`direct` 和 `council`。
- 每次路由必须输出理由、证据、置信度、风险、缺证、主责和协同关系。
- 下旨接口只生成下旨记录和路由回执，不伪造部门回奏或提前给最终建议。
- 复杂任务提交后自动进入后台执行，不依赖前端再次调用 `swarm-deepen`。
- 状态接口可以回答“圣旨当前在哪里、谁在处理、为什么阻塞、下一步是什么”。
- 真实回奏完成后，丞相生成 3 至 5 个可比较方案并标记首选方案。
- 路由、执行、裁决和最终结果可追溯、可评测、可回滚。

### 3.2 非目标

- 不允许丞相绕过付款、合同、证券、对外承诺等硬风险门。
- 不允许模型直接执行付款、签约、发布、删除等不可逆动作。
- 不新增 Next.js BFF、前端 route handler 或前端服务端业务代理。
- 不在首期实现完全自动化的长期用户心理画像。
- 不用前端本地规则生成 LIVE 部门结论或丞相建议。
- 不要求一次性替换所有历史蜂群和部门实现。

## 4. 领域职责

| 角色 | 职责 | 不负责 |
| --- | --- | --- |
| 皇上/用户 | 提出目标、确认下旨、最终裁决 | 选择具体蜂群和技术实现 |
| 丞相路由 | 理解目标、设计路线、选择主责与参审、解释理由 | 伪造部门执行结果 |
| 军机处 | 拆解复杂任务、派单、跟踪、汇总分歧 | 代替皇上做最终裁决 |
| 六部/专业 Agent | 在职责与工具边界内产出证据和分奏 | 擅自扩大任务或越权执行 |
| 御史/质量门 | 检查证据、风险、来源和不可逆动作 | 生成业务事实 |
| 丞相综合分析 | 基于真实回奏形成多方案建议 | 在回奏前提前给最终建议 |
| 史馆 | 保存路线、结果、反馈和可复用经验 | 用无结果的旧案训练错误偏好 |

## 5. 总体技术架构

```text
FastAPI /api/shangshufang
  |
  +-- ConfirmedEdictNormalizer
  |     统一原问、最终正文、附件、租户、权限和 source label
  |
  +-- IntentUnderstandingService
  |     输出显式目标、潜在目标、约束、期望交付、歧义和置信度
  |
  +-- ChancellorPolicyEngine
  |     证券/付款/合同/签字/隐私/对外承诺等确定性硬门
  |
  +-- CapabilityRegistry
  |     部门、Agent、工具、权限、成本、延迟、可用性和质量指标
  |
  +-- RouteCandidateGenerator
  |     生成 direct、council、先采证后会审等内部候选路线
  |
  +-- RouteCritic
  |     反事实检查、漏部检查、过度会审检查、风险检查
  |
  +-- ChancellorRoutingService
  |     选择最终路线，写入不可变 decision snapshot
  |
  +-- Outbox / TaskDispatcher
  |     事务提交后自动派单，支持重试、幂等和失败恢复
  |
  +-- JunjichuOrchestrator / DirectExecutor
  |     复杂任务编排 / 简单任务执行
  |
  +-- ChancellorSynthesisService
        基于真实回奏生成分析、多方案、首选方案和理由
```

### 5.1 设计原则

1. **一个事实源**：路由和建议由后端生成并落库，前端只消费契约。
2. **模型不是最终权限**：模型负责语义理解和候选生成，硬规则和 Schema 负责约束。
3. **先记录再执行**：确认下旨先事务落库，再通过 outbox 异步执行，避免接口超时和重复执行。
4. **不确定必须可见**：低置信度、缺证和能力不足必须结构化返回，不能用流畅文案掩盖。
5. **建议必须后置**：没有真实回奏时，只能展示路由理由和执行计划。

## 6. 核心模块设计

### 6.1 圣意理解器 `IntentUnderstandingService`

输入：

- 用户原问。
- 用户确认后的圣旨正文。
- 附件摘要和证据元数据。
- 租户允许使用的用户偏好。
- 当前会话上下文。

输出：

```json
{
  "explicit_goal": "评估是否与目标公司合作",
  "latent_goals": ["验证业绩真实性", "控制投入和合同风险"],
  "desired_deliverable": "可供老板裁决的合作评估奏折",
  "constraints": ["本周内完成", "不得自动签约"],
  "stakes": "high",
  "reversibility": "low",
  "ambiguities": ["未说明可接受投入上限"],
  "clarifying_question": "本次是否已有预算上限和合同草案？",
  "confidence": 0.82,
  "source_label": "LIVE"
}
```

处理规则：

- 只有当歧义会改变 `direct/council`、硬风险门或主责部门时才追问。
- 每轮最多提出一个高信息增益问题。
- 用户不回答时，允许按保守路线继续，但必须把假设写入 `assumptions`。
- 模型输出必须通过 JSON Schema；解析失败进入确定性降级，不允许空结果继续。

### 6.2 朝堂能力地图 `CapabilityRegistry`

能力注册以数据契约为事实源，不从提示词中临时猜测。每个 Agent 至少登记：

```json
{
  "agent_id": "hubu_finance_agent",
  "department": "户部",
  "capabilities": ["budget_review", "cashflow_analysis", "roi_analysis"],
  "tools": ["finance_ledger_read", "quote_history_read"],
  "data_scopes": ["tenant_finance_read"],
  "prohibited_actions": ["payment_execute"],
  "availability": "available",
  "estimated_latency_ms": 120000,
  "estimated_cost_units": 2.5,
  "quality_score": 0.91,
  "minimum_evidence": ["budget_or_quote"],
  "version": "1.0.0"
}
```

注册表首期可以由版本化 YAML/JSON 加运行时健康状态组成，后续再迁移到数据库。路由必须保存本次使用的能力快照版本，保证事后可解释。

### 6.3 硬规则与风险门 `ChancellorPolicyEngine`

硬规则在模型调用前后各执行一次：

- 前置检查确定不可绕过的部门、人工确认和禁止动作。
- 后置检查验证模型生成的路线是否覆盖强制部门和约束。

首期强制规则：

| 风险 | 处理 |
| --- | --- |
| 证券买卖、具体投资操作 | 进入受限咨询路径，禁止自动交易，保留人工确认 |
| 付款、回款、预算超限 | 户部必须参与，不得自动付款 |
| 合同、签字、股权、赔偿 | 刑部必须参与，最终动作人工确认 |
| 正式报价、公开发布、客户承诺 | 礼部/兵部按业务参与，刑部检查责任边界 |
| 个人隐私、敏感数据 | 校验权限和最小披露，不满足则阻断 |
| 删除、发布、签约等不可逆动作 | 只生成建议和待确认动作，不直接执行 |

### 6.4 候选路线生成 `RouteCandidateGenerator`

系统对外仍只有两种模式，但内部至少比较三类候选：

1. `direct`：单一主责 Agent 直接承办。
2. `council`：军机处组织多个部门并行或串行会审。
3. `evidence_first`：内部属于 `council`，先由锦衣卫或数据 Agent 采证，再决定完整参审范围。

每条候选路线计算：

```text
route_score =
  任务覆盖度 * 0.30
  + 风险覆盖度 * 0.25
  + 证据可得性 * 0.15
  + 历史成功先验 * 0.10
  + 可解释性 * 0.05
  - 成本 * 0.05
  - 延迟 * 0.05
  - 不必要部门惩罚 * 0.05
```

权重首期写入版本化配置并通过黄金样例校准，不允许模型自行修改。

### 6.5 反事实评审 `RouteCritic`

最终裁定前必须回答：

- 不选择某个关键部门会漏掉什么？
- 选择所有部门是否属于过度会审？
- 当前主责部门是否拥有完成任务所需的真实能力和权限？
- 当前证据是否足够直接执行，还是应先采证？
- 路线是否违反硬规则？
- 如果主 Agent 不可用，替代路线是什么？

输出：

```json
{
  "missing_coverage": [],
  "over_routing": ["吏部当前无必要参与"],
  "policy_violations": [],
  "counterfactuals": [
    {
      "excluded_department": "刑部",
      "impact": "无法验证合同责任与业绩承诺",
      "severity": "high"
    }
  ],
  "passed": true
}
```

### 6.6 丞相裁定 `ChancellorRoutingService`

职责：

- 编排圣意理解、规则、能力召回、候选生成和评审。
- 只接受后端重新规范化的最终圣旨，不信任客户端回传的路由结果。
- 生成不可变的 `RouteDecisionV2` 快照。
- 使用幂等键防止重复下旨产生多个执行任务。
- 决定 `direct` 或 `council`，但不生成最终经营建议。

低置信度策略：

| 情况 | 处理 |
| --- | --- |
| 目标明确、低风险、单能力覆盖 | `direct` |
| 高风险或不可逆 | 强制 `council` / 人工确认 |
| 证据缺失但可先采集 | `council + evidence_first` |
| 语义歧义会改变路线 | 返回一个澄清问题，暂不派单 |
| Agent 无能力或不可用 | 明确 `capability_blocked`，不得假装已执行 |

### 6.7 自动派单与动态改道

`confirm-edict` 在同一数据库事务中写入：

- 下旨记录。
- 路由快照。
- 初始任务状态。
- outbox 事件。

事务提交后由 worker 消费 outbox：

```text
route.direct  -> DirectExecutor
route.council -> JunjichuOrchestrator
```

worker 必须支持：

- 幂等消费。
- 指数退避重试。
- 最大重试次数和死信状态。
- 单部门失败不丢失其他部门结果。
- 超时后写入明确阻塞原因。
- 用户取消或重新下旨时停止旧任务。

执行过程中出现新风险时，允许创建新的 `RouteDecisionV2`，通过 `supersedes_decision_id` 指向旧路线。旧记录不得覆盖，以便审计。

### 6.8 回奏后的丞相综合 `ChancellorSynthesisService`

触发条件：

- 所有必需部门已回奏，或达到截止时间并明确记录缺席部门。
- 御史质量门已完成。
- 回奏带来源、证据、风险和缺证字段。

输出 `ChancellorAdviceV1`：

```json
{
  "task_id": "task_xxx",
  "analysis": "项目具备试点条件，但付款和合同责任尚未闭合。",
  "options": [
    {
      "id": "conditional_pilot",
      "title": "有条件试点",
      "benefits": ["保留市场窗口", "控制首期投入"],
      "risks": ["合同仍需修改"],
      "conditions": ["首付款不超过预算上限", "刑部确认违约责任"],
      "next_actions": ["户部确认预算", "刑部出具条款意见"],
      "evidence_refs": ["evidence_hubu_01", "evidence_xingbu_02"]
    }
  ],
  "recommended_option_id": "conditional_pilot",
  "recommendation_reason": "该方案在保留机会的同时覆盖主要风险。",
  "dissent": ["兵部认为市场窗口可能早于合同完成"],
  "confidence": 0.84,
  "human_confirmation_required": true,
  "source_label": "LIVE"
}
```

约束：

- 必须给出 3 至 5 个真正不同的选项；证据不足时可以只有“补证、暂缓”等受限选项。
- 每个建议必须引用真实回奏或证据 ID。
- 必须明确首选项和不选其他方案的核心原因。
- 部门存在重大分歧时必须保留 `dissent`，不能只输出统一口径。

### 6.9 结果学习与皇帝画像

首期只记录，不自动改变路由权重：

- 路由选择。
- 用户最终裁决。
- 部门实际贡献。
- 执行成本和耗时。
- 任务结果和后续回执。
- 用户对建议的采纳、驳回和修正。

后续在样本足够时生成可审计偏好：

```json
{
  "preference": "重大合作优先小范围试点",
  "evidence_count": 6,
  "confidence": 0.78,
  "last_confirmed_at": "2026-07-10T10:00:00Z",
  "expires_at": "2026-10-10T10:00:00Z",
  "user_editable": true
}
```

禁止从单次对话推断长期偏好；禁止推断政治、健康等不必要的敏感属性；用户必须能够查看、纠正和删除画像。

## 7. 核心数据契约

### 7.1 `RouteDecisionV2`

```ts
type RouteMode = 'direct' | 'council';

interface RouteDecisionV2 {
  schema_version: 'RouteDecisionV2';
  decision_id: string;
  task_id: string;
  mode: RouteMode;
  strategy: 'single_agent' | 'parallel_review' | 'serial_review' | 'evidence_first';
  decided_by: 'chancellor';
  primary_department: string;
  primary_agent: string | null;
  participants: Array<{
    department: string;
    agent_id: string | null;
    role: 'primary' | 'reviewer' | 'evidence_collector';
    reason: string;
    required: boolean;
    status: 'planned' | 'unavailable';
  }>;
  reason_summary: string;
  complexity_score: number;
  complexity_reasons: string[];
  risk_flags: string[];
  evidence_gaps: string[];
  assumptions: string[];
  confidence: number;
  policy_hits: string[];
  human_confirmation_required: boolean;
  capability_snapshot_version: string;
  prompt_version: string | null;
  source_label: 'LIVE' | 'MIXED' | 'FALLBACK' | 'DEMO';
  created_at: string;
  supersedes_decision_id: string | null;
}
```

### 7.2 状态契约

```ts
interface DecreeExecutionStatusV1 {
  schema_version: 'DecreeExecutionStatusV1';
  task_id: string;
  current_stage: string;
  current_owner: string;
  latest_message: string;
  next_stage: string | null;
  blocked_reason: string | null;
  route_decision: RouteDecisionV2;
  departments: Array<{
    department: string;
    agent_id: string | null;
    status: 'planned' | 'accepted' | 'executing' | 'reported' | 'blocked' | 'skipped';
    latest_message: string;
    started_at: string | null;
    completed_at: string | null;
  }>;
  timeline: Array<{
    event_id: string;
    stage: string;
    actor: string;
    message: string;
    occurred_at: string;
  }>;
}
```

## 8. 状态机

```text
drafting
  -> awaiting_emperor_confirm
  -> edict_recorded
  -> chancellor_routing
  -> routed_direct | routed_council | awaiting_clarification | capability_blocked
  -> dispatched
  -> executing
  -> department_reporting
  -> junjichu_synthesizing        (仅 council)
  -> chancellor_synthesizing
  -> awaiting_emperor_decision
  -> completed | awaiting_evidence | rejected | cancelled
```

状态要求：

- 每次状态变化写入事件表，不只覆盖主表字段。
- `current_owner` 必须是军机处、具体部门或具体 Agent，不能只写 `reviewing`。
- 终态和阻塞态必须包含人类可读说明。
- 状态接口允许轮询；后续可以增加 SSE，但 SSE 不是首期必需条件。

## 9. 数据存储建议

在现有 `DecisionTask`、`CourtReview`、`CourtLoopRun` 基础上增量建设：

| 表/实体 | 用途 |
| --- | --- |
| `chancellor_route_decisions` | 保存不可变路由快照和版本关系 |
| `decree_execution_events` | 保存状态时间线和当前责任人变化 |
| `department_assignments` | 保存部门/Agent 派单、状态、重试和回奏引用 |
| `agent_capabilities` 或版本化配置 | 保存 Agent 能力、工具、权限和版本 |
| `chancellor_advice` | 保存回奏后的多方案建议 |
| `task_outcomes` | 保存最终结果、用户反馈和学习标签 |
| `outbox_events` | 确保下旨落库与异步派单一致 |

数据库迁移必须兼容现有记录；旧记录读取时通过 adapter 补默认字段，不批量伪造历史路由理由。

## 10. API 设计与兼容策略

继续使用后端 canonical API，不新增前端 BFF。

### 10.1 拟旨

`POST /api/shangshufang/draft-edict`

- 只返回拟旨、初步风险提示和可选的“预判路线”。
- 预判结果标记为 `provisional`，不能作为最终执行依据。
- 润色只修改正文，不启动路由和执行。

### 10.2 确认下旨

`POST /api/shangshufang/confirm-edict`

请求以最终确认正文为准：

```json
{
  "task_id": "task_xxx",
  "confirmed": true,
  "confirmed_edict_text": "最终圣旨正文",
  "idempotency_key": "client-generated-key"
}
```

响应：

```json
{
  "task_id": "task_xxx",
  "status": "edict_recorded",
  "decree_record": {},
  "route_decision": {},
  "status_url": "/api/shangshufang/tasks/task_xxx/status"
}
```

接口不等待蜂群回奏，也不返回模板奏折作为真实回奏。

### 10.3 状态查询

`GET /api/shangshufang/tasks/{task_id}/status`

返回 `DecreeExecutionStatusV1`，支持 `ETag` 或 `updated_at`，降低轮询成本。

### 10.4 回奏与建议

- `GET /api/shangshufang/tasks/{task_id}/memorial`：只在真实回奏存在时返回。
- `GET /api/shangshufang/tasks/{task_id}/chancellor-advice`：返回 `ChancellorAdviceV1`。
- `POST /api/shangshufang/tasks/{task_id}/decision`：皇上采纳、补证、复核、驳回或归档。

`swarm-deepen` 在新链路稳定后降为运维重试/人工深挖能力，不再承担确认下旨后的正常启动职责。

## 11. 前端对接要求

本方案不要求重做页面布局，只调整数据职责和展示时机：

1. 确认下旨后，卷轴先展示圣旨正文和路由回执。
2. 展示丞相路线理由、主责部门、协同部门和风险，不展示最终决策建议。
3. 根据状态接口展示当前机构、当前 Agent、部门进度和阻塞原因。
4. `direct` 不显示“军机处接旨”或“进入军机处”。
5. `council` 才显示军机处编排和参审部门。
6. 真实回奏完成后，才切换到奏折、丞相分析和决策建议。
7. 删除或停用前端对 LIVE 数据运行 `runMinistryReview()`、`synthesizeImperialReport()`、`runCourtUnifiedDecisionLoop()` 的路径；这些函数只能保留为明确的 DEMO/FALLBACK 或测试能力。

## 12. 模型与提示词策略

### 12.1 模型使用位置

| 模块 | 是否使用模型 | 失败降级 |
| --- | --- | --- |
| 圣意理解 | 是 | 关键词/结构化规则 + 明确低置信度 |
| 硬风险门 | 否 | 必须确定性执行 |
| 能力召回 | 可选 embedding，不依赖生成模型 | 结构化能力标签匹配 |
| 候选路线 | 是 | 确定性 direct/council 规则 |
| 反事实评审 | 是 | 硬规则覆盖检查 |
| 最终路由裁定 | 组合 | 规则可以否决模型 |
| 回奏综合建议 | 是 | 无模型时只返回结构化事实和“暂不建议” |

### 12.2 运行要求

- 所有模型调用记录 `model`、`prompt_version`、耗时、token、重试和降级原因。
- 严格 JSON Schema；禁止从自由文本正则抽取关键路由字段。
- 模型超时不能让确认下旨返回 500；应进入可解释降级路线。
- 提示词不得包含未授权的跨租户历史数据。
- 生产默认禁止把 FALLBACK 输出标记为 LIVE。

## 13. 可观测性与指标

首期必须记录：

- 路由模式分布：`direct/council`。
- 路由耗时 P50/P95。
- 模型成功率、Schema 失败率、降级率。
- 人工改道率。
- 过度会审率：参审但无有效贡献的部门比例。
- 漏路由率：执行中因新风险追加关键部门的比例。
- 下旨到首个部门接单耗时。
- 部门完成率、超时率和重试次数。
- 丞相建议采纳率及用户修改率。
- 结果回执覆盖率。

建议初期目标：

| 指标 | 首期目标 |
| --- | ---: |
| 确认下旨接口成功率 | >= 99% |
| 路由 Schema 有效率 | >= 99.5% |
| 下旨到派单 P95 | <= 10 秒 |
| 高风险强制部门覆盖率 | 100% |
| 前端 LIVE 本地裁决生成 | 0 |
| 状态事件可追溯率 | 100% |

## 14. 分阶段实施计划

### 阶段 0：契约冻结与黄金样例，1-2 人日

交付：

- 冻结 `RouteDecisionV2`、`DecreeExecutionStatusV1`、`ChancellorAdviceV1`。
- 建立至少 30 个黄金案例：简单任务、跨部门、高风险、缺证、证券、能力不可用和歧义任务。
- 为当前两套路由器建立对照输出，记录不一致，不立即删除旧实现。

验收：

- 每个案例有期望模式、必选部门、禁止部门、风险门和理由断言。
- 契约通过 JSON Schema 和前后端类型检查。

### 阶段 1：统一后端路由事实源，3-5 人日

交付：

- 新增 `ChancellorRoutingService`。
- 收敛 `chancellor_decide_route()` 与 `chancellor_router.decide()` 的公共规则和能力选择。
- `confirm-edict` 根据后端最终正文重新路由，不信任客户端 `route`。
- 写入路由快照和版本。
- 保持旧响应字段一段兼容期，同时返回 V2 字段。

验收：

- 简单任务只选择一个主责 Agent。
- 高风险任务覆盖强制部门。
- 同一幂等键不会重复立案。
- 模型不可用时仍能得到可解释的确定性路线。

### 阶段 2：异步派单与真实状态，4-6 人日

交付：

- outbox、worker、部门派单和事件时间线。
- `direct` 与 `council` 自动启动。
- 状态接口返回当前 owner、部门状态和阻塞原因。
- `swarm-deepen` 退出正常主链。

验收：

- 确认接口快速返回，不同步等待模型/蜂群长任务。
- worker 重启后未完成任务可以继续。
- 重复消费不产生重复部门任务。
- 页面可以仅靠状态接口还原完整流转。

### 阶段 3：圣意理解、能力地图和三策推演，5-8 人日

交付：

- 圣意理解 Schema、模型适配器和降级实现。
- 版本化能力注册表与运行时可用状态。
- 候选路线评分和反事实评审。
- 澄清问题和 `capability_blocked` 状态。

验收：

- 隐含风险案例不只依赖关键词。
- Agent 不可用或无权限时不会被选为可执行主责。
- 能解释为何选择和为何不选择关键部门。
- 低置信度输出不会伪装成确定判断。

### 阶段 4：真实回奏后的丞相多方案建议，4-6 人日

交付：

- `ChancellorSynthesisService`。
- 3 至 5 个建议、首选方案、证据引用和分歧保留。
- 回奏前禁止生成正式建议的后端门禁。
- 前端停止对 LIVE 数据本地合成丞相结论。

验收：

- 每条建议可追溯到奏折或证据 ID。
- 建议明确收益、风险、条件和下一步。
- 必须标记首选项；证据不足时不得输出无条件准奏。

### 阶段 5：动态改道与结果学习，7-10 人日

交付：

- 新风险触发重新路由，保留决策版本链。
- 任务结果、部门贡献和用户反馈入史馆。
- 影子模式计算历史成功先验，不直接自动修改生产权重。
- 用户可查看和纠正偏好画像。

验收：

- 动态改道可解释且不覆盖旧路线。
- 没有结果回执的案例不能提高路线权重。
- 偏好可删除、可过期、可追溯。

## 15. 预期代码改动范围

后端建议新增：

```text
backend/src/chancellor/
  contracts.py
  intent_service.py
  policy_engine.py
  capability_registry.py
  candidate_generator.py
  route_critic.py
  routing_service.py
  synthesis_service.py
  outcome_learning.py
backend/src/execution/
  decree_dispatcher.py
  outbox_worker.py
```

后端建议修改：

- `backend/web/routers/shangshufang.py`
- `backend/src/shangshufang_loop.py`
- `backend/src/chancellor_router.py`
- `backend/src/db/models.py`
- `backend/src/swarm_execution_loop.py`
- 对应数据库迁移、Schema、harness 和测试文件。

前端建议修改但不重做 UI：

- `frontend/src/lib/jiqun-api.ts`
- `frontend/src/lib/contracts/shangshufang.ts`
- `frontend/src/features/shangshufang/ShangshufangPage.tsx`
- `frontend/src/features/shangshufang/components/MemorialScroll.tsx`
- 状态轮询/订阅 hook 和对应契约测试。

## 16. 测试与验证矩阵

| 层级 | 重点 |
| --- | --- |
| 纯函数单测 | 风险门、复杂度、能力匹配、评分、反事实检查 |
| 合同测试 | API 路径、Envelope、Schema、source label、前端类型 |
| 路由黄金样例 | 模式、必选部门、禁止部门、风险和原因 |
| Worker 集成测试 | 幂等、重试、死信、恢复、动态改道 |
| 模型评测 | 语义理解准确率、歧义识别、Schema 有效率、幻觉率 |
| 浏览器 E2E | 下旨、路由回执、状态推进、回奏、建议、裁决 |
| 安全测试 | 越权工具、跨租户数据、提示注入、不可逆动作阻断 |

建议验证命令：

```powershell
cd backend
python -m pytest -q tests/test_shangshufang_loop_api.py
python -m pytest -q tests/test_chancellor_routing.py tests/test_chancellor_synthesis.py
python scripts/harness_doctor.py

cd ../frontend
pnpm exec tsc --noEmit
pnpm test:node
pnpm playwright test e2e/shangshufang*.spec.ts

cd ..
node scripts/harness-doctor.mjs
```

新增测试文件名以实际实现为准；命令应在对应阶段进入 CI。

## 17. 上线与回滚

### 17.1 Feature Flags

建议使用后端开关：

- `CHANCELLOR_ROUTING_V2_ENABLED`
- `CHANCELLOR_ROUTING_SHADOW_MODE`
- `CHANCELLOR_ASYNC_DISPATCH_ENABLED`
- `CHANCELLOR_SYNTHESIS_V1_ENABLED`
- `CHANCELLOR_DYNAMIC_REROUTE_ENABLED`

### 17.2 上线顺序

1. 影子模式：V2 只计算不执行，与旧路由对比。
2. 内部租户：V2 生成路线，旧逻辑保留回滚能力。
3. 小流量：开启异步派单和状态事件。
4. 全量：V2 成为唯一事实源，停止客户端 route 信任。
5. 稳定后：移除旧路由兼容字段和前端本地 LIVE 裁决路径。

### 17.3 回滚原则

- 关闭 V2 开关后回到确定性规则路由。
- 已创建的 V2 路由快照和事件不得删除。
- worker 可以停止消费，但不得把执行中的任务标成成功。
- 回滚期间前端继续通过兼容 adapter 展示旧字段。

## 18. 主要风险与权衡

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| 模型误解用户意图 | 错路由 | 硬规则、置信度、单个高价值追问、影子评测 |
| 过度会审 | 成本和延迟上升 | 不必要部门惩罚、反事实检查、贡献率指标 |
| 漏掉关键部门 | 风险失控 | 强制部门规则、动态改道、黄金样例 |
| 能力注册过期 | 选中不可用 Agent | 运行时健康检查、快照版本、替代路线 |
| 异步任务重复 | 重复执行和成本 | outbox、幂等键、唯一约束 |
| 建议看似完整但无证据 | 误导用户 | 证据引用强制门、source label、回奏前禁止建议 |
| 用户画像过拟合 | 错误迎合 | 样本阈值、过期、可编辑、首期只记录不自动调权 |

## 19. Definition of Done

本方案完成的最低标准：

- 后端存在唯一权威丞相路由服务。
- 最终路由基于用户确认后的圣旨正文生成。
- 简单任务直接派给单 Agent，复杂任务由军机处组织部门执行。
- 硬风险不能被模型或客户端绕过。
- 确认下旨只返回记录和路由，不等待回奏，不提前生成最终建议。
- 后台能够自动派单并可靠推进状态。
- 状态接口可以完整说明当前责任人和部门进度。
- 丞相建议只基于真实回奏生成，包含多个方案和明确首选。
- 前端不再为 LIVE 任务本地生成业务裁决。
- 路由、执行、建议、裁决和结果均可审计并有测试证据。

## 20. 推荐首个迭代

第一迭代不要直接建设完整用户画像和自学习。建议只交付：

1. `RouteDecisionV2` 契约和 30 个黄金案例。
2. 唯一 `ChancellorRoutingService`。
3. 根据最终圣旨重新路由，停止信任客户端 `route`。
4. 确认下旨写 outbox，后台自动派单。
5. 可展示当前 owner 和部门状态的状态接口。
6. 回奏前不生成丞相建议的硬门。

完成这六项后，当前流程会先从“看起来聪明”变成“顺序正确、事实真实、状态可追踪”。再加入圣意理解、三策推演和结果学习，智能程度才会建立在可靠闭环之上。
