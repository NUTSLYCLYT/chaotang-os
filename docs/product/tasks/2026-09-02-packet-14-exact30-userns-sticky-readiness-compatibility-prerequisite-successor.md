# P14 Exact30 User-Namespace Sticky Readiness Compatibility Prerequisite Successor

Task ID: `PACKET-14-EXACT30-USERNS-STICKY-READINESS-COMPATIBILITY-PREREQUISITE-SUCCESSOR-20260902`

## Status

Draft

`NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`

## Product Definition

本任务是 P14 exact30 的独立、forward-only readiness compatibility prerequisite。runner-hash corrective approval `13b9751a35815f873cdc986b8ee7e012089408ee` 曾获得 `GO / APPROVED_FOR_ONE_CHILD`，但其本地产品 child `3e89495f4e5b5d547e8b07ccb66b94a013417165` 在 hardened Gate A 的 backend-isolated shard 停止，未运行 machine candidate verification，也未推送。

唯一根因是 Linux user namespace 的安全 sticky 临时目录所有者合同不完整：bubblewrap 将只读根目录映射为 overflow uid `65534`，同时将私有 mode-`1777` `/tmp` 映射给 verifier euid `1000`。`ArtifactStorage` 只接受 namespace root owner，因而把安全的 verifier-owned sticky `/tmp` 错误拒绝。最终 shadow 将重复判断收敛为一个受测安全 helper：保留 sticky-bit、symlink、containment 和其他 fail-closed 检查，仅增加当前有效 uid 作为受信 sticky 目录所有者，并在既有 exact30 测试路径加入定向正负例。该 shadow 相对 stopped child 修改两文件、`56 insertions / 8 deletions`，将 Gate 11 的 artifact storage 拓扑从 `71 failed, 1374 passed, 1 skipped, 50 errors` 收敛为完整后端仅剩两条 closed-pair readiness 失败：`2 failed, 4605 passed, 4 skipped, 3 warnings`。

最终 shadow exact30 为 `30 MODIFY / ALL 100644`，bundle `sha256:2d72b2e0747ff55e77061440fd7940ea843d12bfb7bfe8f2a3a6aff6fc32bae8`，full-index diff `sha256:7b43ef3e1a095abc6b2c28c2c606d494ff9c28813776972980edeca8652fc78d`。它包含当前用户 sticky 正例、非 sticky/外部 UID/非目录负例，并保持既有 symlink 拒绝。该身份仅为 `SHADOW_BYTE_EVIDENCE_ONLY / NOT_A_CANDIDATE / DO_NOT_PUSH`。

本 prerequisite 只允许两个现有 readiness validators 原子追加唯一第十一 ordered pair：runtime `sha256:32ecf613778ddc625567b08ec4526efbf22c0cd29a8c94fc3b9bacbe4e0dd05e` 与 successor `sha256:1922b611550d73daa6226d9dd8abf8d9f9691a0501f9f1fd0ea83e8c772829d2`。现有十对、四项 exclusions、69/65 计数、历史 review identity、两条 successor-content paths 与 fingerprint 算法必须保持不变。

## Acceptance Criteria

