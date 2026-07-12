# 任务拆解

## 任务 1 —— 核实孤儿代码链的调用范围

- 目标：确认 `SwarmDispatchPanel`/`dispatchDeptToSwarm`/`DEPT_ENTRY_SWARM` 在生产代码里除彼此之外没有其他调用方。
- 输入：全仓 grep(`SwarmDispatchPanel`、`useSwarmDispatch`、`dispatchDeptToSwarm`、`DEPT_ENTRY_SWARM`)。
- 输出：确认唯一调用链是 面板→`dispatchDeptToSwarm`→`DEPT_ENTRY_SWARM`，且面板本身零页面挂载。
- 验收：grep 结果只命中这条链内部文件和各自 `.nodetest.ts`。
- 依赖：无。

## 任务 2 —— 删除孤儿代码

- 目标：移除已确认孤儿的 4 个文件。
- 输入：任务 1 的核实结果。
- 输出：`rm -f src/features/shared/components/swarm-dispatch-panel.tsx src/core/courtos/runtime/dept-swarm-dispatch.ts src/core/courtos/runtime/dept-swarm-dispatch.nodetest.ts src/core/courtos/runtime/dept-entry-swarm.ts`。
- 验收：4 个文件不再存在于工作树。
- 依赖：任务 1。

## 任务 3 —— 回归验证

- 目标：证明删除没有引入新的类型错误或测试失败。
- 输入：任务 2 完成后的工作树。
- 输出：`tsc --noEmit`、`test:node`、三层 harness doctor 的运行结果。
- 验收：tsc 无新增错误；test:node 失败集合与删除前一致(既有 6 个无关失败，因删除 nodetest 总数减少)；三层 doctor 全绿。
- 依赖：任务 2。

## 任务 4 —— 补齐 harness 变更记录并提交

- 目标：把本轮范围收窄决策和验证证据落进 `frontend/.harness/changes/fix-retire-orphaned-swarm-dispatch-panel-20260712/`，随后提交。
- 输入：任务 1-3 的产出。
- 输出：`summary.md`/`spec.md`/`tasks.md`/`coding_report_v1.md` 齐全，git commit。
- 验收：`pnpm harness:doctor` 确认该记录结构合规；`git log` 里出现本次提交。
- 依赖：任务 3。

