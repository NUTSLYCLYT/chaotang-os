# Mingshuo Work Product exact20 Readiness Compatibility Prerequisite Successor Plan

Task: `MINGSHUO-FIRST-DELIVERY-WORK-PRODUCT-V1-EXACT20-READINESS-COMPATIBILITY-PREREQUISITE-SUCCESSOR-20260913`

Base: `9257f45e690badd75b6decf30aa2f11c50db16be / 91ff126412f32f27ad3391ad6bdbfdd87c4d05b6`

Status: `DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`

## Objective

以最窄 exact2 forward-only protected-path candidate，使 Python 与 Node readiness validators 原子接受 Mingshuo Work Product exact20 shadow 的唯一第十二 ordered pair，同时保持全部历史身份、排除项、计数与 fail-closed 语义不变。

## Frozen Boundary

- Candidate paths 精确为 `backend/tests/test_six_ministry_readiness_report.py` 与 `scripts/check_harness.mjs`。
- New pair 精确为 runtime `sha256:598dd8e735ce98b2d8a5307c3fa8b866d8fe72521c92b0c6ea4ba360d7bc9f79` + successor `sha256:43cf0adb1d4312e17fef0ec33ca963dbbc98b30d92d9f558a901f0d3ec0a9fea`。
- Existing eleven pairs 保持原样和原序；只追加一个 pair，集合差 `+1/-0`，总数十二。
- 四项 exclusions、69/65 计数、历史 review identity、两条 successor-content paths 与 `path + NUL + bytes + NUL` 算法保持不变。
- Exact20 shadow 为 `2 ADD + 18 MODIFY / ALL 100644`；bundle `sha256:d6a9f2008e182cefe054df4aaa8551e56797f15991403277e623ed27a8a03c83`；full-index diff `sha256:c66fea83492914c0c4bac7947f572e7de477b57f22e6e272261208f72b571959`。它仅为 byte donor，不是 candidate。
- Approval `9257f45e…` 下未消费的 one-child authority 已被 Owner 放弃；任何 exact20 后续都必须重新签发。

## RED To GREEN

1. 在未修改 validator 的 exact20 shadow 保留两条真实 closed-pair readiness RED，证明业务字节本身不能越权改变受保护验证器。
2. 在 exact2 candidate 内新增正向测试，要求 Python 与 Node 同时接受精确第十二 pair。
3. 新增负向测试：只匹配 runtime、只匹配 successor、旧新混搭、顺序交换、未知状态、任一 digest 篡改、未授权第十三 pair、第五 exclusion 与 Python/Node 策略或顺序分叉全部拒绝。
4. 仅在两个 validator 末尾原子追加同一 pair，并把精确 pair count 更新为十二；不修改既有 pair、predicate、exclusions、successor paths 或历史证据。

## Verification Matrix

- 实时远端、治理提交与 candidate 的直接单亲 lineage；approval 三条 `A/100644`，candidate 两条 `M/100644`，工作树 clean。
- 当前十一对与新第十二对 exact `+1/-0`；禁止删除、替换、重排、独立 allowlist、笛卡尔积、单边接受或 validator 分叉。
- `backend/tests/test_six_ministry_readiness_report.py` focused、exact2 Ruff、process-local `TMPDIR=/tmp TEMP=/tmp TMP=/tmp` backend-full。
- Root Harness、self-test、Doctor check/tests、hook self-test、process-local POSIX temp authority regression、V2 check/tests 与 `git diff --check`。
- Governance Review 检查 Owner disposition、no-reanchor、scope 与 forward reissue；Python Review 检查 fingerprint 算法、测试闭合与 exact pair；Security Review 检查 fail-closed、无笛卡尔积、无 exclusion 扩张及无第二 authority。

## Execution Order

1. 严格校验并冻结本三文件，完成独立三审，向 Owner 返回唯一 Packet RFC 8785 canonical digest。
2. Owner 确认后，以当前 base 的直接单亲三文件治理提交普通快进落地；不得把 governance-repair 冒充 product authority。
3. 从最新 ext-dev 创建唯一 exact2 candidate，先 RED 后 GREEN，执行完整矩阵与三审；任何失败立即 STOP。
4. 冻结 exact2 identity；仅在既有明确权限覆盖且实时远端未漂移时创建最小直接单亲提交并普通快进，绝不 force-push。
5. 基于 exact2 落地后的最新 ext-dev 创建新的 exact20 Product Successor；从当前 donor 重物化二十路径，重新执行全部产品验证、三审、machine authority 与 candidate verification。

## Stop Conditions

远端漂移、第三 candidate path、现有 pair 删除/替换/重排、exclusion/计数/算法变化、验证失败、独立审查 P0–P2、恢复旧 exact20 authority、创建第二 authority/事实源、force-push 或生产部署请求，均立即停止对应链路。

## Rollback

治理草案未提交时直接保留为 evidence；exact2 若未推送则不改变远端。若未来已落地 exact2 需要撤回，只允许经过新治理与完整复验的 forward-only inverse，不改写历史、不删除 donor、不放宽 closed-pair 门禁。
