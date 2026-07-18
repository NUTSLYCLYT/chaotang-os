# 朝堂 OS 全域智能服务、成果完成度门禁与 MCP 架构方案

> 日期：2026-07-18
> 状态：APPROVED_FOR_PACKETIZATION / IMPLEMENTATION_PARTIAL
> 目标：在复用现有 `FlowEngine`、`SwarmOrchestrator`、门下省、御史门、正式奏折和史馆链路的前提下，为普通用户提供覆盖生活、学习、事业与娱乐的精准、可靠、可执行服务。

## 1. 产品定义

朝堂 OS 不是“万能聊天机器人”，而是一个受证据、权限和完成度门禁约束的私人内阁：

```text
用户只表达目标
  → 系统补齐少量关键条件
  → 自动拆解、查证、比较和形成方案
  → 交付决策卡、完整奏折和下载附件
  → 用户逐项批准高风险动作
  → 系统执行、监控变化并记录真实结果
```

前台保持“一道旨、三个选择、一键执行”；后台才展示军机处、各部、各司和蜂群。普通用户不需要理解 Agent、MCP 或工作流。

### 1.1 三种用户入口

| 入口 | 用户目标 | 典型交付 |
| --- | --- | --- |
| 问策 | 判断一件事是否值得做 | GO / CONDITIONAL GO / NO-GO、证据、风险、阈值、验证实验 |
| 办事 | 完成一个复杂任务 | 三套方案、预算、日程、清单、附件、执行篮 |
| 守望 | 长期监控变化 | 价格、政策、竞争、健康或项目偏差提醒及自动重规划 |

## 2. 目标运行架构

```text
TaskEnvelope
  → Intent / Risk Classifier
  → DeliverableContract
  → 丞相 MissionPlanner
  → 门下省派单审查
  → Capability Registry
  → 军机处 MissionGraph
  → SwarmOrchestrator
  → FlowEngine / Agent / MCP Tools
  → EvidencePacket[]
  → 成果完成度门禁
  → 御史证据与冲突门
  → 丞相成果编译器
  → Artifact Service
  → Human Approval
  → Controlled Execution
  → OutcomeReceipt / 史馆飞轮
```

模型只产生候选计划、解释和建议。任务状态、权限、数据新鲜度、完成判断、人工批准、付款和正式归档由确定性代码拥有。

## 3. 成果完成度门禁

### 3.1 门禁输入与输出

输入：

```text
TaskEnvelope
+ DeliverableContract
+ EvidencePacket[]
+ ToolCallReceipt[]
+ ArtifactManifest
+ TraceContext
```

输出：

```json
{
  "state": "READY_FOR_DECISION",
  "hard_gates": {},
  "quality_score": 94,
  "missing_requirements": [],
  "conflicts": [],
  "expired_evidence": [],
  "approval_required": true,
  "retry_plan": []
}
```

### 3.2 八道硬门

| 门禁 | 核心检查 | 失败状态 |
| --- | --- | --- |
| G1 身份链 | task、tenant、trace 是否唯一一致 | BLOCKED |
| G2 交付完整性 | 必填栏目、候选方案和附件是否齐全 | PARTIAL |
| G3 证据真实性 | 关键结论是否绑定来源和 claim ID | EVIDENCE_MISSING |
| G4 新鲜度 | 价格、库存、政策和状态是否仍有效 | EXPIRED |
| G5 工具回执 | 是否真的调用工具，结果是否可重放 | UNVERIFIED |
| G6 冲突处理 | 部门结论是否存在未裁决冲突 | CONFLICTED |
| G7 权限安全 | 是否涉及身份、付款或不可逆操作 | AWAITING_APPROVAL |
| G8 附件有效性 | 文件能否打开，manifest 是否完整 | ARTIFACT_INVALID |

任何关键门失败，都不得显示 `COMPLETED`。

### 3.3 质量评分

硬门通过后再计算：

| 维度 | 权重 |
| --- | ---: |
| 成果完整度 | 25% |
| 证据接地率 | 25% |
| 用户约束匹配 | 15% |
| 跨部门一致性 | 10% |
| 数据新鲜度 | 10% |
| 可执行性 | 10% |
| 用户体验 | 5% |

状态阈值：

- `0–69`：INCOMPLETE
- `70–84`：PARTIAL
- `85–92`：READY_FOR_REVIEW
- `93–100`：READY_FOR_DECISION
- 高风险动作即使 100 分也只能进入 AWAITING_APPROVAL
- 人工批准并重新校验参数后才能进入 READY_FOR_EXECUTION

### 3.4 补缺循环

```text
门禁发现缺口
  → 生成 GapTask
  → 只重跑相关能力
  → 最多两轮
  → 仍缺失则追问用户或诚实结束为 PARTIAL
```

禁止无限自我反思和无限蜂群重试。

## 4. 核心协议

### 4.1 TaskEnvelope

必须包含：`task_id`、`tenant_id`、`trace_id`、`goal`、`intent`、`constraints`、`risk_level`、`reversibility`、`source_label`、`required_outputs`。

当前 M1 初版只有基础身份、intent、payload、trace 和 metadata，接入生产链前仍需补齐风险、租户、目标、证据与可逆性字段，并消除共享 `trace-unassigned`。

### 4.2 DeliverableContract

它定义“什么才算完成”，至少包含：

