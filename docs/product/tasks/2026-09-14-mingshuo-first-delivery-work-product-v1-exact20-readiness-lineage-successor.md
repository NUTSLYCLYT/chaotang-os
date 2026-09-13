# 铭硕第一交付 · 方案与报价成果物 V1 exact20 Readiness Lineage Product Successor

任务 ID：`MINGSHUO-FIRST-DELIVERY-WORK-PRODUCT-V1-EXACT20-READINESS-LINEAGE-SUCCESSOR-20260914`

冻结基线：`origin/ext-dev@fee06f259813ee54834fdcd84702430019be61a9`；tree：`06b174bbbcdbf884c13572fb9ef69bec26656b77`。

## Status

Draft

`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`

## Product Definition

本 successor 在 readiness compatibility prerequisite 已经以两个 forward-only 直接单亲提交落地后，重新签发原 exact20 的产品 authority。它复用现有 Mingshuo Fact Pack evaluator、ArtifactStorage、WorkProductEnvelope、runtime-data registry、确认回执和离线发布事实源，把重新验真的 Fact Pack 与 draft request 转换为确定性五页《方案与报价草案》XLSX 和 PENDING WorkProduct。报价不含金额或商业承诺；下载、发布、史馆归档和 V4 展示仍属于后继包。

前序 `MINGSHUO-FIRST-DELIVERY-WORK-PRODUCT-V1-EXACT20-LINEAGE-CORRECTIVE-SUCCESSOR-20260913` 在 approval commit `9257f45e690badd75b6decf30aa2f11c50db16be` 下的 one-child authority 已由 Owner 明确处置为 `ABANDONED_BY_OWNER_UNCONSUMED / NO_REANCHOR / REISSUE_REQUIRED`，不得恢复、消费或继承。当前二十路径未提交工作区只是 `UNCOMMITTED_BYTE_EVIDENCE_ONLY / BYTE_DONOR_ONLY / NO_CANDIDATE_IDENTITY / NO_VERIFICATION_INHERITANCE`。

前置链已经完成：治理提交 `f8caf8abb60f05125c9f9fc1fa39ba0af933064b` 和 validator candidate `fee06f259813ee54834fdcd84702430019be61a9` 以直接单亲、普通 fast-forward 落地。Python 与 Node validator 保留原 11 个 ordered pairs，仅原子追加第 12 对：

- runtime：`sha256:598dd8e735ce98b2d8a5307c3fa8b866d8fe72521c92b0c6ea4ba360d7bc9f79`
- successor：`sha256:43cf0adb1d4312e17fef0ec33ca963dbbc98b30d92d9f558a901f0d3ec0a9fea`

本包不修改 validator；它只允许在最新基线上重物化原 exact20 donor，重新生成 RED/GREEN、全矩阵、三审和 machine candidate evidence。

## Acceptance Criteria

- [ ] Candidate 精确为 manifest 的二十路径，结构 `2 ADD + 18 MODIFY`，全部 `100644`；没有第二十一条路径。
- [ ] donor bundle 必须重物化为 `sha256:d6a9f2008e182cefe054df4aaa8551e56797f15991403277e623ed27a8a03c83`，但不继承旧 candidate、测试、审查或 authority 身份。
- [ ] 机械证明 `9257f45e… → f8caf8ab… → fee06f25…` 是单亲 forward-only lineage，两个前置提交与 exact20 产品路径零重叠。
- [ ] `backend/app/operations/sqlite_backup.py` 只保持已验证的信任 runner SHA 同步，不改变备份、恢复、containment、fail-closed 或 provenance 语义。
- [ ] 保持 runtime registry v2 合同、合法 project/draft/intention foreign-key lineage 和既有测试修正；不关闭 foreign key、不绕过 schema、不删除完整性断言。
- [ ] 经当前日和存储日双重 PASS 的 Fact Pack 才能生成五个固定 worksheet 的 non-binding XLSX；HOLD/BLOCK、过期、时钟回退、旧版本、摘要漂移和跨 tenant/owner 全部 fail-closed。
- [ ] 交付身份继续绑定 tenant、owner、project、draft request、Fact Pack 版本/摘要、evidence/fact/claim digest 和 producer policy；私有 binding 仅在 owner-scoped intent 中。
- [ ] 保留 `PREPARED → ARTIFACT_PENDING → WORK_PRODUCT_BOUND` durable saga、确定性 IDs、create-or-verify、crash recovery、并发幂等和旧 `publish_run` 对 Mingshuo PENDING 工件的原子拒绝。
- [ ] XLSX 继续进行公式注入防护与 bounded OOXML 后验收；拒绝宏、外链、隐藏页、媒体、嵌入、路径穿越、重复条目和 allowlist 外部件。
- [ ] API 只接受严格 `Content-Type: application/json` 的 `{}`；错误映射保持 422/404/409/503，响应和日志不泄漏 tenant/owner、路径、SQL、凭据、canonical bytes 或原始 requirements。
- [ ] runtime registry digest `sha256:7caed69599c964b7fc908229d86795008a0956fdae90628a904f8e4ec87dcabe` 在唯一 registry、release schema、offline build/verifier、RC1 acceptance 及测试中一致，拒绝旧值或交叉不一致。
- [ ] 完整 backend 必须在进程级 `TMPDIR=/tmp TEMP=/tmp TMP=/tmp` 下自然结束；readiness 必须因已落地的第 12 ordered pair 全绿，不得修改 validator 来迎合候选。
- [ ] 未提交候选先通过 v01–v15；三审与身份冻结后，只有在后续明确授权下创建直接单亲 candidate commit，才运行 v16 和 machine verify-candidate。
- [ ] Governance、Python、Security 三个独立只读审查均为 `GO / P0=0 / P1=0 / P2=0`。

