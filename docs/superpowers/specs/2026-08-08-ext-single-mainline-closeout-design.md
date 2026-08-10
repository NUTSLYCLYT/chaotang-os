# EXT 单主线收官设计

## 目标

把可发布事实源收敛到正式仓库的 `feature-chaotang-ext`，吸收旧朝会分支中唯一在当前
R0-W08 获准且不可替代的 S3 校真契约，并推送 Gitee。

## 约束

- 不整支 merge/cherry-pick `integration/ext-court-loop-contracts-20260719`。
- 不触碰旧副本和工部子 worktree 的未提交内容。
- 不把文档确认当作运行授权。
- S4、S5、daily-court 切换保持冻结。
- 候选必须从 `d36bb797` 线性产生，正式主线只做 fast-forward。

## 设计

1. 固定主线、远端、旧副本、脏工作区和独有能力的处置账本。
2. 用固定高分假检索构造 RED，证明只看 relevance 会放过离题与篡改数字。
3. 在当前 EXT 重制主题重合与业务数字核对，不复制旧分支历史。
4. 收窄可信度章边界，避免日期、标准号、型号和标题序号形成视觉假信号。
5. focused tests、相邻回归、Harness Doctor、authority、diff 检查全部留证。
6. 单提交候选通过集成门后 fast-forward 到 `feature-chaotang-ext` 并 push。

## 验收

- 匹配声明放行；高分离题声明拒绝。
- 篡改价格、寿命、保持率时，decision 点名冲突数字。
- 日期、标准号、型号、序号不盖章，业务数字仍盖章。
- 原有 L0 未跟踪文件不进入本轮提交。
- Gitee `origin/feature-chaotang-ext` 与本地主线一致。
