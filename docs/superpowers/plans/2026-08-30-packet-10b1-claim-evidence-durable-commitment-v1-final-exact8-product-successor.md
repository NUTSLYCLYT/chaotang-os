# P10-B1 Claim-Evidence Durable Commitment V1 Final Exact8 Product Successor Plan

## Objective

在 `536f4c00d5364664522956622eab7aed1d2b2cf9 / b799fc582db46197e70c3ed35bfe6fb3834089a8` 上重新签发最终 exact8，使已落地的 exact6 runtime/readiness compatibility 与 P10-B1 durable commitment 字节形成唯一可验证主线。本阶段只冻结治理，不授权产品字节、Pilot、Release或部署。

## Governance freeze

1. 新 task ID 为 `PACKET-10B1-CLAIM-EVIDENCE-DURABLE-COMMITMENT-V1-FINAL-EXACT8-PRODUCT-SUCCESSOR-20260830`；approval commit paths 精确为：
   - `.harness/approvals/PACKET-10B1-CLAIM-EVIDENCE-DURABLE-COMMITMENT-V1-FINAL-EXACT8-PRODUCT-SUCCESSOR-20260830.json`
   - `docs/product/tasks/2026-08-30-packet-10b1-claim-evidence-durable-commitment-v1-final-exact8-product-successor.md`
   - `docs/superpowers/plans/2026-08-30-packet-10b1-claim-evidence-durable-commitment-v1-final-exact8-product-successor.md`
   当前 proposed 临时路径 `docs/migrations/2026-08-30-packet-10b1-claim-evidence-durable-commitment-v1-final-exact8-product-successor.approval.proposed.json` 只用于 Owner 冻结摘要，物化后必须删除且不得进入提交；product paths 精确为 Task 列出的八条。
2. 旧 shadow 固定为 `BYTE_DONOR_ONLY / NO_CANDIDATE_IDENTITY / NO_VERIFICATION_INHERITANCE / NO_AUTHORITY_INHERITANCE`。从 `642848e8...` 到当前基线只有 exact6治理与六路径candidate，和exact8零重叠。
3. 先校验 proposed approval、Task、Plan；Owner确认canonical digest后才物化正式 approval。正式 approval commit必须是当前基线直接单亲子且只含三条 approval paths。
4. 正式 approval普通FF后只运行一次 product authority。machine STOP高于本计划；machine GO只允许一个exact8 child。

## Exact8 implementation

1. 在全新clean candidate worktree逐文件复核 donor HEAD/tree、八路径、raw/blob/mode/bytes、bundle `sha256:d750580bbc26138589367aba51710097f044c7193eff9ede097b5fc44c7c3b2f` 与 full-index diff `sha256:afce5a35187aaa5b7abfd09f7867e1ed8ea67e26937a151e0ce4e33de6e38c97`。
2. byte-for-byte 重物化 exact8，不继承任何旧candidate、测试或审查身份。出现第九路径立即停止。
3. 重新证明 SQL NULL commitment、staged authority handoff、release/marker/activation、owner过滤、worker storage boundary及crash recovery fail-closed。
4. 重新证明稳定双快照 probe、锁内 closed identity dispatch、fresh/exact-new/exact-old/two parent-only predecessor、canonical transactional rebuild、unknown DELETE/WAL sidecar与rollback/restart矩阵。
5. exact8不得修改 exact6 runtime registry/backup/readiness/Harness；完成后应自然命中新 runtime digest与第六 ordered pair。

## Verification

- Backend：P10-A、P10-B1 focused、exact8 Ruff、POSIX backend-full、six-ministry readiness。
- Root：Harness、Harness self-test、doctor check、doctor tests、hook self-test、`TMPDIR=/tmp` authority regression、V2 check/tests、`git diff --check`。
- Structure：candidate必须是 approval commit直接单亲子，只含八条 `M / 100644`。
- Reviews：Governance、Python、Security三路只读独立审查，任一 P0–P2 为 NO-GO。
- Candidate：冻结逐文件identity、bundle、full-index diff、RED/GREEN与verification evidence；machine verify-candidate通过后才请求普通FF。

## STOP conditions

远端或 donor 漂移、machine STOP、第九路径、exact6前置变化、single ALTER持久形态、unknown schema写入、non-null writer、第二事实源、crash recovery回退、任一验证失败、三审P0–P2或需要扩大范围时立即停止。禁止force-push、merge、rebase、fetch、pull和部署。

## Successor queue

P10-B1 exact8完成并普通FF落地、单航道释放后，CT-00 V2才可进入独立治理草案：只冻结Gate E能力身份与现有Evidence/Receipt映射、复用现有product authority、jiqun只读消费脱敏authenticated Outcome；不得与本exact8并行施工或形成第二运行时。