- 必需栏目
- 必需附件
- 每类事实的新鲜度
- 证据等级
- 预算和延迟上限
- 失败 fallback
- 人工签核要求

### 4.3 CapabilityCard

每个 Agent、蜂群和 MCP 工具必须登记：

- in-scope / out-of-scope
- 输入输出 schema
- 数据源和信任等级
- 只读、草稿或执行权限
- 成本、延迟和 SLA
- 新鲜度
- fallback
- 版本、健康状态和历史成功率

### 4.4 EvidencePacket

各部不得自由回一段文字，必须提供：事实、推断、建议、来源、时间戳、有效期、假设、冲突、证据缺口、置信度和附件。

### 4.5 OutcomeReceipt

史馆只学习真实结果：最终选择、计划成本、实际成本、是否兑现、人工改判、事故和用户评价。模型自评分不得作为正式飞轮信号。

## 5. MCP、数据源与工具数量估算

MCP Server、数据源和工具不是同一个概念：一个 MCP 可以聚合多个数据源，每个数据源可以提供多个工具动作。

### 5.1 当前仓库事实

`backend/config/mcp_servers.yaml` 当前含 11 个有效 server 定义和 35 个工具定义，但不能视为 11 个生产数据源：邮件存在真实服务 TODO，微信默认 mock，其他服务也需逐个完成认证、SLA、来源和真实回执验证。

### 5.2 高质量 MVP

- 10–14 个受信 MCP
- 20–30 个真实数据源
- 80–120 个工具动作
- 优先覆盖旅行、商业决策、学习和个人效率
- 每个高风险事实至少两个独立来源

### 5.3 人生全域版

| 能力域 | MCP 估算 | 数据源估算 |
| --- | ---: | ---: |
| 通用搜索与知识 | 3–4 | 8–12 |
| 个人文件与记忆 | 2–3 | 4–6 |
| 邮件、日历与沟通 | 3–4 | 6–10 |
| 地图、旅行与本地生活 | 5–7 | 12–18 |
| 学习与研究 | 3–5 | 8–12 |
| 事业、商业与办公 | 5–7 | 12–18 |
| 财务与消费 | 3–5 | 8–12 |
| 健康与运动 | 3–4 | 6–10 |
| 娱乐与内容 | 3–4 | 6–10 |
| 政务、法律与公共信息 | 3–4 | 6–10 |

共享能力去重后的目标规模：25–35 个 MCP、60–90 个真实数据源、150–250 个工具动作。每次任务只懒加载 3–8 个 MCP。

### 5.4 MCP 信任域

建议按权限聚合，而不是一个供应商一个 MCP：

```text
public-research-mcp
personal-knowledge-mcp
calendar-mail-mcp
travel-local-mcp
learning-mcp
business-mcp
finance-mcp
health-mcp
entertainment-mcp
artifact-mcp
notification-mcp
execution-mcp
```

`execution-mcp` 必须与只读服务隔离，所有工具默认人工批准、幂等、预算受限且可审计。

## 6. 普通用户体验所需能力

### 6.1 前端体验

- 一句话输入与最多三个关键追问
- 真实流式任务地图
- 一个推荐方案和两个备选
- 方案比较器、预算滑块、日期选择器和地图
- 文件预览与下载
- 审批、修改、拒绝和取消
- 断线恢复、通知和长期守望
- 高级用户可展开部门证据和完整 trace

AG-UI 提供 Agent 与用户界面的事件协议；MCP Apps 支持工具在对话内返回表单、图表、仪表盘和多步骤交互组件，适合借鉴，但短期无需替换现有 Next.js 前端。

### 6.2 工具能力

- Web/API 搜索与官方来源优先级
- Playwright 只读浏览器，之后逐步开放草稿和批准后提交
- 文件解析、OCR、表格计算和代码沙箱
- PDF、DOCX、XLSX、PPTX、ICS、KML/GeoJSON 和 ZIP manifest
- 地图、日历、邮件、通知和个人知识库
- OAuth/OIDC、Secret Vault、租户隔离和敏感信息扫描
- OpenTelemetry + Prometheus + Agent trace
- 黄金任务、shadow routing 和真实结果评测

## 7. 推荐编排流程

```text
1. 用户下旨
2. 意图识别与风险分级
3. 生成 TaskEnvelope
4. 选择领域任务模板
5. 生成 DeliverableContract
6. 门下省审查任务拆分
7. Capability Router 查询能力卡
8. 懒加载 3–8 个必要 MCP
9. 军机处形成 MissionGraph
10. 多蜂群并行采集
11. EvidencePacket 标准化
12. 确定性成果完成度门
13. 缺口补齐，最多两轮
14. 御史冲突与证据审查
15. 丞相生成三个方案
16. 工部生成成果包
17. 附件完整性验证
18. 用户批准
19. 受控执行
20. 史馆记录 OutcomeReceipt
```

每个复杂任务建议使用 1 个编排器、1–4 个专业执行蜂群、1 个独立验证器和 1 个成果编译器，而不是让所有部门同时出场。

## 8. 技术选择边界

| 场景 | 推荐 |
| --- | --- |
| 简单问答和整理 | 单 Agent / 单 Flow |
| 单领域研究 | 现有 FlowEngine |
| 多部门并行 | 现有 SwarmOrchestrator |
| 工具和数据连接 | MCP |
| 前端流式事件 | AG-UI 思路或兼容适配 |
| 对话内交互组件 | MCP Apps 思路或原生 React 组件 |
| 长期监控、付款、预订 | Temporal PoC |
| 多次人工中断和动态图 | LangGraph 隔离子图 |
| 外部第三方 Agent 协作 | A2A |

