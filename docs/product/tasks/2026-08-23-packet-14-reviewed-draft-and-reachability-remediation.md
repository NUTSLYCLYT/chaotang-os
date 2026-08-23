# Packet 14 — Reviewed Draft and Reachability Remediation M0 Task

> 状态：`GOVERNANCE_LANDED / SUPERSEDED_BY_V2 / PRODUCT_NOT_ACCEPTED`
>
> Task ID：`PACKET-14-REVIEWED-DRAFT-AND-REACHABILITY-REMEDIATION-V1-20260823`
>
> Proposed manifest digest：`sha256:9698a8f1a854444f440b912ad334070fd4c584c1d8e46a9b471641b3a7cca9ba`

## Frozen identity

- Repository：`gitee.com/msxn/chaotang-os`
- Target：`origin/ext-dev`
- Base commit/tree：`56488ba001796103653ae68f4ac9a2d9dacde89b` /
  `2ece2188d47430e6dc1049859b2bd33b2d0150a1`
- Reachability amendment：`docs/migrations/2026-08-23-packet-14-prepush-reachability-amendment.draft.md`
- Amendment raw SHA-256：`d3b6671b3a7601fc6ed7fc0771dfef00bb57d5fdc03f52467cecbabab7d82b6a`
- Scope：approval manifest 中精确排序的原 P14 30 条产品路径。

## Goal

在不新增产品路径、生产开关、模型/provider 配置或第二事实源的前提下，完成两类纠正：

1. 修复原 P14 独立 review 发现的下载清理、management 唯一绑定、SQLite activation、BFF bounded fetch、客户端
   artifact/work-product/receipt splice 与伪 pre-push PASS；
2. 按已落地主线的 reachability amendment，把证明拆为同一 candidate-bound 的 `P14-REALSTACK`、
   `P14-GENERATION` 与 `P14-DELIVERY-BROWSER`，使用 v2 closed wire 和一次性 delivery fixture，禁止把 fixture 冒充
   generation PASS。

本工作包只形成经过完整复审的最终产品字节和待登记六部 fingerprints；Root Harness 在独立 successor compatibility
治理包落地前继续失败关闭。因此本包不形成可接受、可推送的产品 candidate。

## Required remediation

### Artifact safety

- `StreamingResponse` 生命周期拥有幂等 `download.close()`；未开始消费、disconnect、send failure、timeout 与正常完成均释放
  lease、owner、reserved bytes、spool 和 FD。
- application 与 V2 trigger 同时要求 `report_type=management`、有效绑定数恰一且总绑定数恰一；直接 SQL、cross-run、
  PENDING/ABORTED、tamper 与历史非法行失败关闭。
- migration/DDL 前闭合 DB 文件及所有 ancestors 的 symlink/nlink/owner/mode/identity，并在事务前后重验。
- BFF 传播入站 abort、设置 header/body/total deadline 与响应 cap；cancel rejection 仍返回稳定脱敏错误。
- 前端 parser 逐字绑定请求 artifact ID、外层 work product/version、receipt 序列与身份，任何 splice 失败关闭。

### Three independent proofs

- `P14-REALSTACK`：同一 candidate OCI backend/frontend/caddy 的 identity、只读 rootfs、临时 data、health/readiness、
  registry digest 和 cleanup；不声称模型调用或新产物生成。
- `P14-GENERATION`：锁定 candidate wheel/source/runtime 的 synthetic acceptance 真实经过 draft authority、accept、async worker、
  accounting generation、archive、publish 与 owner-filtered read；synthetic provider 不进入产品或浏览器证据。
- `P14-DELIVERY-BROWSER`：真实 Chromium 经 runner-owned loopback edge 使用 candidate UI/API；owner A/B 真实注册登录，
  一次性 non-root seed container 只在全新 temp root 写一个 PUBLISHED management workbook fixture；浏览器完成 v2 14-action
  resume/download/confirm/refresh/duplicate/inverse/cross-owner journey，runner 独立重验 poststate、privacy、PNG/console 与 cleanup。

### Honest evidence

- PASS 只能由 runner 对实收 artifact bytes、自有 authoritative ledger、candidate poststate、privacy canary 与实际 cleanup 派生；
  client 不得提交 PASS、ledger、path、filename、URI、manifest 或摘要声明。
- v1/v2 session、receipt、manifest、ledger、round 双向拒收；provisional/final schema、root 和 filename 完全分离。
- fixture marker、preimage/postimage、host/container binding、consumption 与 stdout 严格继承 amendment 的 closed schema、权限、
  一次性消费、no-network、单 writer、identity 和销毁规则。
- cross-language registry evidence 绑定 candidate wheel、commit/tree 与唯一 canonical digest，不以宿主 `runpy` 或源码搜索代替。

## Acceptance and staged governance

1. Owner 精确接受本三件套 canonical digest，且 approval commit 成为未漂移的 `origin/ext-dev` 远端头前，产品保持 STOP。
2. exact Task ID 的 `product-authority.m0.v1 --authorize` 返回 GO 后，才可在 30 路径内重放并修复 reviewed draft。
3. focused/full backend、Ruff、frontend full、release regressions、三份真实证据和独立 code/Python/TypeScript/security review
   必须通过；只允许六部 current/successor fingerprint 两项保持预期失败，任何其它失败立即停止。
