# 铭硕第一交付 · 方案与报价成果物 V1 exact20 Replay Idempotency Corrective Product Successor

任务 ID：`MINGSHUO-FIRST-DELIVERY-WORK-PRODUCT-V1-EXACT20-REPLAY-IDEMPOTENCY-CORRECTIVE-SUCCESSOR-20260914`

冻结基线：`origin/ext-dev@a5239e9c5b1e5c4231f71d506e17e131cfebad39`；tree：`8d46823dca941696bc69186ae33b52eef2b42923`。

## Status

Draft

`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`

## Product Definition

本 successor 只纠正铭硕第一交付 exact20 的重放幂等合同。前序 exact20 在 approval commit `a5239e9c5b1e5c4231f71d506e17e131cfebad39` 下取得但尚未消费的 one-child authority 已由 Owner 明确处置为 `ABANDONED_BY_OWNER_UNCONSUMED / NO_REANCHOR / REISSUE_REQUIRED`。现有二十路径未提交字节仅为 `BYTE_DONOR_ONLY / NO_CANDIDATE_IDENTITY / NO_VERIFICATION_INHERITANCE`，不得恢复旧 authority 或继承旧通过结论。

独立 Python Review 发现确定性 P1：首次请求成功后，同一请求重放会重新构造 XLSX。XLSX 是 ZIP 容器，其打包元数据可以跨时间边界产生不同文件 SHA；现有 `create_work_product` 把新生成的 `artifact_sha256` 与已冻结 intent 的文件 SHA 做全字段相等比较，因此合法重放会偶发返回 409。该问题不是 Fact Pack、WorkProduct 内容摘要或业务身份漂移，而是把“新生成的传输容器字节”错误当成“已持久化成果物的重放身份”。

纠正后，首次创建仍以受校验的生成字节创建 PENDING artifact 和 WorkProduct；重放必须以 owner-scoped durable intent 及已持久化的 artifact/work-product 为事实源，验证 tenant、owner、project、draft request、Fact Pack version/digest、binding、cell projection、artifact ID、work-product ID、WorkProduct content digest、PENDING 状态、文件存在性和已存文件 SHA。新生成 XLSX 的瞬时 ZIP SHA 不得使完全相同的 durable identity 假冲突，也不得成为绕过已存字节校验的理由。为保持存储边界，纠偏在既有 `ArtifactStorage` 上增加一个只读、owner-scoped、expected-identity 参数完整的 PENDING artifact 核验接口，不增加 schema、生命周期状态或第二套存储。

本包不改变下载、发布、确认、归档、报价批准、商业承诺或 V4 展示范围；不增加第二 evaluator、第二 ArtifactStorage、第二 WorkProduct ledger 或任何新事实源。

## Acceptance Criteria

- [ ] Candidate 精确保持 manifest 的二十路径、`2 ADD + 18 MODIFY`、全部 `100644`，无第二十一条路径。
- [ ] 仅 `backend/app/accounting_reports/storage.py`、`backend/app/mingshuo/service.py`、`backend/tests/test_accounting_work_product_storage.py`、`backend/tests/test_mingshuo_delivery.py` 可相对 donor 发生纠偏；其余十六路径必须 byte-for-byte 等于 donor。
- [ ] donor exact20 bundle `sha256:d6a9f2008e182cefe054df4aaa8551e56797f15991403277e623ed27a8a03c83` 与 combined diff `sha256:c66fea83492914c0c4bac7947f572e7de477b57f22e6e272261208f72b571959` 仅用于重物化和差异审计，不继承 candidate 或验证身份。
- [ ] 先形成可归因 RED：通过受控 ZIP 时间边界使相同业务输入生成不同容器 SHA，证明旧实现的第二次请求错误返回 409。
- [ ] 完全相同请求在跨 ZIP 时间边界、普通重放、`PREPARED` 恢复、`ARTIFACT_PENDING` 恢复及并发下都返回同一 artifact/work-product 身份，且只生成一个 durable artifact 和一个 WorkProduct。
- [ ] 重放必须验证已存 PENDING artifact 的 owner、run、report type、period、source hashes、display name、状态、文件存在性与实际文件 SHA；任何篡改或缺失 fail-closed。
- [ ] `ArtifactStorage` 的新核验接口只读、owner-scoped，并要求调用者提供 artifact ID、run、report type、display name、period、source hashes 与冻结 file SHA；不得暴露原始 SQL、私有路径或跨 owner 查询能力。
- [ ] 重放必须验证 frozen intent 的 tenant、owner、project、Fact Pack version/digest、binding JSON/digest、cell projection digest、artifact ID、work-product ID、artifact SHA、work-product digest 和合法 saga state；任何篡改 fail-closed。
- [ ] 重放必须验证既有 WorkProductEnvelope、artifact binding、owner/run/capability/version、状态与 content digest；任何篡改或交叉绑定 fail-closed。
- [ ] 不同请求、不同 binding、不同 Fact Pack identity、跨 tenant/owner、时钟回退、HOLD/BLOCK 或过期输入继续拒绝。
- [ ] 首次创建仍验证新生成 XLSX 的实际 SHA，且经过公式注入防护、bounded OOXML allowlist、宏/外链/隐藏页/媒体/嵌入/路径穿越拒绝。
- [ ] API 保持严格 `Content-Type: application/json` 与空对象合同、422/404/409/503 映射及敏感信息不泄漏。
- [ ] readiness ordered pairs、runtime registry digest、离线 build/verifier、RC1、备份恢复和 legacy publish rejection 语义不变。
- [ ] 完成 v01–v15、Governance/Python/Security 三审；后续 candidate commit 仅在新 machine authority GO 后形成，并通过 v16 与 machine verify-candidate。
- [ ] 三个独立审查均为 `GO / P0=0 / P1=0 / P2=0`。

