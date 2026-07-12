# 需求说明

## 背景

"统一决策任务生命周期"架构落地方案(`/home/ubuntu/.claude/plans/valiant-crunching-candy.md`)阶段3原计划是"把各司手动派单接回真实管线，退役 dept-swarm-dispatch 桩"。实现前用 grep 核实 `SwarmDispatchPanel`/`useSwarmDispatch` 在整个 `src/app` 页面树里的挂载情况，结果为零——组件写好了、类型和 hook 都完整，但没有任何真实页面渲染它。这不是一个用户能触达的活跃 bug，而是一段从未上线过的孤儿脚手架。用 AskUserQuestion 向用户确认范围后，用户选择"先删掉这块孤儿代码"，阶段3的范围因此从"接线"改为"清理"。

## 范围

- 删除 `src/features/shared/components/swarm-dispatch-panel.tsx`(`SwarmDispatchPanel` 组件 + `useSwarmDispatch` hook，123 行)。
- 删除 `src/core/courtos/runtime/dept-swarm-dispatch.ts`(`dispatchDeptToSwarm` 函数、`DeptDispatchRequest`/`DeptDispatchOutcome` 类型，91 行)及其 `.nodetest.ts`(73 行)。
- 删除 `src/core/courtos/runtime/dept-entry-swarm.ts`(`DEPT_ENTRY_SWARM` 映射，14 行)。

## 非目标

- 不删除 `src/features/shared/hooks/use-swarm-dispatch-poll.ts`——另一个不相关的孤儿 hook(服务"真链 BFF"吏部招聘/刑部法律会诊/工部PACK可行性协议)，用户没有对它做决策，不扩大范围。
- 不修改 `src/lib/auth/require-court-swarm-auth.ts`——仍是其他真实路由在用的活跃安全网关，只是历史注释里提到过已删除的函数名，本身不动。
- 不处理 `test 856` 揭示的更大缺口(dept 派发所需的 HTTP route.ts 层根本不存在)。
- 不处理 office-kit 各司引擎(`bingbu-cro-sales-office.ts` 等)与真实派发完全脱节的架构缺口，这比本次删除范围更大，留给未来单独一轮变更。

## 验收标准

- `tsc --noEmit` 无新增错误。
- `test:node` 无新增失败(既有失败保持同一组，不增不减；因为删除了对应 nodetest，总用例数会减少)。
- 三层 harness doctor(前端/后端/根级)全绿。

## 风险

- `dispatchDeptToSwarm` 若仍有隐藏的非测试调用方，删除会导致构建失败——已用 grep 全仓确认唯一调用方就是被同时删除的 `SwarmDispatchPanel`。
- `require-court-swarm-auth.ts` 的历史注释提到 `dispatchDeptToSwarm`，需要确认该文件本身不依赖被删符号(它不依赖，只是注释提及)，避免误删仍在服务的安全网关。

## 验证计划

`pnpm exec tsc --noEmit`、`pnpm test:node`、`pnpm harness:doctor`、`python3 backend/scripts/harness_doctor.py`、`node scripts/harness-doctor.mjs`。