- [ ] candidate 精确修改 `backend/tests/test_six_ministry_readiness_report.py` 与 `scripts/check_harness.mjs`，均为 `M / 100644`，无第三路径。
- [ ] 现有十个 ordered pairs 原样、同序保留；只追加第十一 pair，集合差精确 `+1/-0`，总数精确 `11`。
- [ ] Python 与 Node validator 保持同一 ordered-pair 策略；单边、混搭、未知、篡改、第十二 pair、第五 exclusion 或策略分叉全部 fail closed。
- [ ] readiness、backend-full、Ruff、Harness、自测、Doctor、hook、authority regression、V2 与 diff check 全绿。
- [ ] 独立 Governance、Python 与 Security Review 均为 GO，P0–P2 为零。
- [ ] exact2 必须 byte-for-byte 等于冻结 donor：bundle `sha256:b4c022f2750ecd016e6c5d1358b109d8ee83ebdfcc84821502d978c61714c87c`，full-index diff `sha256:32cf8415288f54f2f35c063717b85bc29175c4c49447658f7659ec2c1b080ba0`。
- [ ] 运行 candidate gates 前，唯一总控必须把三审后创建并普通快进落地的精确治理 commit 通过 `P14_READINESS_APPROVAL_COMMIT` 绑定；Gate 01 同时验证该 commit 只含本三文件，避免非循环 self-digest 无法表达的 approval byte 替换。
- [ ] 验证器必须把精确 candidate lineage 与 pinned external-capability lineage 封装为 sealed memfd Git bundle，并把 15302 文件 user-site `sha256:f66e4960cdae78f5f88a6a4c0c279cf83bc572b2ebfe73cae4422d05e2896267` 封装为 sealed memfd archive；第一层无网络 bubblewrap 只在私有 tmpfs 解包和复核，全部 Python/Node 命令再在第二层 bubblewrap 中只读执行这些同一快照，保证 hashed copy is executed copy，且使用私有 `/tmp`、`env -i`、不继承 `NODE_OPTIONS`。
- [ ] exact2 落地后必须基于新的 ext-dev 重签最终 exact30；旧 authority、candidate、验证和审查身份均不得继承。

## Delivery Constraints

- 不修改历史 readiness 报告、四项 exclusions、69/65 计数、review identity、successor-content paths 或 fingerprint 算法。
- 不修改 P14 exact30、发布运行时、前后端产品路径或任何第三路径。
- 不创建第二套 readiness、Harness、authority、事实源或运行时。
- 不 merge、rebase、force-push、Pilot、Release、生产发布或部署。

## Affected Modules

- 模块：六部 readiness Python/Node closed ordered-pair compatibility validators。
- 允许路径：`backend/tests/test_six_ministry_readiness_report.py`、`scripts/check_harness.mjs`。

## Technical Plan

1. 冻结本三文件治理包并完成 strict JSON、闭合合同、Harness 和独立三审。
2. 普通 fast-forward 落地治理提交后，从最新 ext-dev 唯一隔离工作区只追加同一第十一 ordered pair。
3. 运行结构、负向策略、完整后端与 Harness 矩阵；任何漂移或失败立即停止。
4. 三审 GO 后创建直接单亲 exact2 candidate commit并普通 fast-forward 落地。
5. 基于新的 ext-dev 全新签发 P14 exact30 Product Successor，byte-for-byte 重物化受审 exact30，纳入 runner hash 与 userns sticky owner 两项纠正，重新完成 RED/GREEN、Gate 00–99、三审和 machine candidate verification。

## Implementation Report

只读基线及 shadow 诊断已完成。真实 Gate 11 原失败为 `71 failed, 1374 passed, 1 skipped, 50 errors`；安全 helper 与定向回归形成真实 `1 failed → 2 passed`，完整 shadow backend 为 `2 failed, 4605 passed, 4 skipped, 3 warnings`，且两项失败精确为新 ordered pair 未获接受。exact2 byte donor 已形成 readiness `17 passed`、backend-full `4550 passed, 4 skipped, 3 warnings` 与 Harness self-test `175 PASS`，但仍为 donor-only。最终不可变快照原型已真实完成 readiness `17 passed`、backend-full `4550 passed, 4 skipped, 3 warnings`、Ruff、Harness `146 PASS`、self-test `175 PASS`、Doctor、hook、product-authority `12/12`、V2 `20 passed / 1 skipped`；宿主同 uid 无法替换已封存且实际执行的 repo/dependency bytes。远端保持 `13b9751a35815f873cdc986b8ee7e012089408ee`。

## Acceptance Review

待治理包、exact2 重物化、完整矩阵与独立三审完成后填写。通过仅证明第十一 ordered pair 被两个 validators 原子接受，不证明最终 exact30、Gate B、Pilot、Release 或部署完成。
