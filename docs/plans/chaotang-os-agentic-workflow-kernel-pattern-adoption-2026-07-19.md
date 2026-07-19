# 朝堂 OS Agentic 工作内核模式采用决策与 M0–M10 Amendment 输入

> 日期：2026-07-19
> 状态：`ACCEPTED_PATTERN_PRINCIPLES / BASELINE_REBOUND / WORKBUDDY_IDENTITY_PENDING / NO_RUNTIME_ADOPTION / IMPLEMENTATION_REQUIRES_M0_M10_AMENDMENT`
> PR !3 审定来源头：`docs/product-r0-freeze-20260718@df632e4f7c95b7c53a5ad9cb2a725a1e404976fd`
> 产品正式合并头：`ef9b597412f53c00fb717ea5b7a2a265fd599f0f`（双亲为 `05582e520300e32a5d84e2b38b3822903f75c954` 与 PR !3 审定来源头）
> 当前集成基线：`origin/feature-chaotang-ext@e69f2795a8a144a4e9a89ccc7b690c2ecbe10707`（`ef9b597...` 的直接子提交；收敛 R0 数据边界、风险口径与 R1 商业门）
> 根级 Change：`docs-agentic-workflow-kernel-pattern-adoption-20260719`
> Owner：Product Owner；M0–M10 Engineering Owner=`TBD_BY_AMENDMENT`

## 0. 决策摘要

朝堂 OS 应吸收 Claude Code 与 WorkBuddy 中已经被验证有用户价值的工作模式，但不把任何一个外部产品、
会话格式、任务库、记忆库或运行时接成新的 canonical 中枢。

本决策冻结四件事：

1. **学模式，不接管主链**：计划、授权、隔离执行、恢复、成果、验证、通知和记忆治理都映射到朝堂既有对象。
2. **开发控制面与产品运行时分泳道**：Claude Code 的开发配置不自动成为朝堂业务能力。
3. **一个产品、一条工程路线**：本文件是设计输入，不建立独立施工 DAG；实现只能进入既有 M0–M10 的一次显式 amendment。
4. **先证据、后晋级**：外部模式先登记来源与处置，再用合成 benchmark 验证；未通过安全、许可证和 canonical 门不得接真实数据。

用户于 2026-07-19 明确同意“吸收模式、补蓝图”的方案。本次批准只覆盖文档决策和后续施工规划，
不授权运行时代码、外部源码复制、真实数据 PoC、Provider 接入、提交、推送、合并或生产切换。

### 0.1 权威优先级

```text
产品宪法 PROJECT_PRODUCT.md
  > R0/R1 PRD
  > 获批的唯一 M0–M10 amendment
  > 本 Pattern Adoption Decision（设计输入）
  > 精确 change / CI（完成证据，不拥有长期产品定义）
```

本文件与上层权威冲突时以上层为准。品牌能力发生变化时，只更新来源观察和处置，不改写产品身份。

## 1. 产品为什么要吸收这些模式

当前产品承诺已经是“一旨、一卡、一包”：用户只面对一个助手、一个计划、一条真实进度线和一个成果包。
因此 Claude Code 和 WorkBuddy 的价值不在于再增加两个 Agent，而在于提供更成熟的任务工作方法：

- 复杂任务先形成用户能理解的计划，再执行；
- 每项能力只获得完成当前任务所需的最小上下文、工具和权限；
- 确定性代码负责权限、状态、验证与完成，模型只负责需要判断的部分；
- 长任务可以暂停、续办、局部重试和查明在途动作；
- 结果以可取回成果和证据为准，而不是以 Agent 自述“完成”为准；
- 用户可以看见、撤销和删除被保存的授权与记忆；
- 普通用户不需要理解 Agent、MCP、Hook 或工作流框架。

### 1.1 不改变的产品决定

- 产品仍是面向个人与团队的可信复杂任务超级助手。
- R0/R1 首个商业 Offer 仍是中国大陆制造业/B2B 日常合同决策包。
- 世界杯旅行仍是跨域只读 benchmark，不是当前首发产品。
- 六部 41 司仍是长期能力目录，不是 R0/R1 完成条件。
- 不修改“一旨、一卡、一包”、三次人类决定、canonical 主链和 `DELIVERED` 完成公式。

## 2. 来源身份与处置

“WorkBuddy”不是唯一产品名。本文件将两个公开对象分别登记；在业主给出准确链接或产品版本前，
不得把笼统的“WorkBuddy”写进实现 spec。

| 来源 | 本次识别 | 处置 | 可吸收 | 明确禁止 |
| --- | --- | --- | --- | --- |
| Claude Code | Anthropic 官方开发 Agent；官方文档快照日期 2026-07-19 | `ADOPT_PATTERN / NO_PRODUCT_RUNTIME_DEPENDENCY` | Plan、deny-first 权限、隔离 subagent、Skills、Hooks、MCP、恢复与验证闭环 | Claude session/JSONL、`.claude/`、本地 hook 或 checkpoint 成为生产事实源 |
| Tencent WorkBuddy | 腾讯全场景 AI 办公工作台；准确商业版本与合同未冻结 | `ISOLATED_BENCHMARK / HOLD_REAL_DATA` | 一句话任务、任务工作台、后台长任务、成果面板、通知、Connector/Skill 治理 | R0 处理客户原件或任何可重新识别材料；R1+ 在 DPA/TOS、合法依据与用途、数据类别/最小化、地域、保留/删除、训练使用、subprocessor、fallback/退出和具名 Owner 未冻结，或尚未满足当前 R0/R1 PRD §8.2、关闭其 §2.3 指定的 OQ-01–06、OQ-09、OQ-10 前处理真实客户数据 |
| 开源 `work-buddy` | Kaden McKeen 的个人 Agent runtime；公开仓标记 `GPL-3.0-only`，精确 commit 未冻结 | `REFERENCE_ONLY / CLEAN_ROOM / HOLD_CODE_USE` | 工作流、精确同意、事件投影、sidecar、成果和记忆生命周期的抽象模式 | 未经具名 License/Legal 裁决复制、改写、vendor、链接或分发源码/模板/资产 |

