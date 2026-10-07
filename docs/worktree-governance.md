# Worktree 治理铁律（2026-10-07 owner 拍板，所有 agent 必须遵守）

背景：2026-10-06 实测 worktree 膨胀至 25 个，其中 4 个挂在 C 盘 Temp（随时被系统清理→注册表
损坏，曾引发 13 个 worktree 全损事故），另有一批验证用完未收。2026-10-07 已大扫除 17 个，
抢救内容（patch + 未跟踪文件）存于 `H:/ChaotangBackups/worktree-rescue-20261007/`（MANIFEST.md 可查）。
本文件从 AGENTS.md 迁出以保持其精简与 canonical hash 完整；门禁脚本见
`scripts/check-worktrees.mjs`。

规则：

1. **新 worktree 只能建在白名单目录**：首选 `H:/ChaotangWorktrees/<任务名>`，其次
   `H:/ChaotangStaging/`、`H:/ChaotangSource/`、`D:/OrcaWorkspaces/`。
   **绝对禁止**建在 C 盘（含 Temp、AppData、用户目录）。
2. **detached HEAD 验证/仿真 worktree 用完立即 `git worktree remove`**，不留过夜、不攒堆。
3. **任务分支合并进 `ext-dev` 后**：先删 worktree，再删本地分支（`git branch -d`），
   远端分支去留由 owner 决定。
4. **每次会话收尾前必须运行 `node scripts/check-worktrees.mjs`**：exit 1 表示存在越界
   worktree，必须当场处置或明确上报 owner；禁止留到下次会话。
5. 删除脏 worktree 前必须抢救：`git -C <路径> diff HEAD > 备份.patch` +
   未跟踪文件拷贝（参考 `worktree-rescue-20261007` 的目录结构），先备份后删除。

会话收尾自检命令（与 AGENTS.md 其他验证命令并列执行）：

```
node scripts/check-worktrees.mjs
```
