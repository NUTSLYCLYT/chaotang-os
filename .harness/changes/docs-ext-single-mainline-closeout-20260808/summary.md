# 变更摘要：docs-ext-single-mainline-closeout-20260808

> 执行权威：`R0-W08 / GO / APPROVED_WORK_PACKAGE`

| 字段 | 值 |
| --- | --- |
| Change ID | docs-ext-single-mainline-closeout-20260808 |
| 状态 | IMPLEMENTED_CANDIDATE / PENDING_INTEGRATION |
| 基线 | `feature-chaotang-ext@d36bb797` |
| Owner | Codex |
| 日期 | 2026-08-08 |

## 范围

- 固定 EXT 单主线拓扑和旧副本处置。
- 在当前 EXT 重制 S3 校真契约。
- 不激活 S4、S5、daily-court，不删除 worktree。
- 验证后 fast-forward 正式主线并推送 Gitee。

## 边界

`NO_WHOLE_BRANCH_MERGE / NO_OLD_CLONE_WRITE / NO_RUNTIME_CUTOVER /
NO_EVOLVE_CHANGE / NO_WORKTREE_DELETE`
