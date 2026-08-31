# P04 Shiguan Outcome Readiness Compatibility Prerequisite Successor

Task ID: `P04-SHIGUAN-OUTCOME-READINESS-COMPATIBILITY-PREREQUISITE-SUCCESSOR-20260831`

## Status

Draft

`NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`

## Product Definition

本任务是 P04 authenticated Outcome exact12 的独立、forward-only readiness compatibility prerequisite。P04 exact12 已形成有效 RED→GREEN 与 focused 证据，但 backend-full 精确停在 six-ministry closed compatibility pair：当前 65 路径 runtime fingerprint 为 `sha256:eb0d8d214c2dc51ca4eb37ce5a13423e424fd6fdd3b6b8c3dac6a5f5757bd2df`，successor fingerprint 为 `sha256:709ebaf18862a4c2d78422756ca1e353eeb8dd5925c624ee74d9ebdaf43cc924`。本包只允许两个现有 validator 原子追加该唯一 ordered pair，不修改历史 readiness 报告、exclusions、文件计数或产品字节。

旧 P04 product authority `GO / APPROVED_FOR_ONE_CHILD` 尚未被 candidate commit 消费；因 exact12 approval 未包含 readiness validators，本次产品尝试固定为 `STOP / APPROVAL_SCOPE_CONTRADICTION / BYTE_DONOR_ONLY`。依据 Owner 的常驻连续推进授权，旧 one-child authority disposition 为 `ABANDONED_BY_OWNER_STANDING_AUTHORIZATION_UNCONSUMED / REISSUE_REQUIRED`，不得消费、恢复、继承或 re-anchor。prerequisite 落地后必须基于届时最新 ext-dev 全新签发 P04 exact12 product successor，并 byte-for-byte 重物化和完整复验。

为彻底排除 exact2 同文件自证放宽，已在隔离工作区预物化一份无 candidate 身份的 validator byte donor：两文件 bundle `sha256:8066b455294e0a2eaa453efb4fcf84c9779144de0e950da1186a13d3e5f9351f`，combined full-index diff `sha256:4325efe5e148d6b120f194c420be562034e814b41025855ef972bbc34ebac28b`。未来 candidate 必须从最新治理 approval 基线 byte-for-byte 重物化该 exact2；任何字节差异立即 STOP。

## Acceptance Criteria

- [ ] candidate 精确修改 `backend/tests/test_six_ministry_readiness_report.py` 与 `scripts/check_harness.mjs`，均为 `100644`，无第三路径。
- [ ] 现有六个 ordered compatibility pairs 原样、同序保留；只追加第七 pair，集合差精确为 `+1/-0`。
- [ ] Python 与 Node validator 字节级表达同一 ordered-pair 策略，不形成独立 allowlist、笛卡尔积或单边接受。
- [ ] packet-owned、Owner 控制执行的闭合命令矩阵冻结历史六对原序、第七对、两侧四 exclusions、两 successor paths、69/65 计数、review identity、Python fingerprint/membership AST、受保护名称唯一绑定，以及 Node fingerprint/predicate、完整 readiness gate、repository error sink、STATIC_POLICY_GUARDS 注册、validateHarness 传播与 main 调用；除 pair 常量和对应负向测试外拒绝其他源码变换。并验证 candidate 是治理 approval 的直接单亲 exact2 `M/100644` child，且该父提交精确等于隔离 Git 配置后的 live `origin/ext-dev`。仓库当前不存在 `governance-repair.packet.v1` machine runner，本矩阵不得冒充 product-authority machine-enforced verification。
- [ ] 仅 runtime、仅 successor、旧新混搭、非法第三状态、pair 任一字节篡改、未授权第八 pair 与第五 exclusion 全部 fail closed。
- [ ] candidate HEAD tree 与工作树的两文件 raw SHA、Git blob、mode、bytes、bundle 必须精确等于 packet 冻结的 byte donor identity；full-index diff 必须在隔离 Git/attribute 配置并禁用 external diff/textconv 后等于冻结摘要。byte donor 不继承 candidate、验证或通过身份。
- [ ] readiness、backend-full、Harness/self-test/doctor、authority regression、V2、diff check 与独立治理/安全审查全绿。

## Delivery Constraints

- 不修改 `docs/migrations/2026-08-14-six-ministry-runtime-readiness.json`、历史 review identity、69 文件清单、四项 exclusions、65 路径计数或两条 successor paths。
- 不修改 P04 exact12 donor 工作区或任何产品运行时；不继承其 candidate、验证、审查或 authority 身份。
- 不创建第二套 readiness、Harness、authority、事实源或运行时。
- 不 merge、rebase、force-push、Pilot、Release、发布或部署。

## Affected Modules

- 模块：六部 readiness Python/Node closed ordered-pair compatibility validators。
- 允许路径：`backend/tests/test_six_ministry_readiness_report.py`、`scripts/check_harness.mjs`。

## Technical Plan

1. 冻结本三文件治理包并普通 fast-forward 落地。
2. 从最新 ext-dev 创建唯一隔离 candidate，将唯一第七 pair 原子追加到两个 validators。
3. 由治理 packet 自身携带不可由 exact2 自证放宽的结构、远端父身份与 ordered-pair policy verifier；冻结 Python/Node 实际 fingerprint、ordered-pair predicate 和生产调用点相对 parent 不变，并以保证不同字符的临时篡改证明单边、混搭、额外 pair/exclusion 与策略分叉 fail closed，再运行完整矩阵。该闭合命令矩阵由 Owner 控制执行，不声称由当前 product-authority runner 自动消费。
4. 双审 GO 后只提交两条 validator 路径并普通 fast-forward 落地。
5. 基于新的 ext-dev 重签 P04 exact12 product successor；旧 exact12 只作 byte donor，必须重新物化、验证、审查与 machine authority。

## Implementation Report

尚未实施。本轮 P04 exact12 focused 为 `335 passed`，backend-full 为 `4535 passed, 4 skipped, 1 readiness closed-pair failed`；该失败是确定性 approval-scope contradiction，不是 P04 Outcome 功能回归。当前 exact12 combined full-index diff SHA-256 为 `sha256:80c750a5b0e592840f38bd6e0b882fee48a016614bad4405bb64c97763de47a4`，仅作 predecessor byte evidence。

## Acceptance Review

待 governance package、exact2 candidate、完整矩阵与独立审查完成后填写。通过只证明第七 ordered pair 被两个 validators 原子接受，不证明 P04 exact12、Pilot、Release 或生产部署完成。
