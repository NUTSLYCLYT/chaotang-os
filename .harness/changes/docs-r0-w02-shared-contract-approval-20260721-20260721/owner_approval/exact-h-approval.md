# Product Owner Exact-H Approval — R0-W02 Entry

| Field | Approved value |
| --- | --- |
| Approver | `lyt` |
| Date | `2026-07-21`（Asia/Shanghai） |
| Amendment ID | `R0-TRUSTED-KERNEL-AMENDMENT-01` |
| Work package | `R0-W02`（共享合同契约） |
| Effective base | `origin/feature-chaotang-ext@656a4fe31ca17e131e523f9f141490108158be44` |
| Candidate H | `656a4fe31ca17e131e523f9f141490108158be44`（= effective base，本批准针对"从此状态开始建 W02"，非某个已存在的实现提交） |
| Tree | `8ceb590da5f97999818aadd64216bf3855035cc6` |
| Approved scope | 仅进入 `R0-W02` 实现（共享合同契约：`MissionContractV1`/`ContractSupportDecisionV1`/`ContractDecisionV1`/正交状态与 lineage 契约） |
| Explicitly not approved | `R0-W03`–`R0-W09` runtime、真实客户数据、上线 |

## OQ-03（支持/拒答 taxonomy）冻结确认

同一批准动作内一并冻结 OQ-03，具体取值：

```
Jurisdiction     = CN_MAINLAND | UNSUPPORTED_OR_UNKNOWN
ContractLanguage = zh-CN | UNSUPPORTED_OR_UNKNOWN
ContractType     = procurement | sales | service | UNSUPPORTED_OR_UNKNOWN
OurRole          = buyer | seller | service_provider | other_party | UNSUPPORTED_OR_UNKNOWN
ContractVerdict  = NEED_INFO | REVISE_BEFORE_PROCEED | PROCEED_TO_HUMAN_APPROVAL
                    | BLOCKED | NEED_LEGAL_REVIEW
```

`UNSUPPORTED_OR_UNKNOWN` 哨兵机制（schema 层拒绝陌生原始字符串，support-decision 层对哨兵值给出
结构化 `DECLINED`，两层均不静默放行）已获批准采用。

## Approval statement

> 我（lyt）批准 R0-TRUSTED-KERNEL-AMENDMENT-01 的 R0-W02 work package 从
> effective base=`origin/feature-chaotang-ext@656a4fe31ca17e131e523f9f141490108158be44`
> 开始实现；同时确认冻结 OQ-03（支持/拒答 taxonomy，取值见上）与其中的 `OurRole` 四值枚举、
> `UNSUPPORTED_OR_UNKNOWN` 哨兵机制设计。批准仅进入 R0-W02 实现，不批准 R0-W03–R0-W09
> runtime，不批准真实客户数据，不批准上线；专业安全、法律和发布负责人重新指定门在
> R0-W08/R0-W09/真实客户数据前必须完成，由 execution-authority v2 运行时阻断。

## Boundary

本证据只授权 R0-W02 范围内的实现工作（Pydantic 契约、FastAPI 路由、OpenAPI/TS 快照重生成、
RED 测试），不建 Mission 持久化单一事实源（W04 边界）、不建完整能力目录（W03/W05 边界）、不碰
前端 UI（W07 边界）、不新增 BFF 或 `/reports/[id]`、不碰 `/dadian`。W02 合入并 MERGED_AND_VERIFIED
后，Product Owner 需再对 R0-W03 单独批准，本证据不预先授权。