实现前 M0 必须冻结 URL、访问日期、版本/commit、许可证 hash、数据条款和负责人；网页宣传、README 或模型记忆
都不能替代这一来源快照。

## 3. 双泳道边界

| 泳道 | 拥有 | 不拥有 | 证据 |
| --- | --- | --- | --- |
| `DEVELOPER_CONTROL_PLANE` | Git 工作、开发 Skills、开发 Hooks、代码子代理、工作树、测试与 review | 用户 `DecisionTask`、业务授权、正式奏折、用户记忆与结果 | Git/change/CI |
| `PRODUCT_RUNTIME` | 用户任务、组阁、派单、候选回奏、证据、奏折、裁决、成果、史馆与 outcome | Git lease、Claude session、开发 hook 状态 | canonical 业务事件与数据库 |

硬规则：

- `.claude/`、开发 Skill、开发 Agent 或本机会话不得成为产品运行依赖。
- 开发 `PreToolUse`/Stop hook 只能提高开发反馈，不能代替服务端权限门或发布门。
- 产品 Agent 不能读取开发会话作为用户任务事实；开发 Agent 也不能直接写业务完成状态。
- 两个泳道的 task、lease、checkpoint、approval 同名时仍无隐式转换关系。

## 4. 模式采用矩阵

处置枚举固定为：`ADOPT_PATTERN / ADAPT / ISOLATED_BENCHMARK / HOLD / REJECT`。

| 模式 | 处置 | 用户价值 | 朝堂 canonical 落点 | 建议阶段 | 最小验收 |
| --- | --- | --- | --- | --- | --- |
| Plan before act | `ADOPT_PATTERN` | 先看懂计划再授权 | `DecisionTask` 版本化输入快照 + `ChancellorRouteDecision` | M1 / R0 | 确认绑定精确版本；目标、范围、预算或风险改变后强制重确认 |
| Permission modes | `ADAPT` | 用户只批准真正需要的范围 | 版本化权限协议 + 服务端确定性门；不建 ConsentLedger | M1 + M6 / R0 | 缺字段、过期、撤销、重放、跨租户和子 Agent 扩权全部拒绝 |
| Context-isolated subagents | `ADOPT_PATTERN` | 少泄露、少 token、少串扰 | `ChancellorRouteDecision` 选人；worker 只回 candidate/receipt | M2–M4 / R0-R1 | 未激活能力零数据/零 token/零工具；worker 不能发布正式奏折 |
| Skills / reusable SOP | `ADAPT` | 用户获得可复用“锦囊” | M2 `CapabilityCard` 引用版本化 Skill 规格，M7 outcome 晋级 | M2 + M4 + M7 / R1 | 签名/来源/版本/allowlist/反例/kill switch 完整；不得自动 ACTIVE |
| Hooks | `ADAPT` | 关键动作可被稳定阻断 | 服务端生命周期事件 + M6 确定性 gate | M5 + M6 / R0 | 任意 shell/LLM hook 不得成为安全权威；超时与失败策略确定 |
| MCP / Connectors | `ADAPT` | 可安全连接外部工具与数据 | 后端 Tool/Provider Gateway + 可核验 receipt | M2 + M5 + M6 / R0-R2 | MCP 自述不等于可信；Provider、scope、region、版本和输出来源可核验 |
| Session resume / digest | `ADOPT_PATTERN` | 断线或隔夜后无需重新解释 | 从 canonical 事件派生恢复投影，不建 Session SSOT | M1 + R0 纵切 | 恢复前重验租户、计划版本和授权；摘要不能推进正式状态 |
| Checkpoint / retry | `ADAPT` | 长任务可暂停、续办和局部恢复 | `DecreeExecutionEvent`、outbox、artifact 的幂等节点/投影 | M1 + M4 + M5 / R0 | 非幂等动作不盲重放；取消后查明在途请求；迟到回调不伪完成 |
| Verify loop | `ADOPT_PATTERN` | 用户拿到证据而非口头保证 | M5 Evidence/Artifact + M6 完成门 | M5 + M6 / R0 | 浏览器、下载、来源和独立 review 证据齐全；Agent 自评不能覆盖硬 FAIL |
| Shared agent-team task graph | `HOLD` | 大型任务可并行协作 | 只允许成为 canonical 事件的图投影 | R3+ | 租约、fencing、取消、冲突和完成门证明净收益后另案 |
| 一句话到可下载成果 | `ADOPT_PATTERN` | 普通用户不管理 Agent 拓扑 | 既有“一旨、一卡、一包” | R0 | 一个入口、一个主动作；必需附件缺失不得 `DELIVERED` |
| Task workspace / results panel | `ADAPT` | 随时看进度、阻塞、成果和下一步 | canonical 读模型；不是本地 Task DB | R0 纵切 | 状态全部由服务端事实派生；UI 不能补造 LIVE/完成 |
| Background work + notification | `ADAPT` | 用户离开后任务仍可安全办理 | M4 后台执行 + outbox 通知投影 | R1-R2 | 通知送达不等于任务完成；需要新授权时自动暂停 |
| Scoped consent | `ADOPT_PATTERN` | 每次批准可理解、可撤销、不可重放 | 权限协议 + M6 pre-action gate | M1 + M6 / R0 | 绑定 actor/task/plan/action/target/hash/TTL；first response 有审计 |
| Artifact lifecycle | `ADOPT_PATTERN` | 附件可验证、过期、删除和追溯 | `ArtifactManifest` 协议映射既有成果链 | M5 / R0-R1 | hash、来源、租户、状态、保留与删除传播完整 |
| Persistent memory | `ADAPT` | 越用越懂但用户仍有主权 | M7 记忆候选/晋级/删除；不自动写共享记忆 | R1+ | 可看、可改、可删、可导出；撤销后停止召回；跨租户为零 |
| Sidecar supervision | `ADAPT` | worker 可探活、退避和恢复 | M4 执行控制面 | R1+ | sidecar 可丢弃并从 canonical 重建；不得拥有业务完成事实 |
| Skill marketplace / autonomous automation | `HOLD` | 扩展能力 | 以后按签名供应链和专业包发布门评估 | R3+ | 未具备来源、权限、数据和撤销治理前不得开放 |

