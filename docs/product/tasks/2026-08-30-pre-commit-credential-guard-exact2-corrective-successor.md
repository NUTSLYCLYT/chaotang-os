# Pre-commit Credential Guard Exact2 Corrective Successor

任务 ID：`PRE-COMMIT-CREDENTIAL-GUARD-EXACT2-CORRECTIVE-SUCCESSOR-20260830`

冻结基线：`origin/ext-dev@62b77cc545999af015e7c6d37b611ffd17ab0ab4`

冻结 tree：`adc7a818011c4997379f9524e97ac9d01928d5d1`

Proposed Approval RFC 8785 canonical digest：`sha256:9b27404ed8326cd1ad102bbe3d35f905a98fdf10ad31cc3b17bead43fd6fde04`

## Status

Draft

细分状态：`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`

## Product Definition

本任务是《朝堂能力协议 V1》Capsule Binding exact4 在普通 candidate commit 阶段暴露出的 forward-only pre-commit 合同纠偏后继。exact4 产品字节已通过 RED/GREEN、完整矩阵和独立三审，但现有 credential guard 把安全 fixture 中作为**值或路径片段**出现的攻击标记，与同一 JSON 行后续的长错误码跨字段拼接，误判为 credential assignment，导致普通 commit hook 确定性失败。

本 successor 只收紧现有 scanner 的 assignment 语法边界，并扩充其现有行为测试。它不得跳过、禁用或替换 guard；不得给安全 fixture、路径或文件类型加豁免；不得修改 fixture 来躲避扫描；不得降低真实 credential-like assignment 的检测能力；不得创建第二个 scanner 或 secret store。

## Predecessor Disposition

- predecessor approval：`62b77cc545999af015e7c6d37b611ffd17ab0ab4` / tree `adc7a818011c4997379f9524e97ac9d01928d5d1`。
- predecessor task：`CHAOTANG-CAPABILITY-PROTOCOL-V1-CAPSULE-BINDING-SUCCESSOR-20260829`。
- predecessor machine authority：`GO / APPROVED_FOR_ONE_CHILD`，approval digest `sha256:375c49f320905f34d5e1ec4c8c447ae146d04d86f82281aa69aeb6a773ee8844`。
- exact4 首次普通 commit 尝试被 credential guard 阻断；此后另一个写入窗口改写安全 fixture 并从 predecessor approval 创建了本地 child `c02bb33b999d3b458b14ecb705ca7fe83ab09314`。该 child 未运行 machine candidate verification、未 push、未 Pilot、未 Release、未部署。
- Owner 已明确拒绝该本地 child；child disposition：`REJECTED_LOCAL_CHILD / MACHINE_UNVERIFIED / DO_NOT_PUSH / NO_CANDIDATE_IDENTITY / REISSUE_REQUIRED / NO_REANCHOR`。predecessor authority lifecycle：`ABANDONED_AFTER_LOCAL_CHILD / REISSUE_REQUIRED / NO_REANCHOR`。
- 本 successor 的 approval commit 将使远端离开 predecessor approval；该生命周期结果已由 Owner 明确确认，不构成采纳、推送或继承 `c02bb33b…`。
- predecessor exact4 字节、验证和审查只作 donor evidence，不具有 candidate、通过、authority 或可继承身份。

## Deterministic Root Cause

现有 `frontend/scripts/guard-credential-leak.sh` 对 staged added lines 使用 credential keyword 后跟最多十五个非字母数字字符、再跟长引号值的模式。它没有要求 keyword 后出现同一 credential key 的 `:` 或 `=` assignment separator，因此会从一个值或路径中的 keyword 开始，跨过 JSON 结构标点，把后续 `expected_error` 长字符串误当作 credential value。

首次阻断精确命中三个既有安全负例：OTel raw prompt 泄漏、POSIX 路径逃逸和 Unicode 路径混淆。它们不含真实凭据，也不得被删除、改弱、拆行规避或加入 allowlist。

## Frozen Exact2 Base Identity

候选范围固定为 `0 ADD + 2 MODIFY`：

| Path | Mode | Base Git blob | Base raw SHA-256 | Bytes |
| --- | --- | --- | --- | ---: |
| `frontend/scripts/git-safety-guards.test.mjs` | `100644` | `17e54f018203b8a898531533327128a104d32b30` | `sha256:02d533dee4d3744de421e49831485d7a5eee6c0e0f1f1469680787a73756d5b2` | 3005 |
| `frontend/scripts/guard-credential-leak.sh` | `100755` | `9999b9a882b9407525679c91b546f749f9d1b621` | `sha256:dff7f5cf98c5c8e242caddde07616aabab7232997f726476eac952e804e11170` | 1520 |

Base exact2 bundle：`sha256:fa5eb2179d0b84e079cd0fe46da780659a454d2170d83213ccdc11434954ba2b`。

