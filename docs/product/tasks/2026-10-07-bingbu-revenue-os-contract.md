# 兵部 Revenue OS：整体产品与技术设计方案

## Status

Ready

用户于 2026-10-07 通过“同意所有的天才设计，并立刻汇总制定整体方案”确认本文方向。本文件仍是产品与工程设计合同，不代表产品 authority 已授权施工。当前仓库 authority 为 `STOP / canExecuteProductWork=false`；只有 Owner 为本任务选择 exact task、落地 approval manifest 并取得 GO 后，才允许按本文修改产品代码。

## 一句话目标

把兵部从“销售问题咨询器”升级为销售决策层 Revenue OS：CRM 负责记录销售事实，兵部负责证据化判断、跨部会审、唯一下一步和待审批动作，所有外部副作用都经过人工审批并可追溯。

## 设计原则

1. **兵部不是第二个 CRM。** CRM/导入源是事实系统，兵部是决策和协同系统。
2. **先证据，后判断。** 事实、推断、建议、待补证据必须分层展示。
3. **先建议，后动作。** P0 只生成作战包和动作草稿；发送、改价、签约、承诺交付和 CRM 写入都必须经过审批。
4. **唯一下一步。** 每个活跃商机必须有一个动作、一个责任人、一个截止时间。
5. **现有朝堂业务流不被绕过。** 下旨、军机处、六部、司级证据协议、锦衣卫、史馆和 ADR 0028 继续是唯一业务基线。
6. **从单 Agent/单图开始。** 复用现有 LangGraph 与 Runtime Skills；只有上下文隔离、质量或延迟出现明确瓶颈时才拆分。
7. **所有结果可复盘。** 每条建议必须能追溯到销售事实、证据、调用链、模型版本和最终结果。

## 当前事实与外部选型

