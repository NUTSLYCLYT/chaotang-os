# 朝堂能力协议 V1 Capsule Binding Successor Plan

任务：`CHAOTANG-CAPABILITY-PROTOCOL-V1-CAPSULE-BINDING-SUCCESSOR-20260829`

基线：`4a8d3d587d07ef61962179674be860befb13ae5a` / tree `05742b8eefa7d1db8920b2840cb4cec291cc543b`

Proposed Approval RFC 8785 canonical digest：`sha256:375c49f320905f34d5e1ec4c8c447ae146d04d86f82281aa69aeb6a773ee8844`

状态：`PLAN_ONLY / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`

## Goal

在不创建第二协议、registry、authority、Tenant、Evidence、Tool 或 execution runtime 的前提下，把现有六部执行兼容 envelope 收敛为 Capsule-aware 的《朝堂能力协议 V1》非授权内核。新增 Capsule-bound 分支保持 candidate-only、MCP deny、零执行 authority、零外部副作用；既有 server-owned RuntimeSkill + trusted receipts confirmed-execution 正向语义与覆盖保持，synthetic fixture 和 envelope 本身均不授予 authority。

## Exact Paths

治理草案仅三路径：

- `docs/migrations/2026-08-29-chaotang-capability-protocol-v1-capsule-binding-successor.approval.proposed.json`
- `docs/product/tasks/2026-08-29-chaotang-capability-protocol-v1-capsule-binding-successor.md`
- `docs/superpowers/plans/2026-08-29-chaotang-capability-protocol-v1-capsule-binding-successor.md`

未来 approval commit 仅三路径：

- `.harness/approvals/CHAOTANG-CAPABILITY-PROTOCOL-V1-CAPSULE-BINDING-SUCCESSOR-20260829.json`
- `docs/product/tasks/2026-08-29-chaotang-capability-protocol-v1-capsule-binding-successor.md`
- `docs/superpowers/plans/2026-08-29-chaotang-capability-protocol-v1-capsule-binding-successor.md`

未来 product candidate 精确 `0 ADD + 4 MODIFY / 100644`：

- `docs/contracts/six-ministry-capability-execution.md`
- `docs/contracts/six-ministry-capability-execution.schema.json`
- `scripts/fixtures/six-ministry-execution/security-cases.json`
- `scripts/six_ministry_execution_contract.test.mjs`

当前 projection/Capsule 集合必须精确为六项：`decision-quality-gate`、`hubu-financial-grounding`、`hubu-payment-three-gates`、`libu-responsibility-authority-chain`、`rites-message-quality-gate`、`rites-war-truthfulness`。其中五个使用标准 `candidates/*` 布局，`rites-message-quality-gate` 保持 legacy 兼容输入；不迁目录、不新增 inventory。

## Dependency DAG

1. Capability Protocol V1 capsule-binding exact4：只闭合六 Capsule、exact-zero-grant projection 与 unresolved mapping 协议，不激活；Owner 保持唯一 authority。
2. Tenant-scoped Evidence/Receipt V2 prerequisite：解决 ADR 0044 owner-only `tenant_id=null` 与 exact15 principal 的 forward-only 边界。
3. Read-only capability projection：从现有 Chancellor/46 RuntimeSkill/Tool/family facts 构造七类视图，不复制清单。
4. Shadow-only runtime adapter：只映射已批准 digest 到既有 RuntimeSkill/Tool；不动态 import，不扩 ToolName。
5. 三次独立真实任务评测：不同 task/run/evaluator、fresh context、不可复用 output，生成不可变 evaluation receipts。
6. Outcome Truth / Qualified Use：对预注册 baseline 的真实改善机械派生；当前 `0/22` 不得提前改变。
7. Owner activation projection + tenant enable：每次执行实时求 signature、approval、qualified receipts、principal、tenant policy、RuntimeSkill/Tool policy、kill epoch 的交集。
8. Release candidate：仍需完整真实链、Pilot 与 Release 独立授权；本计划不部署。

## RED Phase

在既有 `security-cases.json` 与 contract test 中先形成以下真实 RED：

- Capsule 自报晋级、自授 tool/data/external write 或伪造 authority projection。
- Capsule/lock/artifact/authority/RuntimeSkill digests 与 repository commit/tree/path 发生 splice/drift。
- client/model/MCP/A2A 注入 principal、route、evidence、tool decision、confirmation 或 epoch。
- Workflow/Swarm/Pack 权限聚合，Expert 输出被当作 authority；Pack/Swarm 空集、unknown/duplicate/nested/cycle/over-budget 产生 vacuous allow。
- synthetic/repeated/self-rated evaluation 冒充三次真实任务或 Qualified Use。
- OTel trace/span 冒充 durable receipt，或 receipt 携带 secret/raw content/high-cardinality identity。
- arbitrary MCP endpoint/credential/write 与任意 A2A card/message。
- unknown type/field、escaped-equivalent duplicate key、NaN/Infinity、path/Unicode confusion、oversize/budget exhaustion。