## 5. 安全与信任协议

### 5.1 权限信封

`PermissionEnvelope` 只是候选协议名，不是新数据库或新批准事实源。正式命名、owner、writer 和存储映射必须由
M0–M10 amendment 裁定。协议至少表达：

```text
tenant_id, approver_id, grantee_principal_id,
executing_principal_id, task_id, trace_id,
plan_version, input_digest,
capability_id, tool_or_provider_id,
audience, parent_grant_id, delegation_chain_digest,
object_or_resource_scope, target_id,
action_id, attempt_id, purpose, data_categories,
effect_class = READ | DRAFT | SEND | PAY | DELETE,
action_risk_class = AR0_ROUTINE | AR1_SENSITIVE | AR2_HIGH_IMPACT | AR3_RESTRICTED,
reversibility, payload_digest,
amount, currency,
budget = time | token | cost | calls,
approval_ref, policy_version,
issued_at, expires_at, revoked_at,
nonce, max_uses, consumed_uses, consumed_at,
idempotency_key, kill_generation
```

规则：

- 默认拒绝；安全关键字段缺失即拒绝；deny 永远优先于 allow。
- 子 Agent 的有效权限只能是父信封、能力卡和当前策略的集合交集，不得扩权。
- prompt、Skill、网页、文档或外部 workflow 文本不能修改权限信封。
- `approver_id`、`grantee_principal_id` 与实际 `executing_principal_id` 分开；执行主体、audience、父授权或委托链任一不匹配即拒绝。
- `READ` 不能升级为 `SEND/PAY/DELETE`；现实副作用必须绑定精确计划版本、输入摘要、action/attempt、对象、目标、payload digest、金额、币种和短 TTL。
- `action_risk_class` 只属于授权/现实动作命名空间，由未来 M1/M6 policy owner 冻结；不得序列化成合同 `riskLevel`，也不得与 release-severity P0/P1 或运营告警级别混算。
- 服务端在 pre-action 以原子 compare-and-set 消费授权；非读取副作用默认 `max_uses=1`。nonce、次数、版本、digest 或 idempotency 绑定不符即拒绝，旧计划批准和其他 worker 不得复用。
- 撤销后停止新调用；queued/in-flight 状态进入查单或 `UNKNOWN/RECONCILING`，不得假称已取消。

### 5.2 记忆主权

- 分开 `task context / user preference / organization knowledge / outcome`，不得把所有内容放进一池向量记忆。
- 默认只在当前任务短期使用；客户原文、反馈、裁决和情绪推断不得自动晋升共享记忆。
- 晋升固定经过 `candidate -> 来源/授权/DLP/人工审查 -> approved`。
- 每条长期记忆必须有 tenant、source、purpose、visibility、sensitivity、TTL、consent version 和删除/导出指针。
- 外部 runtime 的 ambient recall/retain 默认关闭；删除必须传播到主库、对象存储、索引、缓存和适用 Provider，并取得下游回执。
- 删除状态至少区分 `REQUESTED / PROPAGATING / HELD / PARTIAL / COMPLETE`。legal hold 必须有 owner、范围、依据和到期/复核时间；hold 阻止物理删除时仍应停止未获授权的检索和使用，并向用户诚实显示。
- 删除 tombstone 与 restore filter 必须阻止备份恢复、事件 replay 或重建索引“复活”已删内容；备份按获批周期淘汰。下游回执、恢复负例和备份义务未闭环时不得显示 `DELETE_COMPLETE`。

### 5.3 Provider、Connector 与数据外发

每项 Provider/Connector 必须登记：身份与版本、owner、用途、数据类别、DPA/TOS、训练使用、保留期、
处理地域、subprocessor、fallback、成本、事故/删除 SLA、kill switch 和退出策略。

