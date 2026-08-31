# Packet 14 — Work-Product BFF Cancellation Exact2 Prerequisite Successor

## Status

Draft

Task ID: `PACKET-14-WORK-PRODUCT-BFF-CANCEL-EXACT2-PREREQUISITE-SUCCESSOR-20260901`

## Product Definition

在当前 canonical `ext-dev@976393db991c480b8cf733b4184b4cc0f9584bc6` 上，前向落地 P14 V4 明确隔离的 work-product BFF exact2 前置：限制 artifact ID 为至多 256 个 UTF-8 bytes，把浏览器请求的 `AbortSignal` 传入现有 backend client 调用，并让所有响应显式 `private, no-store`。

本前置只建立边界与取消信号传递点。`frontend/src/lib/backendClient.ts` 中的完整 timeout/cap/cancel 实现仍属于后续 P14 exact30；本 exact2 不宣称 P14、下载链、确认链或 release acceptance 已完成。

## Acceptance Criteria

- [ ] approval commit 是基线的直接单亲子，且只包含三份治理文件。
- [ ] machine authority 只授权一个 exact2 产品 child。
- [ ] candidate 精确 `2 MODIFY / 0 ADD`，模式均为 `100644`，无第三路径。
- [ ] 两文件 byte-for-byte 等于冻结 donor raw/blob/bytes；bundle 为 `sha256:7d6eb6471c2d7a4c2be9a988f4b529a9ab7b5fbfa83c974419728868d925d5fa`，full-index diff 为 `sha256:c40b12b29529b110f86b070b686e40eee7d554bab440c67928f1b77c96c3a539`。
- [ ] 缺 session、超 256 UTF-8 bytes ID 和 backend error 均 fail-closed；请求 signal 精确传递，sanitized response 不泄露 session/owner/backend。
- [ ] focused、frontend full test/lint/typecheck/build、Harness、Doctor、authority regression、V2 与 diff check 全绿。
- [ ] Governance、TypeScript 与 Security 独立复审均无 P0–P2，machine `--verify-candidate` PASS 后才允许普通快进。

## Delivery Constraints

- 历史 exact32 worktree `p14-v3-r2-product-20260824` 仅为 `BYTE_DONOR_ONLY / NO_CANDIDATE_IDENTITY / NO_VERIFICATION_INHERITANCE / NO_REANCHOR`。
- 旧 P14 approvals、GO、candidate、tests、reviews 和 release evidence 全部不得继承。
- 不修改 backend client、backend、Harness、authority、readiness、exact30、pilot 或 release runner。
- 不 merge、cherry-pick、rebase、force-push、发布、Pilot 或部署。
- product authority 前后必须使用固定 Gitee URL、`/tmp` 非仓库 cwd、禁用 global/system Git config、拒绝 local include/includeIf、`url.*.insteadOf`、`core.sshcommand`，并以 `/usr/bin/ssh -F /dev/null` 只读确认远端精确等于 approval commit。
- 本前置落地后，P14 仍为 `PRODUCT_STOP`，直到最新基线上的 exact30 与 candidate-external supervisor 分别完成合法闭环。

## Affected Modules

- 模块：Next.js report work-product BFF request boundary。
- 允许路径：`frontend/src/app/api/report-artifacts/[id]/work-product/handler.ts`；`frontend/src/app/api/report-artifacts/[id]/work-product/route.test.ts`。

## Technical Plan

1. 三文件治理 approval 基于 `976393db / 13b0d855` 落地并普通快进。
2. machine authority GO 后，从 approval commit 创建唯一干净 candidate worktree。
3. 从 donor 只读核对并 byte-for-byte 重物化 exact2；不得复制其余 30 条 dirty bytes。
4. 运行 manifest 冻结矩阵与 Governance/TypeScript/Security 三审。
5. machine `--verify-candidate` 只运行一次；PASS 且三审 GO 后普通快进，不部署。

## Implementation Report

只读审计确认当前两条主线 preimage 与历史 donor 的 preimage 相同；donor final bytes 为：

- `handler.ts`：raw `sha256:6f157d070e01d5caac2cc9738f3787c7cac529f57355714d918100c586c14988`，blob `471e34f994a4b06e9e602a79095f36deac72956a`，2020 bytes。
- `route.test.ts`：raw `sha256:bab4f5d6cfec93c03fab9e4e2c5ffda0ded3e6725e83180438c6cfe14ad78b2e`，blob `f8a0b8cb388de74776f8705326c0f2c4a0a2bbd6`，2442 bytes。

当前未运行 product authority、未创建产品 candidate、未推送或部署。

## Acceptance Review

Pending。Owner 的持续推进授权允许形成并验证最小治理/产品批次，但 machine STOP、scope drift、第三路径、验证失败或独立 P0–P2 均优先停止。本 exact2 不能冒充 P14 完成或 release 资格。