RED 必须来自现有协议未闭合的真实缺口；测试、环境或 fixture 错误不得冒充。

## GREEN Phase

1. 收紧现有 schema 与 mapping 文档，使用显式 discriminator 增加 non-authorizing Capsule-bound 分支和七类类型边界；legacy/server-owned confirmed-execution 正向语义与覆盖保持，fixture bytes 可做最小安全纠正但不升级为 runtime proof。
2. Capsule/lock/projection 通过现有 strict parser 与 validator 从 checked-in bytes 机械读取；禁止手写 trusted authority、源码正则解析或复制 inventory。本轮不新增 Python registry import 或真实 reload 声明；bounded synthetic constructors 仅表达 evidence/work-product/confirmation/tool-decision 语义，不定义或证明真实 RuntimeSkill/Tool/Owner authority。
3. 冻结 repo-scoped exact-zero-grant projection donor 六 ID 与六 Capsule ID 集合等式；五个标准目录和一个 `rites-message-quality-gate` legacy 布局全部覆盖，不迁移目录。
4. 当前没有 canonical Capsule-ID→RuntimeSkill-ID 映射，也没有在本 exact4 冻结 hash-locked Python import 环境；Capsule-bound 分支固定 `mapping_status=UNRESOLVED`，不得猜映射、用 fixture 自证或依赖 mutable user-site。真实 reload/mapping 转入后续独立 projection successor。
5. 现有 kill-switch 三个 true 只表示未熔断，`true + exact-zero-grant => NO_EXECUTION_AUTHORITY`，任一 false 继续 killed；不得把 `tenant_enabled` 当 tenant activation。
6. 对未实现的 signer/SBOM/receipt/epoch/Qualified Use/activation 只接受 `UNVERIFIED/ABSENT/UNAVAILABLE/NOT_MEASURED/DENY` 固定值；本轮不声称验证其漂移。
7. Raw 输入先经现有 `parseJsonNoDuplicateKeys`，再运行 Draft 2020-12 schema validator与 semantic guard；合法样本两层通过，hostile 样本按职责 fail closed。
8. Capsule-bound 分支固定 `mcp_refs=[] / DENY`，known/unknown MCP ref 都拒绝；只有 legacy/server-owned 分支继续复用现有只读 MCP registry。A2A 固定拒绝。Pack flat/bounded/unique/sorted 且无 MCP refs，Swarm non-empty/bounded/unique/acyclic 且无 MCP refs，unknown/duplicate/nested/cycle/over-budget 全部 DENY。
9. 所有 schema/semantic 安全负例离线 fail closed；合法 fixture 同时保留既有 preview/confirmation/evidence 与 confirmed-execution 不变量。本轮不宣称真实 registry/tool/storage/network 零副作用证明。

## Verification

- Capsule、evaluation、shadow、six-ministry execution 与 Evidence Spine contract tests。
- exact4 `0 ADD + 4 MODIFY / 100644`、direct single-parent、approval-parent presence 结构门与 `git diff --check`；machine authority 另行绑定 exact approval parent。
- root Harness、Harness self-test、Doctor、hook self-test。
- `TMPDIR=/tmp` product-authority regression。
- V2 convergence check/tests。
- Governance、JavaScript/Contract、Security 三路独立只读审查；P0–P2 必须为零。

## Non-Goals

不新增 schema/runtime/registry/ledger/executor/plugin loader；不修改 Capsule、repo-scoped projection donor、RuntimeSkill/Tool/Tenant/Evidence/MCP runtime、Harness/authority/ADR/runtime lock；不实现 Capsule→RuntimeSkill mapping、publisher trust root、SBOM verifier、tenant Evidence V2、durable receipt、Qualified Use、activation、A2A、外部写、Pilot、Release 或部署。

## Stop Conditions

远端漂移、machine STOP、范围超过 exact4、需要第二事实源或动态 importer、需要更改既有 authority/registry/executor、外部可提供 principal/authority、第三方可直接 ACTIVE、synthetic/OTel 可冒充成功、MCP/A2A 越界、验证失败或独立审查 P0–P2，立即停止；不得 re-anchor、force-push 或部署。