## Delivery Constraints

- 只允许 manifest 精确二十路径；不得出现第二十一条路径。
- 不修改刚落地的两个 readiness validator、Fact Pack evaluator/schema、WorkProduct 合同、report-artifact API、史馆、SceneRun/V4、前端、Harness 或 authority。
- 不把 `NON_AUTHORIZING` draft request、PENDING WorkProduct 或人工确认误写为报价批准、可下载、已归档、商业成功或生产就绪。
- 任何远端漂移、machine STOP、路径扩大、第二事实源、安全门放宽、关键验证失败或独立审查 P0–P2 都立即停止。

## Affected Modules

- 模块：铭硕 Fact Pack 到中性方案/报价 WorkProduct、owner-scoped durable delivery saga、唯一 runtime registry 与可信离线发布/备份身份链。
- 允许路径：manifest 精确二十路径，结构固定 `2 ADD + 18 MODIFY`。

## Technical Plan

1. 以 `/home/ubuntu/ct-p8/mingshuo-delivery-work-product-exact20-candidate-20260913` 为只读 donor，重新核对二十路径 raw/blob/mode/bytes、bundle 与 diff，不继承其 authority 或验证结论。
2. 从本 approval commit 的干净直接子候选中 byte-for-byte 重物化 exact20，证明前置两提交与产品路径零重叠。
3. 重新生成可归因 RED/GREEN，运行 v01–v15，不得使用前序 exact20 的测试、审查或通过身份。
4. 完成 Governance/Python/Security 三审并冻结候选身份。
5. 只有在后续有效授权下才可创建 candidate commit，运行 v16 和 machine verify-candidate；实时远端、直接单亲、路径、模式和摘要全部一致后才能普通 fast-forward。

## Implementation Report

只读依赖闭包已确认：实时 `origin/ext-dev` 为 `fee06f259813ee54834fdcd84702430019be61a9 / 06b174bbbcdbf884c13572fb9ef69bec26656b77`。前置治理与 validator 提交只触及三份治理文档和两个 validator，与 exact20 零重叠。旧 donor 仍精确为 `2 ADD + 18 MODIFY / ALL 100644`，bundle `sha256:d6a9f2008e182cefe054df4aaa8551e56797f15991403277e623ed27a8a03c83`，combined full-index diff `sha256:c66fea83492914c0c4bac7947f572e7de477b57f22e6e272261208f72b571959`。

readiness exact2 已经通过 `18 passed`、Ruff、backend-full `5109 passed / 4 skipped`、Harness `159`、self-test `175`、Doctor、hook、authority regression `13/13`、V2 和 Governance/Python/Security 三审，并以 `fee06f259…` 普通 fast-forward 落地。这些只证明前置，不证明 exact20 产品候选已通过。

本轮仅编制 proposed 治理三文件；未修改产品、未物化正式 approval、未运行 product authority、未运行产品测试、未 commit、未 push、未部署。

## Acceptance Review

Strict JSON、重复键拒绝、Draft 2020-12 schema、`validateApprovalManifest`、`productTaskErrors=[]`、精确路径/模式、lineage 零重叠、Harness/Doctor/hook/authority regression/V2 与 `git diff --check` 均已通过。Governance Review、Python Design Review 和 Security Review 均为 `GO / P0=0 / P1=0 / P2=0 / P3=0`。

Proposed JSON 的 `state=APPROVED_FOR_ONE_CHILD` 是正式 approval schema 的固定字段，本草案仍是 `DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`。只有 Owner 后续精确确认 canonical digest、正式三文件形成直接单亲 approval commit，并由 machine authority 返回 GO，才可实施 exact20。

即使 exact20 落地，也只完成“事实包 → PENDING 中性方案/报价成果 → 可人工审阅”。第一交付里程碑剩余的 `CONFIRMED → 下载 → 史馆幂等归档 → V4 任务详情回看` 必须另立最小后继包，不得在本包顺手扩展。
