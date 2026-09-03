# Scene Pack V1 第一批真实场景闭环实施修正案

> Amendment ID：`SCENE-PACK-V1-FIRST-REAL-SCENES-20260903`
> 状态：`SCOPE_EXPANDED_ENTERPRISE_GROWTH_PENDING_EXACT_APPROVAL / MACHINE_AUTHORITY_STOP`
> 产品范围：`SCENE_PACK_V1_ENTRY_TO_BOARD_MINIMUM_LOOP`
> 当前执行授权：`NOT_GRANTED_FOR_RUNTIME_UNTIL_AUTHORITY_BINDING`
> 用户批准：2026-09-03 chat，批准创建并执行本 amendment；不授权 push、merge 或 deploy

本修正案把“场景入口 + 军机处看板”的最小闭环绑定为一个受控产品切片。它只定义 Scene Pack 作为现有朝堂主链的入口、运行记录和军机处投影，不创建第二套 Agent 系统、任务事实源、权限事实源、flow 编排器或对外执行器。

2026-09-03 后续追加：Product Owner 要求将 `b2b-inquiry-conversion` 从占位场景提升为 `real_v1`，作为第四个高付费场景接入 Scene Pack 体系。该变更扩大了原 exact digest 的范围，因此旧 digest `fbc4aa05019dade11cceda17fd61ae75fd8ec8c8656765d91d03dc9a7a4ee0ed` 不再可作为产品施工授权。

2026-09-03 再次追加：Product Owner 要求将 `enterprise-growth-diagnosis` 从占位场景提升为 `real_v1`，作为第五个高付费场景接入 Scene Pack 体系。该变更再次扩大 amendment 范围，因此 B2B 扩展后的 digest `44fd22c41fd73e3b3aba4c2f371b6fd19432a2f297ef1774a3a10fa3459c32a3` 也不再可作为产品施工授权。

在 `node scripts/execution-authority.mjs --authorize` 仍返回 `STOP / AMENDMENT_APPROVAL_REQUIRED` 时，本文件不授权修改 frontend/backend 产品 runtime。产品施工必须在后续 authority 绑定、exact base 批准和独立复审后进行。

## 1. 裁决

Scene Pack V1 第一批只交付一条用户可演示闭环：

```text
大殿 5 个业务场景入口
  -> 用户选择场景并提交输入
  -> 后端生成统一结构化 SceneRun
  -> 自动生成军机处 BoardMission
  -> 用户在军机处查看裁决、风险、缺失项、下一步和证据
```

首批真实链路开放四个场景：

| 场景 slug | 中文名 | 状态 | 目标 |
| --- | --- | --- | --- |
| `single-product-export-diagnosis` | 单品出海诊断 | `real_v1` | 判断一个产品最该卖去哪、怎么卖、缺什么证据 |
| `contract-cashflow-risk` | 合同与回款风控 | `real_v1` | 判断合同是否可签、回款是否安全、哪些条款必须先处理 |
| `b2b-inquiry-conversion` | B2B 询盘成交 | `real_v1` | 判断客户真不真、值不值得追、下一句怎么回 |
| `proposal-quotation-tender` | 方案/报价/投标建议 | `stubbed` | 保留入口和统一占位，不打断演示 |
| `enterprise-growth-diagnosis` | 企业经营增长诊断 | `real_v1` | 找出企业今天最该抓的一件事 |

## 2. 唯一事实源与主链复用

Scene Pack 不拥有新的业务事实源。所有真实能力必须复用现有链路：

```text
Shangshufang confirm
  -> ChancellorRouteDecision
  -> OutboxEvent
  -> department/swarm candidate reports
  -> CourtReview
  -> quality + provenance gate
  -> FinalMemorial
  -> EmperorDecision
  -> ShiguanArchive
```

Scene Pack 的定位：

- `ScenePack`：场景定义和前端入口 registry。
- `SceneRun`：一次场景运行的结构化摘要和 evidence refs。
- `BoardMission`：军机处对 `SceneRun` 的用户可见投影。

`SceneRun` 和 `BoardMission` 不得替代既有任务内核、案卷、证据链、质量门、用户裁决或史馆归档。

## 3. 输出契约

所有场景必须返回同一种核心结构：

```json
{
  "runId": "string",
  "packSlug": "string",
  "status": "completed|blocked|failed",
  "verdict": "string",
  "confidence": 0,
  "riskGrade": "low|medium|high",
  "opportunityGrade": "low|medium|high",
  "missingItems": ["string"],
  "nextActions": [
    {
      "title": "string",
      "ownerDept": "string",
      "priority": "P0|P1|P2",
      "dueHint": "string"
    }
  ],
  "evidenceRefs": [
    {
      "claim": "string",
      "sourceLabel": "string",
      "sourceType": "user_file|official|company|news|database|model_inference",
      "capturedAt": "ISO8601",
      "reliability": "high|medium|low"
    }
  ],
  "summaryForUser": "string",
  "canProceed": false,
  "boardMission": {
    "title": "string",
    "stage": "todo|in_progress|awaiting_input|blocked|done",
    "nextMilestone": "string"
  }
}
```

