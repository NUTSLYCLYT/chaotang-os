# 任务：docs-branch-worktree-hygiene-guardrail-20260721-20260721

## 任务 1：野生本地 ext 隔离

- 目标：防止本地 `feature-chaotang-ext@7daf36ba` 被误 push/merge 覆盖远端权威
- 前置条件：确认该分支未被任何 worktree 占用（`git worktree list` 核验）
- 输入：`git branch --list feature-chaotang-ext -vv`
- 输出：分支改名为 `wip/six-capability-absorption-governance-20260721`
- 涉及文件：无（仅本地分支引用）
- 状态 / 数据变化：`git branch -m feature-chaotang-ext wip/six-capability-absorption-governance-20260721`
- 验证命令与证据：`git branch --list "wip/six-capability*" -vv` 输出确认改名成功
- 回滚边界：`git branch -m` 可逆，原名可随时改回
- 完成定义：本地分支列表不再出现与远端权威同名但内容分叉的 `feature-chaotang-ext`

## 任务 2：机械化四件套审计脚本

- 目标：把「哪些 worktree 可安全清理」从人工目测改为脚本机械核验
- 前置条件：本地 origin 已 fetch `feature-chaotang-ext`
- 输入：`git worktree list --porcelain` 全量枚举
- 输出：`worktree-audit.sh`（存于会话 scratchpad），逐条输出 SHA / 是否 ext 祖先 / 工作区是否干净 / 分支名
- 涉及文件：`/tmp/claude-1000/-home-ubuntu-Projects-chaotang-os/259ad197-3b7e-4e61-8058-662cee0a5f18/scratchpad/worktree-audit.sh`
- 状态 / 数据变化：只读，不修改仓库状态
- 验证命令与证据：脚本运行输出 96 行结果，62 YES / 34 NO，与 `git worktree list` 总数一致
- 回滚边界：无需回滚（只读脚本）
- 完成定义：脚本可重复运行、结果确定性，可供下一轮清理复用

## 任务 3：第一批 worktree 清理

- 目标：清除已确认是 ext 祖先且工作区干净的 worktree，降低治理债
- 前置条件：任务 2 输出清单 + 人工确认排除当前活跃工作（4 个）
- 输入：`safe-delete-batch1.txt`（47 条路径+分支名）
- 输出：47 个 worktree 目录移除，对应 47 个已核验为 ext 祖先的本地分支删除
- 涉及文件：仅本地 `.git/worktrees/*` 与本地分支引用，不涉及仓库受控文件
- 状态 / 数据变化：`git worktree remove` × 47（OK=47 FAIL=0）+ `git branch -d` × 35（非 DETACHED 条目）
- 验证命令与证据：清理前后 `git worktree list \| wc -l`：96 → 49
- 回滚边界：底层 commit object 未 gc 前可用原 SHA 重新 `git worktree add` 恢复；未触碰远端
- 完成定义：`git worktree list` 计数从 96 降至 49，0 失败

## 任务 4：前向栅栏规则记录

- 目标：防止清理完成后 worktree 债务再次堆积到失控规模
- 前置条件：任务 1-3 完成，仓库所有者口头确认规则内容
- 输入：审计文档 `docs/status/archive/2026-07-20-ext-branch-convergence-audit.md` 的分支分类原则
- 输出：本变更记录本身，作为规则事实源
- 涉及文件：本目录 `summary.md` / `request_analysis/spec.md` / `tasks.md`
- 状态 / 数据变化：新增文档，无代码/运行时变更
- 验证命令与证据：本记录可被后续 packet 引用，规则文字见 spec.md「验收标准」
- 回滚边界：纯文档，`git rm` 即可回滚
- 完成定义：规则文字化、可引用、可在下次审计时用于判断是否遵守
