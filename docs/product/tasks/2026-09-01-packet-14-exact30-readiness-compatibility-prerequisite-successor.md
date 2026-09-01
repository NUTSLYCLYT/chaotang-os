# P14 Exact30 Readiness Compatibility Prerequisite Successor

Task ID: `PACKET-14-EXACT30-READINESS-COMPATIBILITY-PREREQUISITE-SUCCESSOR-20260901`

## Status

Draft

`NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`

## Product Definition

本任务是 P14 Trusted Artifact Delivery Gate A exact30 的独立、forward-only readiness compatibility prerequisite。P14 lifecycle-truth approval commit `c6bcaf524fbd6dd5984337b429e279d1791158c8` 曾获得 `GO / APPROVED_FOR_ONE_CHILD`，但在创建产品 child 前，独立复审机械确认 exact30 对应的 65 路径 runtime fingerprint `sha256:32ecf613778ddc625567b08ec4526efbf22c0cd29a8c94fc3b9bacbe4e0dd05e` 与 successor fingerprint `sha256:9d10d2bed258e632c909719f05df50c6b33530d9f40be2458a38dd063fcde3c5` 不在当前九组 closed ordered-pair allowlist 中。该 product authority 因而固定为 `ABANDONED_AFTER_PRE_CHILD_READINESS_COMPATIBILITY_REVIEW / NO_RETRY / NO_INHERITANCE / REISSUE_REQUIRED`，没有 product child，不得恢复、消费或 re-anchor。

本 prerequisite 只允许两个现有 validator 原子追加唯一第十 ordered pair。历史九对、四项 exclusions、69/65 文件计数、历史 review identity、两条 successor-content paths 与 fingerprint 算法必须保持不变。预物化 exact2 仅为 `BYTE_DONOR_ONLY / NO_CANDIDATE_IDENTITY / NO_VERIFICATION_INHERITANCE`；其两文件 bundle 为 `sha256:fd7dc8d7afdec2c99df166cd2cdcb231a0ea72b9bcc65b090845880fd7a5be2c`，combined full-index diff 为 `sha256:58b17810b439e5c5f06be297024d96b7974ed6f912c8e75b4d466680186bad3e`。

独立 TypeScript Review 另发现 exact30 中预注册 CDP/edge observation promise 在触发动作先失败时可能形成未处理 rejection。该 P1 不属于本 exact2 范围；下一份 exact30 Product Successor 必须在新的精确产品 allowlist 内纠正并增加负向测试，旧 exact30 不得原样晋级。

## Acceptance Criteria

- [ ] candidate 精确修改 `backend/tests/test_six_ministry_readiness_report.py` 与 `scripts/check_harness.mjs`，均为 `M / 100644`，无第三路径。
- [ ] 现有九个 ordered compatibility pairs 原样、同序保留；只追加第十 pair，集合差精确为 `+1/-0`，总数精确为 `10`。
- [ ] Python 与 Node validator 表达同一 ordered-pair 策略；单边、混搭、未知、篡改、未授权第十一 pair、第五 exclusion 或策略分叉全部 fail closed。
- [ ] readiness `16 passed`、backend-full、Ruff、Harness、自测、Doctor、hook、authority regression、V2 与 diff check 全绿。
- [ ] exact2 candidate 必须基于本三文件 approval 的直接单亲 child 重新 byte-for-byte 物化；不得继承 donor 验证或 candidate 身份。
- [ ] exact2 落地后，基于最新 ext-dev 新签 P14 exact30 successor，同时关闭 CDP/edge observation promise 清理 P1；旧 exact30 只能作为受审 byte donor。

## Delivery Constraints

- 不修改历史 readiness 报告、四项 exclusions、69/65 计数、review identity、successor-content paths 或 fingerprint 算法。
- 不修改 P14 exact30、发布运行时、前后端产品路径或任何第三路径。
- 不创建第二套 readiness、Harness、authority、事实源或运行时。
- 不 merge、rebase、force-push、Pilot、Release、生产发布或部署。

## Affected Modules

- 模块：六部 readiness Python/Node closed ordered-pair compatibility validators。
- 允许路径：`backend/tests/test_six_ministry_readiness_report.py`、`scripts/check_harness.mjs`。

## Technical Plan

1. 冻结本三文件治理包并等待 Owner 对 canonical digest 的精确确认。
2. 普通 fast-forward 落地 approval 后，从最新 ext-dev 唯一隔离工作区 byte-for-byte 重物化 exact2 donor。
3. 运行 packet 冻结的结构、策略、完整后端与 Harness 验证矩阵，并完成独立 Governance、Python 与 Security Review。
4. 只在全部门禁 GO 后创建直接单亲 exact2 candidate commit并普通 fast-forward 落地。
5. 基于新的 ext-dev 全新签发 P14 exact30 Product Successor；修复已登记的 CDP/edge promise cleanup P1，重新物化、RED/GREEN、完整验证、三审和 machine verify-candidate。

## Implementation Report

exact2 byte donor 已在隔离工作区形成真实 RED→GREEN：第十 pair 缺失测试首先 `1 failed`，最小追加后 readiness `16 passed`。同一字节上 Ruff PASS，backend-full `4549 passed, 4 skipped, 3 warnings`，Harness `146 PASS`、Harness self-test `175 PASS`、Doctor `PASS / STRUCTURE_VALID_NON_AUTHORIZING`、Doctor tests `10/10`、hook `3 PASS`、product-authority regression `12/12`、V2 tests `20 passed / 1 skipped`、`git diff --check` PASS。Packet 冻结的 `verificationSummaryRecords` JSON array 按原序、原字段使用 RFC 8785 canonical UTF-8 bytes 计算 SHA-256，得到 `sha256:e2f13ef2d48413fcca7a4d34eb4b9f4b4824494c537b47c0dabcacc3b5da6781`；该摘要只绑定明确列出的结果记录，不代替原始日志，也不授予 candidate 身份。

## Acceptance Review

待治理包冻结、exact2 重新物化、完整矩阵及独立三审完成后填写。通过只证明第十 ordered pair 被两个 validators 原子接受，不证明 P14 exact30、Gate B、Pilot、Release 或部署完成。