- 网络和 Gateway 层 enforce allowlist，不能只靠 prompt。
- 每次外发都必须构造 payload-level egress envelope，并逐请求核对 tenant、object 清单、purpose、data categories、approval/grant、recipient、Provider、model、region、字段最小化/DLP 结果、payload digest 与大小；任一不符即零出网。
- fallback 不得静默改变地域、训练策略、数据类别、`effect_class` 或 `action_risk_class`。
- fallback 只有在当前授权精确列入其 Provider/model/region/audience 时才可使用；否则暂停并重新批准，不能以“政策看起来等价”代替授权。
- Skills、MCP、嵌套 LLM 和通知通道都按独立 processor 审核。
- receipt 必须记录最小必要的 tenant/task/object refs、purpose、recipient、Provider/model/region、policy/grant version、payload digest、DLP 结果和时间；日志不记录密钥、完整 prompt、合同正文或可还原敏感片段。

### 5.4 六级 kill switch

至少覆盖：`global / vendor / capability / tenant / task / action`。每次切换递增不可回退的
`kill_generation`/fencing token，并在 dispatch、claim/lease、凭证签发、pre-action、egress、不可逆 commit、
callback/receipt 接收和完成门重新校验；旧 lease、预取凭证和旧 generation 一律失效。

触发后拒绝新派单、新工具调用、新外发和新不可逆提交，撤销短期凭证并停止 scheduler；既有成果仍应可只读、
导出和依法删除。开关前已发出、开关后才返回的请求只能进入隔离 receipt 与 `UNKNOWN/RECONCILING`，
不得因迟到 callback 自动推进完成。控制面不可用、generation 不可确认或策略过期时 fail closed。

### 5.5 许可证与 clean-room

- 开源 `work-buddy` 当前只可作需求与模式参考；精确 GPL 义务由具名 License/Legal Owner 裁定。
- 未批准前，发布 artifact 中来自该项目的源码、模板、schema 文本、资产、vendor 副本或紧密链接依赖必须为零。
- clean-room 实现者只读取独立需求规格，不逐行改写外部代码；保留 source/SBOM/provenance 与相似性复核证据。
- 工程 reviewer 不得代替法务对许可证兼容性作最终结论。

### 5.6 Stop-ship

任一项出现即 No-Go：

1. 权限扩张、旧计划/跨 worker 批准重放、非原子授权消费或 prompt/Skill 绕过服务端 gate；
2. 未登记 processor/地域/目的，或 outbound payload 未逐请求绑定授权与 digest 的数据外发；
3. 外部 runtime 写入任务、批准、正式奏折、裁决、史馆或正式记忆；
4. kill switch 后旧 generation 仍可 claim、取凭证、外发、commit 或推进 callback；
5. 来源/许可证不明代码进入发布 artifact；
6. 外部 `complete`、ACK、通知送达或部分附件被显示为 `DELIVERED`；
7. 删除只删主库、缺下游回执、被 backup/restore/replay 复活，或 legal hold 状态对用户不可见；
8. R0 benchmark 接收客户原件或任何可重新识别材料；或 R1+ 在 DPA/TOS、合法依据与用途、数据类别/最小化、地域、保留/删除、训练使用、subprocessor、fallback/退出和具名 Product/Data/Security Owner 未冻结，或尚未满足当前 R0/R1 PRD §8.2、关闭其 §2.3 指定的 OQ-01–06、OQ-09、OQ-10 前接收真实客户数据。

## 6. 对 M0–M10 的唯一映射

本节只是 amendment 输入，不拥有开工权。产品 PR 合入门已由 `ef9b597...` 满足；正式 amendment 仍必须从届时
最新目标分支 exact HEAD 新建干净 branch/worktree，逐 M 写出 `COMPLETE / PARTIAL / BLOCKED / NOT_STARTED`、
owner、schema、精确下一 Packet、反例、迁移和回滚。

| Milestone | 本次建议吸收 | 不允许借机扩大 |
| --- | --- | --- |
| M0 | 冻结三类来源、版本、许可证、数据条款、威胁模型、黄金/负例和 exact-HEAD 现状 | 不以文档观察宣称能力已实现 |
| M1 | 计划版本/diff/reconfirm、权限语义、恢复投影、trace 贯穿 | 不建 Plan/Session/Consent 平行总账 |
| M2 | Capability/AgentRole/Skill/Tool/Provider/Connector 的版本、权限、来源、健康、fallback 与 kill switch | 不让外部 registry 或 MCP 自述成为信任证明 |
| M5 | Tool/Provider receipt、Evidence/Artifact lineage、候选记忆 provenance | 不让 receipt 直接推进正式完成 |
| M6 | deny-first pre-action、egress、记忆晋升、canonical-writer tripwire 和完成门 | 不用 LLM judge 或本地 hook 代替硬门 |
| M3 | 路由只选择健康且 policy-compatible 的能力；shadow 无现实副作用 | 路由不能扩权或静默换 Provider 政策 |
| M4 | 隔离子 Agent、最小上下文、预算、超时、重试、取消、后台暂停和 sidecar | worker/sidecar 不持业务完成事实 |
| M7 | 记忆/Skill/outcome 的候选、晋级、撤销与真实结果飞轮 | 未授权内容和模型自评不得进入学习闭环 |
| M8 | 六部能力复用同一计划、权限、证据、成果和记忆内核 | 六能力 runtime/UI/shadow/cutover 不得绕过 M0–M7；R0/R1 不以六能力齐全验收 |
| M9 | 生产 trace、Provider/version/egress KPI、异常、kill-switch drill；通知只作事件投影 | M9 不独自拥有客户任务工作台、审批箱或产品状态 |
| M10 | 保持原 LangGraph 条件式隔离 PoC | 不把 WorkBuddy benchmark 偷换成 M10，不替换 canonical 主链 |

