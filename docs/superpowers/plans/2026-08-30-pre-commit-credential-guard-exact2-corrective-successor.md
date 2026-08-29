# Pre-commit Credential Guard Exact2 Corrective Successor Plan

任务：`PRE-COMMIT-CREDENTIAL-GUARD-EXACT2-CORRECTIVE-SUCCESSOR-20260830`

基线：`62b77cc545999af015e7c6d37b611ffd17ab0ab4` / tree `adc7a818011c4997379f9524e97ac9d01928d5d1`

Proposed Approval RFC 8785 canonical digest：`sha256:9b27404ed8326cd1ad102bbe3d35f905a98fdf10ad31cc3b17bead43fd6fde04`

状态：`PLAN_ONLY / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`

## Goal

在不跳过、不替换、不放宽 credential guard 的前提下，消除 security marker value/path 与后续 JSON 字段之间的跨字段误匹配，同时保持所有真实 credential-key assignment 的 staged-diff fail-closed 语义。

## Predecessor Boundary

- Capsule Binding approval `62b77cc5…` 的 one-child authority 已 GO。首次普通 commit 被 hook 阻断后，另一个窗口创建本地 child `c02bb33b999d3b458b14ecb705ca7fe83ab09314`；未 machine verify、未 push。
- Owner 已拒绝该 child：`REJECTED_LOCAL_CHILD / MACHINE_UNVERIFIED / DO_NOT_PUSH / NO_CANDIDATE_IDENTITY / REISSUE_REQUIRED / NO_REANCHOR`；predecessor authority lifecycle 为 `ABANDONED_AFTER_LOCAL_CHILD / REISSUE_REQUIRED / NO_REANCHOR`。
- Owner 保留的旧 exact4 对象级 donor bundle：`sha256:2f6a9d5b5ee2dd07f9539426403e39036e5b9cdcf926878dc1aabde5d7ef87f8`。
- 旧 exact4 combined full-index diff：`sha256:3e06e4b94b0829b2a47891031c41f49e3ec2d62d6f52196f5ef492ac690691ae`；其中 fixture blob `071381d5…` 是主对象库中的 dangling donor，不属于已确认可达 commit。
- `c02bb33b…` 与其改写 fixture 只能作拒绝证据；corrective 不修改它。corrective 落地后必须在最新 ext-dev 全新 reissue，再按冻结 blob/raw/bytes 逐文件重物化旧 exact4 并全量重验。

## Exact Paths

- `frontend/scripts/git-safety-guards.test.mjs`：`100644`，base blob `17e54f018203b8a898531533327128a104d32b30`。
- `frontend/scripts/guard-credential-leak.sh`：`100755`，base blob `9999b9a882b9407525679c91b546f749f9d1b621`。
- Base exact2 bundle：`sha256:fa5eb2179d0b84e079cd0fe46da780659a454d2170d83213ccdc11434954ba2b`。
- Final structure：`0 ADD + 2 MODIFY`；不得出现第三路径或模式漂移。

## RED Phase

1. 在 test 的临时 Git 仓中 staged 一行与原 exact4 安全 fixture 等价的 JSON，保留 marker value/path和长错误码。
2. 运行现有 guard，必须返回非零并精确命中跨字段 false positive。
3. 现有 true-positive assignment 测试继续为 RED/拒绝基线；临时仓、chmod、Git config或 TMP 错误不得冒充。
4. 在真实 staged index 增加 `const E2E_* = ...` allow 与相邻非 allowlist credential reject 对照，禁止扩大 safe pattern。
5. 构造两个真实 parent 与 synthetic `MERGE_HEAD`：single-parent-only 新增 credential-like 行必须不扫描，both-parent-added 真实 assignment 必须拒绝。

## GREEN Phase

1. 收紧现有 pattern，使完整 credential key/identifier 后必须先出现可选闭合引号、空白和 `:`/`=` assignment separator，再匹配 quoted value。
2. 不改变 keyword 集合、不区分大小写、最小 value 长度、允许值字符、staged added-lines 和 merge-parent 交集。
3. 增加 JSON true-positive、普通 value/path/subword false-positive回归；动态构造攻击测试值，禁止真实 credential material。
4. E2E safe 与 merge-parent 用例必须通过真实临时 Git index 验证，不允许 mock、直接调用正则或只比较字符串。
5. focused 与 frontend-full GREEN；普通 pre-commit hooks 自然通过。

## Verification Matrix

- `TMPDIR=/tmp TEMP=/tmp TMP=/tmp node --test frontend/scripts/git-safety-guards.test.mjs`
- `cd frontend && TMPDIR=/tmp TEMP=/tmp TMP=/tmp node --test`
- candidate exact2 direct-single-parent、路径、状态和模式门。
- `git diff --check`
- 根 Harness、self-test、Doctor、hook self-test、`TMPDIR=/tmp` product-authority regression。
- V2 convergence check/tests。
- Shell/JavaScript Review 与 Security Review。

## Non-Goals

不改旧 exact4 对象级 donor、已拒绝 `c02bb33b…`、security fixture、installed Git hook、dispatcher、Git config、Harness、authority、CI、ADR、前端产品或运行时；不新增 allowlist、第二 scanner、secret store、网络调用；不 force-push、Pilot、Release 或部署。

## Review Focus

- Shell quoting 与 ERE 边界在 Bash/GNU grep 环境下确定性一致。
- JSON quoted key、代码 identifier assignment 和 keyword value/path/subword边界无笛卡尔误匹配。
- E2E allow 只覆盖合法 `const E2E_*`，不得覆盖相邻普通 credential；merge-parent 交集由两个真实 parent 与 `MERGE_HEAD` 的临时仓证据闭合。
- 测试以真实临时 Git index证明，不通过 mock 或直接调用正则自证。

## Stop Conditions

远端漂移、machine STOP、RED 非确定性、需第三路径、真实 assignment 变为漏报、fixture/path allowlist、扫描范围或 keyword/value约束放宽、hooks/矩阵失败或审查 P0–P2，立即停止。只允许后续普通 fast-forward，不部署。
