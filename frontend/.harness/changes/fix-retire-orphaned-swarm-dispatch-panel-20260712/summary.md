# 变更摘要：fix-retire-orphaned-swarm-dispatch-panel-20260712

| Field | Value |
| --- | --- |
| Change ID | fix-retire-orphaned-swarm-dispatch-panel-20260712 |
| Type | fix |
| Status | DELIVERED |
| Owner | Frontend Agent |
| Created | 20260712 |

## 阶段

| # | 阶段 | Status | 证据 |
| ---: | --- | --- | --- |
| 0 | 加载上下文 | DONE | 已加载 harness 上下文 |
| 1 | 需求分析 | DONE | request_analysis/spec.md, tasks.md |
| 2 | 需求复核 | DONE | AskUserQuestion 澄清后用户选定"先删孤儿代码" |
| 3 | 实现记录 | DONE | coding/coding_report_v1.md |
| 4 | 代码复核 | DONE | 见 coding_report_v1.md |
| 5 | 测试计划 | DONE | tsc + test:node |
| 6 | 测试复核 | DONE | 982/988(同组既有失败，数量变化因删除了对应 nodetest) |
| 7 | 提交 / 收口 | DONE | git commit |
| 8 | CI 验证 | DONE | 三层 harness doctor 全绿(前端/后端/根级均 0 errors 0 warnings) |
| 9 | E2E 验证 | N/A | 纯删除不可达死代码，无新增可见行为需要浏览器验证 |
| 10 | 部署验证 | N/A | |
| 11 | 用户确认 | DONE | AskUserQuestion 已获得"先删掉这块孤儿代码"的明确选择 |

## 说明

- 范围：原计划(见 `/home/ubuntu/.claude/plans/valiant-crunching-candy.md` 阶段3)设想"把各司手动派单接回真实管线"，但实现前用 grep 核实发现 `SwarmDispatchPanel`/`useSwarmDispatch` 组件虽然写好、且描述自己是"任意部/司页面拖入即获得能力"的复用原语，实际在整个 `src/app` 页面树里零挂载——没有任何真实页面渲染它，用户点不到那个调用兼容占位端点的假按钮。用 AskUserQuestion 跟用户确认后，改为直接删除这条孤儿代码链(组件+`dispatchDeptToSwarm`+`DEPT_ENTRY_SWARM`及各自 nodetest)，而不是给一个没人能触达的组件接真实管线。
- 风险：删除前确认过 `dispatchDeptToSwarm` 唯一的非测试引用就是这个组件本身；`require-court-swarm-auth.ts` 提到 `dispatchDeptToSwarm` 只是历史注释，该文件本身是仍在为其他真实路由(吏部招聘/刑部法律会诊/工部PACK可行性等)服务的活跃安全网关，未触碰。
- 验证：`pnpm exec tsc --noEmit`、`pnpm test:node`(982/988，同组既有失败)、三层 `harness:doctor`。

## 顺带发现，本轮不处理

- `src/features/shared/hooks/use-swarm-dispatch-poll.ts`：另一个完全无引用的孤儿 hook(服务"真链 BFF"吏部招聘/刑部法律会诊/工部PACK可行性协议)，跟 SwarmDispatchPanel 是不同的代码路径，用户只针对 SwarmDispatchPanel 决策，未扩大范围处理这个。
- `test 856`(`每个调 dispatchDeptToSwarm 的 route 都过 requireCourtSwarmAuth 守门`)持续失败的真实原因：它期望 `src/app/**/route.ts` 里至少有 4 个调用 dept 派发的真实 HTTP 路由(xing-bu/gong-bu/li-bu 等)，但这些路由在仓库里根本不存在——是比这次删除范围更大的一个既有缺口，本轮不处理。