`model_inference` 只能作为推断来源，不能显示为已核实外部事实。`demo=true` 的样例不得混入真实业务数据。

## 4. 数据契约候选

若现有 canonical 任务/案卷表不能承载本投影，允许新增以下最小表，并必须通过 migration 和 downgrade 证明可回滚：

| 表 | 用途 | 关键约束 |
| --- | --- | --- |
| `scene_packs` | 场景入口和 schema registry | `slug` 唯一；5 个 seed；前两个 `real_v1`，其余 `stubbed` |
| `scene_runs` | 单次运行结构化结果 | `pack_id` 外键；状态、风险、缺失项、证据 refs 结构化 |
| `board_missions` | 军机处场景任务投影 | `run_id` 外键；支持状态/风险/pack 查询索引 |

如果实现前发现现有正式任务表可安全扩展，应优先使用现有事实源并把上述对象实现为 read model / projection。

## 5. API 候选

| 方法 | 路由 | 要求 |
| --- | --- | --- |
| `GET` | `/api/court/scene-packs` | 返回可见场景列表，按排序输出，含 `canExecute` 和 `exampleHint` |
| `GET` | `/api/court/scene-packs/:slug` | 返回场景定义、输入字段说明和 demo 说明 |
| `POST` | `/api/court/scene-runs` | 入参 `packSlug`、`inputs`、`attachments`；返回 `runId` 和统一结果 |
| `GET` | `/api/court/scene-runs/:runId` | 返回运行结果与关联 `missionId` |
| `GET` | `/api/court/military-office/missions` | 支持 `stage`、`risk_grade`、`pack_slug` 筛选 |
| `PATCH` | `/api/court/military-office/missions/:missionId` | 只允许手动更新 `stage`、`nextMilestone`、`owner`、`pinned` |

## 6. 四个真实场景

### 6.1 单品出海诊断

输入字段：

- 产品名称、产品类别、产品资料文件或摘要。
- 已知参数、已有认证、当前报价或成本、月产能、交付周期。
- 目标国家或“不确定”。
- 计划渠道：阿里国际站、独立站、海外经销商、小程序、其他。

处理流程：

```text
资料摄取
  -> 产品事实卡
  -> 缺失检测
  -> 锦衣卫市场证据
  -> 工部技术适配
  -> 刑部合规提示
  -> 户部价格风险
  -> 礼部卖点表达
  -> 丞相一句话裁决
  -> 军机处任务卡
```

缺关键产品资料时：

- `status=blocked`
- `riskGrade=high`
- `canProceed=false`
- 必须列出 `missingItems`
- 不得编造参数、认证、价格、客户案例或市场事实

### 6.2 合同与回款风控

输入字段：

- 合同文本或合同摘要、合同金额、币种、付款节点。
- 交付周期、验收方式、质保责任、对方公司名称、目标国家或地区、历史合作状态。

处理流程：

```text
合同事实卡
  -> 条款风险矩阵
  -> 锦衣卫对方核验
  -> 户部回款风险
  -> 刑部合规提示
  -> 工部交付可行性
  -> 丞相裁决
  -> 军机处任务卡
```

合同文本或付款节点缺失时：

- `status=blocked`
- `riskGrade=high`
- `canProceed=false`
- 必须提示“缺少合同文本/付款节点/验收标准”
- 不给最终签约建议

### 6.3 B2B 询盘成交

输入字段：

- 询盘来源：阿里国际站、独立站、展会、WhatsApp、邮件、LinkedIn、经销商推荐、其他。
- 客户姓名、客户公司、国家或地区、联系方式、询盘时间、客户原文。
- 产品类别、规格参数、数量、应用场景、目标价格或预算、认证要求、交付时间、付款方式、是否要求样品。
- 聊天记录、邮件往来、客户网站、公司注册信息、历史询盘记录、竞争对手报价、产品手册、报价单。

事实标签：

- `verified_fact`：已核实事实。
- `customer_claim`：客户声明。
- `user_claim`：用户声明。
- `external_signal`：外部信号。
- `market_reference`：市场参考。
- `model_inference`：模型推断。
- `missing`：缺失。
- `conflict`：冲突。

处理流程：