## Frozen Exact4 Donor Evidence

原 exact4 工作区：`/home/ubuntu/Projects/chaotang-os/.worktrees/chaotang-capability-protocol-v1-capsule-binding-successor-candidate-20260829`。该工作区当前 clean 且位于已拒绝的 `c02bb33b…`，不再持有下表全部旧 donor 字节，不得作为 candidate 来源。

Owner 确认保留的旧 exact4 是对象级 byte-donor manifest；四条路径均为 `M / 100644`，无第五路径：

| Path | Git blob | Raw SHA-256 | Bytes |
| --- | --- | --- | ---: |
| `docs/contracts/six-ministry-capability-execution.md` | `067a3230a15b21daeb78493d04d27288ce6e56da` | `sha256:6dc1f6e676fba5a28ce9615845177c86b193f70ecc0883042319747d6c04b67c` | 6567 |
| `docs/contracts/six-ministry-capability-execution.schema.json` | `885ed960b409dd792f87e1b5917601c54ab4aba1` | `sha256:89ce12b623881ebec6f49b8af30e18337c510ddb1630d8a51d69ab284c8c65a4` | 12652 |
| `scripts/fixtures/six-ministry-execution/security-cases.json` | `071381d5426ffb5f8a730278444d9352e50232fd` | `sha256:0c3fbe070863a5333a903e2b8ff7fd2f1c55bec3a207ae0cc771d698c81b9e53` | 16238 |
| `scripts/six_ministry_execution_contract.test.mjs` | `bd3092c82305864071ffa5ec85969a541899e267` | `sha256:76ac0acaf71de443ffdea678c2a82e7208036a8a7dcb3d875f1e125253c363b6` | 26043 |

- exact4 bundle：`sha256:2f6a9d5b5ee2dd07f9539426403e39036e5b9cdcf926878dc1aabde5d7ef87f8`。
- exact4 combined binary full-index diff：`sha256:3e06e4b94b0829b2a47891031c41f49e3ec2d62d6f52196f5ef492ac690691ae`。
- fixture blob `071381d5…` 当前存在于主仓对象库但不属于任何已确认可达 commit；它是显式 dangling byte donor。其余 blob 也只能按上表 blob/raw/bytes 机械核验，不能从 `c02bb33b…` 继承身份。
- `c02bb33b…` 及其被改写 fixture 只作被拒绝历史证据，禁止 push、cherry-pick、adopt、re-anchor 或验证继承；本 corrective 不修改该 child 或原 exact4 工作区。
- exact2 落地主线后，必须基于届时最新 ext-dev 重新签发 Capsule Binding successor，再从对象库或经 raw SHA 复核的字节源逐文件 byte-for-byte 重物化上表 exact4，并重新执行 RED/GREEN、完整矩阵和独立三审。

## Affected Modules

- 模块：Git pre-commit credential guard、前端脚本安全回归。
- 允许路径：`frontend/scripts/git-safety-guards.test.mjs`、`frontend/scripts/guard-credential-leak.sh`。

## Technical Plan

1. 新 approval 落地并取得 machine GO 后，从精确 approval commit 建立唯一 clean candidate 工作区。
2. 在现有 guard test 中物化确定性 false-positive fixture：同一 staged JSON 行保留 OTel raw prompt 标记、POSIX traversal path、Unicode traversal path及长 `expected_error`，证明当前 guard RED。
3. 保留并加强 true-positive fixture，覆盖代码 assignment 与 JSON credential-key assignment；测试数据只在临时 Git 仓动态构造，不把真实 credential 或可复用 credential literal写入仓库。
4. 仅收紧 scanner pattern：credential keyword 必须是完整 key/identifier，并在可选闭合引号与空白后出现同一 assignment separator `:` 或 `=`，之后才允许匹配长 quoted value。
5. 在真实临时 Git index 中新增 E2E safe 边界测试：合法 `const E2E_* = ...` staged added line 必须继续允许；同一临时仓相邻的非 E2E allowlist credential assignment 必须继续拒绝，证明 safe pattern 没有吞掉普通 credential。
6. 在真实临时 Git 仓构造两个 parent 和 synthetic `MERGE_HEAD`，证明 guard 对各 parent 的 staged-added-line 集合取交集：仅相对单一 parent 新增的 credential-like 行不得误报；相对两个 parent 共同新增的真实 credential assignment 必须拒绝。
7. 禁止通过 fixture/path/filetype allowlist、排除 test 文件、缩短最小 value 长度、删除 keyword、拆行或改变 staged-diff、E2E safe、merge-parent 交集语义取得 GREEN。
8. 在 POSIX temp 环境重跑包含上述真实 Git-index 用例的 focused guard tests、全部 frontend Node tests、普通 commit hooks、根 Harness/Doctor/Authority/V2 矩阵和 diff check。
9. 完成独立 Shell/JavaScript Review 与 Security Review；任一 P0–P2 为 NO-GO。
10. exact2 candidate commit 必须为 approval commit 的直接单亲子；hooks 必须自然通过，machine verify-candidate PASS 后才可普通 fast-forward push。