## Delivery Constraints

- 本轮治理草案仅创建三份治理文件；不物化正式 approval、不运行 authority、不修改产品、不运行产品测试、不 commit、不 push、不部署。
- 未来产品候选仍必须是 exact20；相对 donor 的纠偏实施只能触及 `backend/app/accounting_reports/storage.py`、`backend/app/mingshuo/service.py`、`backend/tests/test_accounting_work_product_storage.py`、`backend/tests/test_mingshuo_delivery.py`，其他十六路径只能重物化 donor 字节。
- 仅允许在既有 `ArtifactStorage` 增加上述只读核验 API；不修改其 schema、写入语义或生命周期状态，不修改 Mingshuo schema、Fact Pack evaluator、WorkProduct schema、readiness validator、Harness、authority、前端或史馆。
- 不允许通过忽略 `artifact_sha256`、不读已存文件、跳过 owner/run/binding 检查或吞掉冲突来实现幂等。
- 远端漂移、machine STOP、第五条纠偏路径、第二十一条产品路径、测试无法产生真实 RED、关键门禁失败或独立审查 P0–P2 均立即停止。
- 远端身份在本轮受限网络环境中只能依 Owner 的精确确认作为草案输入；正式 approval 物化前必须由具备只读网络权限的环境重新核验 Gitee `origin/ext-dev`。

## Affected Modules

- 模块：既有 ArtifactStorage 的 owner-scoped PENDING 身份核验、铭硕方案与报价 WorkProduct durable saga 的 replay idempotency，以及对应存储与 delivery 回归测试。
- 允许路径：产品候选保持原 exact20；相对 donor 的纠偏仅限 `backend/app/accounting_reports/storage.py`、`backend/app/mingshuo/service.py`、`backend/tests/test_accounting_work_product_storage.py`、`backend/tests/test_mingshuo_delivery.py`。

## Technical Plan

1. 以当前 exact20 二十路径工作区为只读 donor，冻结 raw/blob/mode/bytes、bundle 和 full-index diff；不得修改或继承旧身份。
2. 新 approval 落地并取得一次 machine GO 后，从 approval commit 创建唯一隔离候选，先 byte-for-byte 重物化二十路径。
3. 在 `backend/tests/test_accounting_work_product_storage.py` 先为 expected-identity 核验接口建立元数据、来源、冻结 SHA、owner/run、状态、文件与错误泄漏负向合同；在 `backend/tests/test_mingshuo_delivery.py` 使用可控生成器/时钟边界证明同一 durable identity 的新 XLSX ZIP SHA 可变化，并证明旧实现错误 409；不得用 sleep 制造不稳定测试。
4. 在 `backend/app/accounting_reports/storage.py` 增加只读 `verify_pending_identity` 等价接口，复用参数化 SQL、contained path 与现有 `_sha256`，返回已核验 `PendingReportArtifact`；不暴露 connection/path，不改变写入或状态机。
5. 在 `backend/app/mingshuo/service.py` 中将首次创建与重放分流：首次创建继续验证并持久化新生成 artifact；存在 intent 时，以冻结 identity 调用公开核验接口并验证已存 WorkProduct，返回相同响应，不拿瞬时再生成 ZIP SHA覆盖 durable identity。
6. 对 `PREPARED` 与 `ARTIFACT_PENDING` 恢复保持 create-or-verify；若已存实体不完整或被篡改，必须确定性 fail-closed，不得重复创建、静默修复或泄漏内部状态。
7. 运行重放、恢复、并发、篡改、租户隔离、输入验证、Fact Pack 双 PASS、OOXML、release/backup 的 focused 测试，再运行 backend-full、Ruff、Harness、Doctor、authority regression、V2、offline/RC1 和 diff check。
8. 完成 Governance、Python 和 Security 三审并冻结新 exact20 身份；任何审查 P0–P2 停止。
9. 后续只有 Owner 精确授权才可创建 candidate commit、运行 v16 和 machine verify-candidate；v16 必须逐 blob 锁定十六条 frozen donor 路径并证明四条 corrective 路径都不同于 donor，远端仍为新 approval commit 时才能普通 fast-forward。