```text
询盘摄取
  -> 询盘事实卡
  -> 客户真实性初筛
  -> 需求完整度判断
  -> 产品匹配
  -> 锦衣卫公开信息核验
  -> 户部价格和付款风险
  -> 礼部生成回复策略
  -> 丞相判断优先级
  -> 军机处生成销售跟进任务
  -> 史馆归档
  -> 后续反馈回流
```

输出扩展：

```json
{
  "packSlug": "b2b-inquiry-conversion",
  "verdict": "HOT|WARM|COLD|FAKE_RISK|BLOCKED",
  "verdictText": "string",
  "leadScore": 0,
  "authenticityScore": 0,
  "fitScore": 0,
  "urgencyScore": 0,
  "paymentRiskScore": 0,
  "conflicts": ["string"],
  "recommendedReply": {
    "subject": "string",
    "body": "string",
    "tone": "professional|warm|direct|technical"
  },
  "followUpPlan": [
    {
      "step": "string",
      "timing": "string",
      "ownerDept": "string",
      "successSignal": "string"
    }
  ]
}
```

B2B 场景仍必须包含统一输出契约中的 `runId`、`status`、`confidence`、`riskGrade`、`opportunityGrade`、`missingItems`、`nextActions`、`evidenceRefs`、`summaryForUser` 和 `boardMission`。

阻断规则：

- 没有客户原文：`verdict=BLOCKED`，不得生成可发送回复。
- 没有产品需求：`verdict=BLOCKED`，必须提示补齐产品类别/规格/数量/应用场景。
- 国家或地区未知：不得输出具体市场法规判断，只能标记 `missingItems`。
- 客户身份完全不可核验：必须标记 `verdict=FAKE_RISK` 或高风险核验建议，不得直接指控欺诈。
- 不自动发送邮件、不自动承诺价格、不自动联系客户。

### 6.4 企业经营增长诊断

输入字段：

- 企业名称、行业、主营产品、当前阶段、目标市场、团队人数、预算范围。
- 近 30 天销售额、近 90 天销售额、毛利率、净利率、现金余额区间、应收账款、库存金额、回款周期。
- 客单价、询盘数、报价数、成交数、复购数。
- 渠道数据：阿里国际站、独立站、小程序、线下展会、海外经销商、短视频/内容、私域/社群、其他。
- 当前最痛的问题、未来 30 天目标、未来 90 天目标、最想提升的指标、可接受风险。
- 产品目录、报价单、询盘记录、销售表、成本表、库存表、客户反馈、投放数据、网站或平台页面。

事实标签：

- `verified_fact`：已核实事实。
- `user_claim`：用户声明。
- `accounting_data`：经营数据。
- `sales_data`：销售数据。
- `channel_data`：渠道数据。
- `external_signal`：外部市场信号。
- `model_inference`：模型推断。
- `missing`：缺失。
- `conflict`：冲突。

处理流程：

```text
数据摄取
  -> 经营事实卡
  -> 数据完整度评估
  -> 三大瓶颈识别
  -> 户部现金与利润评估
  -> 工部产品和交付评估
  -> 锦衣卫市场与竞品核验
  -> 礼部渠道表达评估
  -> 丞相形成唯一经营裁决
  -> 生成 30/60/90 天行动包
  -> 军机处立项
  -> 史馆归档
  -> 结果复盘回流
```

核心评分：

- `RevenueMomentumScore`
- `ProfitQualityScore`
- `CashSafetyScore`
- `LeadConversionScore`
- `ProductMarketFitScore`
- `DeliveryCapacityScore`
- `ChannelHealthScore`
- `TeamExecutionScore`
- `GrowthPriorityScore`

输出扩展：

```json
{
  "packSlug": "enterprise-growth-diagnosis",
  "verdict": "SCALE|FOCUS|FIX_CASHFLOW|FIX_CONVERSION|FIX_PRODUCT|HOLD|BLOCKED",
  "verdictText": "string",
  "topBottlenecks": [
    {
      "name": "string",
      "severity": "low|medium|high",
      "evidence": "string"
    }
  ],
  "scores": {
    "revenueMomentum": 0,
    "profitQuality": 0,
    "cashSafety": 0,
    "leadConversion": 0,
    "productMarketFit": 0,
    "deliveryCapacity": 0,
    "channelHealth": 0,
    "teamExecution": 0,
    "growthPriority": 0
  },
  "todayOneAction": {
    "title": "string",
    "reason": "string",
    "ownerDept": "string",
    "successSignal": "string"
  },
  "actionPlan30_60_90": [
    {
      "period": "30|60|90",
      "goal": "string",
      "actions": ["string"],
      "ownerDept": "string",
      "metric": "string"
    }
  ]
}
```

