# 前后端连通性缺口审计（2026-07-11）

## 背景

用户报"登录/注册后偶发 404"，排查该具体问题过程中，用户要求扩大范围，
用 Workflow 多 agent 并行审计全站前端页面路由、前端 API 调用点、后端注册
路由，交叉比对找出前端调用了但后端未实现的死路由。

## 方法

1. 并行枚举：前端 15 个页面路由、183 个前端 API 调用点、后端 321 个注册路由。
2. 精确分段匹配交叉比对，得到 61 个疑似不匹配的调用。
3. 发现 `frontend/src/lib/backend-api.ts` 的 `toBackendApiPath()` 有一层
   历史路径别名重写（`/api/court/shangshufang/*` → `/api/shangshufang/*`
   等 10 条规则），先应用这层重写得到真实请求路径，再逐条真实 curl 验证，
   排除因为跳过这层重写产生的假阳性。
4. 对剩余真实缺口，人工确认其前端组件是否被 `src/app` 下任何真实路由
   实际渲染引用（而非孤立死代码/无路由可达）。

## 结论：确认接通、无需处理

以下调用经别名重写后返回 401/405（路由存在，只是鉴权或方法不对），确认真实可用：
上书房下旨/确认/首页/任务状态/IM/财务系列、六部概览（户部/兵部/礼部）、
刑部法务概览、蜂群花名册、最新朝会。

## 结论：真实缺口

| 功能 | 端点数 | 涉及组件 | 是否被真实路由渲染引用 |
| --- | --- | --- | --- |
| 军机处大议会实时视图 | 1 | `features/command-center/views/CouncilView.tsx` | **是** — `junjichu/page.tsx` 通过 `?view=council` 渲染，用户点得到 |
| 工部可行性研判 / 吏部招募 | 4 | `features/departments/lib/department-actions.ts` | **是** — 经 `DepartmentPageViewShell` 挂在 `/liubu/[code]` 下 |
| 户部预算案详情 | 1 | `features/departments/components/HubuBudgetCaseBody.tsx` | **是** — 同上 |
| 刑部法务蜂群面板 | 1 | `features/xingbu/components/xingbu-legal-swarm-panel.tsx` | 待精确核实（经 `xingbu-contract-workbench` 引用） |
| 运营闭环构建台账 | 1 | `features/operating-loop/lib/build-ledger.ts` | 是（1 处直接引用） |
| 翰林院整个功能 | 12 | `features/hanlin/*` | **否** — `src/app` 下无任何路由引用，用户进不去 |
| 钦天监预测情景/学习路径 | 3 | `features/qintian/*` | **否** — 同上,无路由可达 |
| 户部问答（大屏可视化） | 1 | `components/chaotang/visual/WorldCourtStage.tsx` | **否** — 未见 app 路由引用 |
| 治理议案看板 | 1 | `features/governance/components/bills-board.tsx` | 待核实 |
| 庄园分析适配器 | 1 | `lib/api/adapters/manor-adapter.ts` | 待核实 |
| 通用任务 SSE 适配器 | 1 | `lib/api/adapters/task-events-sse.ts` | 待核实 |
| 学习飞轮回测/记录/顾问信号 | 3 | `department-flywheel-recap`、`use-advisor-signal` | **否** — 经 `weekly-recap.tsx`，未见任何 app 页面渲染 `weekly-recap` |
| 太医仪表盘/新闻、通用预测/情报 BFF | 4 | `lib/api/client.ts` | **否** — 未见任何 app 页面调用这几个具体方法 |
| 司局(bureaus)详情 GET | 1 | `features/bureaus/api/index.ts`（3 处引用） | 待核实 |
| 治理议案看板 | 1 | `bills-board.tsx` 经 `use-command-center-data` | **否** — `features/command-center` 整个 barrel 无任何 app 页面外部引用，纯孤立代码 |
| 庄园分析适配器 | 1 | `manor-adapter.ts` 经 `use-manor-stream` | **否** — 同上，孤立于 command-center barrel 内 |
| 通用任务 SSE 适配器 | 1 | `task-events-sse.ts` 经 `use-task-status` | **否** — 未见任何 app 页面引用 |

### 二次核实后更新

- **刑部法务蜂群面板**：确认可达 —— `xingbu-legal-swarm-panel` 经 `xingbu-contract-workbench` 挂在 `BureauPageRouteClient`，是 `/liubu/[code]/[office]` 的真实渲染路径。
- **运营闭环构建台账**：确认可达 —— 被 `junjichu/page.tsx` 和 `ShangshufangPage.tsx` 直接引用。

## 处理建议（最终版）

**确认可达、用户真会点到 404，值得优先修（共 9 个端点）：**

| 功能 | 端点数 |
| --- | --- |
| 军机处大议会实时视图 | 1 |
| 工部可行性研判 / 吏部招募（含结果轮询） | 4 |
| 户部预算案详情 / 研究预算闭环 | 2 |
| 刑部法务蜂群面板 | 1 |
| 运营闭环构建台账 | 1 |

**确认无任何真实路由可达，纯孤立死代码（共 26 个端点）：** 翰林院(12)、钦天监预测(3)、
户部问答大屏(1)、学习飞轮(3)、太医/预测BFF(4)、治理议案(1)、庄园分析(1)、任务SSE(1)。
这些组件在 `src/app` 下没有任何页面渲染它们，用户物理上点不到——按 YAGNI 原则，
在没有确认产品近期要上线这些功能之前，给它们补后端属于给死代码做无意义的工作。

## 审计原始数据

原始发现数据（前端调用清单、后端路由清单）保存于 `/tmp/audit/`（会话临时目录，如需长期保留应移入仓库）。
