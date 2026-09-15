# 铭硕第一交付 · Confirm Readback exact10 Readiness Compatibility Prerequisite Successor

任务 ID：`MINGSHUO-FIRST-DELIVERY-CONFIRM-READBACK-V1-EXACT10-READINESS-COMPATIBILITY-PREREQUISITE-SUCCESSOR-20260915`

冻结基线：`origin/ext-dev@547673fe623cc619a028d48bb4ec806300bc7b4a`；tree：`13259f170048357f778f88efdb94658f80c485e8`。

## Status

Draft

`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`

## Product Definition

本任务是铭硕第一交付 Confirm Readback exact10 的独立、forward-only、最窄 protected-path readiness compatibility prerequisite。前序任务 `MINGSHUO-FIRST-DELIVERY-CONFIRM-READBACK-V1-EXACT10-V00D-PYTEST-HOOK-SIGNATURE-CORRECTIVE-SUCCESSOR-20260914` 已在 approval commit `547673fe623cc619a028d48bb4ec806300bc7b4a` 取得 `GO / APPROVED_FOR_ONE_CHILD`，但 exact10 shadow 在冻结验证矩阵中停止为 `STOP / APPROVAL_VERIFICATION_TOPOLOGY_CONTRADICTION / UNCOMMITTED_BYTE_EVIDENCE_ONLY`。Owner 已将该 one-child authority 精确处置为 `CONSUMED_BY_STOPPED_SHADOW_ATTEMPT / NO_REANCHOR`；它不得恢复、继承、重试或消费为后续 candidate 身份。

exact10 十路径已在唯一隔离工作区 byte-for-byte 重物化，保持 `10 MODIFY / ALL 100644`，bundle 为 `sha256:44bf93000c04c6ae647e9439e46928536698e31b176e5efd152c504683ed85ee`，combined full-index diff 为 `sha256:6d3465289eb9c517e79a38747ea21164b4e6fbf6b867e9ad79b2320437d25d37`。新鲜 RED 证明三条确认／下载／归档／回读能力在基线缺失，新鲜 GREEN 为 `3 passed`；focused 为 `234 passed`，exact10 Ruff 通过。backend-full 精确为 `5164 passed, 4 skipped, 5 warnings, 2 failed`，两项失败均为 readiness closed-pair 门禁。

验证拓扑矛盾已机械定位：原 approval 的 `v04-harness-single-readiness-diagnostic` 要求当前 root Harness 因 readiness pair 缺失而失败；紧随其后的 `v05-harness-self-test` 又在相同 root、相同 validator 字节上要求同一 readiness 校验返回空错误列表。因此两项在第十四 ordered pair 落地前不可同时为真，不是 exact10 业务回归，也不得通过跳过、放宽或伪造结果解决。

本 prerequisite 只允许 Python 与 Node 两个既有 validator 原子追加唯一第十四 ordered pair。它不修改历史 readiness 报告、不创建第二套 readiness、Harness、authority 或事实源，也不授予 exact10 产品实施、候选、验证继承、提交、推送或部署身份。

## Acceptance Criteria

- [ ] Future candidate 精确修改 `backend/tests/test_six_ministry_readiness_report.py` 与 `scripts/check_harness.mjs`，均为 `M / 100644`，没有第三路径。
- [ ] 现有十三组 ordered pair 字节、顺序和语义全部保持不变；仅在末尾追加唯一第十四 pair，集合差精确为 `+1/-0`，总数精确为 `14`。
- [ ] 新 pair 精确为 runtime `sha256:9e8729a88bc797c01d59818fb67d852025a9c679fdd7eb6e8fe63f26cbc8d365` 与 successor `sha256:6b9521165b821729a3548f3535b90c30aab9b874c81b1b1b437bb5af64d06e34`，顺序不得交换。
- [ ] Python 与 Node validator 使用同一 ordered-pair 策略；只匹配一侧、任一既有 runtime 与新 successor 混搭、新 runtime 与任一既有 successor 混搭、顺序交换、未知状态、任一 digest 篡改、未批准第十五 pair、第五 exclusion 与策略/顺序分叉均 fail closed。
- [ ] 四项 exclusions、历史 69 文件、runtime-content 65 文件、历史 review status/fingerprint、两条 successor-content paths 与 `path + NUL + bytes + NUL` 算法保持不变。
- [ ] Readiness focused、exact2 Ruff、backend-full、Harness、自测、Doctor、hook、authority regression、V2 与 `git diff --check` 全绿；需要临时目录的 Python/Node 回归仅使用 process-local `TMPDIR=/tmp TEMP=/tmp TMP=/tmp`。
- [ ] Governance、Python 与 Security 三个独立只读审查均为 `GO / P0=0 / P1=0 / P2=0`。
- [ ] prerequisite candidate 落地后，基于届时最新 `origin/ext-dev` 重新签发全新的 exact10 Product Successor；只从当前 shadow byte donor 重物化十路径，重新生成 RED/GREEN、完整矩阵、三审、machine authority 与 candidate verification，不继承旧身份。

