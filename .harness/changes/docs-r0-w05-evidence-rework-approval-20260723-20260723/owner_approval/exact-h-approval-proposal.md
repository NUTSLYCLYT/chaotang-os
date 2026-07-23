# Product Owner Exact-H Approval Proposal — R0-W05

> Status: `PENDING_EXACT_OWNER_APPROVAL`
>
> 本文件是批准提案，不是已获批准证据。不得从“下一步”、W04 合并或此前产品方向确认推导 W05 已获执行权。

## Exact identity

| Field | Proposed value |
| --- | --- |
| Approver | Product Owner（拟 `lyt`） |
| Date | `PENDING` |
| Amendment ID | `R0-TRUSTED-KERNEL-AMENDMENT-01` |
| Amendment SHA-256 | `2ba59cbe4d4032d8f372d1dd757e03edb78038b38de6d657380f357100a83e38` |
| Work package | `R0-W05`（证据与合同成果内容 + evidence-bound rework loop） |
| Effective base | `origin/feature-chaotang-ext@67bcc78ec5f80d3d1600c676812ddb4cec958eb3` |
| Candidate H | `67bcc78ec5f80d3d1600c676812ddb4cec958eb3`（从此状态开始建 W05） |
| Tree | `e7efd61be8b8d9e725d859489124400f606fea69` |

## Proposed approved scope

只批准一个 `R0-W05` 后端纵切：

- `EvidencePacketV1`、`ContractRiskItemV1`、`ContractReviewPackV1` 和最小刑部合同能力；
- 补证请求绑定精确 tenant/task/prior FinalMemorial content hash/generation；
- 新证据触发唯一新 generation，旧 generation 迟到不得覆盖 current；
- 只刷新受影响合同分析 section，并重新经过 canonical CourtReview single writer、质量门和来源门；
- 新 FinalMemorial 以 append-only version supersede 旧版本，旧版本不可改写；
- EmperorDecision 与史馆归档绑定精确 current FinalMemorial content hash；
- 为实现上述行为所必需的后端契约、migration、service/API、测试与 feature flag。

## Explicit exclusions

本提案不批准：

- R0-W06–R0-W09；
- 前端页面或交互修改；
- PDF/DOCX/JSON 成果附件；
- 真实客户材料或生产 provider；
- 第二套 Mission、DecisionTask、CourtReview、FinalMemorial、archive writer 或通用编排器；
- LangGraph 安装/接入；
- 推送、PR、合并、发布或生产切换。

## Exact approval statement

如同意，请明确回复：

> 我明确批准 R0-W05 从 effective base `67bcc78ec5f80d3d1600c676812ddb4cec958eb3`（tree `e7efd61be8b8d9e725d859489124400f606fea69`）开始实施。批准范围仅为一个后端 Packet：三个 W05 v1 证据/合同契约、补证绑定、新 generation、受影响部分重算、canonical 重审、新 FinalMemorial 追加版本替代旧版本，以及对精确新 content hash 的裁决；允许所必需的后端 migration、service/API、测试和 feature flag。不批准 W06–W09、前端 UI、成果附件、真实客户数据、LangGraph、第二套事实源、推送、PR、合并、发布或生产切换。
