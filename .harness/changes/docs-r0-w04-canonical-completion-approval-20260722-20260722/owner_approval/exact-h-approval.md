# Product Owner Exact-H Approval — R0-W04 Entry

| Field | Approved value |
| --- | --- |
| Approver | `lyt` |
| Date | `2026-07-22`（Asia/Shanghai） |
| Amendment ID | `R0-TRUSTED-KERNEL-AMENDMENT-01` |
| Work package | `R0-W04`（canonical 完成与恢复） |
| Effective base | `origin/feature-chaotang-ext@eefd4133dd9d1c21c3299c0093524a1fb8befd18` |
| Candidate H | `eefd4133dd9d1c21c3299c0093524a1fb8befd18`（= effective base，本批准针对"从此状态开始建 W04"） |
| Tree | `f2427cb901cebd2c829976b08968374358d54ecb` |
| Approved scope | 仅进入 `R0-W04` 实现：`CANON-IDEMPOTENCY-01` runtime、CourtReview single writer、
  服务端 `DELIVERED` 完成公式、取消 fencing、局部重试、`UNKNOWN` 查单、全链 identity
  (request/task/tenant/release/model)、每任务确定性 wall-clock/token/tool-call/retry 硬上限 |
| Explicitly not approved | `R0-W05`–`R0-W09` runtime、真实客户数据、上线 |

## 批准前置确认（amendment 原文）

- 前置条件：`R0-W03` 已 `MERGED_AND_VERIFIED`（已确认：`0a24fa3d` 是 `origin/feature-chaotang-ext`
  祖先，合并提交 `eefd4133`）。
- 不得与 W03 并行、不得共享未迁移完成的 writer 或状态事实源（amendment §R0-W04）。
- 首个 RED：`direct_completed`/worker ACK/部分文本/部分附件不得显示完成；任一硬上限超出必须
  进入明确终态或人工接管，不得继续执行、静默重试或显示完成。
- 历史 source-only：只复用 `wip/canon-court-01a-red` scanner 思想，不整支合并。
- 回滚：所有新写入记录 `delivery_formula_version`；关闭新 writer/投影后，新公式期间写入的行
  继续按原版本派生或进入 `UNDER_REVIEW` 隔离，禁止用旧公式重新解释为完成；兼容读保留，禁止
  恢复伪完成写入。

## Approval statement

> 我（lyt）批准 R0-TRUSTED-KERNEL-AMENDMENT-01 的 R0-W04 work package 从
> effective base=`origin/feature-chaotang-ext@eefd4133dd9d1c21c3299c0093524a1fb8befd18`
> 开始实现。批准仅进入 R0-W04 实现，不批准 R0-W05–R0-W09 runtime，不批准真实客户数据，
> 不批准上线；专业安全、法律和发布负责人重新指定门在 R0-W08/R0-W09/真实客户数据前必须
> 完成，由 execution-authority v2 运行时阻断。

## Boundary

本证据只授权 R0-W04 范围内的实现工作。W04 合入并 MERGED_AND_VERIFIED 后，进入静默收口态
（`activeWorkPackage=null`），Product Owner 需再对 R0-W05 单独批准，本证据不预先授权。
