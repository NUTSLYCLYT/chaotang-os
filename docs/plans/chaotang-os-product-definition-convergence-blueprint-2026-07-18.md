# 朝堂 OS 产品定型融合蓝图：超级任务助手与全朝堂能力体系

> 状态：`ACCEPTED_DECISION_RECORD`（2026-07-18）；保留定型理由，不再作为可变产品事实源
> 日期：2026-07-18
> 当前且持续有效的产品字段事实源：[`docs/product/PROJECT_PRODUCT.md`](../product/PROJECT_PRODUCT.md)
> R0/R1 发布范围与验收：[`product-r0-trusted-kernel/PRD.md`](../product/releases/product-r0-trusted-kernel/PRD.md)
> 候选输入与读取快照：见本 change 的 [`source_inputs/README.md`](../../.harness/changes/docs-product-definition-convergence-20260718/source_inputs/README.md)
> 业主方向（2026-07-18）：产品本体是“用户超级助手 + 动态多 Agent 朝堂”；世界杯是案例；长期覆盖六部及其专属司
> 变更性质：已接受的产品与跨线架构定型记录；不修改运行时代码，不安装第三方，不开启自动学习
> 阅读规则：正文保留提案当时的比较、候选契约与历史判断；若与产品 SSOT 或 R0/R1 PRD 冲突，以二者为当前真值
> 发布修订：原 `R1 六部最小覆盖 → R2 合同包` 顺序已被 2026-07-18 产品冻结替换，见第 11.3 节

## 0. 定型裁决

### 0.1 一句话产品定义

> **朝堂 OS 是面向个人与团队的可信超级任务助手：用户只需说出目标，系统便动态召集六部、专属司与蜂群中最合适的 AI 班子，把复杂任务办成有证据、有附件、有下一步、可授权、可复盘的完整成果。**

对用户，它永远是一个会听旨、会追问、会交付的超级助手；对系统，它才是丞相、军机处、六部诸司、专署、御史和史馆组成的动态多 Agent 朝堂。

用户买的不是 Agent 数量、六部角色或 token，而是四件事：

1. 更快弄清真正的问题；
2. 关键事实有据、缺口和时效可见；
3. 得到能直接使用的结果与附件；
4. 所有现实动作仍由用户控制，后来结果能被复盘。

长期北极星体验冻结为（守望与现实代办按 release flag 解冻）：

```text
一旨：自然语言说目标
一卡：确认目标、假设、计划、预算和交付物
一包：收到结论、附件、证据和下一步
一守望：只在事实真正改变时提醒和刷新
```

### 0.2 一位助手、一个内核、六部诸司、N 种任务

业主已经明确产品本体不是合同工具。最终采用 `1 + 1 + 6 + N`，并把商业切口与产品范围分开：

| 层 | 定型内容 | 当前状态 |
| --- | --- | --- |
| 1 位用户超级助手 | 上书房入口与丞相主对话；用户无需学习 Agent 拓扑 | 产品身份与首页定义 |
| 1 个可信任务内核 | 理解、计划、组阁、采证、审查、成果、授权、归档、真实结果 | 所有场景共用的唯一主链 |
| 6 部及全部专属司 | 吏、户、礼、兵、刑、工的 `TARGET_DIRECTORY_V1` 与横向专署 | 目录治理目标；登记不代表实现、Beta 或生产 |
| N 个任务场景 | 世界杯旅行、商业判断、合同、招聘、财务、产品、销售、守望等 | 同一内核的动态组合与黄金任务 |
| 1 个首个收费专业包 | 制造业/B2B 合同审查 | GTM 切口，不代表产品边界 |

关键取舍：

- **超级助手是产品本体**；官网首页、上书房和主用户旅程都从“说出目标、动态组阁、交付成果”出发；
- **六部诸司完整覆盖是能力治理目标**；目录、契约和沙箱可并行，生产实现与对外承诺必须按 release 逐能力解冻；
- **合同审查是首个收费专业包**，因为已有客户画像、证据结构、人工裁决和定价假设；它应进入解决方案页，不能反过来定义整个朝堂 OS；
- **世界杯旅行是旗舰复杂任务案例与跨域黄金验收**，用于证明赛事、入境、机酒、交通、预算、保险、Plan B 和多附件一致性，不是第二条销售主线；
- **商业决策包是第二个收费专业包候选**，`5 家试用 / 3 家复用 / 1 家付费 / 1 条可公开证言` 只是必要条件，仍需满足下方统一解冻公式；
- **生活、学习、事业、娱乐都是任务宇宙**，但“目录覆盖”不等于“能力已验证”，产品必须逐项展示成熟度和拒答边界；
- **R0/R1 先验证合同纵切，R2 才是邀请制 1.0**；守望和代办分阶段开放，真实付款、预订、签约和发信不属于首发默认能力。

第二个收费专业包没有任何单门捷径，解冻公式统一为：

```text
合同商业门 5/3/1/1
AND 合同质量/安全 release gate
AND 跨域 benchmark portfolio（含世界杯旗舰案例）
AND 平台单位经济门
AND 候选新包自身 release gate
```

平台单位经济门暂定为：至少 30 个真实付费合同任务有完整成本归集，扣除模型、工具、OCR、存储和人工复核后的任务贡献毛利中位数 `≥60%`、P10 `≥0`，且不存在未披露专家补贴；样本不足就是 `NO_DATA`。

候选新包不能继承合同包的质量或付费证据，必须另有：版本化支持/拒答/专家升级矩阵；领域专家双人标注 holdout；关键错误、伪完成、应升级未升级和未授权 effect 为 `0`；真实 pilot/live canary；该包自己的 `5 个目标用户或团队试用 / 3 个独立用户复用 / 1 笔付费或有约束采购 / 1 个可核验 outcome`；至少 10 个完整成本 pilot 任务证明单任务贡献不为负，并在 30 个付费任务后达到上述规模化毛利门。任一项 `NO_DATA` 都不能正式上架或规模销售；为收集证据可签明确标注实验边界、人工复核和退出条件的受控付费共创。五重门只约束新的正式收费承诺，不禁止六部诸司继续做目录治理、沙箱评测和内部集成。

### 0.3 为什么这样融合

如果把合同工具当成产品本体，会违背用户已经确认的“超级助手 + 全朝堂”方向；如果把“六部齐全”误写成所有能力都已可用，又会变成万能助手空承诺。

因此必须分开三件事：

- **开发覆盖**：六部及所有目标司都进入唯一能力目录、契约和评测体系；
- **任务激活**：每次只召集完成当前 MissionContract 所需的最小班子，不默认六部全开；
- **发布/商业化**：每项能力按成熟度独立开放，合同只是第一个收费专业包。

这同时保留产品野心、技术复用和商业聚焦：能力宇宙可以全面建设，用户每次仍只面对一个助手、一个计划和一个成果包；没有真实能力的领域诚实返回缺口，不靠部门人设兜底。

## 1. 两份候选方案的比较与去留

### 1.1 核心比较

| 维度 | 候选 A：超级任务交付 | 候选 B：全域服务质量/MCP | 当前产品事实源 | 融合裁决 |
| --- | --- | --- | --- | --- |
| 产品定位 | 高价值复杂任务成果系统 | 覆盖人生全域的私人内阁 | 企业老板 AI 决策执行 OS + FULL_COURT_V1 开发裁决 | 用户超级助手是产品本体，动态朝堂是内核，六部诸司是能力宇宙，合同是首个收费包 |
| 用户入口 | 快办、深办、代办 | 问策、办事、守望 | 上书房单一正式入口 | 问策/办事/守望是意图；快办/标准/深办是系统策略；代办是授权后的阶段 |
| 用户体验 | 一旨、一卡、一包，结论先行 | 一道旨、三个选择、前端组件 | 老板一句话到奏折裁决 | 一旨、一卡、一包、一守望；普通用户不看 Agent 拓扑 |
| 任务模型 | GoalBrief、WorkPackage、Claim、Artifact、Action | TaskEnvelope、DeliverableContract、Capability、Evidence、Outcome | DecisionTask 与正式奏折主链 | 统一版本化协议栈并映射到现有 canonical 对象，不新建第二状态库 |
| 质量门 | 门下、御史、证据/附件/授权硬门 | 八道完成度硬门与质量分 | `FinalMemorial` 唯一成文门 | C1–C7 在成文前，C8 在成文后附件交付前，避免循环依赖 |
| 状态 | 覆盖 NO_DATA、PARTIAL、补偿等 | 一个 state 混合质量/审批/执行 | 多对象分层状态 | 状态正交；用户只看派生阶段，不再用一个 COMPLETED 混合所有含义 |
| 能力组织 | 六部治理、动态专案能力执行 | Capability Registry + 1–4 蜂群 | 六部观察面，同一执行主线 | 全部六部/司进入 Coverage Matrix；部门负责治理、能力卡负责办事、每单最小激活 |
| Agent 数量 | 复杂任务默认约 6，设硬预算 | 1 编排器 + 1–4 蜂群 + 验证器 | 不以数量验收 | D0 最多 1、D1 最多 3、D2 最多 6、高风险最多 9；是硬上限而非起步编制 |
| MCP/工具 | 强调连接器但不过度定量 | 给出大量 MCP/数据源/工具数量 | 现有配置含 mock/TODO | 数量不是里程碑；只按黄金任务覆盖率、真实回执和安全等级解冻 |
| 知识/飞轮 | 分层知识、真实 outcome、强红队门 | OutcomeReceipt 概念 | 已有独立知识/史馆蓝图 | 本稿只写不变量，详细 schema 继续由既有知识蓝图拥有 |
| 第三方 | OpenClaw/Hermes/Humen/Hume 细边界 | 外部网关、客户部署策略 | 尚未成为正式主链 | 全部是可拔插 adapter；MVP 后 PoC，不阻塞首发 |
| 商业化 | 基本未冻结 | 基本未冻结 | 企业合同切片、POC/年费、5/3/1/1 门 | 产品首页卖超级助手；合同解决方案页承担首个 B2B GTM；不按 Agent 数量收费 |
| 工程现场 | 含当前实现审计 | 混入 Git 冲突现场 | change/harness 管现场 | 所有易过期状态移入 change record，不进入长期产品规范 |

### 1.2 保留、合并、后置、删除

保留候选 A：

- “部门治理、能力办事”；
- 控制、工作、证据、成果分层；
- 世界杯和商业判断黄金任务；
- 广域研究面与窄域行动面；
- 知识/飞轮的真实 outcome 原则；
- AgentBudget、丞相/钦天监交互和反暗黑 UX；
- 断线、过期、冲突、重试、取消和部分失败测试。

吸收候选 B：

- 问策、办事、守望三种意图；
- `DeliverableContract` 的完成定义；
- 八道确定性完成检查；
- `CapabilityCard` 与 `EvidencePacket` 命名；
- MCP 信任、权限、新鲜度与懒加载思想；
- 外部集成网关和普通用户免安装原则；
- `OutcomeReceipt` 作为用户/接口视图。

后置为 ADR 或专项设计：

- OpenClaw、Hermes、Humen/Hume 供应商细节；
- Temporal、LangGraph、A2A、AG-UI、MCP Apps 选型；
- MCP 供应链、语音、Local Companion；
- 自动技能生成、共享学习和跨域守望；
- 真实支付、预订、签约和发信。

从产品主文删除：

- 当前 Git 冲突、分支、未提交代码和旧 Packet 状态；
- “25–35 个 MCP、150–250 个工具”等数量型能力叙事；
- 未校准的 `93–100` 用户可见质量分；
- “一键执行”现实动作的承诺；
- “超越某产品”的未经基准验证宣传；
- 把生活、健康、金融、法律全域当作首发范围的描述。

### 1.3 十项冲突的统一口径

1. 全域 vs 聚焦：超级助手与六部诸司是产品/开发范围；聚焦只约束每次组阁、能力发布和收费包，不把产品缩成合同工具；
2. 问策/办事/守望 vs 快办/深办：前者是意图，后者是策略；
3. 代办：不是策略档位，而是研究完成后的受控行动阶段；
4. 追问数量：默认每轮一个；高风险任务同一张卡最多三个阻塞字段；
5. 三套方案：默认一个推荐；只有真实存在取舍时才加两个备选；
6. 决策枚举：通用研究/商业包可用 `GO / CONDITIONAL_GO / NO_GO / INSUFFICIENT_EVIDENCE / NEED_EXPERT`；合同包使用独立且更保守的裁决语义，不能把 `GO` 翻译成“可以签”；
7. 质量分：硬门决定能否交付，分数只做内部诊断和趋势，不向用户制造伪精确；
8. 守望：可自动刷新草案，不可自动执行现实动作；
9. OpenClaw/Hermes：只是候选 worker/入口，不拥有任务、知识、证据和审批主权；
10. 路线图：工程只沿现有 M0–M10 演进，本稿不再创建 P/E/M 三套竞争里程碑。

## 2. 产品策略冻结提案

### 2.1 产品核心用户与主 JTBD

产品核心用户不是“只需要合同审查的人”，而是任何需要完成高价值复杂任务、又希望结果可信、可控、可交付的个人或团队。这里定义产品能力边界，不等于第一天同时面向所有人获客。