唯一顺序保持：

```text
M0 → M1 → M2 → M5 → M6 → M3 → M4 → M7 → M8 → M9 → M10
```

任何未来六能力吸收蓝图只能标为 `REFERENCE_INPUT_FOR_M8 / R3+ EXPANSION INPUT`；其中源盘点、许可证和
契约研究可提前，但 runtime、UI、shadow、cutover 必须进入 M8 子 Packet，并满足专业包独立扩张门。

## 7. PRD v1.1 候选澄清

当前 PRD 已覆盖版本化计划、精确确认、最小激活、未激活零权限、成果包、局部恢复、取消、权限和单状态线。
本文件不直接修改 PRD。exact-HEAD 对账后，仅在确有用户承诺缺口时考虑以下澄清：

| 候选澄清 | 现有锚点 | 建议阶段 | 是否新产品范围 |
| --- | --- | --- | --- |
| 计划 scope/risk/budget 变化展示 diff 并重新确认 | R0-REQ-004/005 | R0 | 否，补精确失败语义 |
| 跨会话 checkpoint/resume 从 canonical 事件恢复 | R0-REQ-018/020/022 | R0 | 否，补恢复验收 |
| 授权 TTL、撤销、重放与在途 reconcile | R0-REQ-005/019 | R0 | 否，补权限验收 |
| 任务工作区显示计划、阻塞、证据、附件和下一动作 | R0-REQ-021/022 | R0 | 否，补读模型验收 |
| Skill/工具/Provider 来源与版本可下钻 | R0-REQ-009–011/020 | R1 | 否，补 provenance 体验 |
| 后台完成/待批准通知与早朝摘要 | R0-REQ-018、R2-REQ-001 | R1-R2 | 是，需单独产品裁决 |
| 用户可控长期记忆 | R1-REQ-003/004 | R1+ | 是，需单独数据和产品裁决 |

用户界面不显示 Claude Code、WorkBuddy、MCP、Hook 或 checkpoint 等开发品牌词，只显示“计划、进度、批准、
成果、继续办理、记忆和来源”。

## 8. 合成 benchmark：`BENCH-WB-01`

`BENCH-WB-01` 是研究证据标签，不是新 milestone、运行时 Packet 或 M10 子项。

### 8.1 前置条件

- 产品 PR 合入门已由 `ef9b597...` 满足；未来 benchmark 必须在其独立 change 当时最新、干净的 exact integration HEAD 上执行。
- 两个 WorkBuddy 的身份、URL、版本/commit、许可证和数据条款已冻结。
- M1 版本计划/授权、M2 Provider/Capability 登记、M4 隔离 worker/sidecar，以及 M5/M6 receipt/权限/egress/canonical 门均有可验证最小实现。
- 使用假租户、合成合同、专用 sandbox 凭证和隔离输出目录；无生产 DNS、数据库、对象存储和真实通知通道。

### 8.2 最小链路

```text
既有 DecisionTask
→ 只读能力查询投影
→ 确定性输入校验
→ 单次候选分析
→ 精确一次性授权
→ 隔离 worker/sidecar 生成成果
→ ArtifactManifest / receipt 回写既有主链
→ M6 决定是否仍为 PARTIAL/BLOCKED/可供审查
```

### 8.3 必须通过的负例

- 缺 tenant/purpose/approval、过期/撤销、跨租户、子 Agent 扩权，以及旧 plan、跨 worker、跨 attempt、跨 target/payload 的 approval replay 全部拒绝；一次性授权必须原子消费。
- `READ` 尝试 `SEND`、prompt injection 请求扩权、未知 Provider/region/subprocessor、合法 Provider 接收未绑定对象或过量字段全部零出网；每次 payload digest 与 egress receipt 可核验。
- 外部 complete、重复/乱序/迟到 callback、worker 重启或本地状态丢失不得推进/回退正式状态。
- sidecar 崩溃恢复后成果只有一份；provider 故障只能 `PARTIAL/BLOCKED`。
- kill switch 触发后旧 generation 在 claim/lease、凭证、pre-action、egress、commit、callback 和完成门全部失效；开关前请求的迟到结果只进 `UNKNOWN/RECONCILING`。
- 自动写记忆、跨租户召回、撤销后仍召回、删除未传播、legal hold 隐瞒，以及 backup/restore/replay 复活已删内容全部失败关闭。
- 发布 artifact 中 GPL/来源不明代码路径为零。

### 8.4 退出与结论边界

至少运行 10 个复杂黄金任务与对应负例，并记录恢复率、证据完整率、P50/P95、成本、人工介入和失败原因。
benchmark 只能输出 `ADOPT_PATTERN / ADAPT / HOLD / REJECT / ISOLATED_ADAPTER_REVIEW`，不能输出
`PRODUCTION_READY`。结束后清理 sandbox 数据、撤销凭证并留下 purge 证据。

