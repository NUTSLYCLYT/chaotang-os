# 任务：fix-p5-1-literal-normalization-repair-20260717

## 任务 1：建立远端精确修复基线

- 目标：从远端 `bbb1000` 建立隔离修复工作树，不触碰 P6 和本地主分叉。
- 前置条件：`git ls-remote` 精确匹配 `bbb1000`。
- 输入：P5.1 修复链 `9b7c181`、`ac93496`、`6056e2c`、`8ae79eb`。
- 输出：`task/p5-1-literal-normalization-repair`。
- 涉及文件：P5.1 blocker/incident/change docs、schema adoption 实现与测试。
- 状态 / 数据变化：无真实数据库或服务变化。
- 验证命令与证据：`git diff bbb1000..HEAD`、`git status --short`。
- 回滚边界：删除隔离分支/工作树即可；不改共享历史。
- 完成定义：移植无冲突，P6 原工作树状态不变。

## 任务 2：验证精确 repair-H

- 目标：证明旧 RED、新 GREEN、相邻迁移与护栏无新增回归。
- 前置条件：任务 1 完成。
- 输入：repair 工作树。
- 输出：版本化 CI 摘要。
- 涉及文件：测试与 harness，不访问真实数据。
- 状态 / 数据变化：仅 `/tmp`/pytest 临时 SQLite。
- 验证命令与证据：adoption、007–015 代表集、Ruff、compileall、双 doctor。
- 回滚边界：测试临时文件自动清理。
- 完成定义：定向绿；任何范围外红灯按基线登记。

## 任务 3：独立审查与 ext 修复

- 目标：生成精确 B/H review-v1、approval-v1 和 clean no-ff merge，fast-forward 修复 ext。
- 前置条件：任务 2 完成且远端仍为 `bbb1000`。
- 输入：repair-H 与本变更证据。
- 输出：Claude GO、review-only R、candidate M、更新后的远端 ext。
- 涉及文件：本变更 `packet_review/` 两文件；最终 merge 不改树。
- 状态 / 数据变化：只更新 Git 远端引用。
- 验证命令与证据：gate nodetest、pre-push status、candidate verifier、push 后 ls-remote。
- 回滚边界：push 前可直接丢弃候选；push 后只能新 revert，不改写远端。
- 完成定义：远端为 M，M tree 等于 R tree，P5.1 fix 在远端可验证。