主 JTBD：

> 当我面对一个重要、陌生、跨领域、信息分散且容易遗漏的目标时，我只想把目标说清楚；朝堂 OS 应替我组建最合适的 AI 班子，查证、比较、计划、生成成果并告诉我下一步，同时让我保留最终决定权。

产品支持两种协作形态：

| 形态 | 典型用户 | 权限语义 |
| --- | --- | --- |
| 个人内阁 | 个人旅行、学习、职业、生意判断 | 同一人可同时是提出者、确认者和裁决者；现实动作仍需独立授权 |
| 团队内阁 | 企业老板、专业人员和管理团队 | 购买者、操作者、业务负责人、裁决人按角色分离并审计 |

### 2.2 首个 GTM ICP

首个收费专业包继续服务当前事实源已定义的客户：

| 维度 | 首发选择 |
| --- | --- |
| 客户 | 制造业、储能、新能源、工程、贸易和产业服务企业 |
| 规模 | 100–500 人、年营收约 3000 万–5 亿元优先 |
| 使用者 | 老板、总经理、法务/合同、采购、项目负责人 |
| 首发材料 | 中国大陆法域、中文、制造业/B2B 日常采购、销售、服务合同 |
| 核心痛点 | 合同判断慢、证据散、改什么说不清、责任留痕差、外部法务成本高 |
| 付费理由 | 更快发现风险、明确必须修改项、留下可追溯决策证据 |

跨境、劳动、证券金融、强监管专项合同和无法确定适用法的材料必须 `NEED_LEGAL_REVIEW`，不能输出“可签”。

合同专业包冻结为**团队决策工作台**。小企业可以由同一人兼任多个角色，但权限和审计事件仍按角色发生：

| 商业角色 | 首发默认人群 | 在系统中的责任 |
| --- | --- | --- |
| 经济购买者 | 企业老板、总经理 | 购买 POC/年费，确认价值与数据边界 |
| 日常操作者 | 法务/合同、采购、项目或销售人员 | 上传材料、说明交易立场、补证、处理风险项 |
| 业务负责人 | 该采购、销售、服务或项目的负责人 | 判断商业风险是否可接受，确认谈判目标 |
| 最终裁决人 | 获企业授权的签字人或管理者 | 对正式奏折作采纳、驳回或补证裁决；AI 永远不是最终裁决人 |

客户自己的裁决人是企业内部决策者，**不等于律师复核**；需要律师意见时必须进入独立专家服务或客户自有法务流程。

### 2.3 专业包 JTBD

企业首发 JTBD：

> 当我收到一份需要尽快决定是否签署的业务合同时，帮我定位原文风险、判断严重程度、说明必须改什么和还缺什么，让我能与对方、同事或律师快速推进，并保留完整决策依据。

世界杯案例 JTBD：

> 当我要去美国看世界杯决赛时，替我把赛事与票务、入境、机酒、交通、预算、保险、时间冲突和 Plan B 组合成一套可下载、可核验、可更新的完整攻略；买票、付款和预订仍由我逐项批准。

### 2.4 产品承诺

合同首发的正式裁决只允许以下五种，界面、导出和 API 使用同一枚举：

| 合同裁决 | 含义 | 禁止的误读 |
| --- | --- | --- |
| `NEED_INFO` | 缺少会改变结论的合同页、交易背景、主体或适用法信息 | 不得猜测补齐后继续放行 |
| `REVISE_BEFORE_PROCEED` | 存在必须先修改或谈判的条款 | 不等于修改后自动可以签 |
| `PROCEED_TO_HUMAN_APPROVAL` | 在已声明范围和证据下，可提交企业授权人继续裁决 | 不等于“安全”“无风险”或“AI 批准签署” |
| `BLOCKED` | 支持范围内存在当前不可接受或无法消解的阻塞项 | 不替代企业/律师最终法律判断 |
| `NEED_LEGAL_REVIEW` | 超出首发法域/合同类型，或风险需要执业律师判断 | 不得降级成普通风险建议 |

“能不能签？”可以是用户原话，但产品必须改写为“当前能否进入企业人工审批，以及先要改什么/补什么”。

| 承诺 | 用户感知 | 系统硬保证 |
| --- | --- | --- |
| 听懂 | 复述真正目标与一个决定性缺口 | 不以关键词命中冒充理解 |
| 查清 | 关键结论带原文/来源、时间和适用范围 | 搜索摘要、模型记忆不得冒充事实 |
| 办成 | 给出可直接使用的结果、附件与下一步 | 不以生成文本冒充交付完成 |
| 可控 | 计划能改、过程能停、行动逐项批准 | 模型不能降低风险或自行授权 |
| 可恢复 | 失败能说明、能局部重试或转人工 | 不把部分成功、超时和未知标完成 |
| 会复盘 | 保留当时判断与后来真实结果 | 模型自评和点赞不进入正式 outcome |

### 2.5 明确非目标

1. 不是万能聊天机器人、Agent 商店或六部轮流作文；
2. 不因能力目录覆盖全域就宣称所有能力已经生产可用；
3. 不替代律师、医生、持牌投资顾问、签证官或政府裁决；
4. 不以多 Agent、MCP 数量或古风页面作为卖点；
5. 不默认自动购买、付款、发信、签约、发布或删除；
6. 不把客户私有数据训练成平台共享知识；
7. 不同时销售合同、旅行、商业尽调等多个收费专业包；能力研发、沙箱和黄金评测不受此限制；
8. 不在没有真实客户 outcome 前宣称系统已经形成自我进化飞轮。

### 2.6 任务支持矩阵

| 类别 | 1.0 行为 | 示例 |
| --- | --- | --- |
| `SUPPORTED_READ_ONLY` | 自动研究、分析、生成成果 | 合同审查、公开资料核验 |
| `SUPPORTED_WITH_INPUT` | 补齐关键输入后继续 | 缺附件、预算、身份或地区 |
| `SUPPORTED_WITH_APPROVAL` | 先形成动作草案，再逐项授权 | 未来的日历写入、邮件草稿提交 |
| `NEED_EXPERT` | 给证据与问题清单，升级专业人士 | 强监管合同、法律/医疗/投资结论 |
| `INSUFFICIENT_EVIDENCE` | 输出缺口与最低成本验证 | 市场需求未验证、动态价格拿不到 |
| `UNSUPPORTED_SCOPE` | 诚实停止，不派裸 LLM 兜底 | 没有真实能力或许可的任务 |

`NEED_EXPERT` 是跨领域的内部 support/control 状态。合同域对外和 API 统一投影为 `NEED_LEGAL_REVIEW`；如果在风险前门就被阻断，返回独立 `ContractIntakeDecision=NEED_LEGAL_REVIEW`，明确尚未形成正式奏折，绝不能为了凑齐五种结果伪造 `FinalMemorial`。

## 3. 产品体验与角色

### 3.1 一个超级助手入口

产品首页只保留一个自然语言输入框，示例同时证明产品宽度与可信边界：

- 问策：这个生意值不值得做？先替我找反方证据。
- 办事：我要去美国看世界杯决赛，给我完整攻略和可下载成果包。
- 专业包：这份合同有哪些必须修改，当前能否进入公司审批？

系统自动识别意图，不要求用户先理解六部或先选 Agent。守望入口由独立 release flag 控制，在第 8.5 节的数据源、频率、费用、误报和通知验收完成前不展示。内部再选择执行策略：

```text
用户意图：问策 / 办事 / 守望
      ↓
执行策略：快办 / 标准 / 深办
      ↓
现实动作：另行生成 ActionProposal，逐项授权
```

按钮统一写“开始办理”，不用“一键执行”。

### 3.2 普通用户只看六种卡片

| 卡片 | 何时出现 | 必须包含 |
| --- | --- | --- |
| 计划卡 | 高于 60 秒、跨三个维度或要生成附件 | 目标、假设、交付物、预计时间/额度、研究边界 |
| 组阁/进度卡 | 计划确认后 | 本次激活的部/司/能力、激活理由、正在补的交付缺口和真实状态 |
| 需要决定卡 | 缺关键条件、来源冲突、预算/范围明显变化 | 问题、影响、推荐默认值、可选项 |
| 结果/奏折裁决卡 | 正式奏折成文后 | 场景适用裁决、推荐、理由、风险、未知项、下一步与采纳/驳回/补证 |
| 动作批准卡 | 任何现实副作用前 | 对象、精确参数、金额/条款、有效期、可逆性、影响数据 |
| 守望更新卡 | 变化足以改变原建议时 | 变化、证据、影响、是否需重新裁决、下次检查 |

用户图片展示的“上书房 → 丞相 → 军机处 → 各部各司 → 军机处会审 → 丞相回奏”是朝堂 OS 最有代表性的复杂任务模式，应成为产品主旅程，但不是固定全员流水线。正式表达为：

```text
用户下旨
→ 丞相复述目标并只问决定性问题
→ 军机处形成 RequiredCapabilitySet 与最小组阁计划
→ 门下省检查覆盖、能力认证、预算和权限
→ 相关各司提交 Claim / Evidence / Gap / Artifact
→ 各部只汇总本部被激活各司，不生成“无意见”作文
→ 军机处跨部对齐依赖和冲突
→ 御史通过证据与完成门
→ 丞相交付一份综合回奏与完整成果包
→ 用户裁决；现实动作另行逐项授权
→ 史馆归档，钦天监按条件守望
```

组阁卡允许展开查看“为什么召集这个司、它贡献了什么”；未激活部门获得零正文、零附件、零 token、零工具权，也不会为了画面完整而生成意见。全朝总览只用于能力地图、审计或显式高成本演示模式，不是正式答案的事实来源。

### 3.3 三层信息架构

1. **结果层**：30 秒内看到结论、最重要证据、最大风险和下一步；
2. **推理层**：方案、假设、冲突、情景和“什么会改变结论”；
3. **审计层**：来源快照、时间、版本、Claim、事件、工具回执和完整 trace。

默认收起内部部门长意见。透明不是把所有 Agent 作文倒给用户。

### 3.4 丞相、钦天监和各机构

| 角色 | 用户关系 | 权力边界 |
| --- | --- | --- |
| 丞相 | 唯一主对话：听旨、形成计划、综合回奏、请求裁决 | 不是真实事实源，不执行不可逆动作 |
| 门下省 | 计划与能力前置封驳 | 硬风险 fail-closed；不能因轮次耗尽自动放行 |
| 军机处 | 确定性任务编排与真实进度 | 主要由代码承担，不另造第二任务事实源 |
| 六部/专署 | 治理责任与专业复核 | 不是每次都启动的固定 Agent 阵容 |
| 御史 | 证据、冲突、越权和完成质量门 | 不能用总分覆盖硬门失败 |
| 钦天监 | 时间窗、概率区间、二阶效应和复核日 | 不预言、不封驳、不执行 |
| 史馆 | 固化当时案卷与后来真实 outcome | 不回写篡改历史判断 |
| 翰林 | 离线评测、实验和能力晋升候选 | 不直接改生产 prompt/skill/registry |

丞相每轮默认只问一个高信息增益问题；高风险任务可在同一张结构化卡一次收集最多三个阻塞字段。钦天监只在时间、概率或二阶效应足以改变选择时出现，稳定事实查询不触发。

### 3.5 失败也必须有可用体验

| 失败 | 用户看到 | 可执行恢复 |
| --- | --- | --- |
| 缺输入 | 还缺什么、为什么重要 | 补充、采用保守假设或取消 |
| 缺能力 | 当前不能可靠办什么 | 安装/授权能力、转专家或停止 |
| 证据冲突 | 哪些来源冲突、影响哪条结论 | 等待新证据、选择条件方案 |
| 动态事实过期 | 哪些价格/政策已过期 | 只刷新受影响工作包 |
| 工具失败 | 已完成什么、失败在哪里 | 局部重试、换能力或查看非正式已验证片段/缺口 |
| 成果失败 | 分析仍保留，附件未生成 | 单独重试成果生成 |
| 部分副作用 | 哪一步成功、哪一步未知/失败 | 停止后续动作、查单、补偿或人工事故处理 |

### 3.6 文化外壳与普通话模式

三省六部是治理模型，不要求普通用户学习古代官制。界面默认使用“计划、证据、风险、待确认、成果”等现代词，括号或图标保留朝堂角色；允许开启完整朝堂模式。不可用人格化语言制造内疚、恐惧或授权压力。

### 3.7 B2B 角色与协作

| 角色 | 默认能力 | 明确禁止 |
| --- | --- | --- |
| 客户成员 | 建案、补证、查看和导出自己获权任务 | 查看同租户无授权任务、操作内部节点 |
| 客户裁决人 | 采纳、补证、复核、驳回和动作批准 | 伪造质量门、改写历史证据 |
| 租户管理员 | 成员、角色、保留策略和本租户审计 | 查看其他租户、修改平台运行事实 |
| 内部运营 | 查看脱敏运行状态、重试可恢复节点、升级事故 | 读取正文默认权限、替客户裁决 |
| 平台管理员 | 发布、冻结、恢复和跨租户聚合指标 | 默认读取客户材料、绕过上书房写业务事实 |