## 9. 正式 Amendment 编制协议（不是施工 DAG）

本文件不创建 S/P/ABS 等第二套执行编号，也不允许 fresh agent 直接按本节开工。产品 PR 正式合入门现已满足；
后续只能由 M0–M10 Engineering Owner 通过**一份唯一 amendment**补充原 M0–M10 模块卡；每个模块仍是一个
change、一个精确 HEAD、一个主要状态变化和一次独立复审。

### 9.1 合入与基线交接清单

正式 amendment 前必须创建 `baseline-handoff` 证据，至少冻结：

```text
schema_id = chaotang.baseline-handoff
schema_version = 1
change_id
decision_version
decision_digest
product_pr_head
product_target_head_before_merge
product_integration_head
product_integration_tree
decision_head
amendment_base_ref
amendment_base_head
amendment_base_tree
product_ssot_digest
prd_digest
m0_m10_plan_digest
source_inventory_digest
recorded_at
recorded_by
```

唯一 artifact 路径固定为：
`.harness/changes/<amendment-change-id>/request_analysis/baseline-handoff.v1.json`；schema 固定由
`.harness/contracts/baseline-handoff.schema.json` 拥有。future amendment root change 在写任何模块裁决前，必须先以
`node scripts/baseline-handoff.mjs generate --change-id <amendment-change-id> --product-pr-head <40sha> --product-integration-head <40sha> --decision-head <40sha> --base-ref origin/feature-chaotang-ext`
生成工件。`product_integration_head` 专门记录产品 PR 的正式合并头；`amendment_base_head/tree` 由脚本从当前
`HEAD` 派生，不能拿较早的产品合并头冒充。随后以
`node scripts/baseline-handoff.mjs verify --change-id <amendment-change-id> --expect-git-head HEAD`
校验。该 future change 必须同时交付这一个根级 validator/contract；校验预期退出码为 `0`，且输出
`baseline-handoff: valid schema=1 head=<40sha>`。validator 必须证明 `product_pr_head` 是
`product_integration_head` 的祖先，且 `product_integration_head` 与 `decision_head` 都是 `amendment_base_head` 的祖先；
同时复核三棵树和全部 digest。脚本、schema 或 artifact 不存在、字段由手工自由文本替代、祖先/HEAD/tree/digest
不匹配或输出非精确成功格式时，一律 `NOT_AUTHORIZED`。这些是未来 amendment 的 bootstrap 交付要求，本 Decision
不创建脚本、schema 或 artifact，也不因此授权任何 M 模块开工。

门禁：

- 产品 PR 必须通过 Gitee 正式合入；禁止直接 push 目标分支模拟 PR merge。
- amendment 从届时最新目标分支 exact HEAD 新建干净 branch/worktree，`git status --porcelain` 必须为空；不得退回较早的产品 merge commit 开工。
- 必须证明产品 PR 头、产品 integration head 和获批 Decision head 都是 amendment base 的祖先，并重新运行根 doctor；产品 SSOT、PRD 和 M0–M10 链接均存在。
- 目标分支、PR 头、产品/PRD/M0–M10 digest 任一漂移时，旧 merge preview、状态对账、批准和 review 证据立即标
  `STALE_BASELINE`；重新三方预检、重绑定 base、重跑验证并由 Owner 重批，不能沿用旧 GO。

### 9.2 Future M 模块卡的强制字段

未来 amendment 中每个 M 模块卡必须自包含以下字段；缺任一项只能保持 `NOT_AUTHORIZED`：

| 字段 | 强制内容 |
| --- | --- |
| Context brief | 当前实现、用户问题、canonical 调用链、已知红灯与不变量，fresh agent 不依赖旧会话即可理解 |
| Status | `COMPLETE / PARTIAL / BLOCKED / NOT_STARTED`，绑定 exact integration HEAD 和证据 |
| Ownership | Product/Engineering/Security/Data/Legal Owner；canonical writer；schema/migration owner |
| Git envelope | approved 40 位 base SHA、branch、worktree、change ID、task/lease、允许与禁止路径 |
| Inputs | 精确文档、schema、实现、fixture、来源版本和上游 Packet 证据 |
| Dependencies / Parallel disposition | 每个上游 change、candidate SHA、CI/review 证据与状态；`SERIAL / PARALLEL_ELIGIBLE / BLOCKED` 裁决及理由；重叠路径、schema/migration owner、锁/lease 和冲突处置 |
| Outputs | 精确文件路径、协议版本、状态/数据变化和消费者；不得写“相关文件” |
| Tasks | 可检查的原子任务；一个模块/主要状态变化一个 change，M8 每项能力独立子包 |
| Security | 权限、数据类别、egress、processor、许可证、kill generation、预算和副作用 |
| Verification | 可执行命令、预期退出码/关键计数、正反例、browser/backend/doctor 的证据边界 |
| Rollout | 默认关闭的 flag/selector、shadow 分母、阈值、Owner 签字和停止条件 |
| Rollback | 触发阈值、Owner、停接/drain/查单、兼容读/forward-fix、凭证/数据清理和恢复验证命令 |
| Review | candidate SHA、独立 reviewer、精确 verdict、未验证项和下一授权点 |
| Exit / Handoff | 可机器判定的完成条件、验证命令与预期结果；本模块 candidate SHA/证据清单、未决风险、下游消费者、下一授权人/授权点和保持阻塞的条件 |

