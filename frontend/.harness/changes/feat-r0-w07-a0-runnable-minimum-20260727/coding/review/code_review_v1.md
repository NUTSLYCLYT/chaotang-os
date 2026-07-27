# 代码审查 v1

原结论：NO-GO / REMEDIATION_REQUIRED

## Findings

- HIGH：非合同任务可能误挂面板并锁定旧动作。
- HIGH：下载按钮未服从 server `DOWNLOAD_ARTIFACT`。
- HIGH：READY 未要求 PDF/DOCX/JSON 三项全部可下载。
- HIGH：pack quality/source 尚未进入 adjudicability gate。
- HIGH：既有 decision endpoint 只校验 user，缺 tenant 校验。
- MEDIUM：mission DRAFT 检查顺序、archive 跨字段一致性、exact readback
  错误可见性、客户端 idempotency key、API baseline 和浏览器 PARTIAL 证据需修复。
- `backend/web/routers/shangshufang.py` 不在当前批准文件清单，等待 Product Owner
  最小 scope amendment。

## Remediation Status

Product Owner 已批准最小 scope amendment；上述 HIGH/MEDIUM 均已按 TDD 修复并通过
focused、build、fixed OpenAPI baseline 和 real browser READY/PARTIAL 证据。当前等待
fresh two-pass independent review；本文件不预先声明 GO。

## Second Review

`ea267d1c...` 的 fresh two-pass 仍为 `NO-GO`。第二轮适用项已在批准文件范围内按
TDD 修复：共享 writer gate、verdict-aware actions、request task identity、有效归档
显示、legacy footer suppression 与不可改钉 OpenAPI baseline。当前等待新 exact
candidate 的两轮独立只读复审。

## Fifth Review

`68158da9...` 的 backend/frontend 两路审查均为 `NO-GO`，合并为
`HIGH 2 / MEDIUM 4`。已按批准 scope 补齐 persisted exact review、完整
decision-ledger 零写入快照、canonical artifact URL、完整 Mission/Pack/RiskItem
runtime schema 与 adjudicable receipt gate。implementation `08d46fb4...` 等待
fresh two-pass independent review，本文件不预先声明 GO。

## Sixth Review

`6a2ffefc...` 的 backend/frontend 两路审查均为 `NO-GO`，合并为
`HIGH 2 / MEDIUM 2 / LOW 1`。全部 H/M 已按批准 scope 修复：server
`REFRESH_REVIEW` gate 与 persisted review status 对齐，W06 `EXPIRED` typed
fail closed，Mission/ReviewPack 业务范围 exact match，史馆 exact archive
改为 audit-only 卷轴。LOW 的 parser `additionalProperties` hardening 留作后续
residual。implementation `5d5ff747...` 等待 fresh two-pass independent review。

## Seventh Review

review envelope `492703ce...` 的两路 fresh review 均为 `NO-GO`，合并
`HIGH 3 / MEDIUM 5 / LOW 1`。前端适用项包括 root boundary closed-world、
missing-review downstream omission、exact archive 右栏只读和 visible loading；
跨边界还发现 stale Mission revision、terminal task status、clock expiry 及多个
decision action authority 缺口。same-user cross-tenant legacy route 的可靠修复需要
当前批准范围外的 `backend/web/routers/chaotang.py` 或共享 accessor，状态转为
`SCOPE_AMENDMENT_REQUIRED`。
