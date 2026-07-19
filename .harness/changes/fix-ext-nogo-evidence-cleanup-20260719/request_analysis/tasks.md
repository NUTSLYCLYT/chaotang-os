# 任务：fix-ext-nogo-evidence-cleanup-20260719

## 任务 1

- 目标：从当前发布树移除 6 组冲突、未终态或重复历史证据，同时完整保留 Git 历史和 `4b0deee` 其他成果。
- 前置条件：污染起点为 `4b0deee3335f874f98bd83b5b62e67452aed064b`；发布前驱更新并冻结为 `af652e9d95aa4a951e7a63ba48a62b1a871cdd11`；隔离 worktree 干净。
- 输入：P0 只读审查、P6.4 正式 GO 证据、当前远端树。
- 输出：47 个精确删除 + 1 个既有 GO 复审终态位置规范化 + 本 change 的规格、任务、CI、摘要。
- 涉及文件：见 `spec.md` 六目录清单与本 change 目录。
- 状态 / 数据变化：只改变当前 Git 树的证据集合；无运行时、数据库或用户数据变化。
- 验证命令与证据：路径/数量核对、判词扫描、三层 doctor、diff check、独立 review、D6。
- 回滚边界：只撤销本包；不回滚或改写 `4b0deee` 其他内容。
- 完成定义：独立 GO、D6 GO、正常 push 成功且远端 SHA/树复核一致。

## 任务 2（后续独立包，不在本 change）

- 目标：让 D6 识别 `claude-code-review-*.md` 并对悬挂 NO_GO fail closed。
- 前置条件：任务 1 已成功上传，远端基点更新。
- 完成定义：TDD 负例/正例、独立 GO、D6 GO、顺序上传。
