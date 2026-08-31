# P04 Shiguan Outcome Readiness Compatibility exact12 Corrective Successor Plan

## Objective

用最窄 exact2 protected-path successor，使 Python 与 Node readiness validators 只新增一组完全有序、不可拆分的 P04 exact12 compatibility pair，并为随后重新签发 P04 exact12 清除唯一 closed-pair 阻断。

## Frozen Identities

- Base: `121c1fa97939584306771094f3a4b5f0198c1f9c / 48ee43b052c10fdc6fab2ddbfac00dfe7d87394b`。
- Pair: `sha256:82885fc13cec86318e4436fccfd80c78d7880e4aa25cdb530d0f4d18c9c73fe3` + `sha256:709ebaf18862a4c2d78422756ca1e353eeb8dd5925c624ee74d9ebdaf43cc924`。
- Validator donor bundle: `sha256:8a8685fe5d92995c46ceb6c855654c9b9329df7576774597e5dfd7e6d835debb`。
- Validator full-index diff: `sha256:319dc11b5f8833ff0aae11f4425d04492a55b64f27331d1d8752cad880ffc58d`。
- Corrected exact12 donor bundle: `sha256:7ee08b8a336c9fa957bc39027324844e5a0534d4e63400ad4e51804eb08499a9`。
- Corrected exact12 full-index diff: `sha256:ed63cf5cac3de60f30f829ae0e3863b1684c3c0a0d4b8dc35959273a60c6a46f`。

## RED to GREEN

1. 干净 base readiness 必须先为 `13 passed`。
2. 仅加入第八组合同测试，精确节点以 exit code `1` 证明策略因缺少新 pair 真实 RED；冻结 test blob、stdout/stderr 与 development evidence digest。
3. 两个 validator 原子追加同一 ordered pair，旧七组原序不变。
4. focused readiness 必须为 `14 passed`，Harness self-test 必须继续全绿。
5. future candidate 必须 byte-for-byte 等于本包 donor；旧 donor 不继承 candidate 身份。
6. 字节预检查通过后创建唯一未推送的本地 candidate commit；commit-bound 矩阵与三审必须在该 commit 上全绿，之后才允许普通快进。

## Verification Matrix

- exact2 lineage、两路径 `M/100644`、提交内 byte identity 与 live remote parent。
- Python/Node exact eight ordered pairs、`+1/-0`、四 exclusions、两 successor paths、69/65、review identity。
- 单边、混搭、tamper、未知第九 pair、第五 exclusion、策略分叉负向矩阵。
- readiness focused、POSIX temp backend-full、exact Python Ruff。
- root Harness/self-test、doctor/check/tests、hook self-test、process-local `TMPDIR=/tmp` authority regression。
- V2 convergence check/tests、`git diff --check`。
- Governance、Python、Security 三个只读独立审查；任一 P0-P2 为 NO-GO。

## Stop Conditions

远端漂移、donor 漂移、第三条 candidate path、pair reorder/removal、独立 allowlist或笛卡尔积、历史身份或 exclusions 漂移、完整矩阵失败、审查 P0-P2、需要第二套事实源，均立即 STOP。

## Forward Reissue

exact2 普通快进后，旧 `P04-SHIGUAN-AUTHENTICATED-OUTCOME-V1-EXACT12-LINEAGE-SUCCESSOR-20260831` authority 固定放弃且不得 re-anchor。必须从最新 ext-dev 创建新的 P04 exact12 Product Successor，byte-for-byte 重物化 corrected exact12 donor，重新执行完整验证、独立三审和 machine candidate verification；本计划不授权部署。
