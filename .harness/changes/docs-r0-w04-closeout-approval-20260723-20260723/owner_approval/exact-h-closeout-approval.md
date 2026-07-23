# R0-W04 exact closeout approval proposal

> Status: `PENDING_EXACT_OWNER_APPROVAL`
>
> 本文件是批准提案，不是已获批准的证据。不得从此前的“继续”“同意下一步”或对后续 W05 的意图推断本关账事件已经获批。

## Exact identity

| 字段 | 值 |
| --- | --- |
| Protected mainline | `origin/feature-chaotang-ext@2bcd56336f0c36f9b187f5b4c759900044a569ad` |
| Protected mainline tree | `df229bc9f73ec578935cf5cc03c4742a9153f0d3` |
| W04 closeout transition commit | `fbea3761` |
| W04 closeout transition tree | `293fa393bf81d73789a6eefd74cf88156a264493` |
| Approver | `PENDING` |
| Approval date | `PENDING` |

## Proposed approval scope

- 批准把 `.harness/r0-trusted-kernel-work-packages.json` 的 `activeWorkPackage` 从 `R0-W04` 改为 `null`。
- 批准把同一账本中的 `R0-W04.status` 从 `ACTIVE` 改为 `MERGED_AND_VERIFIED`。
- 批准项目进入没有 active work package 的静止态，以便后续另行评审和批准 W05。

## Explicit exclusions

本批准提案不批准：

- 激活或实施 W05–W09；
- 修改任何前端、后端、数据库、provider 或蜂群运行逻辑；
- 使用真实客户数据；
- 推送、创建/合并 PR、发布或切换生产；
- 将本地验证描述为生产验证。

## Exact approval statement

Project Owner 如同意，应明确回复：

> 我明确批准 R0-W04 exact closeout：受保护主线基线 `2bcd56336f0c36f9b187f5b4c759900044a569ad`，关账转换提交 `fbea3761`（tree `293fa393bf81d73789a6eefd74cf88156a264493`）。批准范围仅为 `activeWorkPackage: null` 与 `R0-W04.status: MERGED_AND_VERIFIED`；不批准 W05–W09、产品代码、真实客户数据、推送、合并、发布或生产切换。
