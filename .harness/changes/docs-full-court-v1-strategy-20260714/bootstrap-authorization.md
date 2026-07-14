# Bootstrap Docs Commit 授权记录 + Packet Commit 标准协议

本文件是 FULL_COURT V1 commit 授权的唯一事实源。聊天记录不作数，以本文件为准。
本文件归属 `integration/full-court-v1` 线，工作副本应位于该分支 worktree 内，不属于 feature-chaotang-ext 工作区。

## 第一部分：bootstrap commit 执行记录

| 项 | 值 |
| --- | --- |
| BASE_SHA | `4f77396314ab91a6d2b7099c83ed135c3dad1037`（feature-chaotang-ext HEAD） |
| 分支 | `integration/full-court-v1`，自 BASE_SHA 切出 |
| bootstrap commit | `9fd856d7f9c54c10b935a300dc7be2d7ab3e727b`（2026-07-14 19:03） |
| worktree | `/tmp/chaotang-full-court-integration` |
| push | 未 push，仅本地 |

验证：

```bash
git merge-base integration/full-court-v1 feature-chaotang-ext
# 必须输出 4f77396314ab91a6d2b7099c83ed135c3dad1037
git log --oneline 4f77396..integration/full-court-v1
```

9fd856d 实际内容（`git show --stat 9fd856d`，14 文件 +1336 行）：

```
.harness/changes/chore-evidence-driven-shangshufang-workflow-20260714/blueprint.md |   2 +
.harness/changes/docs-full-court-v1-strategy-20260714/census.md                    | 310 +++
.harness/changes/docs-full-court-v1-strategy-20260714/ci_result/ci_summary.md      |  31 +
.harness/changes/docs-full-court-v1-strategy-20260714/claude-census-review-prompt.md | 63 +
.harness/changes/docs-full-court-v1-strategy-20260714/codex-absorption-plan.md     | 335 +++
.harness/changes/docs-full-court-v1-strategy-20260714/codex-census-prompt.md       | 205 +++
.harness/changes/docs-full-court-v1-strategy-20260714/mainline-absorption-review.md | 76 +
.harness/changes/docs-full-court-v1-strategy-20260714/request_analysis/spec.md     |  56 +
.harness/changes/docs-full-court-v1-strategy-20260714/request_analysis/tasks.md    |  13 +
.harness/changes/docs-full-court-v1-strategy-20260714/strategy.md                  | 150 +++
.harness/changes/docs-full-court-v1-strategy-20260714/summary.md                   |  40 +
docs/product/CHAOTANG_CONVERGENCE_GUIDE.md                                         |  44 +
plans/FULL_COURT_V2_BACKLOG.md                                                     |   9 +
plans/chaotang-os-launch-blueprint-2026-07-14.md                                   |   2 +
```

## 审批日志

- 已知偏差：9fd856d 先于本协议落地，未走"diff stat 先行"审批。
- [x] **9fd856d 事后追认：已完成。** 用户批复原文（2026-07-14 19:26）："同意天才建议 以后就这么做"——采纳快批建议（stat 全 `.md`、shangshufang blueprint 2 行经核实为范围裁决交叉引用、未 push）。
- [x] 本文件与 `bootstrap-pathspec.txt` 入库：同批复覆盖，按第二部分协议 stage → diff stat（2 files, +64）→ 批 → commit。

## 第二部分：P0–P7 Packet Commit 标准协议（对后续所有 commit 生效）

每个 Packet 的 commit 必须走 stage → show → approve → commit：

1. 所有分支操作在 worktree 内进行；主工作区永久冻结在 `feature-chaotang-ext`，禁止 checkout/switch。
2. 在 Packet 的 change 目录写 `pathspec.txt` 白名单，`git add --pathspec-from-file=<change目录>/pathspec.txt` stage，人不手敲 add。
3. 把 `git diff --cached --stat` 原样贴给用户。
4. 用户回"批"后才允许 `git commit`；批复原文回填到该 Packet change 记录的审批日志。
5. 禁止 push（唯一上传线是 feature-chaotang-ext，integration 分支最终经审查后合回 ext 再上传）。
6. BASE_SHA / 前序 commit SHA 写进 change 记录文件，可用 `git rev-parse` 验证。

### 审批分级（2026-07-14 用户裁定）

审批强度跟不可逆程度走，不跟流程仪式走：

| 变更类型 | 审批强度 |
| --- | --- |
| docs-only + 未 push | 默认快批：查 stat 无非 `.md` 路径即批，一句话盖章 |
| 碰代码 / 碰 CI / 碰配置 | 逐行审 diff 后批 |
| integration 合回 ext（唯一上传线） | 单向门：完整审查证据 + 显式批复，不得快批 |

## 2026-07-14 20:35 BASE_SHA 迁移通告

- B1 裁决执行：repository-structure refactor 已逐行审（代码档）并经用户批复落地 ext，commit `2a92646`。
- FULL_COURT 各 Packet 的 BASE_SHA 自本通告起迁移为 `2a92646`（原 `4f77396` 作废）；integration/full-court-v1 与 task/p0-absorption-baseline 需 rebase 到新 base 或重切。
- 主树路径已变：`plans/` → `docs/plans/`；迁移候选已把本目录与产品文档中的当前引用更新为 `docs/plans/...`。上方 `git show --stat 9fd856d` 代码块保留旧路径，仅作为原 commit 的历史逐字证据。

## 2026-07-14 迁移候选

| 项 | 值 |
| --- | --- |
| 新 BASE_SHA | `2a92646cbae6c411a48a5a9a72257e7ac188e49f` |
| 候选分支 | `migration/full-court-v1-2a92646` |
| 候选 worktree | `/tmp/chaotang-base-migration` |
| 迁移方式 | 非破坏性重切；旧 integration/P0/P1 分支保持不动 |
| 内容 | 重放已批准 bootstrap docs，按新树把 `plans/` 引用和文件迁到 `docs/plans/` |
| push | 禁止 |

候选通过 doctor、diff 与用户 stage→show→approve 门后，才允许形成新的 bootstrap commit；P0 必须从该 commit 重切并重跑，不继承旧 P0 的通过声明。

审批日志：

- [x] 2026-07-14，迁移候选 staged stat 为 17 files / +1557；用户批复原文：“批”。授权仅覆盖 docs/pathspec 迁移 commit，不覆盖 P0 或后续代码 commit。

## 2026-07-15 00:45 分支线裁决（D4，用户批复"批" 2026-07-15 00:41）

- campaign 自 P1 起正式改为：task 分支 → Claude 逐行审 → 用户批 → **直合 ext**。
- `integration/full-court-v1` 线退役，改名归档 `archive/integration-full-court-v1-2a92646`（f9b3e88）；
  `task/p0-absorption-baseline` 终态归档为 `archive/p0-absorption-baseline-final`（037ceb6）。
- P1 审查报告见 `packet-reviews/p1-dept-id-ssot-review.md`（GO 附条件 F1/D2/D3/D4）。
- 后续 Packet 的 PREDECESSOR 定义更新为：上一个已 GO Packet 合入后的 **ext HEAD**。