4. 复审达到 P0=P1=P2=P3=0 后冻结最终 successor pair 与 current-content fingerprint；当前被拒绝草稿的
   `45cf2d7e…` / `0752030b…` 禁止登记。
5. 另立六部 successor compatibility governance 包，仅修改
   `backend/tests/test_six_ministry_readiness_report.py` 与 protected `scripts/check_harness.mjs`，双处绑定同一最终指纹，
   并继续拒绝 partial/unknown third state。
6. compatibility 落地主线后，另立最终 P14 M0，byte-for-byte 重放 reviewed draft；完整 Harness/doctor/V2、机器 candidate
   verification 和三份真实证据全绿后，才请求 Owner 产品 candidate commit/push 决策。

## Stop conditions

- remote/base/tree/amendment SHA/approval digest/exact 30 paths/authority 任一不符；
- 需要第 31 条产品路径、新表/列/API/format/ledger、生产开关、真实模型、公网、secret 或生产数据；
- fixture 被算作 generation、client 仍能铸造 PASS、任一真实证明/identity/privacy/cleanup 缺失；
- Root Harness、安全不变量、三证据分工或独立 review 被放宽；
- 未独立授权的 product commit/push/merge/release/deploy 或外部副作用。

## Rollback

本三件套未提交时可直接丢弃，不影响任何用户工作树。后续 reviewed draft 仅保存在隔离工作树；compatibility 与最终产品
各自使用独立单亲候选。activation 后不得 full revert V2、恢复旧 writer 或覆盖新 receipt，只能另批 forward-compatible child。

## Current decision

`SUPERSEDED_BY_V2 / PRODUCT_NOT_ACCEPTED`。Owner 已精确接受本任务的治理 manifest，三件套已作为提交
`49634a4a857e1c29ff1819ca0fd661f4ca5fa148` 落地主线；V1 因完整取消传播需要额外两个既有 BFF 路径而停止，未形成、
提交、推送或接受产品 candidate。产品后续由 V2 或其获批 successor 管理，本文件不授权新的产品施工或现实副作用。

## Status

Blocked

`SUPERSEDED / GOVERNANCE_LANDED / PRODUCT_IMPLEMENTATION_NOT_ACCEPTED`。本节只修复任务模板完整性，不改变历史批准范围、
产品路径或验收标准。

## Product Definition

产品定义仍是本文件 `Goal` 与 `Required remediation` 中冻结的 P14 artifact safety、bounded BFF、三份独立证明和诚实证据
闭环。V1 只允许 approval manifest 中 exact30；不新增 API、数据库结构、事实源、生产开关或第31条产品路径。

## Acceptance Criteria

- [ ] exact30 内的全部安全不变量、三份真实证明、完整测试矩阵和独立复审通过；不得以静态 fixture 或客户端自报代替。
- [ ] 最终 successor fingerprints、Root Harness、candidate verification 与 Owner candidate 决策完成。
- [x] V1 在发现 BFF cancellation 需要范围外路径时按 stop condition 终止，并由 V2 successor 接管。

## Delivery Constraints

- 本任务历史批准只覆盖 approval manifest 的 exact30，且禁止第31路径、产品 commit/push/merge/release/deploy。
- 本次模板修复是治理字节变更，不追认任何产品实现，也不允许复用 V1 approval 施工。
- 若这些任务文档作为新提交落地主线，既有 one-child approval 的远端头约束将发生变化，必须重新走 successor
  task/plan/approval 与 Owner 精确摘要确认；不得把格式修复解释为产品 GO。

## Affected Modules

- 模块：P14 artifact safety、BFF bounded fetch、真实三证据与离线 release 验证。
- 允许路径：严格等于 V1 approval manifest `request.productPaths` 的 exact30。
- 依赖模块：Root Harness、product authority、六部 successor compatibility。

历史产品影响面严格等于
`.harness/approvals/PACKET-14-REVIEWED-DRAFT-AND-REACHABILITY-REMEDIATION-V1-20260823.json` 的 exact30。
本次 Phase 1 只修改本任务文档，不修改其中任何产品模块或 approval manifest。

## Technical Plan

历史技术顺序保持不变：先在 exact30 内建立 RED，闭合 artifact/storage/BFF/parser 安全，再生成同一 candidate-bound 的
REALSTACK、GENERATION、DELIVERY-BROWSER 三证据，完成全量验证与独立复审，最后另立 compatibility 和最终 M0。
V1 在需要第31路径时停止，没有继续越界实施。

## Implementation Report

- 治理三件套已落地，产品实现未落地主线。
- V1 隔离产品草稿没有形成可接受 candidate；发现 cancellation reachability 缺口后未把范围外修改混入 V1。
- V2 已作为 successor 扩展为 exact32；本文件不声称 V2 或最终 P14 已完成。

## Acceptance Review

结论：`NOT_ACCEPTED / SUPERSEDED`。V1 没有完成三份真实证明、最终 fingerprints、完整 Harness 或 candidate acceptance，
因此不能作为已交付产品或 release evidence。历史停止决定正确，后续只能由新的精确治理链继续。
