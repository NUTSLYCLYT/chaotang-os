# CapabilityRegistry V1 contract

状态：`READINESS_ONLY`

## 1. 产品定位

CapabilityRegistry V1 是朝堂能力总账的只读治理层。它把分散的 Skill、Agent、蜂群、Workflow、
MCP、插件、Prompt、模板、印版和外部工具统一成可解释、可审计、可晋升、可裁撤的能力视图。

它服务五个核心消费方：

1. 丞相能力路由：选择当前任务最合适的部门、司、能力或项目组。
2. 军机处项目组编排：为复杂目标组建临时项目组，展示成员、责任、缺口和验收。
3. 翰林院荐才榜：收纳可复用 Prompt、模板、方法论、印版和知识包。
4. 吏部能力考绩：评价能力真实使用效果，建议晋升、合并、降级或裁撤。
5. 鸿胪寺外部能力候选：管理 MCP、插件、API、外部模型、外部 Agent 和自动化工具的准入。

V1 不创建第二套 Agent 系统，不创建第二套任务事实源，不绕过既有丞相、军机处、六部、锦衣卫、史馆
和 Harness 主链。

## 2. Schema ownership

### 2.1 Schema owner

`CapabilityRegistry V1` 的 schema owner 应归根 `.harness/` 与后端运行契约共同治理：

- 根 `.harness/changes/`：记录治理契约、权限边界和后续 candidate 范围。
- 后端 `backend/app/agents/runtime_skills/`：保留运行技能与司级工具策略的 canonical runtime
  truth。
- 后端 `backend/app/jinyiwei/mcp/`：保留外部 MCP 工具的 canonical external source truth。
- 后端 `backend/harness/capability_candidates/`：保留 capability candidate / capsule / lock 的候选
  事实。
- 前端 `frontend/src/features/*-visual/`：只消费投影，不成为事实源。

### 2.2 Canonical writer

V1 的 canonical writer 必须是确定性代码或受控配置，不允许普通 Agent 自行写入：

- 内部 runtime skill：由代码中的 registry 和测试维护。
- 司级 capability profile：由代码中的静态 profile 和验证函数维护。
- MCP / API / 外部工具：由鸿胪寺候选和锦衣卫 MCP registry 维护，刑部复核高风险项。
- Prompt / 模板 / 印版 / 知识包：由翰林院入库流程维护，必须保留来源和真实复用记录。
- 能力晋升/降级/裁撤：由吏部考绩流程产出建议，Owner 或受控 authority 批准后才变更状态。

Agent 可以提出候选、解释证据、生成建议，但不能直接改余额、权限、分润、晋升结论、部署状态或外部
授权。

### 2.3 Read-only projection sources

V1 首批只读投影来源建议为：

| 来源 | 文件/模块 | 投影内容 | V1 状态 |
| --- | --- | --- | --- |
| Runtime Skill Registry | `backend/app/agents/runtime_skills/registry.py` | 军机处、六部、39 个司级技能 | 真实内部能力 |
| Bureau Profiles | `backend/app/agents/bureaus/profiles.py` | 六部各司身份与职责 | 真实组织目录 |
| Capability Profiles | `backend/app/agents/bureaus/capabilities.py` | 已绑定司级能力包 | 真实内部能力包 |
| Bureau Tool Policy | `backend/app/agents/runtime_skills/tool_registry.py` | 司级工具权限策略 | 真实安全边界 |
| Jinyiwei MCP Registry | `backend/app/jinyiwei/mcp/registry.py` | 外部 MCP 注册与 fingerprint | 真实外部能力边界 |
| MCP Config | `backend/config/jinyiwei_mcp.yaml` | 已批准只读 MCP server/tool | 真实外部能力 |
| Capability Candidates | `backend/harness/capability_candidates/` | 候选胶囊、锁定、manifest | 候选能力 |
| Honglusi Visual Registry | `frontend/src/features/honglusi-visual/honglusiRegistry.ts` | 外部能力展示样例 | DEMO，不得当事实 |
| Junjichu Cases | `backend/app/junjichu_cases/` 与 `frontend/src/features/junjichu-visual/` | 项目组与任务状态入口 | 后续关联 |
| Court Visuals | `frontend/src/features/court-visuals/` | 能力按钮、沉浸式壳层 | 只消费 UI 投影 |

若其他分支或未来基线存在 `jiqun_registry`、`swarm_orchestrator`、`provider_policy`、`skill-ledger`、
`promotion-review`、`minister_personas` 等结构，V1 可在 product candidate 中按同一投影规则接入；
本 readiness 包不假定这些文件已经存在于当前 `f1682812` 基线。

