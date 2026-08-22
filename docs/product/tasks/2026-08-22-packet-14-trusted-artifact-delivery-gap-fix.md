# Packet 14 — Trusted Artifact Delivery Gap Fix M0 Task

> 状态：`M0_CANDIDATE / NOT_LANDED / PRODUCT_STOP`
>
> Task ID：`PACKET-14-TRUSTED-ARTIFACT-DELIVERY-GAP-FIX-V1-20260822`

## Status

Draft

## Product Definition

修复 ext-dev 已有会计 XLSX 产物纵切的安全缺口：只有同 owner、同 run、真实 PUBLISHED、digest 与唯一
management manifest 一致的 WorkProduct 才可由本人作一次终局确认；下载使用有界、验证后流式交付；公开
receipt 不泄露 actor_ref；P14 V2 trigger 纳入 P15 唯一 runtime-data registry。不是新产物平台、上传系统或第二 ledger。

固定身份：

- Repository：`gitee.com/msxn/chaotang-os`
- Target：`origin/ext-dev`
- Base commit：`0af8f2c833c5337199902f7f64461872904a70cc`
- Base tree：`d54ae79ac097be2d038cecce1d376ce03ec08611`
- Contract：`docs/migrations/2026-08-21-packet-14-trusted-artifact-delivery-contract.draft.md`
- Contract SHA-256：`e5584434a25244b2f5230be3b9cffdeba9e08f738e3893d7af3ae764d0700c8b`
- Accepted P09-A product：`91e2c986509b1abb5c15d0a05a5268c9cae7b6ff`
- Accepted P15 product：`fa3cc24e49703bb61b4ac0dfaf9c1cc41f00d14e`

## Acceptance Criteria

- [ ] 合同15个 mandatory nodes 全部 PASS，任何 FAIL/BLOCKED/NOT_RUN 均停止。
- [ ] PENDING、ABORTED、cross-run、digest drift 与伪 actor 均零 receipt；PUBLISHED exact binding 只允许一个终局决定。
- [ ] 64 MiB 有界下载、稳定 FD、process/owner lease、same-origin raw parsers、公开 DTO 脱敏和 PUBLISHED-only UI 全绿。
- [ ] P14 V2 trigger、P15 registry/readiness/backup/release digest 同源，tamper 全部失败关闭。
- [ ] 后端全量、P14精准矩阵、P15 synthetic backup/rehearse、前端测试/lint/typecheck/build、P09/P15、V2、Root Harness/doctor 全绿。
- [ ] 真实 production Next + FastAPI + 临时 SQLite + deterministic provider + 双 owner 浏览器 journey PASS。
- [ ] 独立 backend/frontend/security review 无 P0/P1，机器 `--verify-candidate` 返回 canAcceptProductCandidate=true。

## Delivery Constraints

只允许 approval manifest 的20条产品路径。新增的第20条仅可修正 P15 synthetic WorkProduct digest、reply_id
与内部 actor 三项兼容绑定。产品 M0 前不得新增产品修改；M0 与候选不得读取生产数据库、
真实用户工作簿、secret、已有浏览器 profile，不得使用真实模型/外网、raw trace/HAR、历史 donor 整树或预制 PASS。
持久库 activation、停写、cold backup、restore、部署和产品 push 均需后续独立 authority。

## Affected Modules

- 模块：会计产物存储/确认 API、P15 runtime registry/readiness、P14 FastAPI/Next BFF、Study 产物 UI。
- 允许路径：严格等于 approval manifest `request.productPaths` 的20条路径。
- 非目标：新表/列、第二 ledger、上传、新格式、新 API namespace、自动发布、P06/P09-B、P15 非 synthetic 兼容修改或生产部署。

## Technical Plan

按 `docs/superpowers/plans/2026-08-22-packet-14-trusted-artifact-delivery-gap-fix.md`：authorize → RED →
exclusive V2 trigger expand → application/API/BFF/UI adapt →真实链与全矩阵验证→独立审查→Owner candidate 决定。

## Implementation Report

已有 P14 产品草稿仍停在未提交工作树，未获新版 M0，不得继续修改或提交。除已确认的
PENDING/ABORTED/cross-run、actor_ref、无界 JSON/download 和 UI gate RED 外，follow-up 还确认 P15 synthetic
runtime 的占位 digest、reply_id 与 actor 旧绑定会被 V2 安全底座正确拒绝；禁止放宽安全门来换取回归通过。

## Acceptance Review

当前为 `PENDING_OWNER_M0_DECISION / PRODUCT_STOP`。本任务不授权 approval commit/push、产品修改、候选提交、
产品推送、持久数据库 activation 或部署。

## Required RED Matrix

1. `P14-IDENTITY-01`：base 精确包含 accepted P09-A、P15 与本合同单亲证据。
2. `P14-MODEL-02`：immutable payload digest、public receipt DTO、artifact gate。
3. `P14-STORAGE-03`：状态/绑定/trigger migration/crash/concurrency/postimage/tamper/rollback floor。
4. `P14-AUTH-04`：CurrentUser owner 与 cross-owner/unknown 同形。
5. `P14-DOWNLOAD-05`：published-only、64 MiB、stable FD、spool/lease/cleanup。
6. `P14-CONFIRM-06`：PENDING/ABORTED/cross-run/drift 零 receipt，终局 append-only。
7. `P14-BFF-07`：same-origin、bounded stream、strict JSON、download length/cancel、零泄露。
8. `P14-UI-08`：explicit load、PUBLISHED-only controls、legacy download-only。
9. `P14-REALSTACK-09`：production Next + FastAPI + temp SQLite + deterministic provider。
10. `P14-BROWSER-10`：真实双 owner journey 与脱敏证据。
11. `P14-PRIVACY-11`：日志/响应/截图/request ledger canary 零命中。
12. `P14-CLEANUP-12`：端口、线程、子进程、临时文件零残留。
13. `P14-REGRESSION-13`：P15 synthetic runtime 只按合同三项机械兼容，且后端、前端、P09/P15、V2 与 Harness 无回归。
14. `P14-REVIEW-14`：backend/frontend/security 独立审查 GO。
15. `P14-AUTHORITY-15`：exact M0、single child、Owner acceptance 完整，P09 仅消费 receipt。

## Rollback

持久 activation 前可独立 revert 唯一产品 child。activation 后 V2 trigger、严格 application guard、raw bounded
parser 与脱敏 public DTO 是永久安全底座，不允许 full revert；只能经另行批准的 forward compatibility child
回退非安全展示，或停止 confirmation/work-product 服务。任何数据恢复必须使用匹配 P15 cold backup 并另行授权。
