# 朝堂能力协议 V1 Capsule Binding Successor

任务 ID：`CHAOTANG-CAPABILITY-PROTOCOL-V1-CAPSULE-BINDING-SUCCESSOR-20260829`

冻结基线：`origin/ext-dev@4a8d3d587d07ef61962179674be860befb13ae5a`

冻结 tree：`05742b8eefa7d1db8920b2840cb4cec291cc543b`

Proposed Approval RFC 8785 canonical digest：`sha256:375c49f320905f34d5e1ec4c8c447ae146d04d86f82281aa69aeb6a773ee8844`

## Status

Draft

细分状态：`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`

## Product Definition

本任务把现有 `Capability Capsule v1`、repo-scoped capability projection donor、六部能力执行兼容契约、RuntimeSkill/Tool registries、Tenant Principal、Evidence Spine 与 WorkProduct/ConfirmationReceipt 收敛为《朝堂能力协议 V1》的非授权协议内核。它只修改现有四条契约与离线验证路径，不创建第二套 Capsule schema、lifecycle、authority、RuntimeSkill registry、Tool registry、Evidence ledger、Tenant principal 或执行器。

协议必须明确：Tool、Skill、Agent 是已有可执行权威的投影；Workflow、Swarm、Expert、Pack 只能是只读组合/展示类型，不持有独立 identity、handler、tool、side effect、tenant 或 activation authority。Pack 只允许内容寻址引用，不得聚合权限或激活子项。Capability Family 继续只引用现有 46 项下游 RuntimeSkill registry，不能成为第 47 个 registry。

现有 Capsule 的 `synthetic-offline-only`、`not-registered-no-execution-authority`、candidate 零权限与 taint/fallback 边界保持不变。现有 synthetic evaluation、shadow scaffold、人工确认、任务完成或 OTel correlation 均不得冒充真实能力提升、Qualified Use、生产晋级或 Owner approval。第三方 Skill 永远不得直接进入 ACTIVE；本 successor 新增的 **Capsule-bound 分支**只能是 `CANDIDATE_ONLY / NO_EXECUTION_AUTHORITY / EXTERNAL_EFFECTS_FALSE`。既有不含 Capsule binding、由服务端 RuntimeSkill、ToolPolicy 与受信 receipts 重载的 confirmed-execution 正向语义和覆盖必须保留；允许在 exact4 内最小纠正 synthetic fixture 表达，但该 fixture 与 envelope 均不得冒充真实 authority 或 runtime proof。

## Existing Facts And Boundaries

- Capsule 字节合同唯一源：`docs/contracts/capability-capsule.schema.json` 与 `scripts/capability_capsule.mjs`。
- Owner 是唯一真实 authority。`backend/harness/capability_candidates/authority-manifest.json` 只是当前唯一 repo-scoped、unsigned/digest-only、exact-zero-grant capability projection donor；它不是 Owner authority 或 activation projection，candidate 目录与 publisher signature 均不得自授。
- 下游 Skill/Agent 唯一源：`backend/app/agents/runtime_skills/registry.py` 的 46 项冻结注册表；不得动态发现、复制或推断。
- Tool 唯一源：现有 ToolDescriptor、ToolPolicy 与 ToolExecutor；模型、客户端、Pack、MCP/A2A adapter 均不得扩展 ToolName 或 side effect。
- Tenant Principal 只能由受信认证/session/membership JOIN 服务端派生。协议、Capsule、请求体、模型、MCP 或 A2A 均不得提供或覆盖 user、tenant、membership、role、run 或 route。
- ADR 0044 的 owner-only `tenant_id=null` 与 exact15 Tenant Principal 不是自动等价事实；tenant-aware Evidence/Execution 必须由后续 V2 prerequisite forward-only 迁移，禁止在本轮静默 re-interpret。
- Evidence、DecreeJob、JunjichuCase、WorkProduct、ConfirmationReceipt 与工具决策保持现有唯一事实源，本 envelope 只携带引用与摘要并要求服务端重新加载核验。
- 当前 Capsule 的 `controls.kill_switches.capability_enabled/tenant_enabled/tools_enabled=true` 只表示 inert candidate 的本地 kill-guard 未熔断，绝不表示 tenant authorization、activation 或 epoch；三者任一为 false 仍按现有 validator 语义 killed。exact4 必须证明 `true + exact-zero-grant projection` 仍为 `NO_EXECUTION_AUTHORITY`。
- 当前 repo-scoped exact-zero-grant projection donor 必须与六个 Capsule ID 集合精确相等：`decision-quality-gate`、`hubu-financial-grounding`、`hubu-payment-three-gates`、`libu-responsibility-authority-chain`、`rites-message-quality-gate`、`rites-war-truthfulness`。五个标准 `candidates/*` 布局加一个 legacy `rites-message-quality-gate` 只作为兼容输入；不得迁目录或新建 inventory。遗漏、额外或重复 ID 立即 STOP。