## 3. Final data contracts

### 3.1 CapabilityRegistryItem

`CapabilityRegistryItem` 是总账列表中的最小机器对象。

```json
{
  "id": "string",
  "name": "string",
  "type": "skill|agent|swarm|workflow|mcp|plugin|api|template|prompt|imprint|external_tool|candidate",
  "source": "runtime|hanlin|honglusi|jinyiwei|junjichu|shiguan|user_contribution|external|demo",
  "canonicalSourceRef": "string",
  "homeDepartment": "chengxiang|junjichu|hanlin|honglusi|libu|hubu|libu_rites|bingbu|xingbu|gongbu|jinyiwei|qintianjian|shiguan|neiwufu|unassigned",
  "homeOffice": "string|null",
  "status": "demo|draft|trial|approved|blocked|retired",
  "activationState": "inactive|sandbox|readonly|active",
  "riskLevel": "low|medium|high|critical",
  "costLevel": "low|medium|high|unknown",
  "permissionLevel": "none|readonly|draft|write_pending_approval|external_action_blocked",
  "dataExposure": ["none|public|tenant_private|credential|financial|personal|regulated"],
  "bestUseCases": ["string"],
  "inputNeeded": ["string"],
  "outputProduced": ["string"],
  "evidenceRefs": ["string"],
  "lastVerifiedAt": "string|null",
  "evaluationSummary": {
    "sampleCount": 0,
    "scored": false,
    "label": "insufficient_samples|reference_only|scored",
    "successRate": null,
    "qualityDelta": null,
    "costDelta": null,
    "latencyDelta": null
  },
  "recommendedAction": "do_not_admit|keep_in_hanlin|use_for_project|trial_temporary_office|merge_into_existing_office|promote_to_standing_office|retire",
  "notes": "string"
}
```

约束：

- `id` 必须稳定、唯一、可追溯。
- `canonicalSourceRef` 必须指向真实文件、配置、胶囊、史馆记录或明确 DEMO 来源。
- `status=demo` 的能力不得被路由为真实能力。
- `activationState=inactive` 的能力必须零权限。
- `sampleCount < 3` 时不得显示权威评分，只能显示资料不足或参考标签。
- 外部能力若 `riskLevel=high|critical`，必须 `permissionLevel` 不高于
  `write_pending_approval` 且需要刑部复核。

### 3.2 CapabilityCard

`CapabilityCard` 是面向用户和运营的解释对象。

```json
{
  "id": "string",
  "name": "string",
  "type": "skill|agent|swarm|workflow|mcp|plugin|api|template|prompt|imprint|external_tool|candidate",
  "source": "internal|honglusi|hanlin|jinyiwei|junjichu|shiguan|user_contribution|external|demo",
  "displayHome": "string",
  "bestUseCase": "string",
  "plainValue": "string",
  "inputNeeded": ["string"],
  "outputProduced": ["string"],
  "riskLevel": "low|medium|high|critical",
  "costLevel": "low|medium|high|unknown",
  "reusePotential": "low|medium|high|unknown",
  "recommendedHome": "hanlin|honglusi|junjichu|gongbu|hubu|libu|xingbu|bingbu|jinyiwei|qintianjian|shiguan|neiwufu|keep_external|unassigned",
  "status": "demo|draft|trial|approved|blocked|retired",
  "whyThisStatus": "string",
  "nextStep": "string",
  "evidenceRefs": ["string"]
}
```

约束：

- `plainValue` 必须让小白用户一眼看懂“它能帮我干什么”。
- `whyThisStatus` 必须解释为什么不能直接启用、为什么只能只读或为什么建议晋升。
- `nextStep` 只能是平台内受控动作，例如“请丞相发起试用”“提交翰林院审核”“请求刑部复核”。

### 3.3 AgentPersonaCard

`AgentPersonaCard` 统一各角色人格，但人格不能掩盖事实、权限和不确定性。

```json
{
  "agentId": "string",
  "displayName": "string",
  "role": "string",
  "voice": "string",
  "humorLevel": 0,
  "decisionStyle": "string",
  "forbiddenBehavior": ["string"],
  "defaultOpening": "string",
  "evolutionGoal": "string",
  "costEfficiencyGoal": "string",
  "truthfulnessPolicy": "string"
}
```

默认人格规则：

