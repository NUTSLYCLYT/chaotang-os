# 朝堂能力协议 V1 Capsule Binding Lineage Successor

任务 ID：`CHAOTANG-CAPABILITY-PROTOCOL-V1-CAPSULE-BINDING-LINEAGE-SUCCESSOR-20260830`

冻结基线：`origin/ext-dev@d127323a5be1140320c34bbd7e4d4987c3bd39d3`

冻结 tree：`2e899b1bb6ae96e23ebaf31eefc138693269a24d`

Proposed Approval RFC 8785 canonical digest：`sha256:691afc6c5a00d33b44177981cecc02f0d0938bcc7ce79fee92e06fe625b3e87d`

## Status

Draft

细分状态：`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`

## Product Definition

本任务是《朝堂能力协议 V1》Capsule Binding exact4 的 forward-only lineage successor。它在已落地的 credential guard exact2 基线上，把冻结的四文件强 donor byte-for-byte 重物化，并重新取得 machine authority、完整验证与独立审查；不继承旧 approval、authority、candidate、验证或审查身份。

产品价值保持为：复用现有 `Capability Capsule v1`、六部执行兼容契约、RuntimeSkill/Tool registries、Tenant Principal、Evidence Spine 与 WorkProduct/ConfirmationReceipt，闭合 Tool、Skill、Agent、Workflow、Swarm、Expert、Pack 七类边界。Capsule-bound 分支只允许 `CANDIDATE_ONLY / MAPPING_UNRESOLVED / MCP_DENY / NO_EXECUTION_AUTHORITY / EXTERNAL_EFFECTS_FALSE`；本 exact4 仅允许 inert Pack 形成 `CAPSULE_REFS_ONLY / DENY` 投影，其余六类固定 `UNRESOLVED / DENY`；既有 server-owned confirmed-execution 正向语义保持兼容。

本任务不创建第二套 Capsule、authority、registry、tenant、truth ledger、receipt、runtime、MCP/A2A 运行时或第四业务主线。Owner 继续是唯一真实 authority；模型、客户端、Pack、Swarm、Expert、第三方 Skill 与 adapter 均不得自授 principal、工具、外部副作用或 ACTIVE 状态。

## Lineage And Donor Boundary

- predecessor task：`CHAOTANG-CAPABILITY-PROTOCOL-V1-CAPSULE-BINDING-SUCCESSOR-20260829`。
- predecessor approval：`62b77cc545999af015e7c6d37b611ffd17ab0ab4` / tree `adc7a818011c4997379f9524e97ac9d01928d5d1`。
- predecessor authority disposition：`ABANDONED_AFTER_LOCAL_CHILD / REISSUE_REQUIRED / NO_REANCHOR`；不得恢复、消费、继承或重新锚定。
- rejected local child：`c02bb33b999d3b458b14ecb705ca7fe83ab09314`，状态为 `REJECTED_LOCAL_CHILD / MACHINE_UNVERIFIED / DO_NOT_PUSH / NO_CANDIDATE_IDENTITY / REISSUE_REQUIRED / NO_REANCHOR`。
- rejected child 只在 security fixture 使用了较弱 blob `7378041251f52396f78d8e7df748a5ff88bed6b5`；该 blob 禁止采用。
- predecessor strong donor bundle：`sha256:2f6a9d5b5ee2dd07f9539426403e39036e5b9cdcf926878dc1aabde5d7ef87f8`，仅为不可变 byte donor evidence。
- predecessor combined full-index diff：`sha256:3e06e4b94b0829b2a47891031c41f49e3ec2d62d6f52196f5ef492ac690691ae`，仅作 lineage 复算依据。
- 当前基线与 predecessor base 在 exact4 四路径上的 base blob 完全一致；exact2 只改动前端 credential guard 两路径，对本 exact4 产品范围为零重叠。
- donor 不是一个可继承工作区或远端提交。doc、schema、test 的冻结 blob 也出现在被拒绝 child 的对象中，但只按 content identity 采用；strong fixture `071381d5…` 是当前主仓对象库中的 local unreachable/dangling blob，不在任何已推送 lineage 中。
- 因此正式 approval 物化前和 machine GO 后重物化前，必须在同一主仓对象库分别机械确认四个对象的 `type=blob`、bytes 与 raw SHA。任一对象缺失、GC、类型或摘要漂移立即 STOP；不得从弱 fixture、工作区近似字节或网络猜测重建。
- 重物化只能使用 `/usr/bin/git cat-file blob <oid>` 的原始输出，并在写入后复核本表四重身份。新 candidate commit 普通 FF 落地后，四个 donor 字节才成为远端可达、可从新 clone 复现的正式产品字节。