## Protocol Type Boundaries

| 类型 | V1 语义 | 唯一权威与禁止项 |
| --- | --- | --- |
| Tool | 原子、受预算和 side-effect class 约束的调用 | 只来自现有 Tool Registry/Policy；禁止 Capsule/Pack/MCP 自定义权限。 |
| Skill | 一个受版本和 definition digest 绑定的专业执行方法 | 只来自 Chancellor registry 或下游 46 RuntimeSkill registry；第三方内容先保持 inert Capsule。 |
| Agent | 服务端拥有、与既有 Skill binding 对应的执行身份 | 不另持 registry/authority；禁止客户端或包声明 agent identity。 |
| Workflow | 既有 entrypoint、route、graph handler 的确定性只读投影 | 不可安装、注册或动态执行，不新增 workflow registry。 |
| Swarm | 既有 Junjichu/部/司 DAG 的组合视图 | 必须 non-empty、bounded、unique、acyclic，成员逐一 exact-resolve 到既有 RuntimeSkill；未知、重复、循环或超预算即 DENY。无独立权限，有效权限只能取 repo-scoped exact-zero-grant projection、Owner 决策与所有成员约束的交集，不得取并集或空集默认放行。 |
| Expert | 专业方法、审查或解释视图 | 只给建议/证据，不构成 authority、confirmation 或事实来源。 |
| Pack | immutable capability references/digests 的展示清单 | 只能是 flat、bounded、unique、sorted、content-addressed leaf refs；禁止 nested Pack、循环、重复、未知 ref，且不得包含 tools/domains/tenant/activation/side effect 字段。不 import、不 install、不执行、不聚合权限、不激活子项。 |

## Source, Promotion, Revocation And Receipt Boundary

- Publisher signature 只证明来源，不能替代 Owner activation projection。未来签名必须 domain-bind protocol/version、publisher key、capability id/version、repository commit/tree/path、Capsule/lock/SBOM/build-material digests、有效期、nonce 与 revocation epoch。
- V1 本轮不实现 publisher trust root、SBOM verifier、durable lifecycle 或 activation store；缺失这些前置时必须保持 inert，而不是伪造 VERIFIED/ACTIVE。Capsule-bound 分支必须固定 `publisher_status=UNVERIFIED`、`sbom_status=UNVERIFIED`、`qualified_use=NOT_MEASURED`、`activation=DENY`、`durable_receipt=ABSENT`、`revocation_epoch_status=UNAVAILABLE`；任一正向或非空声明一律拒绝。
- 三次独立真实任务必须是不同 task/run、fresh context、无共享可写状态、独立 evaluator，并绑定 Capsule/RuntimeSkill/principal/input/output/metric digests；synthetic fixture、重复任务、复用输出或模型自评都不计。
- Qualified Use 必须由不可变 outcome receipts 对预注册 baseline 的真实改善机械派生；当前 readiness 的 `businessSuccessMeasuredFamilies=0` 必须保持诚实。
- kill/revocation 必须使用单调 epoch，并在 dispatch、tool call 与任何副作用前重新核验；旧版本、旧 receipt 或 stale cache 不得恢复权限。
- OpenTelemetry trace/span 只允许作为脱敏、定长、低基数的 correlation projection。权威执行 receipt 必须先本地、内容寻址、tenant/member/run/capability/epoch 绑定并可持久化；本轮不实现该 receipt。
- Capsule-bound exact4 固定 `mcp_status=DENY/UNAVAILABLE` 与 `mcp_refs=[]`；无论 known/unknown MCP ref 都拒绝，因为本分支仍是 exact-zero-grant 且 mapping unresolved。只有既有 server-owned legacy 分支继续经过当前只读 MCP registry、schema fingerprint、credential、network、health 与 ToolPolicy 门。Capsule、Pack、Swarm 不得携带 MCP URL、ref、header、token、provider schema 或 write authority。
- A2A 在 V1 固定为 `UNSUPPORTED / DENY`；未来启用必须另行 successor，且远端 Agent Card 永远不能成为本地 authority。

## Affected Modules

- 模块：现有六部能力执行兼容契约、Capability Capsule 绑定、协议安全负例与离线语义验证。
- 允许路径：`docs/contracts/six-ministry-capability-execution.md`、`docs/contracts/six-ministry-capability-execution.schema.json`、`scripts/fixtures/six-ministry-execution/security-cases.json`、`scripts/six_ministry_execution_contract.test.mjs`。