## RED And Security Negatives

- RED 必须精确证明现有 scanner 会把 security marker value/path 与后续错误码跨字段拼接；环境、Git 初始化或临时目录失败不得冒充 RED。
- GREEN 必须接受上述三类安全 fixture，同时继续拒绝 Python/JavaScript/shell-style assignment 与 JSON credential-key assignment。
- `password`、`passwd`、`api_key`、`api-key`、`secret` 及中文 credential keyword 的现有不区分大小写语义不得减少。
- 值最小长度、允许字符集合和 staged-added-line 范围只能原样保留或更严格，不得放宽。
- E2E safe 语义必须由真实 staged line 证明：合法 `const E2E_* = ...` 允许，相邻非 allowlist credential assignment 拒绝；不得仅以字符串/正则单测自证。
- merge-parent 交集语义必须由带两个真实 parent 与 synthetic `MERGE_HEAD` 的临时 Git 仓证明：single-parent-only 新增行不扫描，both-parent-added 真实 credential assignment 拒绝。
- keyword 作为普通值、路径片段、错误码或较长普通 identifier 的子串时不得误报；作为真实 key/identifier assignment 时必须命中。
- guard 自身仍是唯一事实源；不得新增第二 parser、第二 scanner、动态网络查询或 secret service。

## Delivery Constraints

- Candidate 必须精确为 `0 ADD + 2 MODIFY`；test 保持 `100644`，guard 保持 `100755`。
- 不修改旧 exact4 对象级 donor、已拒绝 `c02bb33b…`、security fixture、installed `.git/hooks`、dispatcher、Git config、Harness、authority、CI、ADR、前端 UI或运行时。
- 不使用 `--no-verify`、环境变量禁用、局部 allowlist、路径排除或格式逃逸。
- 不读取、生成、输出、持久化或提交真实 credential。
- 不继承 predecessor exact4 authority、candidate、验证或审查身份。
- 不 Pilot、不 Release、不发布、不部署。

## Acceptance Criteria

- [ ] Proposed approval 精确绑定 `62b77cc5… / adc7a818…`、三条 approval paths和 exact2 product paths。
- [ ] 现有 security fixture 跨字段 false positive 形成真实 RED，exact pattern correction 后 GREEN。
- [ ] 真实代码与 JSON credential assignment 继续 fail-closed；keyword value/path/subword 不误报。
- [ ] 真实 Git-index E2E safe 与双 parent 交集测试通过，且相邻普通 credential 与共同新增 credential 仍 fail-closed。
- [ ] Candidate 精确为 `0 ADD + 2 MODIFY`，模式分别为 `100644 / 100755`，无第三路径。
- [ ] focused、frontend-full、普通 hooks、根 Harness/Doctor/Authority/V2及 diff check全部通过。
- [ ] Shell/JavaScript 与 Security 双审均为 `GO / P0=0 / P1=0 / P2=0`。
- [ ] machine verify-candidate PASS 后才允许普通 fast-forward push；不部署。
- [ ] exact2 落地后，Capsule Binding exact4 基于最新 ext-dev 全新 reissue；`c02bb33b…` 禁止 push/继承，旧四文件只能按冻结 blob/raw/bytes 重物化并重验。

## Implementation Report

尚未实施。本轮仅冻结 corrective successor 治理草案。Owner 选择的旧 exact4 对象级字节和历史验证/三审仅为 donor evidence；`c02bb33b…` 是被拒绝且 machine-unverified 的本地 child，不具有 candidate、通过或可继承身份。

## Acceptance Review

待正式 approval、machine GO、exact2 RED/GREEN、完整矩阵、双独立审查、自然 hooks 通过与 machine candidate verification 后填写。本草案不授权产品施工、commit、push 或部署。

## Dependency DAG

`62b77cc5 Capsule Binding approval (GO)` → `local child c02bb33b (Owner rejected / machine-unverified / do-not-push)` → `credential-guard exact2 corrective approval` → `exact2 candidate` → `natural hooks + machine verify` → `FF push` → `new Capsule Binding exact4 successor` → `old object-level donor byte-for-byte rematerialization + full revalidation`。

## Stop Conditions

远端漂移、machine STOP、真实 RED 不能稳定复现、需第三路径、需修改 fixture/installed hook/Harness/authority、真实 assignment 逃逸、fixture/path allowlist、guard 范围被放宽、任何验证失败或独立审查出现 P0–P2，立即 STOP。禁止 force-push、Pilot、Release、发布与部署。
