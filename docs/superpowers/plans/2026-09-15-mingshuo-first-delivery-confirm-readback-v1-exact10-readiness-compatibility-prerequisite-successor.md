# Mingshuo Confirm Readback exact10 Readiness Compatibility Prerequisite Successor Plan

Task: `MINGSHUO-FIRST-DELIVERY-CONFIRM-READBACK-V1-EXACT10-READINESS-COMPATIBILITY-PREREQUISITE-SUCCESSOR-20260915`

Base: `547673fe623cc619a028d48bb4ec806300bc7b4a / 13259f170048357f778f88efdb94658f80c485e8`

Status: `DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`

## Objective

以最窄 exact2 forward-only protected-path candidate，使 Python 与 Node readiness validators 原子接受 Mingshuo Confirm Readback exact10 shadow 的唯一第十四 ordered pair，同时保持全部历史身份、排除项、计数、算法和 fail-closed 语义不变。

## Frozen Boundary

- Candidate paths 精确为 `backend/tests/test_six_ministry_readiness_report.py` 与 `scripts/check_harness.mjs`。
- New pair 精确为 runtime `sha256:9e8729a88bc797c01d59818fb67d852025a9c679fdd7eb6e8fe63f26cbc8d365` + successor `sha256:6b9521165b821729a3548f3535b90c30aab9b874c81b1b1b437bb5af64d06e34`。
- Existing thirteen pairs 保持原样和原序；只追加一个 pair，集合差 `+1/-0`，总数十四。
- 四项 exclusions、69/65 计数、历史 review identity、两条 successor-content paths 与 `path + NUL + bytes + NUL` 算法保持不变。
- Exact10 shadow 为 `10 MODIFY / ALL 100644`；bundle `sha256:44bf93000c04c6ae647e9439e46928536698e31b176e5efd152c504683ed85ee`；full-index diff `sha256:6d3465289eb9c517e79a38747ea21164b4e6fbf6b867e9ad79b2320437d25d37`。它仅为 byte donor，不是 candidate。
- Approval `547673fe…` 下的 one-child authority 已由 Owner 处置为 `CONSUMED_BY_STOPPED_SHADOW_ATTEMPT / NO_REANCHOR`，不得恢复、继承或 re-anchor。

## RED To GREEN

1. 保留 exact10 shadow 的两条真实 closed-pair readiness RED，并保留原 approval `v04` 与 `v05` 对相同 root readiness 施加互斥预期的机械证据。
2. 在 exact2 candidate 内新增正向测试，要求 Python 与 Node 同时接受精确第十四 pair。
3. 新增负向测试：只匹配 runtime、只匹配 successor、旧新混搭、顺序交换、未知状态、任一 digest 篡改、未授权第十五 pair、第五 exclusion 与 Python/Node 策略或顺序分叉全部拒绝。
4. 仅在两个 validator 末尾原子追加同一 pair，并把精确 pair count 更新为十四；不修改既有 pair、predicate、exclusions、successor paths 或历史证据。

## Verification Matrix

- 实时远端、治理提交与 candidate 的直接单亲 lineage；approval 三条 `A/100644`，candidate 两条 `M/100644`，工作树 clean。
- 当前十三对与新第十四对 exact `+1/-0`；禁止删除、替换、重排、独立 allowlist、笛卡尔积、单边接受或 validator 分叉。
- `backend/tests/test_six_ministry_readiness_report.py` focused、exact2 Ruff、process-local `TMPDIR=/tmp TEMP=/tmp TMP=/tmp` backend-full。
- Root Harness、self-test、Doctor check/tests、hook self-test、process-local POSIX temp authority regression、V2 check/tests 与 `git diff --check`。
- Governance Review 检查 authority 已消费、no-reanchor、scope 与 forward reissue；Python Review 检查 fingerprint 算法、测试闭合与 exact pair；Security Review 检查 fail-closed、无笛卡尔积、无 exclusion 扩张及无第二 authority。

## Execution Order

1. 严格校验并冻结本三文件，完成独立三审，向 Owner 返回唯一 Packet RFC 8785 canonical digest。
2. Owner 精确确认本包 canonical digest 后，以当前 base 的直接单亲三文件治理提交普通快进落地；不得把 governance-repair 冒充 product authority。
3. 从最新 ext-dev 创建唯一 exact2 candidate，先 RED 后 GREEN，执行完整矩阵与三审；任何失败立即 STOP。
4. 冻结 exact2 identity；仅在后续明确授权且实时远端未漂移时创建最小直接单亲提交并普通快进，绝不 force-push。
5. 基于 exact2 落地后的最新 ext-dev 创建新的 exact10 Product Successor；从当前 shadow donor 重物化十路径，重新执行产品 RED/GREEN、全绿矩阵、三审、fresh machine authority 与 candidate verification。

## Stop Conditions

远端漂移、第三 candidate path、现有 pair 删除/替换/重排、exclusion/计数/算法变化、验证失败、独立审查 P0–P2、恢复前序 exact10 authority、创建第二 authority/事实源、force-push 或生产部署请求，均立即停止对应链路。

## Rollback

治理草案未提交时直接保留为 evidence；exact2 若未推送则不改变远端。若未来已落地 exact2 需要撤回，只允许经过新治理与完整复验的 forward-only inverse，不改写历史、不删除 donor、不放宽 closed-pair 门禁。