## Technical Plan

1. 先在现有安全 fixture/test 内补充真实负例，证明 Capsule 自报晋级、自授权限、principal/route/digest 注入、Pack/Swarm 权限聚合、synthetic evaluation 冒充 Qualified Use、OTel 冒充 receipt、MCP/A2A 边界绕过均 fail-open 或尚未闭合；保留既有 server-owned confirmed-execution 正例。
2. 只在现有 schema/contract 中增加带显式 discriminator 的 Capsule-aware、strict closed-object 非授权分支：Capsule id/version/digest/lock identity、repo-scoped exact-zero-grant projection、服务端 principal refs 及显式 non-authorizing outcome。legacy/server-owned RuntimeSkill 分支保持现行 schema/语义兼容。
3. Capsule-bound 分支只通过现有 `capability_capsule.mjs`、checked-in lock 与 repo-scoped projection exact bytes 机械闭合六 Capsule；禁止复制 projection/Capsule inventory 或把手写 fixture 当作 trusted authority。既有 legacy/server-owned confirmed-execution 语义与正向覆盖保持；bounded synthetic test constructors 只可表达 evidence/work-product/confirmation/tool-decision 语义，不得定义、扩张或证明真实 RuntimeSkill、Tool、Owner authority 或 runtime。现有虚构 identity/tool 不得被重新标记为 trusted runtime proof。
4. 当前不存在 canonical Capsule-ID→RuntimeSkill-ID 映射，且本 exact4 不建立受控 Python runtime；因此必须固定 `mapping_status=UNRESOLVED / NO_EXECUTION_AUTHORITY`，不得猜测、用 fixture 自造映射或依赖 mutable user-site。真实 RuntimeSkill/Tool reload 与 mapping 等待独立 read-only projection/mapping successor，在 hash-locked runtime 环境另行冻结。
5. 把七类能力边界编码为 fail-closed 类型约束；Pack/Swarm 的 empty/unknown/duplicate/nested/cycle/over-budget 必须 DENY，不能形成 vacuous allow。
6. 明确 Capsule-bound 分支只允许 candidate-only projection；shadow/canary/stable/active、external side effect、Qualified Use、publisher verified、tenant activation authorized、A2A enabled 或 durable receipt complete 在缺失后续 authority/prerequisite 时全部拒绝。现有 `kill_switches.tenant_enabled=true` 保持原 prerequisite 语义。
7. 对 raw fixture、Capsule 与 projection 使用现有 `parseJsonNoDuplicateKeys`，再运行 Draft 2020-12 schema validator及 semantic guard；禁止 `JSON.parse` last-key-wins 作为受信入口或复制第二 parser。合法样本两层均通过，hostile 样本按 schema/semantic 职责 fail closed。
8. 运行 frozen Capsule/execution/Evidence Spine regression、Harness、自测、Doctor、Authority regression、V2 convergence 与 direct-single-parent exact4 结构检查；完成 Governance、JavaScript/Contract 与 Security 三路只读审查。

## RED And Security Negatives

- Capsule 自报 `ACTIVE/stable`、tool/data domain/external write、publisher verified、tenant activation authorized 或 Qualified Use，必须拒绝。现有 `kill_switches.tenant_enabled=true` 不在该拒绝集合内，且始终不授予 authority。
- Capsule、lock、artifact 与当前 repo-scoped projection 可复算 identity 任一 byte 漂移，必须拒绝；repo-scoped exact-zero-grant projection donor 六 ID 集合必须 `+0/-0`。本轮对 signer、SBOM、epoch、qualified receipt 只接受固定未实现/未验证常量，不得声称已验证其漂移。
- unknown issuer、自签名、过期/撤销 key、签名绑定错误 digest/repository/tree/path 不能被视为 Owner approval；本轮缺少 verifier 时只能保持 inert。
- client/model/adapter 注入 tenant、membership、owner、role、run、route、skill、definition digest、evidence status、tool decision、confirmation 或 revocation epoch，必须拒绝。
- 少于三次、重复 task/run/evaluator、共享状态、synthetic/stub、复用 output、模型自评或无 baseline 的评测不得形成 Qualified Use。
- Workflow/Swarm/Pack 使用权限并集、Expert 输出充当 authority/confirmation、Pack 激活子项必须拒绝；Pack/Swarm 的空集、未知/重复成员、nested/cycle 与超预算必须拒绝。
- stale kill epoch、revoked membership/key/capability、旧 qualified receipt 或 downgrade replay 必须拒绝。
- OTel/raw receipt 泄漏 prompt、evidence body、credential、URL/header、email 或高基数 principal 数据必须拒绝；trace/span 不得授予执行。
- Capsule-bound 分支任何 MCP ref（包括已登记只读 ref）都必须拒绝并保持 `mcp_refs=[]`；legacy/server-owned 分支中的 unknown MCP server/tool、arbitrary URL/credential/schema/write、discovery/fingerprint/health drift 必须拒绝。任意 A2A card/endpoint/message 必须返回 `UNSUPPORTED`。
- 未知类型、额外字段、escaped-equivalent duplicate JSON key、NaN/Infinity、路径逃逸、Unicode/path 混淆、超长输入与资源预算越界必须经现有 strict parser、Draft 2020-12 与 semantic guard 分层 fail closed。

