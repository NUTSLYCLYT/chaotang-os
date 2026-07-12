# 实现报告 v1

## 改动

删除 4 个文件，共 301 行，全部是从未被任何真实页面挂载的孤儿脚手架：

- `src/features/shared/components/swarm-dispatch-panel.tsx`(123 行)：`SwarmDispatchPanel` 组件 + `useSwarmDispatch` hook，自己直接 `fetch('/api/court/dept/swarm-dispatch')`(命中后端一个恒定 FALLBACK 的桩)，不经过 `dispatchDeptToSwarm`。
- `src/core/courtos/runtime/dept-swarm-dispatch.ts`(91 行)：`dispatchDeptToSwarm` 函数、`DeptDispatchRequest`/`DeptDispatchOutcome` 类型、`DEPT_ENTRY_SWARM` 的重导出。
- `src/core/courtos/runtime/dept-swarm-dispatch.nodetest.ts`(73 行)：仅自测该模块本身，无其他消费者。
- `src/core/courtos/runtime/dept-entry-swarm.ts`(14 行)：`DEPT_ENTRY_SWARM: Record<string,string>` 映射(吏部/户部/礼部/兵部/刑部/工部→蜂群 domain key)。

## 取舍

- 用 grep 全仓核实 `SwarmDispatchPanel`/`useSwarmDispatch`/`dispatchDeptToSwarm`/`DEPT_ENTRY_SWARM` 除彼此内部引用和各自 `.nodetest.ts` 外，`src/app` 页面树里零挂载点——原计划"接回真实管线"的前提(有一个用户能点到的假按钮)不成立，用 AskUserQuestion 向用户澄清后改为直接删除。
- 保留 `src/features/shared/hooks/use-swarm-dispatch-poll.ts`：这是服务另一个"真链 BFF"设想(吏部招聘/刑部法律会诊/工部PACK可行性)的独立孤儿 hook，跟本次删除的代码链无引用关系，用户只对 `SwarmDispatchPanel` 这条链做了决策，不擅自扩大删除范围。
- 保留 `src/lib/auth/require-court-swarm-auth.ts`：核实它是仍在为其他真实路由服务的活跃安全网关，只是历史注释里提到过 `dispatchDeptToSwarm`，本身没有 import 或调用被删符号。

## 验证

- `pnpm exec tsc --noEmit`：绿，无新增错误。
- `pnpm test:node`：982/988，同一组既有 6 个无关失败(BFF 写隔离/`dispatchDeptToSwarm` 鉴权守门/学习持久化解耦/e2e 后门安全)；总用例数比删除前少 7 条，对应被删的 `dept-swarm-dispatch.nodetest.ts` 自身用例。
- 三层 `harness:doctor`(前端 `pnpm harness:doctor`、后端 `python3 backend/scripts/harness_doctor.py`、根级 `node scripts/harness-doctor.mjs`)：全绿。