MCP Tasks 仍在演进，朝堂 OS 必须保留自己的正式任务状态机。A2A 只用于外部独立 Agent 协作，不替代内部 SwarmOrchestrator。

## 9. OpenClaw、Hermes、Humen/Hume 的适配判断

### 9.1 OpenClaw：可用作“个人入口层”，不替换主链

OpenClaw 定位为运行在用户设备上的开源个人助手，覆盖聊天渠道、语音和可控 Canvas。适合：

- 移动端、桌面和聊天渠道入口
- 本地文件和设备能力
- 用户侧通知与长期在线代理
- 借鉴 Gateway、频道适配和本地优先体验

不适合直接成为朝堂 OS 的正式事实源、质量门或跨租户编排主链。推荐方式是把 OpenClaw 作为 `client/gateway adapter`，只通过受限 API 或 MCP 调用朝堂 OS；正式任务、证据、审批和史馆仍由朝堂 OS 持有。

结论：`ADOPT_AS_OPTIONAL_EDGE_POC`。

### 9.2 Hermes Agent：可用于“个人记忆与技能飞轮 PoC”

Nous Research 的 Hermes Agent 强调跨平台入口、持久记忆、从经验生成技能、定时任务和多种运行环境。适合：

- 研究个人记忆提取和技能生成
- 研究重复任务如何沉淀为可复用 skill
- 作为独立 sandbox worker 执行低风险研究任务
- 对比朝堂史馆的 OutcomeReceipt 飞轮

风险：自我生成技能不能直接进入正式生产能力；任何新 skill 必须经过来源审计、权限扫描、黄金任务、人工复审和版本冻结。Hermes 不应拥有正式任务状态、御史裁决或直接写生产数据的权限。

结论：`ADOPT_AS_ISOLATED_LEARNING_POC`。

### 9.3 Humen：若指 AI SDR，只作为商业获客能力包

公开信息中的 Humen 多指自动潜客研究、个性化外联和会议预约的 AI SDR。它只与事业/商业域相关，可评估：

- 潜客发现与研究
- 外联草稿
- CRM 线索同步
- 会议预约

所有外发消息必须先进入草稿和人工审批；不得让第三方 SDR 直接持有朝堂用户全域记忆。

结论：`EVALUATE_AS_BUSINESS_DOMAIN_PROVIDER`，不是平台核心。

### 9.4 如果用户指 Hume AI：适合作为情感语音入口

Hume AI 提供实时情感语音交互和多语言语音能力，可用于：

- 更自然的语音下旨
- 识别犹豫、焦虑或挫败，调整交互节奏
- 老年人、无障碍和陪伴型入口
- 低延迟语音反馈

情绪推断只能用于体验适配，不能作为医疗诊断、风险裁决或事实证据。语音和表达数据属于高敏感数据，需要明确同意、最小化保留和关闭选项。

结论：`ADOPT_AS_OPTIONAL_VOICE_POC`。

### 9.5 如果用户指 human-in-the-loop：必须采用

HITL 不是可选插件，而是付款、身份、邮件外发、删除、签约、发布和其他不可逆动作的核心安全机制。流程必须是：

```text
Agent 提议动作
  → 系统暂停并展示完整参数
  → 用户批准、修改或拒绝
  → 执行前重新校验权限、价格和幂等键
  → 执行
  → 生成真实回执
```

结论：`REQUIRED_CORE_CONTROL`。

## 10. 行业趋势判断

1. 从聊天回答转向 durable task：任务可轮询、取消、恢复和延迟取结果。
2. 从巨大工具列表转向能力注册、工具搜索和懒加载。
3. 从文本气泡转向 Agent 原生表单、比较器、地图和审批卡。
4. 从追求完全自主转向“可批准的自主”。
5. 从一次执行转向 checkpoint、幂等、重试和事件历史。
6. 从模型自评分转向工具回执、真实结果和用户改判。
7. 从单一框架转向 MCP（工具）、A2A（外部 Agent）、AG-UI（用户交互）各司其职。

## 11. 实施路线

```text
M1 完整 TaskEnvelope / TraceContext
  → M2 CapabilityCard
  → M5 EvidencePacket
  → M6-A 成果完成度门禁
  → M6-B MCP Registry 与信任/权限/新鲜度
  → 旅行能力包
  → 商业决策能力包
  → 个人效率与学习能力包
  → 成果包生成
  → 受控执行
  → 长期守望和结果飞轮
```

第一阶段量化目标：

- 12 个可信 MCP
- 25 个真实数据源
- 100 个工具动作
- 50 个旅行黄金任务
- 50 个商业决策黄金任务
- 重要事实证据关联率不低于 95%
- 无来源硬数字为 0
- 错误完成声明为 0
- 高风险动作人工批准率为 100%

## 12. 优点、代价与最终判断

优点：前台简单、后台可扩展；结果可验证；工具可替换；高风险可控；生活、学习、事业和娱乐共用同一个可靠内核。

代价：数据授权和供应商维护成本高；多源交叉验证增加延迟；个人全域数据扩大隐私责任；长期任务需要可靠运行基础设施。

