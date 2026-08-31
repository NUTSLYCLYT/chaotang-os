# P04 Shiguan Outcome Readiness Compatibility exact12 Corrective Successor

Task ID: `P04-SHIGUAN-OUTCOME-READINESS-COMPATIBILITY-EXACT12-CORRECTIVE-SUCCESSOR-20260831`

## Status

Draft

治理状态：`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`。

## Product Definition

本包是 P04 史馆 authenticated Outcome exact12 的独立 protected-path prerequisite。它不扩展、恢复或重新锚定旧 P04 product authority，只允许 Python 与 Node readiness validators 原子追加同一第八组 ordered compatibility pair。

前序 P04 exact12 approval commit `121c1fa97939584306771094f3a4b5f0198c1f9c` 已取得 `GO / APPROVED_FOR_ONE_CHILD`，但未提交产品 child。安全纠偏后的 exact12 在完整后端中得到 `4540 passed / 4 skipped / 1 failed`，唯一失败是新 runtime fingerprint 尚未被 closed pair 接受。因此该产品尝试固定为 `STOP / APPROVAL_SCOPE_CONTRADICTION / BYTE_DONOR_ONLY`，旧 one-child authority 固定为 `ABANDONED_BY_OWNER_STANDING_AUTHORIZATION_UNCONSUMED / REISSUE_REQUIRED / NO_REANCHOR`。

本 prerequisite 落地后，P04 exact12 必须基于届时最新 ext-dev 全新签发 successor，byte-for-byte 重物化旧 donor，再重新完成 RED/GREEN、完整矩阵、三审与 machine candidate verification。

## Acceptance Criteria

- [ ] approval commit 只包含本 Task、同名 Packet JSON 与 Plan 三条新增路径，均为 `100644`。
- [ ] future candidate 只修改 `backend/tests/test_six_ministry_readiness_report.py` 与 `scripts/check_harness.mjs`，均为 `M/100644`。
- [ ] 现有七组 compatibility pair 字节级原序保留，仅原子追加第八组 `82885f… / 709eba…`，集合差精确为 `+1/-0`，总数精确为 8。
- [ ] Python 与 Node 策略字节语义一致；单边、混搭、篡改、未知第九组、第五 exclusion 与策略分叉全部 fail-closed。
- [ ] 四项 exclusions、69/65 文件计数、历史 reviewed fingerprint/status、两条 successor-content paths 原样保留。
- [ ] candidate 字节与本包冻结的 exact2 byte donor raw/blob/mode/bytes、bundle 与 full-index diff 精确一致。
- [ ] readiness、backend-full、Ruff、Harness、doctor、hook、authority regression、V2 convergence 与 diff check 全绿。
- [ ] Governance、Python 与 Security 独立审查均为 `GO / P0=0 / P1=0 / P2=0`。
- [ ] prerequisite 普通 fast-forward 落地后，旧 P04 exact12 authority 不得消费、恢复、继承或 re-anchor。

## Delivery Constraints

- 基线精确为 `121c1fa97939584306771094f3a4b5f0198c1f9c / 48ee43b052c10fdc6fab2ddbfac00dfe7d87394b`。
- 本包是 governance repair，不运行 product authority，不创建第二套 readiness、Harness、authority、runtime 或事实源。
- 不修改历史 readiness 报告、四项 exclusions、历史 review identity、69 文件清单、65 路径算法或两条 successor-content paths。
- 不修改 P04 exact12 产品 donor、其他 Harness、API、数据库或业务路径。
- 不继承旧 approval、authority、candidate、测试、审查或通过身份。
- 禁止 force-push、merge、rebase、fetch、pull、Pilot、Release 与部署。
- 远端漂移、第三条 candidate path、pair reorder/removal、验证失败或独立审查 P0-P2 均立即 STOP。

## Affected Modules

- 模块：六部 readiness compatibility protected-path prerequisite。
- 允许路径：`backend/tests/test_six_ministry_readiness_report.py`、`scripts/check_harness.mjs`。
- 治理提交路径：本 Task、同名 `.packet.json`、同名 Plan。
- 非目标：P04 exact12 产品字节、历史 readiness 报告、exclusions、successor paths、authority、Pilot、Release、部署。

## Technical Plan

1. 只读确认 live `origin/ext-dev` 与冻结 base commit/tree 精确一致。
2. 审核并冻结未提交 exact2 byte donor；该 donor 无 candidate 或验证继承身份。
3. 将三文件治理包作为 base 的直接单亲三文件 approval commit 普通快进落地。
4. 从该 approval 创建唯一隔离 candidate，byte-for-byte 重物化两个 validator donor 文件。
5. 先完成未提交字节的 focused/全量预检查与身份冻结，再创建唯一一次本地 exact2 candidate commit；此时不得推送。
6. 对该本地 commit 运行 approval-owned 的 commit-bound 闭合矩阵，机械证明单亲 lineage、旧七组原序、仅追加第八组、`+1/-0`、总数 8、四 exclusions、69/65、Python/Node 闭合一致及 committed byte identity。
7. 对同一 commit 完成独立三审；仅在完整矩阵与三审全绿后普通 fast-forward 推送。
8. 基于新的 ext-dev 另立 P04 exact12 Product Successor；旧 exact12 仅作 byte donor。

## Implementation Report

当前仅完成非授权的 donor 预演：

- baseline readiness：`13 passed`。
- 新第八组精确节点先形成真实 RED：exit code `1`，RED test blob `c8d866f2775646930edf2a815b4fc1444dfab682`，stdout digest `sha256:19dde53f82d5354eb1472ae6537a93d9469831556e94bd5d13636af997d4c154`，证据摘要 `sha256:b1b03cff05785e4eca47b4b97aea4aba9c0ac5f6dfc94a3e52e0ea2f48d2f1bd`；失败签名为缺少批准的第八 pair。
- donor GREEN：readiness `14 passed`，Harness self-test `175 passed`，`git diff --check` PASS。
- exact2 donor bundle：`sha256:8a8685fe5d92995c46ceb6c855654c9b9329df7576774597e5dfd7e6d835debb`。
- exact2 donor full-index diff：`sha256:319dc11b5f8833ff0aae11f4425d04492a55b64f27331d1d8752cad880ffc58d`。
- 以上字节为 `BYTE_DONOR_ONLY / NO_CANDIDATE_IDENTITY / NO_VERIFICATION_INHERITANCE`，尚未提交或推送。

P04 exact12 安全纠偏 donor 保留在隔离工作区，结构仍为 `12 MODIFY / ALL 100644`；bundle 为 `sha256:7ee08b8a336c9fa957bc39027324844e5a0534d4e63400ad4e51804eb08499a9`，full-index diff 为 `sha256:ed63cf5cac3de60f30f829ae0e3863b1684c3c0a0d4b8dc35959273a60c6a46f`。该 donor 的 runtime fingerprint 为 `sha256:82885fc13cec86318e4436fccfd80c78d7880e4aa25cdb530d0f4d18c9c73fe3`，successor fingerprint 为 `sha256:709ebaf18862a4c2d78422756ca1e353eeb8dd5925c624ee74d9ebdaf43cc924`。

## Acceptance Review

当前状态仍为 `DRAFT / NON_AUTHORIZING`。治理包、exact2 candidate 与后续 exact12 successor 是三条前向 lineage，不得互相借用 approval、authority、candidate、验证或审查身份。exact2 先形成唯一未推送的本地 candidate commit，再对该 commit 执行 commit-bound 完整矩阵与独立三审；全部全绿后才允许普通快进。这仍不授予 P04 exact12 产品 child、Pilot、Release 或部署权。
