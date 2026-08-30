# 朝堂能力协议 V1 Capsule Binding Lineage Successor Plan

任务：`CHAOTANG-CAPABILITY-PROTOCOL-V1-CAPSULE-BINDING-LINEAGE-SUCCESSOR-20260830`

基线：`d127323a5be1140320c34bbd7e4d4987c3bd39d3` / tree `2e899b1bb6ae96e23ebaf31eefc138693269a24d`

Proposed Approval RFC 8785 canonical digest：`sha256:691afc6c5a00d33b44177981cecc02f0d0938bcc7ce79fee92e06fe625b3e87d`

状态：`PLAN_ONLY / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`

## Goal

在最新 ext-dev 上重新签发 exact4，把旧强 donor 精确重物化为一个全新的、可机器验收的 child；不恢复旧 authority，不采用被拒绝 child 的弱化 fixture，不创建第二套能力协议、authority、registry、runtime、tenant 或事实源。

## Exact Paths

治理草案仅三路径：

- `docs/migrations/2026-08-30-chaotang-capability-protocol-v1-capsule-binding-lineage-successor.approval.proposed.json`
- `docs/product/tasks/2026-08-30-chaotang-capability-protocol-v1-capsule-binding-lineage-successor.md`
- `docs/superpowers/plans/2026-08-30-chaotang-capability-protocol-v1-capsule-binding-lineage-successor.md`

未来 approval commit 仅三路径：

- `.harness/approvals/CHAOTANG-CAPABILITY-PROTOCOL-V1-CAPSULE-BINDING-LINEAGE-SUCCESSOR-20260830.json`
- `docs/product/tasks/2026-08-30-chaotang-capability-protocol-v1-capsule-binding-lineage-successor.md`
- `docs/superpowers/plans/2026-08-30-chaotang-capability-protocol-v1-capsule-binding-lineage-successor.md`

未来 candidate 精确 `0 ADD + 4 MODIFY / 100644`：

- `docs/contracts/six-ministry-capability-execution.md`
- `docs/contracts/six-ministry-capability-execution.schema.json`
- `scripts/fixtures/six-ministry-execution/security-cases.json`
- `scripts/six_ministry_execution_contract.test.mjs`

## Frozen Lineage

- 当前 base：`d127323a5… / 2e899b1b…`。
- predecessor approval：`62b77cc5… / adc7a818…`，状态 `ABANDONED_AFTER_LOCAL_CHILD / REISSUE_REQUIRED / NO_REANCHOR`。
- rejected child：`c02bb33b…`，状态 `REJECTED_LOCAL_CHILD / MACHINE_UNVERIFIED / DO_NOT_PUSH / NO_CANDIDATE_IDENTITY`。
- strong donor bundle：`sha256:2f6a9d5b5ee2dd07f9539426403e39036e5b9cdcf926878dc1aabde5d7ef87f8`。
- rejected fixture blob `73780412…` 禁止使用；strong fixture blob 必须是 `071381d5…`。
- exact2 与四条 product paths 零重叠；其价值只是在不弱化 canary 的前提下纠正 credential guard。
- strong donor 是当前主仓对象库中的四个 content-addressed blob，不是可继承工作区或远端提交；其中 fixture `071381d5…` 是 local unreachable/dangling object。正式 approval 前与 machine GO 后必须各复核一次 type/bytes/raw，缺失即 STOP。
- 重物化只允许读取 `git cat-file blob <oid>` 原始 bytes；禁止从 `c02bb33b…` 的弱 fixture、相似工作区文件或网络近似重建。candidate commit 推送后才形成远端可复现锚点。

## Dependency DAG

`exact2 credential guard landed` → `exact4 lineage successor governance` → `formal approval commit/push` → `new machine GO` → `fresh exact4 donor rematerialization` → `full matrix + three reviews` → `machine candidate verification` → `ordinary FF ext-dev` → `tenant-scoped Evidence/Receipt prerequisite` → `read-only projection` → `shadow-only adapter` → `real-task receipts` → `Outcome Truth / Qualified Use` → `Owner activation projection` → `Release Candidate`。

