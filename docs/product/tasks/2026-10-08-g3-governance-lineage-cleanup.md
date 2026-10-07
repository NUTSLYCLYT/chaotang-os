# G3 并行批准链治理清理（2026-10-08）

## Status

In Progress

## Product Definition

修复并行 worktree 推入 `ext-dev` 的四份锦衣卫回放基础批准记录的元数据一致性，使 Root Harness 能按真实提交链读取它们。该清理不批准新的产品施工，也不改变产品代码。

## Acceptance Criteria

- [x] successor3 使用完整 40 位 `a10802ed1a8c8398cbfcf730d1549a9bb655d7b3`，并保留原 tree `cf9f8aa59925a99ea870fe97926b71af70454a93`。
- [x] successor4 使用与其 tree `8ad26f9a80a23e391250aa318e871b737eb623f6` 对应的 `e7c9016eed5c4dfaf960334cb0556395519ed3d9`。
- [x] 四份任务文档使用项目允许的 `Ready` 状态。
- [ ] Root Harness、self-test、候选验证和远端 CI 仍需在本清理提交后复核。

## Delivery Constraints

- 只修改批准记录中的 baseCommit 字节、任务文档的枚举状态和本记录。
- 不修改产品路径、approved productPaths、非目标、验证命令、业务代码、API、数据库、权限、模型凭据或网络策略。
- 不删除历史记录，不强推，不绕过 pre-push，不操作原生桌面窗口。

## Affected Modules

- 模块：M0 approval lineage metadata 与 G3 任务文档状态。
- 允许路径：`.harness/approvals/CT-G3-JINYIWEI-REPLAY-FOUNDATION-SUCCESSOR3-20261008.json`、`.harness/approvals/CT-G3-JINYIWEI-REPLAY-FOUNDATION-SUCCESSOR4-20261008.json`、对应四份 `docs/product/tasks/2026-10-08-ct-g3-jinyiwei-replay-foundation-successor*.md`、本文件。

## Technical Plan

1. 以 Git 对象图核对每个 baseCommit 与 baseTree。
2. 只替换可由对象图证明的错误 SHA，统一任务文档状态为 `Ready`。
3. 运行 Root Harness、self-test、差异检查，再进行远端同步。

## Implementation Report

- `a10802ed` 解析为 `a10802ed1a8c8398cbfcf730d1549a9bb655d7b3`，tree 为 `cf9f8aa59925a99ea870fe97926b71af70454a93`。
- `e7c9016e` 解析为 `e7c9016eed5c4dfaf960334cb0556395519ed3d9`，tree 为 `8ad26f9a80a23e391250aa318e871b737eb623f6`。
- 尚未在本记录中宣称远端或 CI 通过，需等待本提交后的新鲜验证。

## Acceptance Review

本清理只证明批准元数据链条可被复核，不代表锦衣卫回放产品施工已执行、真实外部调查已启用或 G3 已达到封闭试用门槛。

## Rollback

使用 `git revert <commit-sha>` 回退本清理；不改写共享远端历史。