分享、评论、补证和审批全部绑定任务/成果版本；新合同版本、关键原文变化或审批人权限变化会使旧裁决失效。同租户不等于所有成员可见，授权必须下沉到 user/purpose/task。

### 3.8 首次使用

超级助手 onboarding 不做产品导览长课。用户只需要用一句话说目标；系统在 10 秒内复述目标和最大未知，在 30 秒内给出可修改的计划、预计时间/额度、成果清单和最小组阁。六部、路由和高级 trace 按需展开。

进入合同专业包时，再要求上传或粘贴合同、选择采购方/销售方/服务提供方/其他交易方、说明最担心什么并确认处理范围；目标是在 3 分钟内给第一个带原文位置的有用风险。

数据处理告知不能藏在一次性的总条款里：首次启用时记录版本化同意；每次上传都在计划卡显示本次文件将由哪些处理方/OCR/模型处理、数据驻留、保留期限和共享范围。处理方、用途或保留策略变化时必须重新确认；不同意则提供本地/私有处理选项或停止。

### 3.9 合同专业包工作台闭环

首发 UI 必须覆盖完整合同生命周期，而不只是生成一篇报告：

1. **摄取**：支持 DOCX、可检索 PDF、扫描 PDF 和纯文本；先做真实类型、页数、加密、病毒/宏、压缩炸弹和 OCR 质量检查。损坏、密码保护、OCR 置信度不足或超套餐页数时，停在 `NEED_INFO`，不能静默漏页。
2. **定位**：每条风险绑定页码/条款号/原文片段和文件版本；用户可一键回到原文，导出仍保留锚点。
3. **逐项处置**：业务负责人可对每条风险选择“接受风险 / 退回修改 / 补证 / 升级法务”，并填写理由；批量采纳不能覆盖关键风险的逐项确认。
4. **修订**：建议文本与原文并排，明确“建议”而非已生效条款；新版本上传后提供条款级 diff、已解决/新增/仍存在风险和旧裁决失效提示。
5. **协作**：操作者、业务负责人和最终裁决人按任务版本分享、评论和审批；外链默认禁止，启用时需到期、撤销、水印和最小权限。
6. **导出与删除**：支持带版本、证据和免责声明的 PDF/DOCX/JSON 导出；用户可请求删除，系统显示对象、索引、缓存、导出和备份的传播状态，并尊重 legal hold。

文件格式、页数、OCR 语言和导出能力都必须进入套餐契约与验收矩阵，不能只写在帮助中心。

## 4. 唯一主链与统一契约

### 4.1 目标链路

```text
Web / App / 可选渠道入口
  → TaskEnvelopeV2 + 风险前门
  → MissionContractV1（目标 + 交付完成定义）
  → RequiredCapabilitySetV1（完成交付所需的硬能力）
  → Capability Registry 查询已认证候选
  → Sparse Activation Planner
  → ActivationPlanV1 + ActivationJustification[]
  → PlanRevisionV1 + CapabilitySnapshotV1
  → 门下省绑定精确版本准奏
  → MissionConfirmationV1（目标/计划/激活集合/预算/读取范围的精确摘要）
  → canonical outbox / worker / swarm
  → ToolGateway: ToolInvocationV1 + VerifiedToolReceiptV1
  → worker 提交 CandidateEvidencePacketV1
  → EvidenceAdmissionService 晋升 EvidencePacketV1
  → EvidenceCompletionAssessmentV1（C1–C7）
  → 御史证据与冲突审查
  → `FinalMemorial` 唯一成文门

成文后的交付支路：
  FinalMemorial → artifact generation → ArtifactManifestV1
  → DeliveryAssessmentV1（C8）→ DeliveryPublishReceiptV1 → DELIVERED

成文后的裁决/归档主链：
  FinalMemorial → MemorialDecisionV1 / 现有 EmperorDecision
  → ShiguanArchive（当时案卷立即固化）
  → 可选 ActionProposalV1 → ActionApprovalV1
  → 受控 Effect + EffectReceiptV1
  → OutcomeService → ArchiveOutcomeEvent → OutcomeReceiptV1 投影
```

两条成文后支路共享同一个 `FinalMemorial.content_hash`，但互不伪装：附件生成失败不会抹掉已成文分析，必须独立重试；缺少必需附件时不能派生 `DELIVERED`。史馆案卷在用户对正式奏折裁决后立即固化，不能为了等待未来付款/预订等 effect 而延迟归档。没有平台 effect 的合同决策同样可以在到期后由获权客户证据或认证业务系统形成 `ArchiveOutcomeEvent`；Outcome Service 不能把“没有 EffectReceipt”误判为没有真实结果。

这条链扩展当前已有：

```text
DecisionTask
→ ChancellorRouteDecision
→ OutboxEvent
→ DecreeExecutionEvent / CourtReview
→ FinalMemorial
→ EmperorDecision
→ ShiguanArchive
→ 后续独立 ArchiveOutcomeEvent
```

新协议只能成为现有对象的版本化输入、快照或投影，不能再建一套并列 Mission 数据库。

### 4.2 统一对象栈

| 对象 | 作用 | canonical writer | 说明 |
| --- | --- | --- | --- |
| `TaskEnvelopeV2` | 身份、tenant、trace、风险、来源、可逆性 | 上书房边界服务 | V1 保持兼容；通过 adapter 升级，不原地破坏 |
| `MissionContractV1` | 合并 GoalBrief 与 DeliverableContract | 丞相规划服务 | 分 `goal` 与 `definition_of_done`；本身不写“已确认”事实 |
| `RequiredCapabilitySetV1` | 从交付定义派生硬 requirement、风险所需独立验证和拒答条件 | Capability Requirement Service | 每项有 requirement_id、来源与 DoD/risk 映射；不可由候选 Agent 自降级或删项 |
| `ActivationPlanV1` | 满足硬覆盖的最小安全能力集合及零权限 standby | Sparse Activation Planner | active 与 standby 分开；每项激活必须说明 `HARD_REQUIREMENT / INDEPENDENT_VALIDATION / CONFLICT_RESOLUTION / MATERIAL_EVIDENCE_GAP / FAILOVER` |
| `PlanRevisionV1` | 工作包 DAG、预算、依赖、停止条件 | 军机处规划器 | 每次修改递增 revision |
| `CapabilitySnapshotV1` | 精确能力版本、实现成熟度、权限认证、benchmark、到期、成本和来源 | Capability Registry | 逐项绑定 requirement_id 与 activation reason；门下准奏绑定该快照 |
| `MenxiaDecisionV1` | 对精确 plan + capability 的准奏/封驳 | 门下策略服务 | 任一版本变化必须重审 |
| `MissionConfirmationV1` | 用户确认任务、计划、激活能力、standby/envelope、预算和读取范围 | Decision Service | 绑定初始 plan digest 与 activation envelope digest；只授权本次研究/生成，不授权现实副作用 |
| `WorkPackageV1` | 可重试、可取消、可局部刷新的工作单 | canonical dispatcher | 不由前端会话持有 |
| `ToolInvocationV1` | 规范化工具请求、身份、schema 和时序 | Tool Gateway | 外部 worker 无权伪造调用事实 |
| `VerifiedToolReceiptV1` | 经身份/签名/schema/顺序验证的原始回执摘要 | Tool Gateway | 绑定原始响应 hash；不可由模型或 worker 自写 |
| `CandidateEvidencePacketV1` | worker 提交的待验证事实、推断、建议和缺口 | worker adapter | 只能引用 `receipt_id`，不是正式证据 |
| `EvidencePacketV1` | 已接纳的 Claim、来源、缺口和回执引用 | Evidence Admission Service | 通过来源、权限、schema、时效和租户验证后晋升 |
| `EvidenceCompletionAssessmentV1` | 成文前 C1–C7 的确定性检查 | Quality Gate Service | 不是第二个奏折，也不检查成文后附件 |
| `ArtifactManifestV1` | 成文后成果文件、hash、来源快照、权限和过期 | Artifact Service | 必需附件失败时可重试，不回写 `FinalMemorial` |
| `DeliveryAssessmentV1` | 对 manifest、文件可读性、权限与发布的 C8 检查 | Delivery Gate Service | 只有通过后才可派生 `DELIVERED` |
| `DeliveryPublishReceiptV1` | 获权用户可取回该成果版本的发布回执 | Delivery Service | 绑定 tenant/user ACL、memorial hash、manifest hash 和发布时刻 |
| `MemorialDecisionV1` | 对精确正式奏折的采纳、驳回或补证裁决 | Decision Service | 绑定 `FinalMemorial.content_hash`；不授予 effect 权限 |
| `ActionProposalV1` | 待批准现实动作 | Action Service | 与研究结论严格分离 |
| `ActionApprovalV1` | 对精确动作 payload 的授权 | Decision Service | 外部 HITL 只通知；过期、撤销或版本漂移即失效 |
| `EffectReceiptV1` | 供应商受理/执行/查单/补偿回执 | 受控执行 adapter | 幂等、签名、顺序和原始 hash |
| `ShiguanArchive` | 奏折裁决当时的不可变案卷 | 现有史馆服务 | 不等待可选 effect，也不自动进入知识学习 |
| `ArchiveOutcomeEvent` | 后来真实结果的追加事件 | 认证 Outcome Service | 投影、模型、worker 均不得写结果事实 |
| `OutcomeReceiptV1` | 面向接口的结果视图 | 只读 projection | 正式结果账本仍是 append-only outcome event |

每个对象必须有一个 schema 路径、一个 owner、一个 canonical writer、一个 upcaster 和一个删除/保留策略。

`RequiredCapabilitySetV1` 不是路由器自由生成的一串标签，而是可验证的需求追踪矩阵：

```text
MissionContract.definition_of_done 每个 section/artifact/evidence/freshness/approval 项
+ goal.constraints / prohibited_actions / risk-front-door obligations
→ stable requirement_id
→ derivation_source（用户、场景模板、确定性策略、专业 taxonomy）
→ required capability class / deterministic service / expert escalation
→ acceptance check
```

每个 DoD 和风险义务必须至少映射到一个 requirement 或明确的 `NOT_APPLICABLE` 理由；每个 requirement 必须反向指回来源，禁止孤儿项。`unmapped_dod_items`、`unknown_required_dimensions`、无法判断的法域/数据类别或未解决的专业义务只要非空，就必须 `NEEDS_INPUT / NEED_EXPERT / UNSUPPORTED` 并封驳规划；不能先把它从 RequiredCapabilitySet 漏掉，再用“已列 requirement 覆盖率 100%”自证完整。版本化场景模板、风险 registry、反例/拒答集与用户确认共同降低 unknown-unknown，任何模型只能提出候选需求，不能单独签署 completeness。

`ActivationPlanV1` 同时保存精确 `active_set`、仅登记身份/资格的 `standby_candidates` 和用户可见 `activation_envelope`（允许的能力集合、数据/工具范围、预算、风险和截止时间）。standby 不是预激活：允许预热无任务数据的容器/模型，但在晋升前收到的任务正文、附件、检索结果、token 和工具权必须为 `0`。

`TaskEnvelopeV2` 至少强制：`task_id`、`trace_id`、`tenant_id`、`user_id`、`purpose`、`data_classification`、`consent_or_authority_ref`、`channel`、`goal`、`risk_level`、`reversibility` 和 `source_labels`。其中 tenant、user、purpose、数据分类或授权引用缺失时必须在边界 fail-closed。

### 4.3 MissionContractV1

```yaml
mission_contract_id:
task_id:
revision:
goal:
  user_intent:
  desired_outcome:
  constraints:
  assumptions:
  prohibited_actions:
  risk_tolerance:
definition_of_done:
  required_sections:
  required_artifacts:
  evidence_requirements:
  freshness_sla:
  max_cost:
  max_latency:
  partial_policy:
  expert_escalation:
  approval_requirements:
contract_hash:
```

这解决两份候选稿最危险的双协议：GoalBrief 不再单独决定目标，DeliverableContract 也不再单独决定完成；它们是同一 MissionContract 的两个受控子结构。`confirmed_by/at` 不属于本对象；如需快速读取，可从不可变决策事件投影，投影不得成为事实写入口。

三类人工决定可以共用一个 append-only `DecisionEventV1` 存储模型，但必须由 `decision_kind + subject_type + subject_id + subject_version + subject_digest` 精确区分：

```text
MissionConfirmationV1
  subject = MissionContract + RequiredCapabilitySet + initial ActivationPlan + PlanRevision + CapabilitySnapshot
  digest  = contract + requirements + initial_plan + activation_envelope + capability + budget + read_scope

MemorialDecisionV1
  subject = FinalMemorial
  digest  = FinalMemorial.content_hash
  choice  = APPROVE | REJECT | INQUIRE

ActionApprovalV1
  subject = ActionProposal
  digest  = canonical_action_payload
  fields  = amount/terms/data_scope/expiry/revocation/step_up_auth
```

