# 铭硕第一交付 · Work Product exact20 Replay Readiness Compatibility Prerequisite Successor

任务 ID：`MINGSHUO-FIRST-DELIVERY-WORK-PRODUCT-V1-EXACT20-REPLAY-READINESS-COMPATIBILITY-PREREQUISITE-SUCCESSOR-20260914`

冻结基线：`origin/ext-dev@e4b7e4ca043c50153d21b0534a07d68584dd233a`；tree：`70aba383bcd688358ea1a6a2d75c6b43e80d679b`。

## Status

Draft

`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`

## Product Definition

本任务是铭硕 Work Product exact20 replay corrective 的独立、forward-only、最窄 protected-path readiness prerequisite。任务 `MINGSHUO-FIRST-DELIVERY-WORK-PRODUCT-V1-EXACT20-REPLAY-IDEMPOTENCY-CORRECTIVE-SUCCESSOR-20260914` 已在 approval commit `e4b7e4ca043c50153d21b0534a07d68584dd233a` 取得 `GO / APPROVED_FOR_ONE_CHILD`，但产品尝试在完整 backend 的 readiness closed-pair 门禁停止。该 one-child authority 仍未形成 candidate commit；其拟议处置为 `ABANDONED_BY_OWNER_UNCONSUMED / NO_REANCHOR / REISSUE_REQUIRED`，必须由 Owner 精确确认后才能推进本 prerequisite。

exact20 二十路径已经形成 `2 ADD + 18 MODIFY / ALL 100644` 的未提交产品字节；十六条非纠偏 donor blob 未漂移，四条纠偏路径形成真实 RED→GREEN。focused `207 passed`、exact20 Ruff 与 diff check 均通过，backend-full 为 `5142 passed, 4 skipped, 5 warnings, 2 failed`。两项失败精确为六部 readiness closed-pair 门禁，不是允许删除、跳过或放宽的测试：

- `backend/tests/test_six_ministry_readiness_report.py::test_readiness_evidence_is_bound_to_current_implementation`
- `backend/tests/test_six_ministry_readiness_report.py::test_successor_content_rejects_third_state_drift`

机械计算得到最终 shadow runtime fingerprint `sha256:598dd8e735ce98b2d8a5307c3fa8b866d8fe72521c92b0c6ea4ba360d7bc9f79` 与 successor fingerprint `sha256:d4e78e42b89022088bb6687a7ab5cc57bcd908a3017b2b4a2e2611497d04def2`。当前两个 validator 已有十二组 closed ordered pair，其中同一 runtime 的最新 pair 仍绑定 predecessor successor `sha256:43cf0adb1d4312e17fef0ec33ca963dbbc98b30d92d9f558a901f0d3ec0a9fea`；因此 exact20 replay 纠偏无法在现有产品 approval 内自行改变受保护 validator。

本 prerequisite 只允许 Python 与 Node 两个现有 validator 原子追加上述唯一第十三 ordered pair。它不修改历史 readiness 报告、不创建第二套 readiness、Harness、authority 或事实源，也不授予 exact20 产品实施、候选、验证继承或发布身份。

## Acceptance Criteria

- [ ] Future candidate 精确修改 `backend/tests/test_six_ministry_readiness_report.py` 与 `scripts/check_harness.mjs`，均为 `M / 100644`，没有第三路径。
- [ ] 现有十二组 ordered pair 字节、顺序和语义全部保持不变；仅在末尾追加唯一第十三 pair，集合差精确为 `+1/-0`，总数精确为 `13`。
- [ ] 新 pair 精确为 runtime `sha256:598dd8e735ce98b2d8a5307c3fa8b866d8fe72521c92b0c6ea4ba360d7bc9f79` 与 successor `sha256:d4e78e42b89022088bb6687a7ab5cc57bcd908a3017b2b4a2e2611497d04def2`，顺序不得交换。
- [ ] Python 与 Node validator 使用同一 ordered-pair 策略；仅匹配一侧、旧 runtime/新 successor 或新 runtime/旧 successor 混搭、未知状态、任一字节篡改、未批准第十四 pair、第五 exclusion 与策略/顺序分叉均 fail closed。
- [ ] 四项 exclusions、历史 69 文件、runtime-content 65 文件、历史 review status/fingerprint、两条 successor-content paths 与 `path + NUL + bytes + NUL` 算法保持不变。
- [ ] Readiness focused、exact2 Ruff、Harness、自测、Doctor、hook、V2 与 `git diff --check` 全绿；backend-full 与 authority regression 均在 process-local `TMPDIR=/tmp TEMP=/tmp TMP=/tmp` 环境运行。
- [ ] Governance、Python 与 Security 三个独立只读审查均为 `GO / P0=0 / P1=0 / P2=0`。
- [ ] prerequisite candidate 落地后，基于届时最新 `origin/ext-dev` 重新签发全新的 exact20 Product Successor；只从当前 donor 重物化字节，重新生成 RED/GREEN、完整矩阵、三审与 machine candidate verification，不继承旧身份。