## Delivery Constraints

- Candidate 必须精确为 `0 ADD + 4 MODIFY`，四条均为 `100644`；不得出现第五路径。
- 不修改 Capsule schema/lifecycle/authority manifest、46 RuntimeSkill registry、family bindings、Tool registry/executor、Tenant auth/session/storage、Evidence/DecreeJob/Junjichu/WorkProduct、MCP runtime、Harness/authority/CI/ADR 或 runtime lock。
- 不创建新数据库、ledger、registry、executor、plugin loader、第四业务主线或动态 importer。
- 不安装依赖，不访问网络，不执行真实第三方 Skill，不运行真实流量、外部写、Pilot、Release 或部署。
- 本 successor 的 schema/fixture/test 只是协议闭合证据，不是运行 authority、promotion receipt 或业务成功结论。

## Acceptance Criteria

- [ ] Candidate 精确为现有四路径 `0 ADD + 4 MODIFY / 100644`，无第五路径。
- [ ] Capsule-bound envelope 只能机械派生 `CANDIDATE_ONLY / MAPPING_UNRESOLVED / MCP_DENY / NO_EXECUTION_AUTHORITY / EXTERNAL_EFFECTS_FALSE`；既有 server-owned confirmed-execution 正向语义与覆盖保持，synthetic fixture 不冒充 runtime proof。
- [ ] 七类能力边界闭合，不新增 registry/executor/ledger，Workflow/Swarm/Expert/Pack 无执行 authority。
- [ ] repo-scoped exact-zero-grant projection donor 与六 Capsule ID 集合精确相等并逐一闭合 Capsule+lock+projection；legacy 第六布局兼容但不迁移。Capsule→RuntimeSkill mapping 保持 unresolved，不在 fixture 猜测。
- [ ] 现有 kill-switch 三个 true 只表示未熔断且仍为零 authority；任一 false 保持 killed。
- [ ] raw 输入经现有 strict parser、Draft 2020-12 与 semantic guard 分层验证；schema/semantic parity、duplicate key 与 unknown-field负例闭合。
- [ ] 第三方 Skill 无法直接 ACTIVE；synthetic evaluation、OTel 或人工确认无法冒充 Qualified Use。
- [ ] Capsule-bound 分支 `mcp_refs=[] / DENY`；legacy/server-owned 分支继续复用既有只读 MCP registry；A2A 固定 `UNSUPPORTED / DENY`。
- [ ] frozen verification matrix 全绿，Governance、JavaScript/Contract、Security 审查均为 `GO / P0=0 / P1=0 / P2=0`。

## Implementation Report

尚未实施。本轮仅冻结 forward-only 治理包；现有 Capsule、synthetic evaluation/shadow 与六部兼容 envelope 均为可复用事实源或 donor evidence，不具有新的 activation、Qualified Use、receipt 或 authority 身份。

## Acceptance Review

待正式 approval、machine GO、exact4 RED/GREEN、完整矩阵与三路独立审查后填写。任何通过结论都只覆盖非授权协议内核，不覆盖 runtime、真实评测、Qualified Use、activation、外部副作用或部署。

## Dependency DAG

`exact15 canonical base` → `Capability Protocol V1 capsule-binding exact4` → `tenant-scoped Evidence/Receipt V2 prerequisite` → `read-only capability projection` → `shadow-only runtime adapter` → `three independent real-task receipts` → `Outcome Truth / Qualified Use derivation` → `Owner activation projection + tenant enable` → `Release candidate`。

每个节点必须使用届时最新 `origin/ext-dev` 创建独立 successor；不得 re-anchor 或继承旧 authority/candidate/verification/review。

## Stop Conditions

远端漂移、machine STOP、需第五路径、需修改现有 registry/executor/authority/Harness/ADR/runtime、出现第二事实源、第三方字节可直接 import/install/ACTIVE、principal 可由外部提供、synthetic/OTel 可冒充 Qualified Use、MCP 获得任意 endpoint/write、A2A 被启用、任何验证失败或独立审查出现 P0–P2，立即 STOP。禁止 force-push、Pilot、Release 与部署。