## Implementation Report

只读诊断已复现：旧 exact20 的 focused 测试、完整 backend 与治理矩阵可通过，但 `tests/test_mingshuo_delivery.py::test_api_creates_one_pending_reviewable_product_and_replays_exact_identity` 可在第二次请求返回 409。`create_work_product` 先构建新的 XLSX，再把 `product.workbook_sha256` 放入 `frozen` 并与既有 intent 全字段比较；XLSX ZIP 字节跨打包时间边界变化时触发假冲突。

现有 `ArtifactStorage.create_or_verify_pending` 已对已存 artifact 的 owner、run、report type、display name、period、source hashes、file SHA、PENDING state、canonical file existence 与实际 SHA 做闭合校验；`create_or_verify_work_product` 已对 WorkProduct payload、唯一 artifact binding、owner/run 和 PENDING state 做闭合校验。但现有公共读取接口不能在不重新提供 incoming file 的情况下复核全部 expected identity，Python Review 因此正确阻止了两路径草案。扩大后的 exact4 通过同一存储事实源增加只读公开核验接口，不新建存储或放宽校验。

本轮只创建 proposed 三文件治理草案。已从主仓只读执行 `git ls-remote origin refs/heads/ext-dev`，实时 Gitee 远端精确为 `a5239e9c5b1e5c4231f71d506e17e131cfebad39`。当前隔离草案 clone 的 `origin` 指向本地主仓，因此正式 approval 物化与 machine authority 仍必须在配置为 `gitee.com/msxn/chaotang-os` 且可再次实时核验的干净环境执行。未物化正式 approval、未运行 product authority、未修改 exact20、未运行产品测试、未 commit、未 push、未部署。

## Acceptance Review

前一版两路径草案已被 Governance/Python Review 以 P1 拒绝；其 provisional digest 不得继承。当前 exact4 修正版已经通过 strict JSON、重复键拒绝、Draft 2020-12 schema、`validateApprovalManifest`、`productTaskErrors=[]`、精确路径/模式、v16 语法、Harness `159 PASS`、Harness self-test `175 PASS`、Doctor、Doctor tests `10/10`、hook self-test `3 PASS`、authority regression `13/13`、V2 tests `20 PASS / 1 SKIP` 与 `git diff --check`。

独立 Governance Review：`GO / P0=0 / P1=0 / P2=0 / P3=1`，唯一 P3 是隔离 clone 的 origin 为本地主仓；正式物化前必须在 Gitee origin 环境重验。独立 Python Design Review：`GO / P0=0 / P1=0 / P2=0 / P3=0`。独立 Security Review：`GO / P0=0 / P1=0 / P2=0 / P3=0`。三审均为只读，未修改文件。

Proposed JSON 的 `state=APPROVED_FOR_ONE_CHILD` 是正式 approval schema 的固定字段，本草案仍是 `DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`。只有 Owner 精确确认最终 canonical digest、正式三文件形成 `a5239e9c…` 的直接单亲 approval commit，且 machine authority 返回 GO，才可实施 corrective exact20。

即使 corrective exact20 最终落地，也只完成“Fact Pack → PENDING 中性方案/报价成果物”的幂等稳定性；`CONFIRMED → 下载 → 史馆归档 → V4 回看` 仍属于后继产品包，不得在本包顺手扩展。