最终判断：朝堂 OS 应继续以现有编排主链为核心。OpenClaw、Hermes、Humen/Hume 都可以用，但只能作为经过边界适配的入口、学习实验、领域供应商或语音体验，不能成为新的正式事实源或第四条运行主线。

## 13. 主要资料

- [OpenClaw GitHub](https://github.com/openclaw/openclaw)
- [OpenClaw 官网](https://openclaw.ai/)
- [Hermes Agent GitHub](https://github.com/NousResearch/hermes-agent)
- [Hermes Agent 文档](https://hermes-agent.nousresearch.com/docs/)
- [Hume AI EVI](https://dev.hume.ai/docs/speech-to-speech-evi/overview)
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/)
- [OpenAI Agents SDK HITL](https://openai.github.io/openai-agents-python/human_in_the_loop/)
- [MCP Tasks](https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/tasks)
- [MCP Apps](https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/)
- [MCP Elicitation 安全](https://modelcontextprotocol.io/specification/2025-11-25/client/elicitation)
- [A2A Protocol](https://a2a-protocol.org/v0.3.0/specification/)
- [AG-UI](https://docs.ag-ui.com/introduction)
- [LangGraph Persistence](https://docs.langchain.com/oss/python/langgraph/persistence)
- [OpenTelemetry](https://opentelemetry.io/docs/)

## 14. 研究说明

本方案结合当前仓库的 MCP 配置、部门回奏协议和执行计划，并核对 OpenClaw、Hermes Agent、Hume AI、MCP、A2A、AG-UI、OpenAI Agents SDK、LangGraph 与 OpenTelemetry 的官方资料。`Humen` 的官方身份无法从名称唯一确认，因此文档分别覆盖 AI SDR、Hume AI 和 human-in-the-loop 三种可能含义；在获得准确链接前，不把任何一种解释当作已确认事实。

## 15. 已批准的第三方集成原则

业主已同意采用以下技能洞察：

> 用“外部集成网关 + 适配器 + 候选结果协议”替代“把第三方框架安装进核心系统”。任何第三方组件都必须可拔除；卸载任意一个组件不得破坏朝堂 OS 的正式任务、证据、审批和史馆主链。

### 15.1 总体边界

```text
用户 Web / App
├─ 内置聊天、语音和交互组件
├─ OAuth 云连接器
└─ 可选 Local Companion
       ↓
External Integration Gateway
├─ OpenClaw Adapter
├─ Hermes Sandbox Adapter
├─ Humen Business Adapter
├─ Hume Voice Adapter
└─ MCP Tool Gateway
       ↓
TaskEnvelope / CapabilityCard
       ↓
朝堂 OS 正式主链
       ↓
EvidencePacket / 完成度门 / 御史门
       ↓
Human Approval
       ↓
Controlled Execution / OutcomeReceipt
```

第三方系统不得直接拥有或修改：

- 正式任务数据库
- FinalMemorial
- 史馆正式记录
- 用户支付状态
- 身份凭据
- 权限和风险等级
- 成果完成状态

第三方只能通过版本化 schema 提交候选结果、工具回执和附件；朝堂 OS 重新验证后才允许进入正式链路。

### 15.2 客户部署策略

| 客户类型 | 默认体验 | 是否安装 |
| --- | --- | --- |
| 普通用户 | 平台内置连接器和 OAuth 授权 | 不安装第三方框架 |
| 隐私/本地用户 | Local Companion 访问本地文件和设备 | 可选一键安装 |
| 企业客户 | 私有 Gateway、内网 MCP 或自托管 Connector | 由企业管理员部署 |

普通用户不需要理解 Docker、MCP、Agent 或模型供应商。只有访问本地设备、企业内网或严格隐私数据时，才提供可选本地组件。

### 15.3 第三方与部门归属

| 第三方 | 核心定位 | 主要部门/机构 | 部署建议 |
| --- | --- | --- | --- |
| OpenClaw | 个人设备、聊天渠道和本地入口 | 礼部、军机处、工部、吏部、锦衣卫 | 平台兼容接口；Local Companion 可选 |
| Hermes Agent | 记忆、技能生成和低风险独立 worker | 翰林院、史馆、吏部、工部、御史台、锦衣卫 | 平台侧隔离 PoC；普通用户不安装 |
| Humen AI SDR | 潜客、外联和会议预约 | 锦衣卫、户部、礼部、刑部、工部 | SaaS/API/MCP 连接；外发前人工批准 |
| Hume AI | 情感语音和实时语音入口 | 礼部、工部、锦衣卫、御史台 | Web/App SDK；用户无需安装 |
| Human-in-the-loop | 高风险动作审批 | 门下省、御史台、用户圣裁、工部 | 产品核心内置，不作为可选插件 |

## 16. 当前 Git 冲突与治理方案

截至 2026-07-18，`feature-chaotang-ext` 正在合并 `origin/pr/p8-from-origin`，存在 4 个 `both added` 冲突，全部位于根级 Harness change 摘要：

1. `chore-agent-harness-baseline-20260717/summary.md`
2. `docs-department-agent-architecture-packet-spec-20260717/summary.md`
3. `feat-department-anti-hallucination-clause-20260717/summary.md`
4. `feat-gongbu-storage-pipeline-engine-20260717/summary.md`

根因不是运行时代码冲突，而是不同分支在独立历史中创建了相同 Change ID 和相同路径，P8 又携带了多个早期 packet 的 review/approval 文档。

推荐语义解决：

- M0：保留本地完整内容，补充 `Packet ID: P10`，状态维持 `VERIFIED_PARTIAL`。
- 架构任务书：采用时间更新后的 `P6.1` 和“文档已完成”事实，但明确不代表生产发布完成。
- 反幻觉条款：补充 `Packet ID: P6.3`，状态维持 `VERIFIED_PARTIAL`。
- 工部引擎：补充 `Packet ID: P6.2`，状态维持 `VERIFIED_PARTIAL`。
- 所有 approval envelope 的 `LOCAL_FEEDBACK_ONLY` 必须保留，不能解释成远端 required check。

### 16.1 后续防冲突规则

1. 一个 Change ID 只有一个 owner 和一个创建分支。
2. 每个 Agent 使用独立 worktree 和独立暂存区。
3. 一个 PR 只包含一个模块及其 review/approval。
4. 候选分支合并前在临时 integration worktree 预演。
5. 使用 merge train 串行进入 integration。
6. 每次合并后，后续候选基于最新 integration 重新验证。
7. 无精确 HEAD 的独立复审，不得合入正式分支。
8. 外部 required check 未配置时，不得宣称生产门禁已生效。

## 17. 分阶段落地行程

### 阶段 A：先恢复工程收敛

- 语义解决当前 4 个 summary 冲突。
- 保留范围外后端未提交改动，不混入 merge commit。
- 完成 root/backend doctor、diff check 和 approval envelope 检查。
- 从远端稳定基线创建唯一 integration 分支。

### 阶段 B：完成可靠任务内核

- 补全 TaskEnvelope / TraceContext。
- 建立 DeliverableContract。
- 建立 CapabilityCard Registry。
- 建立 EvidencePacket。
- 实现成果完成度八道硬门。

### 阶段 C：建设 MCP 信任层

- 清点现有 11 个 server/35 个工具的真实、mock 和 TODO 状态。
- 为每个 MCP 登记信任、权限、新鲜度、成本和 fallback。
- 读取与写入 MCP 分离。
- 实现工具懒加载，每个任务只启用 3–8 个 MCP。
- 第一阶段达到 12 个可信 MCP、25 个真实数据源和 100 个工具动作。

### 阶段 D：完成第一个旅行垂直切片

- 以“二人赴美国观看世界杯决赛、预算八万元、稳妥优先”为黄金任务。
- 完成赛事、入境、球票、航班、酒店、交通、保险、预算和备用方案。
- 输出三个方案及 PDF、XLSX、ICS、地图和证据 JSON。
- 第一版只提供官方购买入口，不自动付款。
- 运行 50 个旅行黄金任务并达到证据率与错误完成率门槛。

### 阶段 E：第三方隔离 PoC

- OpenClaw：入口与 Local Companion PoC。
- Hermes：Sandbox 技能/记忆飞轮 PoC。
- Humen：商业获客供应商 PoC，仅生成草稿。
- Hume：语音下旨 PoC，情绪识别可关闭。
- 每个 PoC 独立 change、独立回滚，不共享正式事实写权限。

### 阶段 F：受控执行与长期守望

- 内置 human-in-the-loop 审批卡。
- 引入幂等、预算上限、取消/退款状态和真实回执。
- 对长期监控、预订和支付评估 Temporal。
- 只有复杂人工中断子图才评估 LangGraph。
- 用 OutcomeReceipt 建立真实结果飞轮。

## 18. 最终验收

只有同时满足以下条件，才能称为全域服务的可靠第一版：

- 100 个旅行与商业决策黄金任务稳定通过。
- 重要事实证据关联率不低于 95%。
- 无来源硬数字为 0。
- 错误完成声明为 0。
- 高风险动作人工批准率为 100%。
- 所有第三方组件都能禁用或卸载，正式主链仍可运行。
- 每个第三方都有 CapabilityCard、权限边界、fallback、审计和回滚。
- 当前精确 HEAD 通过独立复审和外部 required check。

## 19. 最终执行优先级

以下顺序是本方案的唯一默认执行队列。它保留既有
`M0 → M1 → M2 → M5 → M6 → M3 → M4 → M7 → M8 → M9 → M10`
主依赖，只在模块之间补入 Agent/Skill 治理、垂直场景和用户体验交付。

```text
P0 工程收敛
  → P1 黄金任务与基线
  → P2 核心任务/成果契约
  → P3 AgentRoleCard / SkillCard 治理契约
  → P4 CapabilityCard Registry
  → P5 EvidencePacket 内容质量协议
  → P6 完成度门 + 御史证据门
  → P7 第一批高质量 Skills
  → P8 自适应路由 + 懒加载 + 预算
  → P9 MCP 信任层与真实数据源
  → P10 OutcomeReceipt 与史馆飞轮
  → P11 旅行垂直闭环
  → P12 商业决策垂直闭环
  → P13 用户体验与成果包
  → P14 生产 Trace / KPI / 受控执行
  → P15 第三方和编排框架隔离 PoC
```

| 优先级 | 对应模块 | 必须完成的成果 | 为什么排在这里 | 退出条件 |
| --- | --- | --- | --- | --- |
| P0 | 工程治理 | 解决当前 4 个 merge 冲突，隔离范围外脏改动，恢复唯一 integration 基线 | 不先恢复收敛，任何新模块都无法得到可信 HEAD、复审和回滚 | merge 完成；doctor/diff/packet 检查有真实记录 |
| P1 | M0 | 冻结旅行、商业两组黄金任务和 known-red | 先定义“好结果”，否则 Agent、Skill 和路由只能优化主观感觉 | 至少 50+50 个分层案例，含拒答、冲突、缺证据和高风险样本 |
| P2 | M1 扩展 | 完整 TaskEnvelope、TraceContext、DeliverableContract | 所有执行者必须先共享同一任务与交付定义 | 入口、路由、Flow、Swarm 全链透传；缺关键字段 fail closed |
| P3 | 治理前置 | AgentRoleCard、SkillCard、生命周期和版本规则 | 先定义岗位与技能边界，避免继续复制 prompt 和重复 Skill | schema、正反例、owner、升级/停用规则冻结 |
| P4 | M2 | CapabilityCard Registry 与健康状态 | 路由只能选择已注册、已验证、权限明确的能力 | active 能力均有 owner、输入输出、工具、成本、延迟、fallback、拒答集 |
| P5 | M5 | EvidencePacket、ToolCallReceipt、ArtifactManifest | 内容质量必须变成机器可验证协议，而不是模型自评 | 事实/推断/建议分层；无来源硬数字自动阻断 |
| P6 | M6 | CompletionVerdict 八道硬门、御史冲突门、最多两轮补缺 | 先建立“什么时候算完成”，再扩大蜂群 | 确定性 gate 有正负例；高风险永远不能仅凭高分自动通过 |
| P7 | Skill 生产 | 12 个公共基础 Skill，随后旅行/商业领域 Skill | 路由需要经过评测的候选能力，不应路由到一堆文档资产 | 每个 Skill 5–10 个黄金案例、触发/近似不触发测试、成本与失败路径 |
| P8 | M3/M4 | shadow routing、Skill/Agent 懒加载、预算与停止条件 | 契约和候选能力稳定后，智能路由才有可比较对象 | D0 不启蜂群；复杂任务仅启动 3–7 个 Agent、5–15 个 Skill；无无限循环 |
| P9 | MCP 信任层 | 可信 Registry、读写分离、权限/新鲜度/fallback、真实数据源 | 没有可靠数据，编排越聪明只会更快地产生精致幻觉 | MVP 达到 10–14 个可信 MCP、20–30 个真实源、80–120 个动作 |
| P10 | M7 | OutcomeReceipt、人工改判、真实结果和失败归因 | 只有真实结果才能训练路由和技能飞轮 | 正式任务都有结果状态；未兑现不得标成功 |
| P11 | M8 第一纵切 | 世界杯赴美旅行完整任务包 | 用一个高价值、跨部门、强时效场景验证整个系统 | 50 个旅行黄金任务；证据率、预算、备选、附件和审批均达标 |
| P12 | M8 第二纵切 | 生意是否值得做的全方位决策包 | 验证系统能从生活服务扩展到复杂事业决策 | 50 个商业黄金任务；市场、竞争、财务、风险、情景与反方完整 |
| P13 | 前端/Artifact | 渐进式披露、比较卡、审批卡、PDF/XLSX/ICS/地图/证据 JSON | 普通用户感知的是成果与掌控感，不是后台 Agent 数量 | 用户无需理解 Agent/MCP；结果可查看、下载、修订、批准 |
| P14 | M9 + 执行 | 生产 Trace、KPI、幂等、取消、预算上限、受控执行 | 在真实执行前必须可观测、可停止、可追责 | 关键 KPI 有真实数据；支付、外发、删除等动作 100% 按策略审批 |
| P15 | M10/PoC | OpenClaw、Hermes、Humen/Hume、LangGraph/Temporal 隔离实验 | 第三方只能解决已被证实的缺口，不能反客为主 | 可拔除；不写正式事实源；用黄金任务证明净收益后再评审 |

### 19.1 必须串行与可并行项

必须串行：`P0 → P1 → P2 → P4 → P5 → P6 → P8 → P10`。这些步骤分别冻结基线、
契约、能力事实源、证据、完成定义、执行策略和结果学习；跳过任何一层都会让后一层缺少可验证输入。

可在不共享文件时并行：

- P3 的 AgentRoleCard 与 SkillCard 示例可以分包编写，但 schema 需统一评审。
- P7 的旅行、商业、研究、比较、成果生成 Skill 可以按能力包并行，最终统一进 Registry。
- P9 的只读数据源连接器可以按信任域并行，写操作连接器必须后置。
- P11 的附件生成前端与后端旅行研究链可以并行，但必须通过同一 DeliverableContract 验收。
- P13 的 UI 原型可提前做，LIVE 状态接线必须等待后端契约和真实回执。

禁止并行：多个分支创建同一 Change ID、修改同一正式 schema、维护第二份任务/审批/史馆事实源。

## 20. 当前完成度审计

本节区分“仓库已有资产”和“可在正式主链使用的已验证能力”。数量不代表可用性，设计文档、
prompt、mock 工具和局部单测均不能单独证明产品闭环。

| 领域 | 当前事实 | 判断 | 下一缺口 |
| --- | --- | --- | --- |
| Git/集成 | `feature-chaotang-ext` ahead 26、behind 21，存在 4 个 `AA` 冲突 | `BLOCKED` | 完成 P0 语义合并，保留其他协作者脏改动 |
| M0 基线 | 已有基线提交和 known-red 记录；全量曾为 2703 passed、7 known-red | `VERIFIED_PARTIAL` | 当前冲突解决后重新绑定精确 HEAD，并完成独立复审 |
| M1 契约 | `TaskEnvelopeV1`、`TraceContext` 和 3 个单元测试已存在 | `IMPLEMENTED_PARTIAL` | 缺 `tenant_id/goal/risk_level/reversibility/evidence_state/source_label`；默认 `trace-unassigned` 未 fail closed；尚未证明全链透传 |
| Agent 资产 | `backend/agent_design/` 约 594 个文件；`backend/runtime_prompts/` 有 71 套 `AGENTS.md/IDENTITY.md` 角色资料 | `ASSET_RICH, RUNTIME_UNPROVEN` | 去重、角色卡化、绑定 CapabilityCard、黄金评测、健康状态和停用机制 |
| Skill 资产 | 367 份 `SKILL.md`，但仅 43 个唯一目录名，大量跨部门复制 | `DUPLICATED_ASSETS` | 唯一 Registry、版本、owner、近似不触发测试、评测晋级和懒加载 |
| M2 Capability | 尚未发现本计划对应的独立 CapabilityCard Registry 模块 | `NOT_STARTED` | 建 schema、注册表、健康状态、fallback 与未知能力 fail closed |
| M5/M6 质量 | 已有正式奏折质量门、御史相关实现与本文规格，但无统一 EvidencePacket/CompletionVerdict 运行闭环证据 | `PARTIAL_FOUNDATION` | 统一证据协议、八道硬门、冲突处理和补缺上限 |
| 编排 | FlowEngine、SwarmOrchestrator 和正式下旨主链已经存在 | `FOUNDATION_EXISTS` | 仍需基于能力/风险/质量/成本的 shadow routing、预算和懒加载 |
| MCP/数据 | 配置约 11 个有效 server、35 个工具；含 mock、邮件 TODO、微信默认 mock | `DEMO_MIXED` | 建真实性分级；替换关键 mock；增加旅行/商业权威源与 fallback |
| M7 Outcome | 已有史馆/事件账本基础，但未证明统一 OutcomeReceipt 和长期结果飞轮 | `PARTIAL_FOUNDATION` | 区分“已输出、已批准、已执行、已兑现、失败/退款” |
| 垂直产品 | 旅行和商业闭环已定义，尚无 50+50 黄金任务通过证据 | `DESIGN_ONLY` | 先完成旅行纵切，再复制到商业决策 |
| 用户体验 | 已定义成果包、审批卡和渐进式披露 | `DESIGN_ONLY` | 可用界面、移动入口、进度/中断/恢复、附件下载和真实浏览器证据 |
| 生产质量 | KPI、Trace、第三方隔离边界已定义 | `NO_REAL_KPI_DATA` | 真实任务遥测、成本/延迟/改判/兑现数据和外部 required check |

综合判断：目前系统拥有较强的朝堂组织模型、运行主链和大量 Agent/Skill 素材，但距离“普通用户可托付的
高质量全域智能服务”仍处于 `IMPLEMENTATION_PARTIAL / READY_FOR_ITERATION`。最接近的是治理与编排骨架，
最薄弱的是统一成果契约、真实数据、可量化内容质量、垂直闭环和普通用户体验。

## 21. Agent 与 Skill 的最终生产方法

### 21.1 五层对象必须分开

| 对象 | 定义 | 例子 | 不允许承担 |
| --- | --- | --- | --- |
| Agent | 对结果负责、可升级问责的稳定岗位 | 丞相、门下省、御史台、礼部、户部 | 不把每个小步骤都做成新 Agent |
| Skill | 可复用、可测试、可版本化的标准作业程序 | 交叉验证、比较三方案、预算测算 | 不持有身份、长期状态或最终审批权 |
| Tool/MCP | 读取事实或执行动作的接口 | 航班查询、地图、日历、CRM | 不决定任务是否完成 |
| Flow | 单个能力包内的确定性步骤与状态机 | 旅行方案生成流程 | 不创建第二套正式任务事实源 |
| Swarm | 为一次复杂任务临时组建的最小协作队 | 旅行研究小组 | 不默认常驻、不无限扩张 |

### 21.2 第一版岗位规模

- 6–8 个稳定治理岗位：丞相、军机处/中书、门下省、御史台、史馆、工部执行控制、人工圣裁等。
- 8–12 个领域负责人：六部加锦衣卫、钦天监、翰林院等；只在领域任务中加载。
- 5 个通用 worker 模板：Collector、Analyst、Planner、Challenger、ArtifactMaker。
- 每个复杂任务只激活 3–7 个 Agent；不能用更多 Agent 掩盖契约或数据缺口。

AgentRoleCard 必填：`mission`、`owns`、`does_not_own`、`accepts`、`produces`、
`allowed_tools`、`forbidden_tools`、`skills`、`budget`、`stop_conditions`、`escalation`、
`golden_cases`、`version`。

### 21.3 第一批 Skill 顺序

先做 12 个跨域基础 Skill：

1. `clarify-user-goal`
2. `build-task-envelope`
3. `build-deliverable-contract`
4. `decompose-mission`
5. `select-minimum-capabilities`
6. `search-primary-sources`
7. `normalize-evidence`
8. `cross-check-claims`
9. `resolve-evidence-gaps`
10. `compare-three-options`
11. `audit-completion`
12. `build-outcome-receipt`

然后再做旅行能力包，最后做商业决策能力包。旅行包优先，因为它能同时验证时效数据、预算、地理、
政策、多个供应商、附件和高风险购买审批；商业包在相同内核上增加市场、竞争、现金流、法规、
情景分析和反方论证。

每个 Skill 必须拥有：明确触发语义、`should_not_trigger`、输入输出 schema、依赖工具、证据规则、
失败行为、审批要求、成本/延迟预算、5–10 个黄金案例、至少一个近似不触发负例、版本和 owner。

生命周期统一为：

```text
DRAFT → CANDIDATE → EVALUATED → SHADOW → ACTIVE → DEPRECATED → RETIRED
```

Hermes 或其他模型生成的新 Skill 只能进入 `CANDIDATE`，不得直接进入 `ACTIVE`。

## 22. 内容质量与用户体验的双重验收

### 22.1 内容质量

系统回答“完整”之前必须同时满足：

- 用户目标、约束、预算、时间、风险偏好已被结构化。
- DeliverableContract 中每个交付项都有状态和证据。
- 重要事实有来源、抓取时间、适用范围和新鲜度。
- 事实、推断、建议和未知项明确分开。
- 冲突证据已解决，或显式呈现给用户裁决。
- 工具调用有真实回执，不能用文字声称代替执行。
- 附件有 manifest、hash、版本和生成时间。
- 不可逆动作仍处于待批准状态，除非有合法授权和执行回执。

### 22.2 用户体验

用户默认只看到：一句结论、三个可选方案、关键理由、风险、下一步和“查看完整攻略/下载成果包/批准执行”。
证据、Agent 过程、冲突、工具日志和完整 Trace 放在可展开层。这样既保持简单，又让高要求用户能够核验。

用户体验核心指标：首次有效结果时间、任务完成率、修订次数、错误完成声明、人工改判率、成果下载率、
7/30 日复用率、真实结果兑现率；不能用对话轮数或 Agent 数量当作成功指标。

## 23. 接下来六个可执行 Packet

| 顺序 | Packet | 范围 | 明确不做 | 验收 |
| --- | --- | --- | --- | --- |
| 1 | P0-Integration-Recovery | 语义解决当前 4 个冲突，完成精确 HEAD 验证 | 不混入 8 个后端脏文件和其他未跟踪目录 | merge 状态清零；doctor/diff/packet 检查记录完整 |
| 2 | P1-Golden-Tasks | 冻结旅行/商业各 50 个案例与质量 rubric | 不写运行时 | 案例覆盖 D0–D2、拒答、冲突、缺证据、过期、高风险 |
| 3 | P2-Core-Contracts | 补齐 TaskEnvelope/TraceContext，新增 DeliverableContract | 不改业务路由策略 | schema、兼容适配、全链透传和 fail-closed 测试通过 |
| 4 | P3-Quality-Contracts | EvidencePacket、Receipt、ArtifactManifest、CompletionVerdict | 不接第三方 | 契约正反例和确定性 validator 通过 |
| 5 | P4-Agent-Skill-Governance | AgentRoleCard、SkillCard、Registry、生命周期 | 不批量搬运 367 份旧 Skill | 旧资产盘点映射；12 个基础 Skill 进入 CANDIDATE/EVALUATED |
| 6 | P5-Completion-Gate | 八道硬门、御史冲突门、两轮补缺上限 | 不实现自动支付 | 黄金任务能稳定输出 incomplete/partial/review/decision-ready |

完成这六个 Packet 后，系统才具备扩展智能路由、真实 MCP 和旅行纵切的可靠地基。当前下一步不是新增更多
部门或框架，而是先执行 Packet 1，恢复工程收敛。

## 24. 大神会审结论

🎲 大神会审（Taiichi Ohno · 精益系统 × Andrej Karpathy · Agent 系统）

⚠️ 警示（Ohno）：367 份 Skill 文件只有 43 个唯一名称，说明当前最大风险是重复库存和维护漂移，
不是能力数量不足。

⚠️ 警示（Karpathy）：没有黄金任务、统一结果协议和真实 outcome 的多 Agent 路由，本质上无法知道
“智能”是否提升，只能观察到调用更复杂、成本更高。

💡 天才建议（Ohno）：先建立唯一 Skill Registry，把旧资产全部标成 `UNASSESSED`，按真实调用和评测
逐个晋级，不进行一次性大迁移。

💡 天才建议（Karpathy）：用两个纵向黄金场景驱动内核，把每个失败沉淀为评测样本；只有真实任务证明
需要时，才增加 Agent、Skill、MCP 或新框架。

🔧 推荐技能：`blueprint`——每个 Packet 切成可独立复审、可回滚的冷启动任务；触发时机：每个跨 3 个以上
模块的立项前一次（估测）。`skill-creator`——用触发/近似不触发对照集评测 Skill；触发时机：每个 Skill
进入 `EVALUATED` 前一次（估测）。

🆕 技能洞察：可替换“每部门复制一套通用 Skill” → “唯一公共 Skill + 部门 CapabilityCard 引用”；
更好技巧是基于真实 OutcomeReceipt 做晋级/降级，而不是按文档完整度判断能力。当前这是比继续扩充 Agent
数量更高杠杆的方案。