企业经营增长场景仍必须包含统一输出契约中的 `runId`、`status`、`confidence`、`riskGrade`、`opportunityGrade`、`missingItems`、`conflicts`、`nextActions`、`evidenceRefs`、`summaryForUser` 和 `boardMission`。

阻断与降级规则：

- 没有主营产品或服务：`verdict=BLOCKED`。
- 没有目标问题：`verdict=BLOCKED`。
- 没有任何经营指标：`verdict=BLOCKED`。
- 没有时间范围：`verdict=BLOCKED`。
- 用户要求预测收入但不给销售、渠道或成本数据：`verdict=BLOCKED`。
- 数据明显冲突但无法核验：`verdict=BLOCKED`。
- 缺成本、成交、现金流、渠道来源、库存或产能信息时，降级为“框架建议”，不得给具体数值判断。

## 7. 前端边界

大殿首页允许新增“朝堂战略场景”模块，因为用户明确点名修改大殿；本变更必须保留冻结边界记录。

页面候选：

| 页面 | 目标 |
| --- | --- |
| `/dadian` | 展示 5 个 Scene Pack 卡片，主按钮“立即开局”，次按钮“查看示例” |
| `/dadian/scene-pack/[slug]` | 共用场景执行页，左输入、右结果、底部固定操作栏 |
| `/junjichu/scene-board` | 军机处 Scene Pack 看板，支持筛选、卡片、详情和手动推进 |

前端不得自行推导 LIVE 完成状态；必须消费后端结构化结果和 mission projection。

B2B 询盘成交的前端文案：

- 大殿入口场景名：`B2B询盘成交`。
- 入口文案：`判断客户真不真、值不值得追、下一句怎么回`。
- 主按钮：`分析询盘`。
- 次按钮：`查看样例`。
- 场景页：左侧输入询盘原文、客户信息、产品需求、聊天/邮件上传；中间显示客户真实性与需求完整度；右侧显示丞相裁决、客户等级、下一步跟进和推荐回复。
- 底部按钮：`生成成交作战卡`、`保存到军机处`、`查看证据`、`补齐客户资料`、`生成回复草稿`。
- 军机处任务卡标题：客户公司 + 产品需求；显示线索等级、真实性、风险和下一步。

企业经营增长诊断的前端文案：

- 大殿入口场景名：`企业经营增长诊断`。
- 入口文案：`找出企业今天最该抓的一件事`。
- 主按钮：`诊断增长`。
- 次按钮：`查看样例`。
- 场景页：左侧输入经营数据、资料上传和目标选择；中间显示经营评分、瓶颈树和数据完整度；右侧显示丞相裁决、今天唯一行动和 30/60/90 天路线。
- 底部按钮：`生成增长诊断`、`保存到军机处`、`查看证据`、`补齐经营数据`、`发起专项项目`。
- 军机处任务卡标题：企业名 + 增长诊断；显示经营裁决、最大瓶颈、今日行动和风险等级。

## 8. 禁止动作

本切片不授权：

- 自动签约。
- 自动付款。
- 自动报价或突破销售底线。
- 自动群发、自动发邮件、自动 CRM 写入。
- 自动对外发布或 deploy。
- 将合规/签约/报价建议显示为“已通过”。
- 将 demo/stub 结果显示为真实业务结论。

## 9. 验收

产品实现包必须满足：

1. 大殿首页可见 5 个场景入口。
2. 点击 `single-product-export-diagnosis` 可提交 demo 输入并出现 `verdict`、`riskGrade`、`missingItems`、`nextActions`。
3. 点击 `b2b-inquiry-conversion` 可提交 demo 输入并出现询盘成交作战卡、推荐回复和跟进计划。
4. 点击 `contract-cashflow-risk` 可提交 demo 输入并出现同一结构结果。
5. 点击 `enterprise-growth-diagnosis` 可提交 demo 输入并出现经营增长行动包、今日唯一行动和 30/60/90 天路线。
6. 四个真实场景运行后自动生成军机处任务卡。
7. 用户可点击任务进入详情并查看证据来源和下一步。
8. 一个 stub 场景不报错、不挂起，并显式标记为 demo/stub。
9. 缺字段路径返回 blocked。
10. Playwright 最小路径覆盖四个真实场景从入口到看板详情。

## 10. 下一步授权口径

进入产品代码实现前，Product Owner 需要再次批准：

```text
批准 Scene Pack V1 amendment exact digest <sha256>，批准施工 base <branch@sha>，授权绑定机器 authority 并在该 scoped package 内修改后端模型/API、前端大殿入口、场景页、军机处看板、B2B 询盘成交 Pack V1、企业经营增长诊断 Pack V1 和最小 Playwright 验收；不授权 push、merge 或 deploy。
```