冻结 donor identities：

| 路径 | Git blob | Raw SHA-256 | Bytes | Mode |
| --- | --- | --- | ---: | --- |
| `docs/contracts/six-ministry-capability-execution.md` | `067a3230a15b21daeb78493d04d27288ce6e56da` | `sha256:6dc1f6e676fba5a28ce9615845177c86b193f70ecc0883042319747d6c04b67c` | 6567 | `100644` |
| `docs/contracts/six-ministry-capability-execution.schema.json` | `885ed960b409dd792f87e1b5917601c54ab4aba1` | `sha256:89ce12b623881ebec6f49b8af30e18337c510ddb1630d8a51d69ab284c8c65a4` | 12652 | `100644` |
| `scripts/fixtures/six-ministry-execution/security-cases.json` | `071381d5426ffb5f8a730278444d9352e50232fd` | `sha256:0c3fbe070863a5333a903e2b8ff7fd2f1c55bec3a207ae0cc771d698c81b9e53` | 16238 | `100644` |
| `scripts/six_ministry_execution_contract.test.mjs` | `bd3092c82305864071ffa5ec85969a541899e267` | `sha256:76ac0acaf71de443ffdea678c2a82e7208036a8a7dcb3d875f1e125253c363b6` | 26043 | `100644` |

## Protocol Boundaries

- 本 exact4 的唯一可解析组合类型是 inert Pack：只允许 `CAPSULE_REFS_ONLY / DENY`，不得产生执行权。
- Tool、Skill、Agent、Workflow、Swarm、Expert 在本轮全部固定 `UNRESOLVED / DENY`；不得从 Capsule、Pack、模型或客户端推断或扩权。
- Pack 必须 flat、bounded、unique、sorted、content-addressed；禁止 nested Pack、动态 import/install、权限并集与子项激活。
- Swarm 的 non-empty、bounded、unique、acyclic 与逐一 exact-resolve 只作为未来独立 mapping successor 的前置条件；本轮不接纳任何 Swarm mapping，未知、重复、循环或超预算继续 DENY。
- Capsule、lock 与 repo-scoped exact-zero-grant projection 必须按 checked-in bytes 机械闭合；Capsule-ID→RuntimeSkill-ID mapping 保持 `UNRESOLVED`，不得猜测或新建 registry。
- Tenant Principal 只能由服务端受信认证/session/membership JOIN 派生；外部提供的 principal、tenant、role、run、route 均拒绝。
- synthetic evaluation、shadow、人工确认与 OTel correlation 不得冒充 Qualified Use、durable receipt、Owner approval 或生产晋级。
- Capsule-bound MCP 固定 `DENY/UNAVAILABLE` 且 `mcp_refs=[]`；A2A 固定 `UNSUPPORTED / DENY`。
- 第三方 Skill 不得直接 ACTIVE；publisher signature 只证明来源，不替代 Owner approval、SBOM、revocation epoch 或真实任务结果。

## Acceptance Criteria

- [ ] Candidate 精确为冻结四路径 `0 ADD + 4 MODIFY`，全部 `100644`，无第五路径。
- [ ] 四个 candidate blob 与本文件冻结 strong donor blob byte-for-byte 一致，尤其 fixture 必须是 `071381d5…`，不得采用 `73780412…`。
- [ ] predecessor authority、rejected child 和 donor 均不产生可继承 identity；新 machine authority 只允许一个新 child。
- [ ] Capsule-bound envelope 只能得出 candidate-only、mapping unresolved、MCP deny、零执行权和零外部副作用。
- [ ] 七类能力边界 fail closed，不新增 authority、registry、ledger、runtime、tenant 或第四主线。
- [ ] raw fixture 通过现有 duplicate-key-safe parser、Draft 2020-12 schema 与 semantic guard；unknown/duplicate/path/Unicode/oversize 等负例闭合。
- [ ] 既有 server-owned confirmed-execution、Evidence Spine、ToolPolicy 和 Tenant Principal 正向语义不回退。
- [ ] frozen verification matrix 全绿，Governance、JavaScript/Contract 与 Security Review 均为 `GO / P0=0 / P1=0 / P2=0`。

## Delivery Constraints