### 9.3 只允许填入原 M0–M10 的采用项

| 原模块 | Pattern amendment 输入 | 必须等待 | 原子性边界 |
| --- | --- | --- | --- |
| M0 | 来源/版本/许可证/数据条款、exact-HEAD 状态、威胁模型、负例 | 产品 PR merge + baseline handoff | 只读冻结；不接 runtime |
| M1 | 计划版本/digest/reconfirm、PermissionEnvelope 语义、恢复投影 | M0 Owner/事实源裁定 | Task/trace/授权协议一个 change 一个 writer |
| M2 | Capability/AgentRole/Skill/Tool/Provider/Connector 登记 | M1 trace/permission 透传契约 | registry/schema owner 独立 change |
| M5 | receipt、Evidence/Artifact lineage、payload/Provider provenance | M1 trace/tenant 语义 | evidence/artifact owner 独立 change |
| M6 | pre-action/egress/kill fencing/writer/completion gates | M2 registry + M5 receipt | 每个硬门可拆；不能与 producer 混做 |
| M3 | policy-compatible shadow routing | M2 + M6 最小门 | 路由不改权限/正式状态；单独 selector |
| M4 | 隔离 worker、预算、retry/cancel/reconcile、sidecar | M3 + M6 | 执行控制面不持业务完成事实 |
| M7 | 记忆/Skill/outcome 候选晋级、撤销、删除传播 | M4 + M5/M6 | memory 与 outcome writer 分开裁定 |
| M8 | 六能力 authority reconciliation 后逐能力接入 | M0–M7 + 专业包扩张门 | 每能力 backend/UI/shadow/cutover 独立，不继承首包证据 |
| M9 | 生产 trace/KPI、provider/version/egress、kill drill | M1–M8 所需纵切 | 只做观测/投影，不拥有客户任务状态 |
| M10 | 原 LangGraph 条件式隔离 PoC | M0–M9 全部满足原触发条件 | 不吸收 WorkBuddy，不替换主链 |

顺序和依赖仍只引用原图：`M0 → M1 → M2 → M5 → M6 → M3 → M4 → M7 → M8 → M9 → M10`。

### 9.4 并行条件

- 只有 amendment 已给出互斥的精确输出路径、不同 schema/writer owner、独立 task/lease 和无共享 migration revision 时，
  M2 与 M5 的实现 Packet 才可并行；否则默认串行。
- 来源/许可证只读研究与 exact-HEAD 状态对账可并行，但必须写入不同 change/path，且 amendment 等待二者完成。
- 同一能力的 UI 与 shadow 只有在 backend 契约冻结后才可并行；cutover 必须串行等待两者与回切演练。
- 产品 PR、amendment 批准、真实数据、外部 Provider、代码复制和 cutover 都是单向门，必须串行裁决。

### 9.5 六能力 clean-lineage 门

当前 dirty/diverged 主工作树中的六能力蓝图、catalog、PRIV/ABS 文档不属于本 stacked branch 的输入，
不得由 future agent 跨工作树读取后直接开工。它们只有在独立 clean change 中完成：

1. 同一 integration lineage 与完整 source hash；
2. 状态/CI/Owner 一致性修复；
3. `REFERENCE_INPUT_FOR_M8 / CANDIDATE_PACKET_CATALOG / NOT_EXECUTION_AUTHORITY` 权威降级；
4. 与唯一 amendment 的逐项映射和独立复审；

之后才可被 M8 引用。未满足时保持 `BLOCKED_CLEAN_LINEAGE`。

### 9.6 WorkBuddy benchmark 与 M10 分离

- `BENCH-WB-01` 不是 milestone。任何包含 worker/sidecar 的运行 benchmark 必须等待 M1、M2、M4、M5、M6
  对应门通过，并使用独立 synthetic sandbox；只读产品比较可提前。
- benchmark 结论只能进入新的 Decision/Packet 评审，不能自动修改 M0–M10 或获得生产权。
- LangGraph 只由原 M10 在 M0–M9 完成且原量化触发条件成立后启动；本文件不新增、提前或替换该 PoC。

## 10. Decision / Amendment 变更与回滚协议

每次变更必须递增 `decision_version` 或 `amendment_version`，并在对应 root change 写不可省略的变更日志：

```text
change_reason
old_version -> new_version
old_base_sha -> new_base_sha
affected_M_modules
changed_sources_or_terms
dependency_edges_before_and_after
owners_and_paths_before_and_after
evidence_invalidated
data_or_side_effects_already_created
rollback_or_forward_fix
required_reapproval
independent_review_verdict
```

- `SPLIT`：一个 Packet 同时引入两个 writer、两个状态机或两个不可逆副作用时拆分，并重算受影响 M 依赖。
- `INSERT`：发现许可证、隐私、canonical owner 或外发未知项时，只能在原 M 模块依赖前插入 gate Packet；不得新建平行 milestone。
- `REORDER`：只有获批 amendment 中对应 M 模块的 Engineering Owner 证明依赖、owner、路径租约、证据和回滚不被削弱时允许，并重新对抗评审。
- `HOLD/SKIP`：HOLD 保留模式但不开工；SKIP 只有等价 canonical 实现与精确证据时允许，并记录替代 owner/测试。
- `ABANDON`：记录原因、已产生数据/副作用、清理、替代方案和用户裁决；审计只标历史，不物理删除。