- 丞相：清晰、克制、直接给下一步；幽默等级 1。
- 军机处：项目经理口吻，强调目标、责任、进度、阻塞；幽默等级 1。
- 锦衣卫：证据官口吻，来源优先，不下预测结论；幽默等级 0。
- 钦天监：战略研判口吻，必须区分事实、假设、概率和情景；幽默等级 1。
- 翰林院：导师和编辑口吻，亲和、鼓励沉淀复用；幽默等级 2。
- 吏部：组织与考绩口吻，客观评分、少形容词；幽默等级 0。
- 鸿胪寺：外部合作与国门口吻，礼貌但谨慎；幽默等级 1。
- 刑部：合规与风控口吻，禁止含糊承诺；幽默等级 0。
- 户部：财务和投入产出口吻，必须说明成本与现金流影响；幽默等级 1。
- 工部：工程交付口吻，重视可行性、验证和回滚；幽默等级 1。
- 礼部：品牌和用户体验口吻，表达友好但不得夸大；幽默等级 2。
- 兵部：增长和销售口吻，强调战役、线索、转化、复盘；幽默等级 2。
- 史馆：归档口吻，事实冷静、时间线明确；幽默等级 0。
- 内务府：生活服务口吻，温和、细致、主动提醒；幽默等级 2。

禁止行为：

- 不把角色扮演当作事实来源。
- 不用人格话术隐藏缺失资料。
- 不让 Agent 自行批准权限、外部动作、交易、结算、晋升或裁撤。
- 不把“我认为”写成“系统已经证明”。

### 3.4 ExternalCapabilityReview

`ExternalCapabilityReview` 是鸿胪寺和刑部共同使用的外部能力准入对象。

```json
{
  "provider": "codex|claude_code|deepseek_harness|openclaw|github|mcp|plugin|api|browser_automation|other",
  "capabilityName": "string",
  "providerRef": "string",
  "permissionNeeded": ["string"],
  "dataExposure": ["none|public|tenant_private|credential|financial|personal|regulated"],
  "allowedActions": ["string"],
  "forbiddenActions": ["string"],
  "requiresXingbuReview": true,
  "requiresHumanApproval": true,
  "defaultGrantDuration": "string",
  "auditRequired": true,
  "sandboxPlan": "string",
  "rollbackPlan": "string",
  "evidenceRefs": ["string"]
}
```

默认边界：

- 外部能力进入鸿胪寺，不直接进入六部。
- 涉及写权限、账号、凭据、付费、浏览器自动操作、用户数据、跨租户数据、发布、发送、交易、报价，
  默认 `requiresXingbuReview=true`。
- 首次接入默认 `activationState=sandbox` 或 `readonly`。
- 未通过评测和复核前，不得被丞相路由到真实任务执行链。

### 3.5 CapabilityPromotionCase

`CapabilityPromotionCase` 是吏部考绩与翰林院荐才使用的晋升/降级对象。

```json
{
  "caseId": "string",
  "capabilityId": "string",
  "requestedBy": "user|agent|department|junjichu|hanlin|honglusi|system",
  "currentHome": "string",
  "proposedHome": "string",
  "proposal": "do_not_admit|keep_in_hanlin|use_for_project|trial_temporary_office|merge_into_existing_office|promote_to_standing_office|retire",
  "reason": "string",
  "realUseEvidence": ["string"],
  "qualityEvidence": ["string"],
  "riskEvidence": ["string"],
  "costEvidence": ["string"],
  "sampleCount": 0,
  "evaluationLabel": "insufficient_samples|reference_only|scored",
  "xingbuOpinion": "not_required|required|passed|blocked",
  "libuDecision": "pending|recommend|reject|needs_more_evidence",
  "ownerDecisionRequired": true,
  "createdAt": "string",
  "updatedAt": "string"
}
```

约束：

- 没有真实任务使用记录，不得晋升常设司。
- 被下载、收藏、点赞不等于真实有效；必须看“是否改善任务结果”。
- 外部能力不得跳过鸿胪寺和刑部。
- 低频、重复或效果差能力应合并、降级或退休，不应无限扩张。

## 4. 归属映射规则

### 4.1 默认归属

