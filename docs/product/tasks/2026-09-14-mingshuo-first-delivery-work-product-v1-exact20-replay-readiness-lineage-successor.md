# 铭硕第一交付 · 方案与报价成果物 V1 exact20 Replay Readiness Lineage Product Successor

任务 ID：`MINGSHUO-FIRST-DELIVERY-WORK-PRODUCT-V1-EXACT20-REPLAY-READINESS-LINEAGE-SUCCESSOR-20260914`

冻结基线：`origin/ext-dev@67ce78f164c4b29987ff89ff8a86a437a7a6c96d`；tree：`d4ad99650e6c3ed86d11bb0a4bcacdcb34111c1a`。

## Status

Draft

`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`

## Product Definition

本 successor 在最新 ext-dev 上重新签发铭硕第一交付 exact20。前序 replay corrective approval commit `e4b7e4ca043c50153d21b0534a07d68584dd233a` 下尚未消费的 one-child authority 已由 Owner 明确处置为 `ABANDONED_BY_OWNER_UNCONSUMED / NO_REANCHOR / REISSUE_REQUIRED`；其二十路径未提交字节只作为 `BYTE_DONOR_ONLY / NO_CANDIDATE_IDENTITY / NO_VERIFICATION_INHERITANCE` 保留。

前序产品尝试唯一范围矛盾是完整 backend 对新 runtime/successor fingerprint pair 的 readiness closed-pair 拒绝。独立 prerequisite 已 forward-only 落地：治理 commit `2992668c1027eb0e797e2c4744eafe26e9d4b964`，exact2 validator commit `67ce78f164c4b29987ff89ff8a86a437a7a6c96d`。Python 与 Node validators 原子追加第十三 ordered pair，保留原十二 pair、四项 exclusions、69/65 计数和算法不变；完整 backend `5110 passed, 4 skipped`，三审 GO。

未来 candidate 只能从旧 exact20 donor byte-for-byte 重物化冻结的二十文件。该 donor 已包含 replay 幂等纠偏：相同 durable identity 不因新生成 XLSX ZIP 容器 SHA 变化而假冲突，同时仍验证已存 PENDING artifact、WorkProduct、tenant/owner、binding、文件存在性和实际 SHA。不得继续修改 donor 字节、继承旧验证结论或扩大产品范围。

本包仅交付“Fact Pack → PENDING 中性方案与报价成果物”的稳定、可复算、可恢复生成；不宣称完成 `CONFIRMED → 下载 → 史馆归档 → V4 回看`，这些仍属于后继交付闭环。

## Acceptance Criteria

- [ ] Candidate 精确保持 manifest 的二十路径、`2 ADD + 18 MODIFY`、全部 `100644`，无第二十一条路径。
- [ ] 二十文件逐 blob 精确等于冻结 donor；bundle 为 `sha256:4bc4f1e24b9eaa6ed040b1657e9b0337ebb41e0f8f339d5ac1b2953d2bd86589`，旧基线 combined diff `sha256:81fa5073e85143fd6ead48ee6feef487b852b5cbd5b14a40451e88f27821da11` 仅作 donor 证据。
- [ ] 重新生成 replay RED→GREEN：跨 XLSX ZIP container-byte 变化、普通重放、`PREPARED`/`ARTIFACT_PENDING` 恢复及同一 Python 进程内线程并发返回同一 artifact/work-product identity。
- [ ] 重放完整验证 stored PENDING artifact、owner/run/report identity、source hashes、file existence/actual SHA、frozen intent、Fact Pack、binding、WorkProduct digest/state；任一篡改 fail-closed。
- [ ] 不同请求、跨 tenant/owner、HOLD/BLOCK、过期 Fact Pack、错误 binding、文件缺失或状态漂移继续拒绝。
- [ ] 首次创建继续执行 formula/OOXML 防护、宏/外链/隐藏页/嵌入/路径穿越拒绝和严格 API 错误合同。
- [ ] readiness 19 项、backend-full、exact20 Ruff、Harness、Doctor、authority regression、V2、offline/RC1 及 diff check 全绿。
- [ ] Governance/Python/Security 三审均 `GO / P0=0 / P1=0 / P2=0`，machine candidate verification PASS。

## Delivery Constraints

