# 任务：fix-r0-execution-authority-20260720

## 任务 1：RED 与事实冻结

- 目标：证明当前主线没有 execution authority，并冻结新基线。
- 前置条件：当前 HEAD 等于远端真实 integration HEAD；保留用户文件和脏 worktree。
- 输入：R0 PRD、旧 authority WIP 只读 diff。
- 输出：新任务分支、change record、先失败的 Node 测试。
- 涉及文件：本 change、`scripts/execution-authority.nodetest.mjs`。
- 状态 / 数据变化：无运行时数据变化。
- 验证命令与证据：首次 Node test 因缺 resolver 返回 1。
- 回滚边界：删除本 change 的未提交新增内容即可；不触碰用户文件。
- 完成定义：RED 原因精确对应缺失护栏。

## 任务 2：最小 inactive guard

- 目标：实现 schema、manifest、resolver/CLI、doctor 和消费者接线。
- 前置条件：任务 1 RED。
- 输入：14 个计划、产品 SSOT、R0 PRD 与根政策的当前字节摘要。
- 输出：固定 `STOP` 的 execution-authority.v1。
- 涉及文件：根 `AGENTS.md`、`.harness/`、`scripts/`；不修改前后端 runtime。
- 状态 / 数据变化：仅版本化治理文件；无数据库迁移。
- 验证命令与证据：Node suite、CLI、三层 doctor。
- 回滚边界：整包 revert。
- 完成定义：所有负例失效关闭，真实仓 inventory 与 digest 一致。

## 任务 3：exact-HEAD 独立审查

- 目标：由 Claude Code 非实现会话完成 Authority、Security、Git-Evidence 三路只读审查。
- 前置条件：实现候选已提交且工作树无范围内未提交改动。
- 输入：B/H/tree/diff digest、change 四件套和测试证据。
- 输出：三份绑定同一 exact HEAD 的审查报告。
- 涉及文件：本 change 的 review evidence；审查不得修改实现。
- 状态 / 数据变化：只增加审查证据。
- 验证命令与证据：重新计算 SHA/tree/diff digest，复跑全部门禁。
- 回滚边界：审查证据可独立撤回；实现需整包 revert。
- 完成定义：无 HIGH/MEDIUM；否则回到任务 2。