## Delivery Constraints

- approvalCommitPaths 只允许本轮 Task、Packet、Plan 三文件；future candidatePaths 只允许两个 readiness validators。
- 不得删除、替换、重排现有 pair，不得形成 runtime/successor 两个独立 allowlist或笛卡尔积。
- 不得修改 `docs/migrations/2026-08-14-six-ministry-runtime-readiness.json`、四项 exclusions、69/65 计数、历史 reviewed identity、两条 successor-content paths或 fingerprint 算法。
- 不得修改 exact20 二十路径、Mingshuo 业务语义、P14、前端、V4、史馆、数据库、API、其他 Harness/authority、发布配置或任何第三 candidate path。
- exact20 donor 必须保持 `UNCOMMITTED_BYTE_EVIDENCE_ONLY / BYTE_DONOR_ONLY / NO_CANDIDATE_IDENTITY / NO_VERIFICATION_INHERITANCE`；不得删除、提交、推送或继续消费旧 authority。
- 任一远端漂移、第三候选路径、pair 删除/替换/重排、exclusion 或计数变化、验证失败、P0–P2、需要第二 authority/事实源、force-push 或生产部署请求都立即 STOP。

## Affected Modules

- 模块：六部 readiness Python/Node closed ordered-pair compatibility validators。
- 允许路径：`backend/tests/test_six_ministry_readiness_report.py`, `scripts/check_harness.mjs`。

## Technical Plan

1. 冻结本三文件治理包；执行 strict JSON、重复键拒绝、`productTaskErrors=[]`、路径/模式/差异、RFC 8785 canonical、raw SHA、bundle、Harness 与独立三审。
2. 等待 Owner 精确确认旧 one-child authority 的放弃处置及 Packet canonical digest；将三文件作为当前远端的直接单亲治理提交普通快进落地，不使用 product authority 冒充 governance-repair 执行器。
3. 从该治理提交创建唯一干净 candidate；先补充第十三 pair 的正向和所有 fail-closed 负向证据，再在两个 validator 中原子追加同一 pair。
4. 运行完整冻结矩阵；三审 GO 后冻结 exact2 raw/blob/mode/bytes、bundle、full-index diff 和验证证据，随后按另行覆盖的外部写入权限决定是否创建并普通快进 exact2 candidate。
5. exact2 落地后，放弃本轮旧 exact20 approval lineage，基于最新 ext-dev 创建全新 exact20 Product Successor；从保全 donor 重物化二十路径并重新验证。禁止 re-anchor、force-push和生产部署。

## Implementation Report

只读基线与失败拓扑已机械复核。实时远端、治理工作区与 exact20 donor HEAD 均为 `e4b7e4ca043c50153d21b0534a07d68584dd233a`；base tree 为 `70aba383bcd688358ea1a6a2d75c6b43e80d679b`。exact20 donor 精确为十八条 tracked 修改加两条未跟踪新增，二十路径全部 `100644`；bundle 为 `sha256:4bc4f1e24b9eaa6ed040b1657e9b0337ebb41e0f8f339d5ac1b2953d2bd86589`，combined full-index diff 为 `sha256:81fa5073e85143fd6ead48ee6feef487b852b5cbd5b14a40451e88f27821da11`。

当前阶段只编制本三文件草案；未修改两个 validators 或 exact20 donor，未创建 prerequisite approval/candidate commit，未 push、force-push 或部署。前序 exact20 authority 的一次授权已经按机器规则运行并返回 GO，但本草案不继承、恢复或消费该 product authority。

## Acceptance Review

等待 strict validation 与独立 Governance/Python/Security Review。本 Task 的 `Draft` 状态和 Packet 的 `DRAFT / NON_AUTHORIZING` 明确表示它不是 approval、machine GO、candidate 或产品通过结论。只有 Owner 精确确认最终 canonical digest并完成后继治理落地，才可开始 exact2；exact2 落地后仍必须重新签发 exact20。