- 本轮只创建三份 proposed 治理草案；不物化正式 approval、不运行 authority、不实施产品、不运行产品测试、不 commit、不 push、不部署。
- 后续 exact20 必须在本 successor approval 与 machine GO 下从 donor byte-for-byte 重物化；不得继承旧 authority、candidate、测试或审查身份。
- 不修改 readiness validators、Harness、authority、Fact Pack evaluator、ArtifactStorage/WorkProduct 业务 schema、前端、史馆或任何第二十一条产品路径；manifest 内已冻结的 `deploy/release-manifest.schema.json` 仅按 donor 字节重物化。
- 本包的运行与验收边界精确限制为单 Python 进程；不授权多 worker/多进程运行，不承诺其并发行为，也不增加分布式锁。多进程支持如有需要，必须另立 successor 并先加入确定性共享 DB/artifact-dir 竞争负向测试。
- 远端漂移、machine STOP、donor 漂移、任一 blob 不匹配、无法重新证明 RED→GREEN、关键门禁失败或独立审查 P0–P2 均立即停止。

## Affected Modules

- 模块：铭硕中性方案与报价 WorkProduct durable saga、既有 ArtifactStorage owner-scoped PENDING 身份核验、release/backup 绑定及对应测试。
- 允许路径：manifest 冻结的 exact20 二十路径；所有路径只允许 byte-for-byte 重物化 donor。

## Technical Plan

1. 以当前 exact20 未提交工作区为只读 donor，重新核对 HEAD/tree、精确二十路径、`2 ADD + 18 MODIFY`、mode、raw/blob/bytes、bundle 和旧基线 full-index diff。
2. Owner 确认本包 canonical digest 后，正式三文件必须形成 `67ce78f1…` 的直接单亲 approval commit；远端仍精确一致时普通 fast-forward。
3. 仅运行一次 machine authority；GO 后从 approval commit 创建唯一干净候选，将二十 donor 文件逐字节重物化。
4. 先重演可控 ZIP container-byte 差异的旧 replay 失败，再证明 donor 修复；重新覆盖恢复、同进程线程并发、篡改、tenant/owner、Fact Pack、OOXML、API 和 release/backup 负向矩阵。验收环境必须保持单 Python 进程；不得把本包结果外推为多 worker/多进程验证。
5. 在未提交候选上先完成 v01–v15 与 Governance、Python、Security 独立审查并冻结身份；只有 Owner 后续精确授权时，才创建 approval 的直接单亲本地 candidate commit。
6. 对该已提交本地 candidate 运行 v16 和 machine `--verify-candidate`；v16 证明结构精确、模式为 `100644` 且二十 blob 全部等于冻结 donor。只有 machine PASS、远端仍为 approval commit 且另有明确 push 权限时，才可普通 fast-forward 推送。

## Implementation Report

本轮 prerequisite 已完成：`e4b7e4ca… → 2992668c… → 67ce78f1…` 为直接单亲 forward-only lineage。exact2 只修改 `backend/tests/test_six_ministry_readiness_report.py` 与 `scripts/check_harness.mjs`，追加 ordered pair `sha256:598dd8e… / sha256:d4e78e42…`；readiness `19 passed`、backend-full `5110 passed, 4 skipped`、Harness/Doctor/authority/V2 全绿，Governance/Python/Security 三审均 GO。

旧 exact20 donor 仍绑定 `e4b7e4ca… / 70aba383…`，结构 `2 ADD + 18 MODIFY`、全部 `100644`，bundle `sha256:4bc4f1e24b9eaa6ed040b1657e9b0337ebb41e0f8f339d5ac1b2953d2bd86589`。二十 blob 已机械冻结到 proposed approval 的 v16；旧 evidence 只证明 donor 来源，不会冒充新基线候选证据。

## Acceptance Review

本 successor 是新的 forward-only 产品治理包，不是对 `e4b7e4ca…` authority 的 re-anchor。proposed JSON 的 `state=APPROVED_FOR_ONE_CHILD` 是正式 approval schema 字段；在 Owner 确认、正式 approval commit 和 machine GO 之前，本包仍为 `DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`。

治理验收必须证明：base 身份为 `67ce78f1… / d4ad9965…`；approval/product paths 精确；旧 authority 已放弃；exact2 prerequisite 已落地且不被产品 candidate 修改；二十 donor blobs 原子锁定；后续验证不继承。即使 exact20 最终落地，也不得把 PENDING 成果物描述为已人工确认、可下载、已归档或真实商业成功。