现有 `EmperorDecision` 是含 `edict_confirm / compat_dispatch / final_verdict` 等 kind 的 legacy union，并不整体等于任何一个新对象。迁移时：只有绑定精确奏折 hash 的 `final_verdict` 才可 upcast 为 `MemorialDecisionV1`；`edict_confirm` 只有补齐并验证任务/计划/能力/预算/读取范围摘要后才可迁移为 `MissionConfirmationV1`；`compat_dispatch` 只是兼容调度记录，不是人工决定。现有 kind 均缺少动作 payload、金额/条款、期限、撤销和 step-up 字段，因此没有任何一个可解释成 `ActionApprovalV1`。

### 4.4 正交状态，而不是一个万能 `COMPLETED`

内部至少分开：

```text
control_status: VALID | BLOCKED
support_status: SUPPORTED | NEEDS_INPUT | NEED_EXPERT | UNSUPPORTED
capability_coverage_status: COMPLETE | PARTIAL | UNSUPPORTED
planning_status: DRAFT | NEEDS_INPUT | PLAN_READY | VETOED
mission_confirmation_status: AWAITING | CONFIRMED | REJECTED | EXPIRED | REVOKED
dispatch_status: NOT_READY | READY | DISPATCHED | CANCEL_REQUESTED | CANCELLED
evidence_status: NONE | COLLECTING | PARTIAL | GROUNDED | CONFLICTED | STALE | UNVERIFIED
review_status: NOT_STARTED | FAILED | PASSED
memorial_status: NOT_READY | FINAL | SUPERSEDED
artifact_status: NOT_REQUIRED | PENDING | READY | INVALID | FAILED
delivery_status: NOT_READY | READY | PUBLISHED | FAILED
memorial_decision_status: AWAITING | APPROVED | REJECTED | INQUIRY_REQUESTED | SUPERSEDED
action_approval_status: NOT_REQUIRED | AWAITING | APPROVED | REJECTED | EXPIRED | REVOKED
execution_status: NOT_STARTED | RUNNING | CANCEL_REQUESTED | CANCELLED | PARTIAL_FAILURE | UNKNOWN | SUCCEEDED | COMPENSATION_PENDING | COMPENSATED | MANUAL_INTERVENTION | FAILED
outcome_status: NOT_DUE | PENDING | SETTLED | NO_DATA | DISPUTED
```

质量检查返回的是 `CompletionCheckCode`，不是生命周期状态。代码到状态的映射必须由确定性表唯一决定：

| 检查代码 | 写入轴 | 允许的下一步 |
| --- | --- | --- |
| `IDENTITY_OR_AUTHORITY_INVALID` | `control_status=BLOCKED`、`review_status=FAILED`（若已开始审查） | 修复身份/授权后新版本重审 |
| `CAPABILITY_COVERAGE_INCOMPLETE` | `capability_coverage_status=PARTIAL/UNSUPPORTED`、`planning_status=VETOED` | 补能力、缩小交付或诚实停止 |
| `DOD_INCOMPLETE` / `EVIDENCE_MISSING` | `evidence_status=PARTIAL`、`review_status=FAILED` | 补证或诚实部分交付 |
| `SOURCE_STALE` | `evidence_status=STALE`、`review_status=FAILED` | 仅刷新受影响工作包后重审 |
| `TOOL_RECEIPT_UNVERIFIED` | `evidence_status=UNVERIFIED`、`review_status=FAILED` | 重新验证或换可信能力 |
| `EVIDENCE_CONFLICT_UNRESOLVED` | `evidence_status=CONFLICTED`、`review_status=FAILED` | 御史裁决、条件化结论或停止 |
| `ARTIFACT_INVALID` | `artifact_status=INVALID`、`delivery_status=NOT_READY` | 只重试成果生成/发布 |

用户看到的阶段由这些状态派生：

```text
草案 → 等你补充 → 计划待确认 → 办理中 → 部分完成
→ 可供决策 → 待动作批准 → 执行中 → 已交付 → 待结果复盘 → 已结算
```

`DELIVERED` 只能在以下公式为真时派生，不能由任何 Agent 直接写入：

```text
control_status == VALID
AND support_status == SUPPORTED
AND capability_coverage_status == COMPLETE
AND mission_confirmation_status == CONFIRMED
AND review_status == PASSED
AND memorial_status == FINAL
AND (artifact_status == NOT_REQUIRED OR artifact_status == READY)
AND delivery_status == PUBLISHED
AND DeliveryAssessment(C8) == PASS
AND every object above belongs to one non-superseded subject lineage
```

同一 lineage 不是只比较 `task_id`：`MissionConfirmation` 必须绑定 contract/requirements、初始 plan/capability 和 activation envelope/budget/read-scope digest；若当前 plan 是后续 revision，还必须绑定“新 active set 位于该 envelope 内”的确定性授权证明和对应 `MenxiaDecision`。`EvidenceCompletionAssessment` 绑定当前 plan/capability/证据快照；`FinalMemorial` 绑定该 assessment digest；`ArtifactManifest` 绑定 `FinalMemorial.content_hash`；`DeliveryAssessment` 绑定 manifest hash；最终 publish receipt 再绑定前述 delivery subject digest。任何 revision/hash 不同、缺少 envelope 授权链、对象已 superseded 或 publish 无认证回执，都不能把多个旧 PASS 拼成一次交付。

`FinalMemorial` 可以在必需附件生成失败时存在，用户可先查看正式正文并单独重试附件；此时绝不能显示 `DELIVERED`。`SETTLED` 才表示后来结果已确认，没有认证 outcome 时不得说“任务成功”。

状态机还必须满足：

- `ActionApproval=REVOKED/EXPIRED` 后不得产生新的 effect；已受理 effect 转入查单/补偿，不能假装回滚；
- `MemorialDecision=REJECTED/INQUIRY_REQUESTED` 时，基于该奏折的 ActionProposal 不得获批；`APPROVED` 也只代表接受分析，仍不能自动生成 effect；
- `MissionConfirmation=REVOKED/EXPIRED` 后禁止新的 dispatch 和 tool invocation；已在途工作进入 `CANCEL_REQUESTED`，只允许记录已发生回执、查单、清理或生成明确的部分案卷；
- 动态增援、替换或 standby 晋升必须产生新的 `ActivationPlan + PlanRevision + CapabilitySnapshot` digest 并重新过门下；只有新 active set `⊆` 已确认 envelope、能力/工具/数据/预算/风险均未扩张且确定性 authorization check 通过时，旧 `MissionConfirmation` 才继续有效；超出 standby/envelope、扩大任一范围或新增 effect 权限必须重新确认；
- worker 之间只通过 canonical WorkPackage/Evidence 状态交换，不自由群聊、不自邀同伴、不自加工具；每个 capability token 绑定 tenant/user/purpose/work-package/tool/TTL；
- `execution_status=UNKNOWN` 永不计成功，必须查单、转人工或进入事故流程；
- provider 已受理后的取消先进入 `CANCEL_REQUESTED`，只有认证取消回执才能进入 `CANCELLED`；
- 关键计划、证据、原文、授权主体或事实在成文后变化时，创建 successor task/decision/version，旧案卷只标 `SUPERSEDED`，不得覆盖；
- `dispatch_status=CANCELLED`、`artifact_status=FAILED` 和 `execution_status=COMPENSATED` 各自表达不同事实，不能压成一个“失败”。

### 4.5 三个不同的人工决定

1. **任务确认 `MissionConfirmationV1`**：批准目标、计划、能力快照、预计资源和读取范围，只允许研究与成果生成；
2. **奏折裁决 `MemorialDecisionV1`**：对精确 `FinalMemorial.content_hash` 采纳、驳回或要求补证，不授予任何现实副作用；
3. **行动授权 `ActionApprovalV1`**：对付款、预订、发送、签约、删除、发布、共享敏感数据等精确动作逐项授权。

行动授权至少绑定：规范化 payload digest 版本、对象、商户、金额/币种、条款、数据共享范围、有效期、可撤销性、累计金额、审批人和 step-up authentication。模型只能升高风险，不能降低确定性策略给出的风险等级。

## 5. 五级质量与安全门

### 5.1 门 A：确定性风险前门

在任何模型规划前检查：tenant/user/purpose、任务支持范围、数据类别、禁止动作、专业人士升级、预算硬上限。唯一映射为：身份/权限/硬预算违法 → `control=BLOCKED, planning=VETOED`；无支持能力 → `support=UNSUPPORTED, planning=VETOED`；需专业人士 → `support=NEED_EXPERT, planning=VETOED`；缺用户输入 → `support=NEEDS_INPUT, planning=NEEDS_INPUT`。合同请求的 `NEED_EXPERT` 必须按第 2.5 节投影为 `ContractIntakeDecision=NEED_LEGAL_REVIEW`，不生成假奏折。

### 5.2 门 B：门下省计划与能力门

门下省必须同时看到 `RequiredCapabilitySet + ActivationPlan + PlanRevision + CapabilitySnapshot`，检查：

- 所有 hard requirement 覆盖率是否为 `100%`；
- `RequiredCapabilitySet` 是否完整追踪 MissionContract 每个 DoD、约束、禁止动作和风险义务，且 `unmapped/unknown` 均为空；
- 每项能力是否真实、健康、未过期且达到本任务风险所需认证等级；
- 激活集合是否为满足覆盖、独立验证和恢复要求的最小安全集合；
- 每项激活是否绑定允许的 justification 与 requirement_id；
- 关键输入和专业边界是否满足；
- 未激活能力是否零正文、零附件、零 token、零工具权；
- 工具权限、数据出站、预算、延迟和停止条件；
- 工作包依赖和交付定义是否完整；
- 是否把无能力场景硬塞给六部裸 LLM。

达到最大修订轮次只能按原因转 `support=UNSUPPORTED/NEED_EXPERT/NEEDS_INPUT` 且 `planning=VETOED/NEEDS_INPUT`，绝不 fail-open。`PARTIAL` 只适用于已经合法执行并确实取得部分证据的任务，不能用来绕过计划前门。

### 5.3 门 C：证据完成度七项检查（成文前）

| 检查 | 核心问题 | 失败结果 |
| --- | --- | --- |
| C1 身份链 | tenant/task/trace/work package 是否一致 | `IDENTITY_OR_AUTHORITY_INVALID` |
| C2 交付完整 | MissionContract 成文前必填项是否满足 | `DOD_INCOMPLETE` |
| C3 证据接地 | 关键 Claim 是否绑定原文/来源 | `EVIDENCE_MISSING` |
| C4 新鲜度 | 动态事实是否仍在有效期 | `SOURCE_STALE` |
| C5 工具回执 | 调用和结果是否经 Tool Gateway 验证 | `TOOL_RECEIPT_UNVERIFIED` |
| C6 冲突 | 是否存在未裁决的关键矛盾 | `EVIDENCE_CONFLICT_UNRESOLVED` |
| C7 研究权限 | 数据处理、读取范围和身份授权是否有效 | `IDENTITY_OR_AUTHORITY_INVALID` |

任何关键项失败都不得进入 `FinalMemorial`。C7 只检查本次研究、数据处理和是否已经发生未授权 effect；一个尚未批准、尚未执行的未来 `ActionProposal` 不阻塞奏折成文。

### 5.4 门 D：御史独立审查

御史检查来源等级、职责越权、冲突处理、未知项、诈骗/提示注入、附件安全、用户约束和不可逆风险。门 C 证明“交付定义是否满足”，门 D 证明“结果是否值得相信”，二者不能由同一个生成 Agent 自评代替。

### 5.5 门 E：成文与行动门

- `FinalMemorial` 是唯一正式成文对象；
- 成文不等于批准行动；
- `FinalMemorial` 成文后才生成附件；C8 检查文件可打开、hash/manifest、ACL、病毒扫描和发布可取回性；
- C8 失败只阻止 `DELIVERED`，不删除正文、不重跑研究，Artifact Service 可独立重试；
- 高风险动作即使所有质量项满分，也必须等待精确 `ActionApprovalV1`；
- 执行前重新验证价格、条款、权限、商户、预算和幂等键；
- 任何版本漂移使旧审批自动失效。

### 5.6 质量分的正确用法

不向用户显示“94 分所以可信”。内部保留维度向量用于诊断：完整度、接地率、约束匹配、冲突、时效、可执行性和 UX。硬门失败永远不能被平均分抵消；任何权重和阈值必须经标注集校准。

### 5.7 补缺循环

```text
发现 Gap
→ 生成 GapTask
→ 只重跑相关 WorkPackage
→ 最多两轮
→ 仍缺失则追问、转专家、展示非正式 partial view 或诚实停止
```

`PARTIAL` 只允许把已验证片段、缺口、失败原因和恢复选项做成明显标记的进度投影；它不是 `FinalMemorial`、不是 `DELIVERED`，不得进入 `MemorialDecision`、`ShiguanArchive` 正式案卷或生成 `ActionProposal`。禁止无限反思、无限蜂群重试和为凑分重复搜索。

## 6. 能力、Agent、MCP 与第三方

### 6.1 部门治理，能力办事

```text
六部/专署 = 责任、制度、复核和风险归属
Capability = 输入输出、工具、权限和完成能力
Agent/Flow/Worker = 某次任务的临时执行实例
```

长期目标是让六部及全部经批准专属司进入同一个 `Capability Registry`。这里的“全覆盖”有两个同时成立的限定：

