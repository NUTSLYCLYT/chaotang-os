# 变更摘要：feat-r0-w07-a0-runnable-minimum-20260727

> 执行授权：`R0-W07 / APPROVED_WORK_PACKAGE`
>
> Product Owner 已批准在 integrated EXT exact H 上执行 Checkpoint A。
> 本 Packet 不授权 Checkpoint B、持久数据库迁移、push、部署或 listener 3050。

| 字段 | 值 |
| --- | --- |
| Change ID | feat-r0-w07-a0-runnable-minimum-20260727 |
| 类型 | feat |
| 状态 | `IMPLEMENTATION_CANDIDATE_FROZEN / FRESH_TWO_PASS_REVIEW_PENDING / NOT_DEPLOYED` |
| Owner | Codex W07 Implementation Lead |
| Product Owner | `lyt` |
| 创建日期 | `2026-07-27` |
| Base H | `ed822255a452e8dd8dda8f86a180fd7c099b181e` |
| Base tree | `0a56a0eab0135dcf46c31e5ae2cbc46f501cfdcb` |
| Implementation candidate H | `7b8b84d20a3e21f38f89e97f590c554b4045081c` |
| Implementation candidate tree | `6263bf1d2a45a3b2dafdddc2ccdcd7b79cad07f8` |
| Integration target | local `feature-chaotang-ext` |
| Authority before first edit | v1 `VALID_INACTIVE_GUARD`; v2 W07 `GO / APPROVED_WORK_PACKAGE` |

## 目标

用现有持久表、W05/W06 能力和现有 `/shangshufang`、`/shiguan` 跑通一条合成合同
真实后端闭环。验收结论最多为 `RUNNABLE_MINIMUM`，不关闭 W07。

## 独立审查状态

截至 review envelope `6a2ffefc...` 的独立 Codex 只读审查均为 `NO-GO`。
最新适用 findings 已按批准 scope 完成 TDD：合同 final 的 exact CourtReview 必须
持久存在并匹配 task/tenant/final，task endpoint 同时校验 tenant + user；runtime
parser 使用完整 Mission/Pack/RiskItem schema，拒绝外部 artifact URL、fallback
risk/receipt 和矛盾 DECIDE；零写入证据覆盖 OutboxEvent 与 DecreeExecutionEvent。
第六轮 remediation 进一步要求 ready final 只接受 `awaiting_decision` review、
`recheck` 必须消费 server `REFRESH_REVIEW`、Mission 与 ReviewPack 五项业务范围
完全一致，并把 W06 `EXPIRED` artifact 投影为 typed `UNAVAILABLE`。史馆精确回读
现在使用 audit-only 卷轴，明确显示真实来源且不再显示 legacy 裁决建议。
此前修复还保证史馆保留 `LIVE_ENGINE` 的真实来源，并从 URL 首帧起阻断目标合同的
legacy footer、modal 和 handler。审查提出的
“PARTIAL 不得显示 LIVE”不适用：设计中 `LIVE` 是来源真实性，`PARTIAL` 是交付
完整度；现有合同只禁止把 PARTIAL 宣称为 READY、ARCHIVED 或 resumable。W06 明确
批准的是 tenant-owned artifact，故“同租户再按 user 隔离”也不作为 W07 缺陷扩展。
runtime boundary 还要求 PDF/DOCX/JSON 三种 artifact 全部 STORED 且可下载后才接受
DECIDE/REOPEN。P0-B 表面积登记已与既有跨用户行为探针对齐。新 implementation
candidate 已冻结。exact review envelope `492703ce...` 的两路复审均为 `NO-GO`，
合并为 `HIGH 3 / MEDIUM 5 / LOW 1`。same-user cross-tenant legacy memorial
路径需要修改当前 scope 外的 `backend/web/routers/chaotang.py` 或共享 ownership
accessor，因此当前状态为 `SCOPE_AMENDMENT_REQUIRED`；不整合 EXT。

Product Owner 随后批准第七轮 remediation scope amendment。candidate
`61805256...` 已按 TDD 修复全部 `HIGH 3 / MEDIUM 5`：legacy ownership 同时
校验 tenant/user；Mission revision/digest 与 ReviewPack/worker 绑定；全部 W07
decision action 在写前消费 server authority，精确幂等重放保持只读；terminal
task、clock expiry 和 missing-review downstream 均 fail closed；frontend
root/task/blocker 及手工对象 closed-world；exact archive 右栏不再暴露 retrospective
写按钮或 Next Action。固定 OpenAPI ref 未 repin，只把新增 optional component
property 分类为 warning，字段类型或 required 变化仍为 breaking。第七轮 LOW
“visible loading”未获本轮 scope 批准，保留 residual。当前等待 exact candidate
两路独立只读审查，不预先声明 GO 或允许整合。

review envelope `a7937d7e...` 对 `61805256...` 的两路 Codex 复审继续为
`NO-GO`，合并适用项为 `HIGH 2 / MEDIUM 6 / LOW 1`。本轮在既有批准范围内按
TDD 补齐：scope-only contract action authority、terminal worker publication
fence、Mission publication lock、legacy cancel/recheck 只读重放、服务端合同
分类前端接线，以及 response-aware OpenAPI compatibility。fresh evidence 为
backend `484 passed / 2 skipped`、contract-review Node `36 passed`、TypeScript、
real-mode build、API guard `7 passed`、Playwright `1 passed` 和两层 doctor
`0/0`。新 implementation candidate 已冻结为 `7b8b84d2...`、tree
`6263bf1d...`；仍等待该 exact H 的两路独立只读审查，不允许整合 EXT。

## 允许范围

- `MissionContractV1 -> DecisionTask` 的 R0 唯一兼容绑定。
- 现有 `CourtLoopRun` 上的 mission revision snapshot repository。
- `ContractTaskReadModelV1`、server `allowed_actions` 与 blockers。
- current FinalMemorial/ContractReviewPack、latest ArtifactManifest、exact ArchiveReceipt 同
  lineage 投影。
- 既有 decision endpoint 的 `tenant_id + user_id` 双重所有权校验。
- generated/verified TypeScript consumer。
- 现有 Shangshufang/Shiguan 的 hunk-level 接入。
- 一条 synthetic real-backend browser flow。
- test-only、JWT-protected browser launcher：
  `backend/harness/chaotang-true-loop/scripts/run_w07_runnable_backend.py`；该脚本只在
  隔离进程中加载 canonical app，并注册 `include_in_schema=False` 的 seed route；
  不进入产品 OpenAPI，只使用临时 runtime/DB。
- 根、后端和前端 change/evidence/test 文件。

## 禁止范围

- Checkpoint B mission 表、Alembic migration、并发/CAS hardening。
- PARTIAL 跨刷新恢复；Checkpoint A 必须诚实显示 blocker。
- 新页面、Agent、BFF、部门、任务状态机、完成状态或裁决系统。
- `/dadian`、真实客户数据、push、部署、持久 DB 操作和 listener 3050。

## 完成公式

```text
RUNNABLE_MINIMUM =
real backend synthetic flow
+ server-owned read model/actions
+ exact pack/manifest/archive lineage
+ existing two-page consumption
+ honest PARTIAL limitation
+ focused regression and browser evidence
```
