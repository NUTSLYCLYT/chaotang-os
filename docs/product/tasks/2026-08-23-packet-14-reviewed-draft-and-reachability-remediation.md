# Packet 14 — Reviewed Draft and Reachability Remediation M0 Task

> 状态：`M0_APPROVAL_DRAFT / NOT_LANDED / PRODUCT_STOP`
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

`PENDING_OWNER_M0_DECISION / PRODUCT_STOP`。本文件不表示 Owner 已接受上述 exact manifest digest，也不授权任何提交、
推送、产品施工或现实副作用。