基线重绑定协议：任何目标 HEAD、产品/PRD/M0–M10 digest 或来源条款漂移，先将受影响证据与批准标
`STALE_BASELINE`，在干净 worktree 重做 ancestry/diff、DAG/路径冲突、doctor/专项测试、回滚检查和独立 review；
原 Product/Engineering/Security/Data/Legal Owner 按影响范围重新批准后才可恢复执行。

运行时回滚必须在各原子 Packet 写触发条件、执行 Owner、命令/操作、预期状态和恢复验证。最低要求是停止新任务、
停止新外发、drain/查明在途、fencing 旧 generation、幂等重放、保持 compatible read、用 forward-fix 修 schema、
撤销凭证并继续履行删除/导出/审计；不得把“关闭 feature flag”当作全部回滚。已 merge 的纯文档问题走新 PR
revert 或 forward-fix，不改写共享历史；已发生现实副作用只能补偿和 reconcile，不能宣称回滚了现实。

## 11. Anti-patterns

- 把 Claude Code 或 WorkBuddy 做成新的“总管 Agent”。
- 复制外部 task store、consent ledger、memory store、artifact DB 或 event log。
- 把开发 hook、LLM judge、MCP 自述或外部 complete 当确定性质量门。
- 用“local-first”宣传零外发，却仍把 prompt、记忆或浏览器上下文交给外部模型。
- 为追求自动化提供永久无条件绕过权限。
- 在 R0/R1 引入 Marketplace、全渠道自动化、固定大规模 Agent Teams 或 41 司全员运行。
- 把“已写蓝图”“已接 adapter”“已有页面”宣称为真实能力或生产就绪。
- 在当前 dirty/diverged 主工作树混写产品冻结、六能力资料和本 ADR。

## 12. 本文档完成定义

本文档只有满足以下条件才可从 `OWNER_APPROVED_DRAFT` 晋级为 `ACCEPTED_PATTERN_PRINCIPLES`：

1. 产品身份、首个 Offer、R0/R1 和 M0–M10 顺序未被改变。
2. Claude Code 开发控制面与产品运行时分泳道。
3. 两个 WorkBuddy 身份分开，未知版本和许可证未被假定放行。
4. 每个采用模式都有处置、用户价值、canonical 落点、阶段和负例。
5. 权限、记忆、Provider/egress、kill switch、GPL 与第二事实源边界明确。
6. WorkBuddy benchmark 不占用 M10，不接真实数据，不输出生产就绪。
7. 不存在第二施工 DAG；future amendment 的基线交接、原子模块卡、并行、clean-lineage、变更和回滚协议完整。
8. 根 doctor、Markdown 结构/链接、diff check 和独立对抗评审通过。

这些条件只证明决策文档可作为设计输入，不证明 amendment、运行时或外部接入已完成。

## 13. 独立会审裁决

🎲 大神会审（Linus Torvalds · 演进式架构 × Bruce Schneier · 信任边界）

⚠️ 警示（Linus）：直接引入完整 runtime 会同时复制任务、记忆、调度、授权和成果五套权威，退役成本高于逐项吸收模式。

⚠️ 警示（Schneier）：真正的隐私边界不是“数据存在哪里”，而是谁在什么目的、地域和期限内收到哪些字段，以及用户能否撤销。

💡 天才建议（Linus）：用 `pattern matrix → canonical mapping → negative tests → evidence promotion` 演进，不做第二套操作系统。

💡 天才建议（Schneier）：权限与外发必须由机器可拒绝的信封、Gateway 和 kill switch 拥有，不能由 prompt 承诺。

🔧 推荐技能：`blueprint`——本 Decision 建立时运行 1 次，依赖 DAG 实质变化时再运行；`security-review`——权限、Connector、记忆三类 Packet 各在合入前运行 1 次。

🆕 技能洞察：可替换“接入 Claude Code/WorkBuddy runtime”→“双泳道模式采用协议 + canonical adapter + 合成 benchmark”；既持续学习外部最佳实践，又不牺牲产品事实链和可回滚性。

## 14. 参考资料

访问日期均为 2026-07-19；实现时必须重新冻结准确版本和条款。

- Anthropic Claude Code：[功能与扩展概览](https://code.claude.com/docs/en/features-overview)、[工作原理](https://code.claude.com/docs/en/how-claude-code-works)、[权限](https://code.claude.com/docs/en/permissions)、[子代理](https://code.claude.com/docs/en/sub-agents)、[Hooks](https://code.claude.com/docs/en/hooks)、[MCP](https://code.claude.com/docs/en/mcp)、[Sessions](https://code.claude.com/docs/en/sessions)、[Checkpointing](https://code.claude.com/docs/en/checkpointing)、[Agent Teams](https://code.claude.com/docs/en/agent-teams)。
- Tencent WorkBuddy：[产品页](https://cloud.tencent.com/product/workbuddy)、[Quick Start](https://www.workbuddy.ai/docs/workbuddy/Quickstart)、[隐私政策](https://www.workbuddy.ai/document/privacy-policy)。
- 开源 `work-buddy`：[官方文档](https://docs.work-buddy.ai/)、[GitHub 仓库与许可证](https://github.com/KadenMc/work-buddy)。