每个后续节点必须基于届时最新 ext-dev 单独签发；不得继承本轮 authority 或跳过 prerequisite。

## RED Phase

machine GO 后先复核四个本地 donor object，再只通过 `git cat-file blob <oid>` 重物化 `scripts/fixtures/six-ministry-execution/security-cases.json` 与 `scripts/six_ministry_execution_contract.test.mjs` 两个冻结 donor blob；两份 contract docs/schema 暂时保持 approval 基线字节。随后运行 focused contract test 并保存真实 RED。只有失败精确来自下列协议缺口时才能进入 GREEN；旧 donor 结果、环境错误或 fixture 错误不得冒充 fresh RED。

- 重新证明 Capsule 自报晋级、权限、publisher/tenant/Qualified Use 会 fail closed。
- 重新证明 client/model/adapter 无法注入 principal、route、evidence、tool decision、confirmation 或 epoch。
- 重新证明 Pack/Swarm 空集、unknown/duplicate/nested/cycle/over-budget 和权限并集不会形成 vacuous allow。
- 重新证明 synthetic/repeated/self-rated evaluation 与 OTel correlation 不会冒充真实任务结果或 receipt。
- 重新证明 arbitrary MCP/A2A、duplicate key、path traversal、Unicode/path confusion、oversize 与预算越界会拒绝。
- RED 必须来自真实协议缺口；旧测试结果、环境错误和旧 donor 身份不得冒充 fresh RED。

## GREEN Phase

1. fresh RED 成立后，再 byte-for-byte 重物化两份冻结 docs/schema donor；最终四路径必须全部等于 strong donor，并复算 bundle/full-index diff。
2. 用现有 strict JSON parser、Draft 2020-12 schema 与 semantic guard 闭合 Capsule-aware non-authorizing 分支。
3. 保持六 Capsule 与 repo-scoped exact-zero-grant projection 集合等式；mapping 固定 `UNRESOLVED`。
4. 本 exact4 仅允许 inert Pack 形成 `CAPSULE_REFS_ONLY / DENY`；Tool、Skill、Agent、Workflow、Swarm、Expert 全部固定 `UNRESOLVED / DENY`。Swarm exact-resolve 只作为未来独立 mapping successor 的前置条件；不新增 registry、executor、ledger 或 dynamic importer。
5. Capsule-bound MCP 固定 deny、A2A unsupported；third-party Skill 固定 inert。
6. 保留 legacy/server-owned confirmed-execution 正向语义，不改变 RuntimeSkill/Tool/Tenant/Evidence 事实源。

## Verification

- machine `candidate-donor-identity`：四个 HEAD blob 精确等于冻结 donor。
- machine `candidate-exact4-structure`：direct single parent、approval parent、四路径 `M`、全部 `100644`。
- Capability Capsule、evaluation、shadow、Evidence Spine 与 execution contract tests。
- root Harness、Harness self-test、Doctor、hook self-test。
- 进程级 `TMPDIR=/tmp` product-authority regression。
- V2 convergence check/tests 与 `git diff --check`。
- Governance、JavaScript/Contract、Security 三路独立只读审查；P0–P2 必须为零。

## Non-Goals

不恢复 predecessor authority，不采用或推送 `c02bb33b…`，不改变 donor 字节，不修改 exact2、Capsule schema、RuntimeSkill/Tool/Tenant/Evidence/MCP/Harness/authority/ADR/runtime lock，不实现 mapping、publisher trust root、SBOM、durable receipt、Qualified Use、activation、A2A、外部写、Pilot、Release 或部署。

## Stop Conditions

远端漂移、machine STOP、任一 local donor object 缺失/GC/类型或摘要不一致、donor bundle 不一致、范围超过 exact4、需要第二事实源、需要更改既有 authority/registry/runtime、第三方可直接 ACTIVE、synthetic/OTel 冒充成功、MCP/A2A 越界、任何验证失败或独立审查 P0–P2 时立即停止。禁止 re-anchor、force-push 或部署。
