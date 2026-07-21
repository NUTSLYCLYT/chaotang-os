# Product Owner Exact-H Approval

| Field | Approved value |
| --- | --- |
| Approver | `lyt` |
| Date | `2026-07-21`（Asia/Shanghai） |
| Amendment ID | `R0-TRUSTED-KERNEL-AMENDMENT-01` |
| Effective base | `origin/feature-chaotang-ext@ccc2d74a2e439830e9c6ae7adcefb5ee8c05c150` |
| Candidate H | `5e432ea45796738902fcd74948a34918e781bda7` |
| Tree | `50f0b0c852fccdd6a3119cbffd180ea65ed78df6` |
| Canonical binary diff SHA-256 | `f4023b84e736f24a745aaec41b19bca108c2b7ec6191eb3d5685fba0ac4e7038` |
| Amendment/source SHA-256 | `2ba59cbe4d4032d8f372d1dd757e03edb78038b38de6d657380f357100a83e38` |
| Approved scope | 仅进入 `R0-W01` 实现 |
| Explicitly not approved | `R0-W02`–`R0-W09` runtime、真实客户数据、上线 |

## Approval statement

> 我（lyt）批准 R0-TRUSTED-KERNEL-AMENDMENT-01 的精确候选：effective base=origin/feature-chaotang-ext@ccc2d74a2e439830e9c6ae7adcefb5ee8c05c150，H=5e432ea45796738902fcd74948a34918e781bda7，tree=50f0b0c852fccdd6a3119cbffd180ea65ed78df6，diff SHA-256=f4023b84e736f24a745aaec41b19bca108c2b7ec6191eb3d5685fba0ac4e7038，amendment SHA-256=2ba59cbe4d4032d8f372d1dd757e03edb78038b38de6d657380f357100a83e38；批准仅进入 R0-W01 实现，不批准 R0-W02–R0-W09 runtime，不批准真实客户数据，不批准上线；真实客户数据、W08、W09 前必须重新指定专业安全、法律和发布负责人。

## Boundary

本证据只绑定上表 Candidate H，不改变或重新计算该候选。它授权后续以新的 packet-scoped 分支实施 W01；当前 re-pin 分支本身仍不包含 execution-authority v2，也不授权任何产品 runtime。W01 必须把专业负责人更换的声明式前置实现为进入真实客户数据、W08、W09 前的可执行阶段阻断。