1. **目录全域覆盖**：每一司的职责、拒答、输入输出、证据、工具、权限、owner 和评测都能登记、调度、审计与回滚；
2. **单次稀疏激活**：每个任务只启动覆盖其硬要求的最小安全能力集合，未激活能力不收到任务正文、附件、token 或工具权。

下表已被产品冻结采纳为 `TARGET_DIRECTORY_V1` 的**目标治理 taxonomy**，不是当前运行能力声明。它来自现有六份前端详细 registry 的合并，共 41 个六部专属司；运行前仍必须与后端身份 SSOT、`si_registry` 和实际 engine 名称收敛为一张可机读事实源，并指定唯一 writer。

| 部 | 目标专属司 | 责任与典型成果 |
| --- | --- | --- |
| 吏部 | 官制、选才、考功、薪酬、人事、劳关、行政 | 组织与岗位、人才选择、绩效薪酬、劳动关系、责任人与协作机制；输出组织图、岗位卡、选才/晋升方案、RACI 与制度草案 |
| 户部 | 度支、金库、计簿、价本、投审、稽核 | 预算、现金、核算、成本定价、投资回报和财务核验；输出预算/现金流/ROI 情景表、报价与审计清单 |
| 礼部 | 品牌、客群、文宣、招商、公关、传播渠道、审辞 | 用户与市场表达、品牌承诺、内容、渠道、公关与发布边界；输出受众画像、信息架构、传播计划、文案与审辞报告 |
| 兵部 | 布阵、商机、攻坚、价策、渠道、销运、客成 | 竞争、销售、客户推进、渠道与客户成功；输出战情图、商机/账户计划、报价策略、行动清单与复盘 |
| 刑部 | 契约、公司、合规、争讼、劳法、知产、法运 | 合同、公司治理、合规、争议、劳动法、知识产权和法务运营；输出风险矩阵、原文锚点、修订稿、升级/停止条件 |
| 工部 | 方案、物料、进度、质量、现场、交付、承诺 | 产品、技术、研发、供应、项目和交付；输出方案、BOM/物料、计划、验收标准、工单草案和交付包 |

门下省、军机处、锦衣卫、御史台、钦天监、翰林院和史馆是横向专署，不计入 41 司：门下管覆盖与准奏，军机处管确定性编排，锦衣卫管外部采证，御史管证据/冲突/安全，钦天监管时窗/情景/守望，翰林管成果编译与离线评测，史馆管案卷和真实结果。它们同样通过能力卡获得权限，不能因“中央机构”身份绕过门禁。

当前仓库只证明：后端六部身份与部分适配器已存在，详细诸司主要还是前端配置或设计资产；后端 `si_registry`、前端 41 司和运行代码中的名称/范围尚未统一，且部分路径会退回通用 LLM 或规则。这项 taxonomy 收敛是 M0/M8 的 stop-ship，不得把 `active: true`、Prompt 数量或页面存在当成生产支持。

每个 `CapabilityCard` 使用两条正交轴，避免“写过 Prompt”和“允许生产执行”混成一个状态：

```text
实现成熟度：DESIGNED → PROMPTED → CONTRACTED → ENGINE_BACKED
           → TOOL_CONNECTED → E2E_VERIFIED → PRODUCTION_SUPPORTED

权限认证级：DECLARED → QUARANTINED → SHADOW_VERIFIED
         → PROD_READ → PROD_DRAFT → PROD_EFFECT
```

- 实现成熟度回答“代码、工具和端到端交付究竟做到哪一步”；
- 权限认证级回答“在什么数据、风险和副作用范围内允许被生产路由”；
- 两轴都按 capability 切片，不给整个部或整个司一次性盖章；
- 工具/schema 变更、评测退化、事故、来源过期或 owner 失联时自动降级/隔离；只有人工批准精确版本才能恢复。

生产资格由两轴交叉决定，不允许取较高的一边补偿另一边：

| 生产动作 | 最低实现成熟度 | 最低权限认证 | 额外硬门 |
| --- | --- | --- | --- |
| 读取/研究 | `E2E_VERIFIED` | `PROD_READ` | 数据类别、法域、风险、来源和 tool digest 精确匹配 |
| 生成草稿但不提交 | `E2E_VERIFIED` | `PROD_DRAFT` | 草稿显式标记、不可被 effect adapter 受理 |
| 现实副作用 | `PRODUCTION_SUPPORTED` | `PROD_EFFECT` | `ActionApproval`、step-up、幂等、查单、补偿和事故门全部通过 |

`PRODUCTION_SUPPORTED + DECLARED` 不能生产读取，`DESIGNED + PROD_EFFECT` 也不能执行动作。路由资格是 capability、版本、domain/jurisdiction、data class、risk、tool schema 和 action type 的精确 tuple，不是一个全局布尔值。

降级和 kill switch 必须写入不可变 `CapabilityRevocationEvent` 并即时传播：dispatcher 在每次 dispatch、Tool Gateway 在每次调用前重新检查；相关 capability token 立即撤销，禁止新调用，在途但尚未接纳的结果进入 quarantine，不能晋升为正式 Evidence。任务必须新建 plan/snapshot 选择其他能力或诚实停止。已经被外部 provider 受理的 effect 不可假装撤销，应进入查单、补偿或人工事故状态；历史案卷和回执只追加撤销事实，不覆盖。

一个 `CapabilityCard` 至少登记：`capability_id`、所属部/司、支持 job、法域/数据类别/风险级、明确拒答、输入输出 schema、成果与证据定义、工具/server/schema digest、来源与 freshness、read/draft/effect 权限、黄金任务与最新验证 manifest、成本、P50/P95 延迟、错误率、owner、到期日、fallback、kill switch、两轴状态、自动降级和回滚条件。历史质量只能来自受控评测与线上回执，Agent 不得自报、自注册或自晋升。

### 6.2 Agent 人数是预算，不是产品承诺

| 任务 | 活跃模型角色硬上限 | 并发 |
| --- | ---: | ---: |
| D0 格式/单事实 | 1 | 1 |
| D1 单领域 | 3 | 最多 3 |
| D2 复杂跨域 | 6 | 默认最多 4，确有独立缺口时最多 6 |
| 高风险审查 | 9（含独立验证角色）+ 人工专家 | 模型并发最多 6；副作用严格串行 1 |
| 同构 Wide Research | 首发最多 12 | 只有独立、只读、硬预算任务 |

人数是上限，不是起步编制。系统不得固定启动“丞相 + 2 个侦察”，而应由 `RequiredCapabilitySet` 与 Sparse Activation Planner 选择最小安全集合。一个能力只允许因 `HARD_REQUIREMENT / INDEPENDENT_VALIDATION / CONFLICT_RESOLUTION / MATERIAL_EVIDENCE_GAP / FAILOVER` 之一被激活；“也许有帮助”“一起头脑风暴”不是生产理由。`FAILOVER` 只在 standby 被正式晋升后成立，standby 阶段仍是零任务数据、零 token、零工具权。

选择目标是：在 hard requirement 覆盖率 `100%`、风险所需独立验证、认证等级、权限和预算约束下，最小化预计成本、延迟、协调复杂度与供应链/数据暴露风险。只有六部各自都有不可替代 requirement、移除任一部都会破坏覆盖，并且预算获批时，才允许全六部会审。

每次增援都必须形成新 `ActivationPlan + CapabilitySnapshot` 并重新过门下；扩大预算、数据读取、风险或 effect 权限还要重新取得 `MissionConfirmation`。连续两个增援没有新增可核 Claim、权威来源、关键冲突裁决或真实方案差异立即停止。冻结 benchmark 必须做消融：移除某能力后覆盖、独立性和恢复力都不下降，则该激活为失败；95% benchmark 任务的预计安全执行成本不得超过离线最小安全路线的 `1.25×`。

`AgentBudget` 必须跨线程/worker 传播：调用数、token、费用、工具次数、重试、并发、截止时间、reserved/spent/refunded、取消和 novelty stop。

### 6.3 MCP 是连接协议，不是信任证明

配置项和声明工具只能算库存，不能宣称生产可信能力。首发不设 MCP/数据源/工具数量 KPI，而为版本化 benchmark portfolio 和首个收费专业包建立最小受信集合；具体库存和健康状态只记录在绑定精确 HEAD 的 change/audit 中。

每个 MCP/tool 必须：

- 固定 server/image/code 和 tool schema digest；
- 独立供应商、租户、环境安全主体，不共享高权限凭据；
- Secret Broker 注入，密钥不进入模型上下文或普通日志；
- egress/DNS allowlist、超时、速率、预算和 kill switch；
- tool description、结果、网页和附件均视为不可信数据；
- callback 验证身份、签名、幂等、顺序和撤销；
- schema/描述/商户变化使相关旧审批失效；
- read、draft、effect 权限分离。

“travel-local-mcp”“business-mcp”只是能力目录，不意味着多个供应商共享一个运行身份或凭据。

正式证据的信任链固定为：Tool Gateway 先写不可变 `ToolInvocationV1`，验证 server 身份、tool schema、签名、回调顺序和原始响应 hash 后再写 `VerifiedToolReceiptV1`；外部 worker 只能提交引用 `receipt_id` 的 `CandidateEvidencePacketV1`；最后由 Evidence Admission Service 根据租户、许可、时效和来源规则写 `EvidencePacketV1`。任何模型文本、worker 自报或第三方 callback 都不能跳过这三层直接成为正式证据。

### 6.4 技术选择门

| 技术 | 当前裁决 | 重新评估触发条件 |
| --- | --- | --- |
| 现有 DB/outbox/worker | 继续作为 canonical 主链 | 无 |
| MCP | 作为工具适配边界逐个引入 | 有真实 provider、回执和黄金任务 |
| AG-UI/MCP Apps | 借鉴事件与组件，不替换现有前端 | 原生卡片协议成为明显瓶颈 |
| A2A | 后置，仅用于独立外部 Agent | 出现跨组织、独立身份协作需求 |
| LangGraph | 不进入主链 | M0–M9 后，动态图/多次中断有可测瓶颈且 PoC 优于现有 ≥30% |
| Temporal | 后置 PoC | 大量任务跨小时/天、跨三类以上副作用且补偿代码成为主要故障源 |

### 6.5 外部组件统一边界