- 现有兵部六司已覆盖线索、商机、渠道、客户、竞情和增长；运行时已有六部/司级 Agent、Runtime Skills、证据脊和审计基础。
- [Twenty](https://github.com/twentyhq/twenty) 具备自定义对象、字段、关系、视图、Pipeline、Workflow、AI Agent、权限和 API，适合作为首选 CRM 事实源。其核心大部分为 AGPLv3，SDK/应用部分有 MIT 例外；通过 API/适配器隔离，不复制代码进朝堂。
- [EspoCRM](https://github.com/espocrm/espocrm) 与 [Frappe CRM](https://github.com/frappe/crm) 是成熟 CRM 备选，均需按 AGPL 边界独立部署和评估。
- [LangGraph](https://github.com/langchain-ai/langgraph) 继续作为朝堂编排内核；其官方能力包含 durable execution、human-in-the-loop 和持久化状态。
- [Langfuse](https://github.com/langfuse/langfuse) 用于 Prompt、模型调用、工具调用、费用、延迟、评测集和人工反馈追踪；核心 OSS 为 MIT，`ee/` 除外。
- [Chatwoot](https://github.com/chatwoot/chatwoot) 可选作为客户沟通/支持事件源，MIT。
- [PostHog](https://github.com/PostHog/posthog) 可选作为增长事件、漏斗、实验和 Feature Flag 层；若只需轻量网站转化分析，可用 MIT 的 [Umami](https://github.com/umami-software/umami)。
- [n8n](https://github.com/n8n-io/n8n) 不进入商业核心：其 Sustainable Use License/Commons Clause 对销售、托管和再分发有限制，只允许内部原型使用，具体使用须经法务确认。

### 执行与模型策略

- 本项目默认使用仓库现有的 **DeepSeek harness**：通过现有 LiteLLM 网关和 Runtime 入口调用模型，不新增第二套 harness，不直连供应商 API。
- `litellm/deepseek-chat` 是主实现位，负责普通编码、测试修复和结构化实现；`litellm/deepseek-reasoner` 是独立复审位，负责架构推理、红蓝互审和高风险边界复核。
- Codex 负责产品目标冻结、设计审查、门禁判断和最终验收；DeepSeek harness 负责主力实施与异构复审，三者职责不混淆。
- Claude、其他模型、外部 Agent 或新的模型供应商不是默认依赖；只有 DeepSeek harness 明确不可用且用户显式授权时，才允许作为临时兜底，并在任务审查记录中写明原因、范围和回退结果。
- 开发与离线测试不得读取私有密钥、私有 dotenv 或绕过网关；真实模型 smoke、真实 CRM 写入和公网调用必须单独授权。离线测试继续使用 fake model 注入。

## 目标用户与任务

### 销售负责人

需要每日知道哪些商机值得投入、为何停滞、谁负责下一步、哪些承诺不能说。

### 一线销售

需要快速得到客户摘要、当前阻塞、下一次沟通目标、建议话术和待补证据。

### 经营负责人

需要每周看到漏斗健康度、阶段停滞、渠道质量、输单原因和可验证增长实验。

### 法务/财务/交付负责人

只在报价、合同、回款或交付承诺进入风险阈值时参与会审，不被无关商机打扰。

## P0 必须交付的三个闭环

### A. 每周商机作战会

输入最近商机与活动记录，按金额、阶段停滞和证据完整度排序，输出重点商机、唯一下一步、责任人、截止时间、阻塞点、缺失证据和是否需要会审。

### B. 报价会审

兵部报价司牵头，按需要会审户部盐铁司、工部技术司/承诺司、刑部合同司和礼部客户沟通司，输出报价草案、毛利/交付/合同红线和下一次客户沟通目标。

### C. 输单与增长复盘

竞情司、增长司和线索司按行业、来源、竞品、价格、产品缺口、响应速度与渠道归属归类输单，生成不超过三个可验证实验。

## 领域模型

所有实体必须带 `owner_id`、`created_at`、`updated_at` 和来源/审计字段；客户端不得提交 owner ID，后端从认证上下文注入。

```text
Account
  id, name, industry, segment, region, source_ref
Contact
  id, account_id, name, title, role_in_decision, contact_status
Lead
  id, account_id?, source, persona, qualification_status, score_basis
Opportunity
  id, account_id, owner_user_id, stage, amount, currency,
  expected_close_date, last_activity_at, next_action, next_action_owner,
  next_action_due_at, blocker, competitor_id?, health, source_ref
Activity
  id, opportunity_id, type, occurred_at, actor, summary, customer_signal,
  next_commitment, source_ref
Quote
  id, opportunity_id, version, price, cost_basis, gross_margin,
  status, approval_state, valid_until, redlines
Competitor
  id, name, product, observed_position, price_signal, source_ref
Evidence
  id, entity_type, entity_id, claim, source_type, source_ref,
  observed_at, freshness, stance, quality, confidence_label
DecisionPacket
  id, subject_type, subject_id, request_id, status, summary,
  facts[], assumptions[], recommendations[], evidence_gaps[],
  selected_bureaus[], bureau_report_refs[], cross_bureau_impacts[],
  unresolved_items[], created_at
ActionDraft
  id, decision_packet_id, action_type, payload, side_effect_level,
  requires_approval, approval_state, approved_by?, approved_at?,
  execution_state, idempotency_key
ImportRun
  id, source_type, filename, schema_version, row_count, accepted_count,
  rejected_count, error_summary, status, created_at
Outcome
  id, opportunity_id, outcome_type, occurred_at, amount, reason,
  competitor_id?, evidence_refs[]
```

## 数据与证据规则

- P0 支持 CSV/JSON 导入；所有导入先 `preview` 再 `commit`。
- 通过 `external_source`、`external_id` 和 `source_updated_at` 去重；重复导入必须幂等。
- 缺少客户、阶段、负责人、金额或下一步时，记录为数据缺口，不由模型补写事实。
- “赢率”只能作为工作假设，必须附证据和不确定性标签；不得作为预测事实。
- 证据必须带来源、观察时间、新鲜度、质量、立场和是否存在冲突。
- 结果回灌后，DecisionPacket 保留当时的 Skill 版本和证据快照，不重写历史语义。
- 每次模型调用记录 harness、模型别名、版本/配置指纹、请求追踪 ID 和复审结论；不得把真实模型输出或密钥写入 Git。

## 后端设计

### 建议代码边界

```text
backend/app/bingbu/
  __init__.py
  models.py              # Pydantic/领域模型
  enums.py               # 阶段、状态、动作和风险枚举
  validation.py          # 确定性校验、唯一下一步、证据完整度
  import_service.py      # CSV/JSON preview/commit，幂等去重
  read_models.py         # overview、funnel、opportunity detail
  storage.py             # 复用项目现有 storage/SQLite 约定
  adapters/
    __init__.py
    base.py               # 只读 CRM adapter 协议
    twenty.py             # P1，默认 disabled
  orchestration.py       # 复用现有 Runtime Skills/LangGraph
  decision_packets.py    # 作战包、会审包、动作草稿
  action_gate.py         # dry-run、approval、执行状态机
  audit.py               # 调用/证据/动作审计
backend/app/api/bingbu.py
backend/tests/test_bingbu_*.py
```

禁止复制一套新的 Agent、证据协议、认证、史馆写入、锦衣卫搜索或 LangGraph 运行时。兵部只通过已有的 `app.agents.runtime_skills`、`app.agents.evidence_protocol` 和认证边界工作。

### 后端 API

所有受保护端点都读取 `CurrentUser`，使用脱敏稳定错误；不得接受 `owner_id`。

```text
GET  /api/v1/bingbu/overview
GET  /api/v1/bingbu/opportunities?stage=&owner=&health=&limit=&cursor=
GET  /api/v1/bingbu/opportunities/{opportunity_id}
GET  /api/v1/bingbu/opportunities/{opportunity_id}/timeline
GET  /api/v1/bingbu/decision-packets/{packet_id}
GET  /api/v1/bingbu/imports/{import_id}
POST /api/v1/bingbu/imports/preview
POST /api/v1/bingbu/imports/commit
POST /api/v1/bingbu/war-rooms
POST /api/v1/bingbu/action-drafts
POST /api/v1/bingbu/action-drafts/{draft_id}/approve
POST /api/v1/bingbu/action-drafts/{draft_id}/reject
```

`POST /war-rooms` 只生成分析与草案，不执行外部动作。`approve` 只能把动作推进到 `APPROVED_PENDING_EXECUTION`；真正发送邮件、更新 CRM、改价、签约或承诺交付必须由独立 Action Gateway 处理，并保留审批人、时间、幂等键和执行回执。P0 不实现外部执行器。

### 关键响应契约

`GET /overview` 返回：

```json
{
  "ok": true,
  "period": {"from": "...", "to": "..."},
  "funnel": {"counts": {}, "amounts": {}, "stage_aging": []},
  "priority_opportunities": [],
  "evidence_gaps": [],
  "decision_queue": [],
  "experiments": [],
  "freshness": {"as_of": "...", "stale_after_hours": 72}
}
```

`DecisionPacket` 必须分层：`facts`、`assumptions`、`recommendations`、`evidence_gaps`、`redlines`、`next_action`、`cross_bureau_impacts`、`unresolved_items`。不得只返回一段自然语言。

## 前端/UI 设计

### 页面路由

```text
/bingbu                         兵部作战台总览
/bingbu/opportunities/[id]      商机详情与证据时间线
/bingbu/war-room/[id]           销售会审包
/bingbu/import                  CSV/JSON 导入预览与错误修复
```

### 总览页面

首屏按行动优先级排列：

1. 顶部：本周期 Pipeline、覆盖倍数、停滞商机数、证据缺口数、待审批动作数。
2. 主区：重点商机队列，每行显示金额、阶段、停滞天数、健康状态、唯一下一步、责任人和截止时间。
3. 左下：漏斗和阶段停滞，不把视觉面积浪费在无决策意义的 KPI。
4. 右下：证据缺口、待会审、增长实验。
5. 所有卡片都提供“查看事实”“查看证据”“生成作战包”入口。

### 商机详情

- 商机摘要和唯一下一步固定在首屏。
- 左侧为客户/联系人/活动时间线。
- 右侧为证据抽屉：事实、推断、冲突、缺口、来源时间。
- 会审区域显示报价、毛利、技术、合同、沟通四类风险。
- 任何外部动作按钮都标明“生成草稿”或“申请审批”，不得出现无审批的“立即发送/立即改价”。

### 会审包

采用“作战简报”布局：目标、战况、证据、分歧、红线、唯一下一步、责任人、截止时间。允许逐司展开，但默认先展示综合结论。

### UI 约束

- 延续朝堂现有导航、认证、布局和视觉语义；新增页面必须纳入现有 `ChaotangHeader`。
- 状态不能只靠颜色；必须有文字和图标/形状补充。
- 支持 loading、empty、error、no-evidence、unauthorized 和 360px 窄屏状态。
- 关键文本不可截断；表格可横向滚动或降级为卡片。
- 动效支持 `prefers-reduced-motion`；对比度至少 4.5:1；焦点态可见。
- 不引入第二套 CSS 框架或第二套图标体系。

## 前端 BFF

浏览器只访问同源 Next.js BFF；BFF 读取 `courtos_session`，以 Bearer session 调用 FastAPI，严格校验响应并映射脱敏错误。建议新增：

```text
frontend/src/app/api/bingbu/overview/route.ts
frontend/src/app/api/bingbu/opportunities/route.ts
frontend/src/app/api/bingbu/opportunities/[id]/route.ts
frontend/src/app/api/bingbu/war-rooms/route.ts
frontend/src/app/api/bingbu/imports/preview/route.ts
frontend/src/app/api/bingbu/imports/commit/route.ts
frontend/src/app/api/bingbu/action-drafts/route.ts
```

`src/lib/backendClient.ts` 仍是唯一后端网络调用位置；不得暴露 `BACKEND_BASE_URL`、Bearer token 或 owner ID。

## 权限、审批和副作用

- 读取销售事实、生成分析和创建草稿：普通受保护会话即可。
- 导入/覆盖销售事实：需要当前用户权限，保留 ImportRun 和错误明细。
- 发送消息、改价、更新 CRM、签约、付款、承诺交付：P0 禁止执行；后续只能经 Action Gateway + 人工审批。
- 所有动作都必须支持 dry-run、幂等键、失败关闭、超时取消和审计。
- 任何模型输出都不能声称已完成现实动作。

## 观测与评估

P0 使用本地审计接口；P1 可接 Langfuse。必须记录：`trace_id`、`request_id`、`skill_id`、`skill_version`、输入引用、证据引用、模型/工具调用、token/费用、耗时、状态和人工反馈。

离线评测集至少包含：

- 高质量商机、有完整证据
- 缺少负责人/下一步的脏数据
- 价格与交付冲突
- 竞品事实相互矛盾
- 低质量商机应被放弃
- 需要跨部会审的报价
- 不得执行外部动作的高风险请求

## 分阶段交付

### P0：可验证垂直切片

CSV/JSON → 标准化事实 → 兵部总览 → 重点商机 → 作战包 → 动作草稿；不接外部 CRM 写入，不接真实模型/公网。

### P1：Twenty 只读适配器

通过 API 读取 Account/Contact/Opportunity/Activity，完成映射、增量同步、去重和来源保留。

### P2：审批动作层

CRM 更新草稿、邮件草稿、报价草稿和会议议程；审批后仍由独立执行器执行，所有动作可撤销或补偿。

### P3：结果学习

接入成交/输单/续约结果、Langfuse 评估、PostHog/Umami 增长事件和 Chatwoot 客户沟通信号。

## 验收标准

- 商机列表、详情、总览和会审包均有稳定契约与离线 fixture。
- 95% 以上 fixture 商机可显示负责人、唯一下一步和截止时间；缺失时明确标红为数据缺口。
- 100% DecisionPacket 的建议带证据引用或明确的证据不足状态。
- 未审批外部动作数量为 0；所有 draft/approve/reject 状态转移有测试。
- CSV/JSON preview/commit 幂等，错误行可定位，不污染已存在数据。
- 双账号隔离、401/403/404/422/503 脱敏路径有测试。
- 360px 窄屏、loading/empty/error/no-evidence 状态有前端静态或组件测试。
- 现有 backend ruff/pytest、frontend lint/typecheck/test/build 和 Harness 不回归。
- 不读取私有 dotenv、不调用真实模型、不访问公网、不发送外部消息、不修改 ADR 0028。

## 关键指标

先看过程指标，不把短期成交率变化直接归因于 AI：

- 商机数据完整度
- 下一步按时完成率
- 阶段停滞天数
- 报价会审耗时
- 证据缺口关闭率
- 建议采纳率
- 输单原因可分类率
- 未授权副作用数（必须为 0）

## 不做的事情

- 不重写 CRM。
- 不复制 Twenty/EspoCRM/Frappe/n8n 源码。
- 不新造第四套 Agent 运行时、证据协议、审计账本或认证系统。
- 不修改 ADR 0028、既有史馆/锦衣卫契约、现有 `/study` 行为。
- 不在 P0 自动发邮件、改价、签约、改 CRM 或承诺交付。
- 不用模型生成的赢率替代销售事实和人工判断。

## Product Definition

- 本合同定义兵部 Revenue OS 的产品目标、领域模型、前后端边界、审批边界和分阶段交付；对应实施任务为 `BINGBU-REVENUE-OS-P0-20261007`。

## Acceptance Criteria

- [ ] P0 交付 CSV/JSON 销售事实到作战台、会审包和 ActionDraft 的离线垂直切片。
- [ ] 所有建议可追溯到证据；未审批外部副作用数量为 0。

## Delivery Constraints

- [ ] 取得 Owner/M0 对 exact task 的 GO 后才可修改产品代码；默认使用现有 DeepSeek harness/LiteLLM，不直连供应商 API。

## Affected Modules

- 模块：兵部 Revenue OS P0；允许路径：`backend/app/bingbu/**`、`backend/app/api/bingbu.py`、`frontend/src/app/bingbu/**`、`frontend/src/app/api/bingbu/**`。
- 允许路径：`backend/app/bingbu/**`、`backend/app/api/bingbu.py`、`frontend/src/app/bingbu/**`、`frontend/src/app/api/bingbu/**`。

## Technical Plan

- 先领域模型与 RED 测试，再导入、读模型、DecisionPacket、ActionDraft、前端页面和离线跨层验收；复用既有 Runtime Skills、证据协议、认证和 BFF。

## Implementation Report

- 本文件登记的是设计合同；本回合未修改产品代码、未调用真实模型、未提交或部署。

## Acceptance Review

- 验收结果：Pending。Ready 只表示产品方向已确认，不表示 authority 已授权施工或实现已完成。