- 只有一个 exact4 产品字节写入者；不存在可继承的 donor 工作区，唯一 donor 来源是当前主仓对象库内四个冻结 blob。
- 正式 approval 落地且 machine 返回 `GO / APPROVED_FOR_ONE_CHILD` 后，才可在新干净工作区重物化 donor。
- 新 candidate 必须重新运行全部测试、结构门、Harness、Doctor、authority regression、V2 与独立审查；历史证据不得继承为通过结论。
- 不修改 exact2 credential guard、Capability Capsule schema/lifecycle、RuntimeSkill/Tool registries、Tenant auth、Evidence storage、MCP runtime、Harness、authority、ADR、数据库或运行锁。
- 不安装第三方依赖，不执行第三方 Skill，不运行外部写、Pilot、Release 或部署。
- 不得 force-push、merge、rebase、跳过 hooks 或放宽门禁。

## Affected Modules

- 模块：现有六部能力执行兼容契约、Capsule 非授权绑定、协议安全负例与离线验证。
- 允许路径：`docs/contracts/six-ministry-capability-execution.md`、`docs/contracts/six-ministry-capability-execution.schema.json`、`scripts/fixtures/six-ministry-execution/security-cases.json`、`scripts/six_ministry_execution_contract.test.mjs`。

## Technical Plan

1. 冻结本三文件治理包并取得 Owner 对新 base、digest 和 lineage 的精确确认。
2. 正式 approval 物化前，按 blob/type/bytes/raw 四重身份确认四个本地 donor 对象仍存在；然后创建 direct-single-parent approval commit 并普通 fast-forward 推送。
3. 运行一次新 product authority；machine STOP 即停止，禁止重试或 re-anchor。
4. machine GO 后再次确认四个本地 donor 对象存在且身份未变，从 approval commit 创建唯一干净 candidate 工作区；只通过 `git cat-file blob <oid>` 先重物化冻结的 `security-cases.json` 与 contract test。
5. 在仍为基线字节的 contract docs/schema 上运行 focused test，记录真实 RED；失败必须来自本轮协议缺口，旧结果、fixture 错误或环境错误不得冒充。
6. RED 成立后再 byte-for-byte 重物化两份 docs/schema donor blob，形成 GREEN；机械验证 `0 ADD + 4 MODIFY / 100644`、四 blob identity、donor bundle、full-index diff 与无第五路径。
7. 重新执行安全负向、Capability/Evidence/Execution focused 回归、Harness/self-test/Doctor/hook、`TMPDIR=/tmp` authority regression、V2 与 diff check。
8. 独立进行 Governance、JavaScript/Contract、Security Review；任一 P0–P2 为 NO-GO。
9. 双层验证全部通过后，才冻结新 candidate identity；后续 commit、machine candidate verification 与普通 FF push 仍按精确 lineage 执行。

## RED And Security Matrix

- Capsule 自报 ACTIVE/stable、tools/domains/external write、publisher verified、tenant authorized 或 Qualified Use 必须拒绝。
- Capsule/lock/projection/artifact digest、repository/tree/path 任一 splice 或 byte drift 必须拒绝。
- client/model/adapter/MCP/A2A 注入 principal、route、evidence、tool decision、confirmation 或 epoch 必须拒绝。
- Pack/Swarm 权限并集、空集合默认放行、unknown/duplicate/nested/cycle/over-budget 必须拒绝。
- synthetic、重复 task/run/evaluator、共享可写状态、模型自评或无 baseline 不得形成 Qualified Use。
- OTel trace/span 不得授予执行；raw prompt、secret、credential、URL/header 或高基数 identity 不得进入 projection。
- arbitrary MCP endpoint/credential/write 与任意 A2A card/message 必须拒绝。
- escaped duplicate key、NaN/Infinity、路径逃逸、Unicode/path 混淆、超长输入与资源预算越界必须 fail closed。

## Implementation Report

尚未实施。本轮只冻结新的 forward-only lineage 治理包。旧 strong donor 只提供可复算字节；旧 authority、`c02bb33b…`、旧验证和旧审查均不具有 candidate、通过、可恢复或可推送身份。

## Acceptance Review

待正式 approval、machine GO、fresh donor 重物化、完整矩阵和三路独立审查后填写。任何通过结论只覆盖 exact4 非授权协议内核，不覆盖真实 runtime、Qualified Use、activation、外部副作用、Pilot、Release 或部署。

## Stop Conditions

远端漂移、machine STOP、任一 donor 对象缺失/GC/类型或 identity 不一致、出现第五路径、需要修改既有 authority/registry/runtime/Harness/ADR、多个事实源无法裁决、第三方字节可直接 ACTIVE、外部可提供 principal/authority、synthetic/OTel 可冒充成功、MCP/A2A 越界、任一验证失败或独立审查出现 P0–P2，立即 STOP。