2026-07-18 官方资料校准：OpenClaw 将自身定位为可跨平台运行的个人 AI 助手并提供 companion/node 形态；Hermes Agent 是 Nous Research 的独立 Agent runtime，带工具、消息网关和经验/技能沉淀；Hume 提供实时语音 EVI 与 TTS API。这些能力支持“可选入口、隔离 worker、语音层”的定位，但都不构成把 canonical 主权外包给它们的理由。参见 [OpenClaw 官方仓库](https://github.com/openclaw/openclaw)、[Hermes Agent 官方仓库](https://github.com/nousresearch/hermes-agent)、[Hume 官方 API 文档](https://dev.hume.ai/intro)。`Humen` 仍无法从名称唯一确认，未取得业主准确链接前不作产品/API 推断。

| 组件 | 可用位置 | 不能拥有 | 顺序 |
| --- | --- | --- | --- |
| OpenClaw | 可选渠道、Local Companion、隔离只读 worker | canonical task、证据晋升、审批、史馆 | 主内核稳定后的 Adapter V2 PoC |
| Hermes Agent | 隔离研究、监测、技能候选起草 | 生产 skill/知识直写、高风险 effect | 飞轮单写者与沙箱完成后 |
| Humen（未识别） | 暂不进入能力路线 | 不分配任何数据、工具或动作权限 | 取得业主准确链接后重新识别并单独评估 |
| Hume AI | 可选语音、打断和表达节奏 | 情绪事实、风险裁决、授权 | 用户研究证明语音价值后 |
| 外部 HITL | 决定通知和回跳 | Decision Service 中三类决定的唯一事实 | 可作为通知 adapter |

任何组件被关闭、卸载或断网，正式任务、证据、奏折、审批和史馆仍必须可读取和恢复。

## 7. 知识、记忆与真实结果飞轮

### 7.1 本稿只冻结不变量

旧 [`chaotang-os-knowledge-memory-flywheel-blueprint-2026-07-14.md`](chaotang-os-knowledge-memory-flywheel-blueprint-2026-07-14.md) 只保留为 K0–K10 历史设计输入，不再拥有当前 schema、迁移或排期。详细实现必须由 11.1 所述 M0–M10 owner 通过显式 amendment 分配 schema owner、迁移、测试和回滚；在 amendment 获批前不得施工。本稿不创建第二知识事实源，只冻结：

- SQL 管文档身份、tenant/user/purpose、版本、授权、许可、保留和引用关系；
- Object Store 保存不可变原始快照、附件、成果和 hash；
- vector/BM25/graph 是可重建投影；
- `ShiguanArchive` 固化当时案卷；
- `ArchiveOutcomeEvent` 追加后来真实结果；
- Obsidian/courtos-brain/旧 MemoryStore 不是生产事务或真值数据库。

### 7.2 记忆和知识域

工作、案例、语义、偏好、程序和制度六类记忆分开治理；`task_evidence / tenant_private / user_private / platform_shared` 四域先鉴权再检索。同租户内仍需 per-user/purpose ACL；空 tenant 绝不解释为共享。

### 7.3 可信飞轮

```text
MissionContract
→ Claim/Evidence
→ FinalMemorial
→ MemorialDecision
→ ShiguanArchive（强制固化当时案卷）
→ 可选 ActionApproval / EffectReceipt
→ 已认证且到期结算的 Outcome
→ ArchiveOutcomeEvent 追加复盘事实
→ 翰林离线实验
→ 冻结 holdout 对比
→ 人工批准精确版本
→ shadow / canary
→ 指标改善才扩大；否则回滚
```

点赞、下载、模型自评和“用户采纳”都不是正式成功标签。没有结算 outcome 时是 `NO_DATA`。

### 7.4 飞轮解冻前置门

`ShiguanArchive` 是正式主链的强制案卷，不属于“自动学习”。在以下问题关闭前，禁止的是把案卷/反馈自动摄取或晋升为 RAG、评测、平台共享知识和生产技能；不得因此跳过 canonical 归档：

1. 所有 API/CLI/cron 统一经过单一摄取写入口；
2. 缺 tenant/user/purpose 的读写全部 fail-closed；
3. AI 派生内容不能引用自己或改写版本完成自证；
4. 相似度只做召回，不替代蕴含/矛盾/来源/时效判断；
5. 反馈由服务端绑定真实 task/output/version，重放不刷票；
6. 自评和自由文本不能直接进入 system prompt；
7. 技能固定 digest/签名/SBOM，在禁网禁密钥沙箱评测；
8. 删除传播到对象、chunk、vector、cache、日志、eval、导出与 release；
9. 候选作者、标注、发布批准人职责分离；
10. 租户私有数据默认永不进入平台共享学习。

## 8. 超级任务组合、专业包与发布顺序

### 8.1 版本化 Benchmark Portfolio

朝堂 OS 不能用一个合同案例证明专业深度，也不能用一次世界杯旅行证明“全域智能”。产品能力由版本化任务组合共同验收：

| 任务族 | 代表问题 | 主要验证对象 |
| --- | --- | --- |
| 合同/专业判断 | 这份合同先改什么，能否进入企业审批？ | 原文锚定、法域边界、保守裁决、专家升级 |
| 旅行/赛事复杂任务 | 去美国看世界杯决赛，怎样形成完整可行攻略？ | 动态事实、跨域约束、预算、附件一致性、Plan B |
| 商业验证 | 这个生意值不值得做，最低成本怎么验证？ | 正反证据、单位经济、停止条件、跨部协同 |
| 学习/研究 | 在有限时间内掌握一个陌生领域并产出可复用材料 | 来源层级、知识结构、引用、未知项和学习成果 |
| 个人效率 | 搬家、求职、重要活动或家庭项目如何办完？ | 依赖计划、清单、日历、预算和部分失败恢复 |
| 守望 | 条件变化何时足以改变原建议？ | TTL、增量刷新、通知 precision、费用和停止日 |
| 未知/拒答 | 缺数据、无可信工具或超出专业边界时怎么办？ | 诚实停止、补证、专家升级、不用裸 LLM 伪完成 |
| 高风险专业任务 | 法律、医疗、投资或现实副作用请求 | 风险前门、独立验证、精确授权和零错误完成 |

Portfolio 必须冻结版本、task taxonomy、来源快照/时钟、hard requirements、允许结果、交付物、预算和故障注入。每部至少 10 个冻结黄金任务；每个拟发布专属司至少包含正例、拒答、缺数据、跨域依赖和工具故障样例。跨域集至少 10 个任务，每个需要三个以上不可替代 capability，世界杯只是其中的旗舰可演示案例。

每次发布声明必须生成不可变 `BenchmarkPortfolioPassManifestV1`，绑定：预先登记的任务分母与 family 版本、冻结集/live canary run IDs、精确代码 HEAD、模型/Prompt/Capability/tool digests、来源时钟、各门阈值与逐项结果、失败/`NO_DATA`、成本/延迟、安全事故、独立复审人和到期日。任务选择和阈值必须在运行前锁定；不得删除失败样例、只报最好的一轮或让同一结果跨版本复用。R3 只有在至少三个不同任务族各自通过其全部硬门、拒答/错误完成安全集为零、两轮 live canary 连续通过且 manifest 获独立复审时才 PASS；任一关键 family 为 `NO_DATA/EXPIRED`，整体只能 `NO_DATA/EXPIRED`。

产品对外能力标识只有三档：`目录已登记 / Beta / 已验证`。只有两轴成熟度达到对应门、黄金集通过、真实来源和成果链成立的能力才能称“已验证”。“跨域复杂任务已验证”要求 portfolio 中至少三个不同任务族连续通过冻结回归与 live canary；“全域已实现”“万能助手”在任何阶段都不允许使用。

### 8.2 首个收费专业包：ContractReviewPack

输入：合同文件、业务背景、交易角色、已知不可接受条款、适用法域和缺失材料。

必须交付：

- 一页合同裁决摘要，只使用 `NEED_INFO / REVISE_BEFORE_PROCEED / PROCEED_TO_HUMAN_APPROVAL / BLOCKED / NEED_LEGAL_REVIEW`；
- 每个风险项的原文位置、等级、解释、缺证和建议修改；
- 必须改/建议改/可接受三类清单；
- 对外谈判与内部沟通稿；
- 仍需律师/业务负责人确认的问题；
- 合同版本、来源、引擎层级、质量门和人工裁决；
- PDF/DOCX/JSON 或结构化导出。

专业包承诺是“更快发现风险、明确必须改什么、留下证据”，不是替代律师或保证合同绝对安全。商业退出门仍是至少 5 家真实客户试用、3 家重复使用、1 家付费、1 条可公开证言。质量退出门冻结为：

- 不少于 120 份合法脱敏/获授权合同，按采购、销售、服务三类以及采购方、销售方、服务提供方等交易立场分层；
- 两名具备中国大陆商事合同经验的独立法律标注者标关键问题、严重性、依据和可接受修改，分歧由第三人裁决；开发集与冻结 holdout 按合同模板族隔离，防止同模板泄漏；
- holdout 上关键问题召回率 `≥95%`、原文锚点准确率 `≥98%`、严重性 macro-F1 `≥0.85`；重大有害修改建议率必须为 `0`，一般有害/明显劣化建议率 `≤1%`，两项分开报告；重大包括扩大核心责任、放弃关键权利、制造违法/无效条款或与用户交易立场相反；这些阈值在首轮律师校准后只能收紧，变更需 Decision Log；
- 安全关键集上“存在未解决关键问题却输出 `PROCEED_TO_HUMAN_APPROVAL`”、跨租户泄露、伪造原文/来源和应升级却未升级均必须为 `0`；
- 分别测试缺页、低 OCR、合同版本漂移、提示注入、相互矛盾条款和超范围法域；系统必须进入补证、阻塞或法务升级，而不是给无条件放行结论。

合同包可先形成企业付费闭环，但它只证明该专业包，不单独证明六部全域能力。

### 8.3 旗舰跨域案例：WorldCupTravelMission

世界杯旅行用于验证复杂任务能力，不是第二条销售主线，也不是唯一的通用性闸门。首版只读研究：

- 官方赛事/票务、入境、航班、酒店、交通、预算、保险与 Plan B；
- 一个推荐方案，存在真实取舍时加两个备选；
- PDF、预算表、日历、清单、地图/链接和证据 JSON；
- 动态事实 TTL、局部刷新和不可退金额；
- 只提供官方购买入口，不自动买票、付款或预订。

验收分成可复现回归和真实世界 canary：

- 固定 50 个带来源快照和时钟的分层任务，覆盖过期、冲突、无票、无签证、超预算、断线、取消和附件失败；
- 每周运行 10 个只读 live canary，只用官方赛事/票务/政府入境信息作为关键事实的一等来源，航班/酒店聚合源必须标明供应商和抓取时间；
- 关键入境、比赛、场馆和票务事实的权威来源覆盖率 `100%`，动态事实 TTL 合规率 `100%`，不可用来源下正确降级为 `PARTIAL/INSUFFICIENT_EVIDENCE` 的比例 `100%`，必需成果包可打开率 `≥98%`；
- 用户预算、日期、身份/入境、比赛场次和住宿等硬约束满足率 `100%`；时区、日期、地点与机场/场馆/酒店转场可行性 `100%`；预算、汇率和不可退金额计算准确率 `≥99%`；PDF/XLSX/ICS/JSON 关键字段一致率 `100%`；任一关键约束无法验证都必须降级，不能输出“完整可行”；
- 伪造库存、价格、预订成功、票券或证件必须为 `0`；live canary 连续两轮通过才可宣称该案例通过。

### 8.4 第二收费候选：BusinessDecisionPack

满足第 0.2 节五项 AND 解冻公式后才能成为第二个收费专业包；其中必须包含 BusinessDecisionPack 自己的支持矩阵、专家 holdout、安全关键集、pilot/canary、5/3/1/1 与单位经济，不能复用合同结果替代。此前可继续做目录、沙箱和 portfolio 评测。输出：需求证据、市场/竞品、单位经济、法务、产品/交付、团队、反方情景、14/30/90 天实验、投资上限和停止条件。

裁决统一为：

```text
GO
CONDITIONAL_GO（含 TEST_FIRST）
NO_GO
INSUFFICIENT_EVIDENCE
NEED_EXPERT
```

### 8.5 守望与受控行动

守望先开放“变化提醒 + 草案刷新”，由用户设置阈值、渠道、安静时段、费用和自动停止日。只有价格、政策、库存、风险或业务指标足以改变原建议才通知。

合同守望的首个 release flag 只覆盖“客户上传新合同版本”和经批准的权威规则源：文件事件即时触发，外部源按其更新特征冻结日/周频率；套餐必须写明每个 watch 的费用、轮询额度和超额停止。上线前用不少于 100 个标注变化事件验证重大变化召回率 `100%`、总体召回率 `≥95%`、通知 precision `≥90%`、重复通知 `0`；上传变更 15 分钟内、外部源在两倍轮询周期内完成检测。达不到就继续隐藏入口，不能用模型“可能有变化”的猜测骚扰用户。

受控行动按风险逐步开放：

```text
读取/比较/生成文件        自动
填写草稿但不提交          可配置
写日历/发送低风险通知      明确授权
锁价/占位                 精确授权 + 到期
付款/预订/签约/删除        后置；逐项授权 + 查单 + 补偿/事故流程
```

## 9. 商业模式、GTM 与利益冲突

### 9.1 产品商业包装

产品身份和收费切口必须分层，避免销售合同包时把整个产品改名成合同工具：

| 商业层 | 用户购买的价值 | 当前状态 |
| --- | --- | --- |
| 朝堂 OS Core | 一个超级助手、通用任务额度、计划/证据/成果/史馆主链 | 产品本体；先随专业包验证，独立定价待实验 |
| Team / Enterprise | 多角色协作、私有数据、审计、连接器、配额、部署和 SLA | 首个企业版本 |
| Solution Packs | 合同、商业决策、旅行等经过领域评测的深度能力与模板 | 合同包先收费；其余逐包解冻 |
| Expert Service | 律师或其他真实专家复核 | 独立身份、责任、报价、时限和数据授权 |

用户按可信任务价值、专业深度、协作/治理和 SLA 付费，不按 Agent、部门、MCP 或 token 数量付费。官网首页卖“把复杂任务办成完整成果”，专业解决方案页再卖合同等垂直价值。

### 9.2 首个收费包仍以企业为主

保留当前产品事实源中合同包的价格区间，同时把“卖什么”冻结成可验证的 `OFFER_HYPOTHESIS`，最终以订单和真实交付成本校准：

| 套餐假设 | 价格假设 | 首发边界 | 服务/部署边界 |
| --- | --- | --- | --- |
| 3 个月企业 POC | 1.5 万–3 万元 | 1 tenant、最多 5 名命名用户、30 份合同或 1,500 处理页（先到者为准） | 两次 onboarding、每周一次共创答疑；约定区域的逻辑隔离环境；工作日支持，不承诺正式 uptime 赔付 |
| 企业标准年费 | 3.6 万–8 万元 | 1 tenant、最多 10 名命名用户、每年 300 份合同或 15,000 处理页 | 管理员培训、审计导出、工作日支持；P1 受理目标 4 个工作小时；月可用性目标 99.5%，赔付需在订单中明确 |
| 企业专业/私有化 | 8 万–20 万元；私有化 20 万起 | 用户、页数、连接器按订单冻结 | SSO、专属审计、数据驻留/私有部署、RPO/RTO 与 SLA 单独评估；在遥测证明前不承诺 99.9% |

口径规则：PDF 每页计一处理页，DOCX 按受控渲染后的页数计，扫描 OCR 仍按原文件页数计；同一文件版本的系统重试不重复计量。因系统故障、超出支持矩阵、低质量 OCR 或安全门在 `FinalMemorial` 前停止的任务不扣合同额度；超额时先提示并购买增量包，绝不静默超费或降质。

套餐包含的是 AI 辅助的合同风险工作台、客户团队自己的人工裁决、审计和约定 SLA，**不包含执业律师出具的法律意见**。专家法律复核必须是独立服务：另行展示专家身份、责任主体、报价、时限、数据共享和交付物，不能把客户点击“批准”包装成律师审查。

### 9.3 未来个人版假设

只有至少两个非合同个人任务族证明复用、留存和单位经济后，再测试：体验版、个人订阅、99–299 元单份轻决策、深办专案包和守望名额。这是未来独立实验，不进入合同 1.0 offer，也不能用未验证的个人版想象改变当前企业首发优先级。

### 9.4 GTM 顺序

1. 首页和通用原型验证“一个目标 → 动态组阁 → 一个成果包”，不要求用户理解朝堂拓扑；
2. 用合同专业页找 5–10 家共创企业和合法获权的真实合同；
3. 用同一 canonical 主链交付合同决策单，不展示所有部门轮流作文；
4. 记录人工基线时间、系统时间、关键漏项、改判、采用和完整交付成本；
5. 争取第一笔企业 POC 或付费共创款，并复用到第二、第三家；
6. 同步以只读方式运行 benchmark portfolio，证明路由和成果内核不是合同专用硬编码；
7. 满足第 0.2 节五项 AND 门后，只允许商业化探索一个第二专业包。

### 9.5 利益冲突

未来机票、酒店、软件或专家推荐产生佣金时必须披露；默认排序不能由隐性佣金决定。供应商必须与证据评分分离，用户可选择“仅无佣来源”。专家升级的报价、身份、责任边界和数据共享也必须在授权前展示。

## 10. 北极星、指标和经济模型

### 10.1 领先北极星与滞后结果

当前产品 SSOT 的北极星原文是：

> 让 1 个真实老板，用朝堂 OS 真做成 1 件经营决策，并愿意说：“这帮我了。”

本稿另建议把“取得第一笔企业 POC/付费共创款”作为商业验证纪律；付款不是当前北极星原文的一部分，只有业主批准并更新 `PROJECT_PRODUCT.md` 后才能成为正式产品字段。

本稿建议把产品级**领先北极星**冻结为：

> **每个活跃账户每月完成的可信价值任务数（Trusted Value Missions per Monthly Active Account）。**

一项任务只在同时满足以下条件时计数：处于当时公开的支持范围；hard capability coverage 为 `COMPLETE`；C1–C8 与场景安全门通过；用户可取回完整成果；获权用户对精确奏折写入有效裁决，或有受控系统记录的真实采用；没有错误完成、未授权副作用、伪来源或数据安全事故。同一 mission 的重试、重新发布和被 successor 取代的旧版本当月只计一次，演示/内部 tenant 排除。`REJECT/INQUIRE` 只有在拒绝或补证本身解决了用户决策任务时才按单独规则计入，不可用低质量奏折刷数。

“活跃账户”是当月至少确认过一项非演示 `MissionContract` 的个人或 tenant；付费与试点必须分层报告，不能混成一个增长数字。正式事件定义、观察窗和“采用”证据仍需在指标字典中冻结。

合同专业包继续使用更窄的领先指标：

> **每个活跃付费合同账户每月产生的“正式合同奏折 + 有效人工裁决”数。**

其计数事件是获权用户对精确 `FinalMemorial.content_hash` 写入有效 `MemorialDecisionV1`；同一 mission 只计一个未被 supersede 的版本。该指标只能评价合同包，不能代表整个朝堂 OS。

**滞后结果北极星**是按任务类型定义的已结算 outcome 成功率：

```text
成功率 = 达到预先冻结成功条件的 SETTLED mission / 全部符合结算条件的 SETTLED mission
结算覆盖率 = 已 SETTLED mission / 已到结算日的 eligible mission
```

`NO_DATA` 不进入成功率分子或分母，但必须进入结算覆盖率的缺口，防止只回收好结果。分享、下载、页面停留和“采纳”只作为使用信号，不能替代人工裁决或真实 outcome。

### 10.2 配套指标

| 类别 | 指标 | 最低要求/用途 |
| --- | --- | --- |
| 激活 | 首次目标复述、计划确认、首个成果时间 | 发现入口摩擦 |
| 价值 | 可信价值任务、成果采用、人工裁决分布、决策周期缩短 | 领先价值；分享/下载仅作诊断 |
| 结果 | 已结算 outcome 的目标达成率 | 不能用下载代替 |
| 信任 | 原文/来源覆盖、事实纠错、冲突未解、过期率 | 按风险和任务类型切片 |
| 可靠 | 恢复率、重复副作用、PARTIAL/UNKNOWN、取消延迟 | P50/P95 与错误预算 |
| 能力覆盖 | 已认证能力覆盖率、hard-requirement recall、无能力误完成率 | 安全关键集 recall `100%`，误完成 `0` |
| 稀疏路由 | unnecessary activation rate、活跃 worker/成本分布、marginal evidence gain | 证明不是固定全朝会审；按 D0/D1/D2/高风险切片 |
| 最小权限 | inactive-agent data exposure、越权 tool token | 固定关键集必须为 `0` |
| 重试隔离 | whole-graph retry rate、局部工作包恢复率 | 单 worker 失败不得默认全图重跑 |
| 留存 | 30 天高价值复用、守望有效提醒率 | 不看页面停留时间 |
| 经济 | 每个可信价值任务成本、毛利、模型/工具成本 | 决定套餐和预算 |
| 安全 | 未授权 effect、跨租户泄露、伪来源、过期批准 | 固定关键集必须为 0 |

每个指标必须冻结事件定义、分母、观察窗、owner、source of truth 和 `NO_DATA` 语义。平均分不能掩盖高风险分群退化；部门数、Agent 数、Prompt 数、MCP 数和工具数只能是库存，不能成为覆盖或价值 KPI。

## 11. 唯一路线与产品发布门

### 11.1 不再新建竞争里程碑

工程依赖继续沿现有 [`chaotang-os-world-class-agent-harness-execution-plan-2026-07-17.md`](chaotang-os-world-class-agent-harness-execution-plan-2026-07-17.md) 的 M0–M10。本稿只给产品门，不重新发明 P0–P5、E0–E5 或阶段 A–F。

权威计划中的推荐串行顺序必须原样保持：

```text
M0 事实源与黄金基线冻结
→ M1 TaskEnvelope / TraceContext
→ M2 CapabilityCard 注册与能力健康
→ M5 EvidencePacket / 统一证据协议
→ M6 御史证据门与冲突门
→ M3 自适应路由与 shadow routing
→ M4 Agent 懒加载与预算治理
→ M7 真实结果回执与史馆飞轮
→ M8 六部能力补齐
→ M9 生产 Trace 与 KPI 仪表盘
→ M10 LangGraph 隔离 PoC（仅当 M0–M9 证明需要）
```

本稿提出的 `MissionContract / RequiredCapabilitySet / ActivationPlan / MissionConfirmation / EvidenceCompletionAssessment / ArtifactManifest / DeliveryAssessment / MemorialDecision / ActionApproval` 是**产品切片所需的候选契约**，不在本文中静默塞入 M1、M2、M3 或 M6。实施前必须由权威计划 owner 出具一次显式 amendment，给每个对象分配 milestone、schema owner、迁移与测试；在该 amendment 获批前，相关工程冻结仍为 `BLOCKED`。

M8“六部能力补齐”应由同一 amendment 解释为：先收敛 41 司目标 taxonomy，再按 CapabilityCard 两轴逐能力推进，最后以 portfolio 与线上回执证明；不能用“六部各有一个 adapter”宣布完成。这个解释不得改变 M8 的位置或绕过 M0–M7 依赖。

产品发布是覆盖在工程顺序之上的门：M6 后只允许用合成/合法脱敏材料做内部 shadow；任何真实客户合同 POC 之前，至少要完成 M9 所要求的 tenant/user/purpose 全链 trace、决策/工具/下载审计、P1 告警、成本与错误预算看板。按当前顺序最简单的裁决是等 M9 完成再发布；如业务要提前，必须先正式修订路线并前置这组 M9 release subset，不能先处理敏感合同、以后再补可观测性。

M10 始终是条件 PoC，不是首发依赖。LangGraph 只在 M0–M9 后出现可测的动态图/多次中断瓶颈、隔离 PoC 至少改善 `30%` 且不破坏 canonical 主链时才考虑。

### 11.2 首发 stop-ship（恒定门槛）

在产品首发前必须关闭：

1. 发布候选必须绑定干净、可复现、独立复审且 required checks 真实生效的 integration HEAD；
2. 门下省 hard veto 必须阻止 dispatch，最大轮次不得 fail-open；
3. TaskEnvelope/TraceContext 必须贯穿 API、outbox、worker 和回执；V2/upcaster 需先获路线 amendment；
4. 六部身份、41 司目标 taxonomy、CapabilityCard 与 engine/tool 名称必须收敛到唯一可机读事实源；目录状态不得冒充生产状态；
5. `CapabilityCard / MissionContract / RequiredCapabilitySet / ActivationPlan / EvidencePacket` 各自必须有唯一 schema、owner 和 canonical writer；
6. RequiredCapabilitySet 必须对 MissionContract 的每个 DoD、约束与风险义务双向可追踪，任何 unmapped/unknown 均 fail-closed；
7. Sparse Activation Planner 必须证明 hard coverage `100%`、最小安全集合，以及 standby/未激活能力零数据、零 token、零权限；
8. 未认证或不支持能力不得被生产路由，禁止通用 LLM/角色 Prompt 裸 fallback 伪装成该司能力；能力降级/kill switch 必须撤销 token、隔离在途结果并阻止新调用；
9. C1–C7、御史、`FinalMemorial`、artifact、C8 必须按第 4 节顺序接线，不能并列新建完成库；
10. AgentBudget、取消、截止时间、重试、查单和补偿必须跨线程/worker 统一传播，单 worker 失败不得默认重跑全图；
11. 三类人工决定必须精确绑定；draft 工具调用和 legacy `EmperorDecision` 不能等同动作授权；
12. 附件、上传知识和下载必须按 tenant/user/purpose 隔离，并通过安全扫描、保留和删除门；
13. 关键路径只能使用有真实回执和供应链审计的工具；mock/TODO/高风险桥接不得进入生产支持矩阵；
14. 在摄取与晋升门通过前，知识/反馈/失败记忆不得自动进入 RAG、共享学习或生产技能；canonical 史馆归档仍必须执行；
15. 真实客户数据进入前，M9 release subset 的全链 trace、审计、P1 告警、成本/错误预算与事故演练必须生效。

### 11.3 分层发布门（2026-07-18 冻结修订）

发布按能力事实逐层晋升，不用一个“1.0”同时宣称超级助手、全六部、合同、旅行和现实代办。本表是本决策记录唯一被后续产品冻结修订的发布顺序；精确门槛以 R0/R1 PRD 为准。

| 层 | 可对外声明 | 必须通过 |
| --- | --- | --- |
| R0 内部可信内核 | 内部合同可信纵切 | canonical task/奏折、门下不 fail-open、真实证据准入、无伪完成、三类人工决定、幂等/取消/恢复、权限/附件/审计 |
| R1 合同 Paid Design Pilot | 有边界、有人审、可退出的付费共创 | 中文/大陆法域/制造业 B2B 采购销售服务合同；至少一份真实付款共创协议；人工复核、数据授权、支持/拒答与事故流程 |
| R2 邀请制生产 | 朝堂 OS 1.0 可信复杂任务超级助手，以合同包为首个稳定 Offer | R1 5/3/1/1、合同 holdout、安全零容忍、SLO、恢复/迁移/客服、真实浏览器与下载闭环 |
| R3 跨域复杂任务证明 | “已验证任务族”，不称全域助手 | `BenchmarkPortfolioPassManifestV1` 证明至少三个不同任务族通过冻结回归/live canary；世界杯 benchmark 通过 |
| R4 第二收费专业包 | 一个新的 Solution Pack | 第 0.2 节五项 AND 门，包括候选包自己的支持/拒答、专家 holdout、安全零容忍、pilot/canary、客户价值和单位经济；一次只开放一个 |
| R5 守望/受控行动 | 变化提醒，随后逐级开放现实动作 | 变化集、通知门、精确授权、查单、补偿、事故演练；付款/签约最后开放 |

R0/R1 的共同硬门：精确 HEAD 独立复审、required checks 生效、一个 canonical task 和一个 `FinalMemorial`、三类决定摘要不可漂移、ACL fail-closed、断线/取消/过期/冲突/附件失败不伪报完成、`NO_DATA` 不显示假成功率。R1 额外要求真实付款、人工复核与真实数据准入；41 司目录完整度不是 R1 入口或退出门。

R2 的用户体验门另要求：普通用户不理解部门结构也能完成任务，3 分钟内得到首个有用风险定位，至少 80% 测试用户无需帮助完成成果与裁决闭环。每个高风险结论必须有原文/来源，缺证不得输出无条件“可签/安全”。

## 12. 产品定型后的实施前工作

### 12.1 已冻结产品字段与待验证实施字段

| 决策 | 状态 | 本稿推荐 / 下一裁决 |
| --- | --- | --- |
| 产品本体 | **已冻结** | 一个可信复杂任务超级助手 + 动态多-Agent 朝堂 |
| 任务组阁原则 | **产品原则已冻结** | 目录覆盖、单次最小安全激活；运行契约由 amendment 验证 |
| 41 司 taxonomy 与 owner | **taxonomy 已冻结 / owner 待定** | `TARGET_DIRECTORY_V1` 已采纳；先消除名称漂移，再指定唯一 registry writer |
| 能力成熟度与权限级 | **发布语义已冻结 / schema 待定** | 逐 capability 发布，不给整部一次性盖章；具体双轴 contract 需 ADR |
| 核心用户与首个 GTM ICP | **已冻结** | 产品服务有复杂目标的个人/团队；第一 ICP 是制造业/B2B 合同团队 |
| 信息架构 | **R0/R1 已冻结** | 一个助手入口、合同 Solution、一条状态线、一个成果包；视觉原型待验证 |
| 合同专业包承诺与裁决 | **已冻结** | 原文风险/修改/证据/留痕 + 五种保守枚举；法律顾问仍须准入 |
| 首个收费 Offer | **范围已冻结 / 价格待验证** | 有配额、有人审、可退出；定价均为假设 |
| 产品与专业包指标 | **指标已冻结 / 事件字典待定** | 产品看可信价值任务与 settled outcome；合同包看正式奏折 + 有效裁决 |
| 发布/扩张门 | **已冻结** | R0 内核 → R1 合同 Paid Pilot → R2 邀请制生产 → R3+ 证据化扩张 |

OpenClaw、Hermes、Humen/Hume 的身份与 PoC 不属于产品定型阻塞项；若要评估 Humen，先由业主提供准确产品链接，再按第 6.5 节 adapter 边界单独立项。

### 12.2 产品工作

1. R0/R1 PRD 已生成；下一产品 change 再产出一页官网信息架构和“Core / Team / Solution Packs”商业包装；
2. 先做“一个输入框 → 目标确认 → 动态组阁 → 一个成果包”的通用可点击原型，再做合同专业包深页；
3. 用世界杯、商业判断、合同、学习研究、个人效率各至少一个 concierge 任务测试主旅程，验证普通用户无需理解六部；
4. 完成 10 次核心用户问题访谈和 10 次首个 GTM 访谈；后者分别覆盖购买者、操作者、业务负责人和裁决人，其中至少 5 次使用合法获权真实合同；
5. 冻结首发合同类型、法域、五种合同裁决、免责声明和 `NEED_LEGAL_REVIEW` 范围，并由外部法律顾问审阅产品承诺；
6. 设计计划、激活理由、进度、成果、证据下钻、补证、奏折裁决、动作授权、导出/删除和史馆原型；合同包另含上传、原文风险、版本 diff 与逐项处置；
7. 与至少 5 名个人和 5 组团队做端到端任务测试，记录首次价值、角色交接、认知负担、误解和信任断点；
8. 把合同 POC/标准/专业套餐拿给至少 5 家客户报价，拿到第一笔真实付款或结构化拒付理由；
9. 建立第 8.1 节 benchmark portfolio，并双人标注第 8.2 节合同集，先校准阈值再冻结 holdout；
10. 冻结产品级与专业包级指标字典、埋点、用户反馈和申诉流程。

### 12.3 工程工作

1. 先形成干净、可复现、隔离范围外改动且获独立复审的唯一 integration HEAD；具体仓库现场只以当前 change/audit 为准；
2. 完成 M0 事实源与黄金基线；
3. 由 M0–M10 计划 owner 批准产品切片契约 amendment；未批准前不把新对象混入 M1/M6；
4. 冻结六部/41 司唯一 taxonomy、CapabilityCard 两轴、schema owner、canonical writer、三类 Decision 和正交状态机；
5. 修复门下省 hard veto、零能力误路由和 fail-open；禁止裸 LLM/角色 Prompt 冒充未实现能力；
6. 按权威路线实现 TaskEnvelope/TraceContext、Capability Registry 和 EvidencePacket，并保持 V1 兼容；
7. 实现 RequiredCapabilitySet、Sparse Activation Planner、激活理由、消融评测和 capability token 最小权限；
8. 建 Tool Gateway/VerifiedToolReceipt/Evidence Admission 信任链，worker 不得自写正式回执或 outcome；
9. 接入 C1–C7 → 御史 → `FinalMemorial` → artifact → C8，并证明附件失败可独立重试；
10. 实现 AgentBudget、取消/查单、局部重试、幂等、fencing、callback 乱序、撤销和补偿；
11. 在真实客户数据进入前完成 M9 release subset、故障注入和事故演练；
12. 按 R0 合同可信内核 → R1 合同 Paid Pilot → R2 邀请制生产推进；41 司目录和 portfolio 可并行只读治理，但不提前获得外部承诺；
13. 在上述闭环完成前，不做 LangGraph、Temporal、A2A 或第三方深度接入。

### 12.4 数据、安全、运营与法律

- 为所有用户任务数据建立 tenant/user/purpose ACL、加密、保留、删除和下载策略；合同等企业材料另加 legal hold 与组织权限；
- 明确外部模型、OCR、对象存储和专家服务的数据驻留与再利用政策；
- 建立附件隔离、真实类型、病毒/宏/压缩炸弹/提示注入和安全导出门；
- 建立错误事实纠正、人工复核、争议、事故和 SLA 升级流程；
- MCP/连接器逐个做许可证、供应链、凭据、域名、回调和 kill-switch 审计；
- 任何专家升级明确身份、报价、责任、数据共享和交付时限。

### 12.5 文档治理

文档不是靠“主 RFC”三个字争夺权威，而是按字段分工：

| 资产 | 唯一拥有的事实 | 不拥有 | 冲突时优先级 |
| --- | --- | --- | --- |
| `docs/product/PROJECT_PRODUCT.md` | 当前有效的定位、ICP、角色、首发 offer、承诺、指标、发布/扩张门 | 详细 schema、临时仓库状态 | **所有当前产品字段最高** |
| 本融合 RFC | 某次定型决定、比较依据、取舍和被否决方案 | 获批后的可变产品字段 | 不覆盖 SSOT；作为不可变历史理由 |
| M0–M10 执行计划 | milestone 顺序、依赖和工程验收 | 产品价格/市场承诺 | 工程排期字段最高 |
| contract / ADR | schema、canonical writer、状态机、技术选择 | 市场定位与当前工程现场 | 各自技术字段最高 |
| `.harness/changes/` | 绑定精确 HEAD/输入 hash 的范围、验证与临时现场 | 长期产品/架构事实 | 审计证据最高，但会随 change 关闭 |
| 候选 A/B | 输入观点 | 任何获批后的事实 | 最低；批准后标记 superseded |

业主批准必须是一次原子文档事务：绑定本 RFC 的精确 SHA-256；在同一变更中把所有获批产品字段（超级助手定位、核心用户/GTM ICP、首页/解决方案层级、41 司目标与成熟度、五种合同裁决、offer、产品/专业包指标、发布和扩张门）写入 `PROJECT_PRODUCT.md`；同步修订 `CHAOTANG_CONVERGENCE_GUIDE.md` 中与新方向冲突的旧发布限制；把 RFC 状态改为 `ACCEPTED_DECISION_RECORD` 并反向链接 SSOT；再把 A/B 标记 `SUPERSEDED_BY`。如果以后 SSOT 与本 RFC 不同，以 SSOT 为当前真值，本 RFC 保留历史理由，不进行双份同步维护。

随后执行：

1. 把契约、状态、MCP 安全、外部集成分别落到工程 contract/ADR，不让产品 SSOT 膨胀成实现手册；
2. 易过期仓库状态只进入 `.harness/changes/` 和带 commit 的审计报告；
3. 每个实施 Packet 只引用一个产品 SSOT、一个对应 Decision/ADR、一个 schema 和一个验证命令；
4. 新事实改变定型方案时走 Decision Log 并原子更新 SSOT，不在多份文档静默改口径。

## 13. 产品冻结与实施就绪的完成定义

下列清单同时包含产品字段和实施字段。产品字段已冻结不代表工程完成；未勾选项由后续 PRD/ADR/amendment/change 关闭，不得用本决策记录追认。

- [x] 一个产品本体：用户超级助手 + 动态多-Agent 朝堂；
- [x] 一个长期能力边界：六部及全部经批准专属司，世界杯只是案例；
- [x] 一组冻结的核心用户、首个 GTM ICP、经济购买者、操作者、业务负责人和最终裁决人；
- [x] 一个产品级首页/解决方案/专业包信息架构；
- [ ] 41 司目标 taxonomy 已获批；唯一 runtime registry owner 尚未指定；
- [ ] 两条能力成熟/认证轴、自动降级和 release 语义；
- [x] 一个首个付费专业包；
- [ ] 一个包含额度、支持、SLA、部署、超额和失败计费的 offer；
- [x] 一个通用主 JTBD、专业包 JTBD 与可证伪价值承诺；
- [x] 一个产品级支持/拒答/专家升级矩阵；精确 taxonomy 仍待法律 Owner；
- [x] 一个用户主链和核心卡片语义；
- [x] 一个 canonical 任务与正式奏折事实源；
- [ ] 一套版本化契约和正交状态；
- [ ] 一个 RequiredCapabilitySet → Sparse Activation Planner → Menxia 的最小组阁闭环；
- [ ] 一套 inactive-agent 零数据/零权限与 capability token 规则；
- [x] 一组不可被质量分覆盖的产品硬门；实现和反例测试仍待工程 change；
- [x] 三个清晰分开的人工决定语义；精确摘要绑定仍待 contract；
- [x] 一个通用成果包与首个专业包的完成定义；
- [ ] 一套 portfolio、律师标注合同 holdout、世界杯快照/live canary、拒答与故障注入量化门；
- [ ] 一个定价假设与真实付款实验；
- [ ] 产品北极星和专业包指标已冻结；完整事件/分母字典尚未实现；
- [x] R0–R5 发布层级与逐包独立证据扩张门；
- [ ] 一张与 M0–M10 对齐的依赖图；
- [x] 一张字段级事实源/优先级表；
- [x] 旧候选和旧 FULL_COURT 范围裁决已有 supersession 记录；历史输入快照保持不可变。

## 14. 大神会审

🎲 大神会审（Andrej Karpathy · 稀疏智能系统 × 张小龙 · 用户体验减法）

⚠️ 警示（Karpathy）：把 41 个角色都写成 Prompt、每次全部运行，不是能力覆盖，而是用 token、延迟和相关错误制造“朝堂很忙”的幻觉。真正的规模化是能力目录可以很大，激活集合必须很小且能被消融证明。

⚠️ 警示（张小龙）：如果用户先学六部、再选 Agent、最后阅读 41 份意见，超级助手就退化成组织架构模拟器。用户只应面对一个会追问、会交付的助手；朝堂结构只在解释“为何这样办”和证据下钻时出现。

💡 天才建议（Karpathy）：把每次下旨建模为 RequiredCapabilitySet，让稀疏路由器在覆盖、独立验证、权限与预算约束下求最小安全集合；每新增一个 Agent，都必须能回答“移除它会缺哪条硬要求”。

💡 天才建议（张小龙）：首屏只保留一句话目标、一个计划确认和一个成果包。合同、世界杯、商业判断是可点击样例与 Solution Pack，不是三个互相竞争的产品入口；过程卡展示贡献和缺口，不轮流播放部门作文。

🔧 推荐技能：`product-manager-ai-workflow`——每新增/调整一个 Solution Pack 时运行 1 次，冻结用户、JTBD、完成定义、拒答、价格实验和 release gate；`expert-perspective`——每次产品层级、能力 taxonomy 或高风险授权发生实质变更时运行 1 次，用稀疏系统与体验减法双视角复审。

🆕 技能洞察：用“全员朝会”替换为“全域能力目录 + 稀疏专案组”，再用“多份部门报告”替换为“一个成果包 + 可下钻证据”；这同时降低认知成本、调用成本、错误相关性和数据暴露面，比单纯增加 Agent 更接近真正的超级助手。

## 15. 最终建议

产品方向现在已经清楚，应该把它冻结成一句产品宪法：

```text
产品：用户只面对一个超级助手。
后台：完整登记六部、41 司与横向专署的能力，但每单只召集最小必要班底。
交付：所有人只贡献结构化证据与成果组件，最终只交付一个可下载、可裁决、可继续办的成果包。
案例：世界杯证明旗舰跨域任务；它不是产品本体，也不能单独证明万能。
商业：合同审查是首个收费专业包；它验证第一笔收入，不缩小产品身份。
发布：按 R0–R5 逐层证明；没有能力就补证、转专家或诚实停止。
```

本决策记录已被产品冻结采纳，但不宣称任何司已经实现。当前产品字段已原子写入 SSOT 与 R0/R1 PRD；下一步按顺序做：M0–M10 Owner 批准契约 amendment → 修复三项信誉 stop-ship 并完成 R0 → 在数据与人工复核门下运行合同 R1 Paid Pilot → 通过全部退出门后立项 R2 → 用 portfolio（含世界杯）证明跨域 → 再只开放一个新专业包。