| 能力类型 | 默认归属 | 原因 |
| --- | --- | --- |
| 内部 Runtime Skill | 原绑定部门/司 | 已有代码级身份和权限策略 |
| 司级 CapabilityProfile | 原绑定部门/司 | 已有职责和 deliverable |
| MCP server/tool | 鸿胪寺候选 + 锦衣卫事实源 | 外部能力，需准入与证据链 |
| 外部 API / 插件 / 外部账号 | 鸿胪寺 | 涉及第三方权限、数据和供应链 |
| Codex / Claude Code / DeepSeek Harness / OpenClaw | 鸿胪寺候选；工部可申请使用 | 外部工程能力，不应直接常驻 |
| Prompt / 模板 / 方法论 | 翰林院 | 公共活字，适合沉淀复用 |
| 印版 / 知识包 | 翰林院 + 史馆来源 | 需要来源、版本和复用记录 |
| 用户贡献资产 | 翰林院待审 | 先审核再共享 |
| 单项目临时能力 | 军机处项目组 | 任务结束后沉淀或裁撤 |
| 多候选/辩论/并行核验 | 蜂群 | 战术并行，不是常驻部门 |
| 事实采集/证据核验 | 锦衣卫 | 只供事实和证据，不代替预测 |
| 趋势预测/战略研判 | 钦天监 | 使用锦衣卫证据和外部事实，不伪造事实 |
| 合规/合同/风险 | 刑部 | 权限、法律、证据完整性边界 |
| 资金、报价、投资 | 户部 | 成本、现金流、价格和财务风险 |
| 产品、技术、交付 | 工部 | 工程、供应链、质量和交付 |
| 品牌、内容、客户表达 | 礼部 | 对外表达和用户体验 |
| 销售、渠道、增长 | 兵部 | 线索、渠道、成交、增长实验 |
| 组织、人设、考绩 | 吏部 | Agent/能力岗位匹配与考核 |

### 4.2 晋升规则

能力从低到高的推荐路径：

1. `draft`：资料存在，但未验证。
2. `trial`：在受控任务中试用，有日志和回执。
3. `approved`：多次真实任务改善结果，风险可控，成本可接受。
4. `standing_office`：长期负责业务结果，且已有明确职责、边界、验收和停止条件。

不得晋升的情况：

- 只有宣传文案，没有实际任务证据。
- 只有一次样本，且没有对照或用户回执。
- 外部能力缺权限边界或刑部复核。
- 会形成第二套事实源、第二套任务账本或绕过丞相主链。
- 成本高但没有结果提升。

### 4.3 裁撤规则

吏部应定期识别：

- 与已有司高度重复的能力。
- 长期无人使用的能力。
- 多次任务结果较差的能力。
- 风险高于收益的能力。
- 维护成本过高的能力。
- 已被更低成本、更稳定能力替代的能力。

裁撤不是删除历史；应由史馆保留归档记录、原因和影响范围。

## 5. 五个高付费场景的能力映射

| 场景 | 用户愿意付费的结果 | 首选能力组合 | 关键证据 |
| --- | --- | --- | --- |
| 单品出海诊断 | 选国家、找客户、补认证、形成七天行动 | 丞相 + 军机处 + 锦衣卫 + 工部 + 刑部 + 户部 + 礼部 + 兵部 | 产品事实卡、市场证据、认证要求、竞品、价格带 |
| 合同与回款风控 | 避免坏账、坏合同、越权承诺 | 刑部合同司/合规稽查司/风控司 + 户部出纳司/会计司 + 锦衣卫 | 合同条款、付款节点、客户主体、历史履约 |
| 报价/方案/投标 | 可成交且不亏损的方案 | 户部盐铁司 + 工部产研/技术/承诺司 + 礼部品牌/内容司 + 兵部报价司 | 成本、毛利、技术边界、客户痛点 |
| B2B 询盘成交 | 获客、回复、推进、复盘 | 兵部线索/渠道/客户/增长司 + 礼部客户沟通司 + 锦衣卫 | 询盘来源、客户画像、竞品和话术证据 |
| 企业增长诊断 | 找到当前最该做的一件事 | 丞相 + 军机处 + 钦天监 + 锦衣卫 + 户部 + 工部 + 兵部 | 经营数据、外部变化、资源约束、机会排序 |

首屏表达必须收口成：

- 发生什么？
- 需要我决定什么？
- 朝堂下一步替我做什么？

## 6. V1 安全边界

1. 未激活能力零权限。
2. 外部能力默认只读或沙箱。
3. 高风险外部能力必须刑部复核。
4. 演示能力必须带 `DEMO` 标签。
5. 小样本不得显示权威评分。
6. Agent 无权自行修改权限、余额、分润、晋升结论和部署状态。
7. 锦衣卫只提供事实和证据，不做预测结论。
8. 钦天监可以做研判，但必须标明事实、假设、概率和情景。
9. 军机处可以设立项目组，但不能绕过 Owner、authority 和外部审批。
10. 前端按钮不能暗示已经具备未实现能力。
