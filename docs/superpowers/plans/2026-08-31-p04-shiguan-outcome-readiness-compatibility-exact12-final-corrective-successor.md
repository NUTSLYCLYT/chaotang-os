# P04 Shiguan Outcome Readiness Compatibility exact12 Final Corrective Successor Plan

## Objective

用最窄 exact2 protected-path successor，使 Python 与 Node readiness validators 只新增一组完全有序、不可拆分的 P04 exact12 最终 compatibility pair，并为随后重新签发 P04 exact12 清除唯一 closed-pair 阻断。

## Frozen Identities

- Base: `305837522d8711c4d0ea556def3d5319d36f1264 / f0853722ff9adeaaec554d027a2cb994a28a04b3`。
- Pair: `sha256:598dd8e735ce98b2d8a5307c3fa8b866d8fe72521c92b0c6ea4ba360d7bc9f79` + `sha256:709ebaf18862a4c2d78422756ca1e353eeb8dd5925c624ee74d9ebdaf43cc924`。
- Validator donor bundle: `sha256:e5a1fb015a9634a4be03aaa4685de16eda8f921872756660740f118b0e3ec058`。
- Validator full-index diff: `sha256:0fde40c94678635f10c1de7c189b81e7dffd8796839a148f86472cf97e803d70`。
- Final exact12 donor bundle: `sha256:98afb3e6b387fa3ce80afe5d7b741883211056bd674ddbd1a867638a14baba3c`。
- Final exact12 full-index diff: `sha256:7b62a654bd4cc6f6668132568839b518dd7f74c57e21266210432820f1b36ad8`。

## Authority Disposition

旧 task `P04-SHIGUAN-AUTHENTICATED-OUTCOME-V1-EXACT12-READINESS-CORRECTED-LINEAGE-SUCCESSOR-20260831` 的 one-child authority 未消费，固定为 `ABANDONED_BY_OWNER_STANDING_AUTHORIZATION_UNCONSUMED / APPROVAL_SCOPE_CONTRADICTION / REISSUE_REQUIRED / NO_REANCHOR`。当前 exact12 只保留为最终 review-corrected byte donor。

## RED to GREEN

1. 干净 base readiness 为 `14 passed`。
2. 仅加入第九组合同测试，精确节点以 exit code `1` 证明策略因缺少新 pair 真实 RED。
3. 两个 validator 原子追加同一 ordered pair，旧八组原序不变。
4. focused readiness 为 `15 passed`，Harness 为 `146 PASS`，Harness self-test 为 `175 PASS`，diff check 为 PASS。
5. future candidate 必须 byte-for-byte 等于本包 donor；旧 donor不继承 candidate 身份。
6. 字节预检查通过后创建唯一未推送的本地 exact2 candidate commit；commit-bound 矩阵与三审全绿后才允许普通快进。

## Verification Matrix

- exact2 lineage、两路径 `M/100644`、提交内 byte identity 与 live remote parent。
- Python/Node exact nine ordered pairs、`+1/-0`、四 exclusions、两 successor paths、69/65、review identity。
- 单边、混搭、tamper、未知第十 pair、第五 exclusion、策略分叉负向矩阵。
- readiness focused、POSIX temp backend-full、exact Python Ruff。
- root Harness/self-test、doctor/check/tests、hook self-test、process-local `TMPDIR=/tmp` authority regression。
- V2 convergence check/tests、`git diff --check`。
- Governance、Python、Security 三个只读独立审查；任一 P0–P2 为 NO-GO。

## Stop Conditions

远端漂移、donor 漂移、第三条 candidate path、pair reorder/removal、独立 allowlist或笛卡尔积、历史身份或 exclusions 漂移、完整矩阵失败、审查 P0–P2、需要第二套事实源，均立即 STOP。

## Forward Reissue

exact2 普通快进后，必须从最新 ext-dev 创建新的 P04 exact12 Product Successor，byte-for-byte 重物化最终 exact12 donor，重新执行完整验证、独立三审和 machine candidate verification。本计划不授权 Pilot、Release 或部署。