## Delivery Constraints

- approvalCommitPaths 只允许本轮 Task、Packet、Plan 三文件；future candidatePaths 只允许两个 readiness validators。
- 不得删除、替换、重排现有 pair，不得形成 runtime/successor 两个独立 allowlist 或笛卡尔积。
- 不得修改 `docs/migrations/2026-08-14-six-ministry-runtime-readiness.json`、四项 exclusions、69/65 计数、历史 reviewed identity、两条 successor-content paths 或 fingerprint 算法。
- 不得修改 exact10 十路径、Mingshuo 业务语义、前端、V4、史馆、数据库、API、其他 Harness/authority、发布配置或任何第三 candidate path。
- exact10 shadow 必须保持 `UNCOMMITTED_BYTE_EVIDENCE_ONLY / BYTE_DONOR_ONLY / NO_CANDIDATE_IDENTITY / NO_VERIFICATION_INHERITANCE`；不得删除、提交、推送或继续消费前序 authority。
- 任一远端漂移、第三候选路径、pair 删除/替换/重排、exclusion 或计数变化、验证失败、P0–P2、需要第二 authority/事实源、force-push 或生产部署请求都立即 STOP。

## Affected Modules

- 模块：六部 readiness Python/Node closed ordered-pair compatibility validators。
- 允许路径：`backend/tests/test_six_ministry_readiness_report.py`, `scripts/check_harness.mjs`。

## Technical Plan

1. 冻结本三文件治理包；执行 strict JSON、重复键拒绝、`productTaskErrors=[]`、路径/模式/差异、RFC 8785 canonical、raw SHA、bundle、Harness 拓扑核验与独立三审。
2. 等待 Owner 精确确认 Packet canonical digest；将三文件作为当前远端的直接单亲治理提交普通快进落地，不使用 product authority 冒充 governance-repair 执行器。
3. 从该治理提交创建唯一干净 exact2 candidate；先补充第十四 pair 的正向和全部 fail-closed 负向证据，再在两个 validator 中原子追加同一 pair。
4. 运行完整冻结矩阵；三审 GO 后冻结 exact2 raw/blob/mode/bytes、bundle、full-index diff 和验证证据，按后续明确授权决定是否创建并普通快进 exact2 candidate。
5. exact2 落地后，基于最新 ext-dev 创建全新 exact10 Product Successor；从保全 shadow 重物化十路径并重新验证。新 successor 的 backend-full 与普通 Harness 都必须全绿，不得继承原 approval 中互相矛盾的“预期 readiness 失败”验证拓扑。

## Implementation Report

只读基线与失败拓扑已机械复核。实时 `origin/ext-dev`、本治理工作区 HEAD 与 tree 精确为 `547673fe623cc619a028d48bb4ec806300bc7b4a / 13259f170048357f778f88efdb94658f80c485e8`。exact10 shadow 精确十条 tracked 修改、无第十一路径、全部 `100644`；其 bundle 与 full-index diff 如上，只作为不可继承的 byte evidence。

本阶段仅创建本 Task、Packet、Plan 三份治理草案；未修改两个 validators 或 exact10 shadow，未运行 authority，未创建 commit，未 push、force-push 或部署。前序 product authority 已由 Owner 确认消费于停止的 shadow 尝试，当前包不恢复、重试、继承或 re-anchor 它。

Strict JSON、重复键拒绝、Packet 内部一致性、当前 validator 身份比对、精确路径/模式/差异与 `git diff --check` 均通过；新 Task 的 `productTaskErrors=[]`。仓库不存在适用于 `governance-repair.packet.v1` 的正式 JSON Schema，因此没有伪造 schema PASS；本包按现有先例的 closed-contract 与内部一致性检查验证。完整 Harness 为 `159 个基线文件通过`，Harness self-test 为 `175 项通过`。

## Acceptance Review

Strict validation 已完成；独立 Governance Review、Python Review 与 Security Review 均为 `GO / P0=0 / P1=0 / P2=0 / P3=0`。三审确认现有十三个 ordered pair 与 Python/Node validators 字节、顺序一致，并按现有 `path + NUL + bytes + NUL` 算法对 shadow 机械复算得到本包冻结的唯一第十四 pair。

本 Task 的 `Draft` 状态和 Packet 的 `DRAFT / NON_AUTHORIZING` 明确表示它不是 approval、machine GO、candidate 或产品通过结论。只有 Owner 精确确认最终 canonical digest 并完成后继治理落地，才可开始 exact2；exact2 落地后仍必须重新签发 exact10 Product Successor。
