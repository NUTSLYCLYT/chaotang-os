# CourtOS 后端交付方案 v1.1 — 一个真引擎胜过六个空壳

> 2026-06-21 · 后端窗口产出 · 经 workflow(5 评估+综合+会审)+ 事实门只读核验校正。
> 分工:另一窗口做 UI,本窗口做后端(部门/蜂群/三省)。本文档是**协同 SSOT**,两窗口共同对齐。
> **方法硬约束(会审天才建议):任何"现状断言"必须贴可复现命令+输出;没命令的当未验证,不准用来排期。**

## 0. 一句话定调
瓶颈不是"功能不够",是**诚实不够 + 真链没被主路径激活 + 一个冻结特性焊进了写入门**。
真实现状比早先评估以为的更靠前:**jiqun:8081 活着(200)、dispatch/swarm-deepen/orchestrate-all 已真 fetch 后端、runShangshu 已接**。所以第一周不是"接通一条线",是**验证已有链的 trace 真假 + 把真链接进主决策路径 + 还诚实债 + 裁定冻结矛盾**。

## 1. 真实现状(事实门核验,2026-06-21)
| 断言 | 复现命令 | 结果 |
|---|---|---|
| jiqun 后端活着 | `curl :8081/api/swarm/config` | **200** ✅ |
| dispatch 已生产调用 | `grep -rn '.dispatch(\|/api/swarm/run' src \| grep -v nodetest` | swarm-deepen:85 / orchestrate-all:147,269 / adapter:144 真 fetch ✅ |
| 三省真空壳 | `grep runZhongshu\|retrieveContext three-chamber-engine.ts` | 仅 `runZhongshu`(空draft)+`retrieveContext`(占位空数组)是壳;`runShangshu`/`runMenxia` 已有实现 |
| 部门学习焊进写入门 | `grep applyDepartmentLearningOutcome sign-off/route.ts` | sign-off:77 真调,来自**未提交** real-source.ts 🔴 |
| 六部真假 | (前轮评估) | 户部/兵部 真(75-80%)·刑部半真·礼/吏/工 壳(吏/工 未标DEMO=欺骗) |

## 2. 🔴 最紧急:部门学习冻结矛盾(交付前必裁)
铁律5 写明部门学习**已冻结**,但工作区显示它被扩建(新 real-source/advisor-signal/archive-backfill,均未提交)且 **`applyDepartmentLearningOutcomeFromBossSignoff` 已焊进 sign-off 生产写入门**。
- 写的是隔离表 `department_learning`(非 tasks,无朝报污染)——这点 OK。
- 但"冻结特性活在写入门 + 未提交 + 无会审"违铁律3/4/5。
- **裁定项**:解冻(则补会审+断言+提交)还是 删/隔离(从 sign-off 摘掉)?**本窗口不擅动(并发地盘),等裁。**

## 3. 交付标准(可验证硬门槛 G1–G10)
| # | 门槛 | 验证 |
|---|---|---|
| G1 | 用户可见数据点带 `sourceLabel∈5值`,经 `assertSourceLabel` | grep overview routes + node test |
| G2 | 无壳冒真:无真源部门标 `DEMO`,`assertDemoNotRealDecision` 挡其进决策 | 回归断言:DEMO 进 decision 抛错 |
| G3 | `LIVE_SWARM` 必带真 `trace_id`(可在 jiqun 反查),经 `assertLiveSwarmTrace` | E2E:trace 不可反查=FALLBACK 非 LIVE_SWARM |
| G4 | 决策链产出单一密封 `MemorialScroll`(question→verdict→evidence→archive_hash) | E2E 读回同 memorial_id |
| G5 | 质门**真在写入门上**:`assertGatePassed` 与 `INSERT archive` 同函数体、写前 | codegraph callers 验调用栈相邻(非 grep);block 断言 |
| G6 | 写 `tasks` 改动配 独立会审 + 回归断言 | PR 含会审产物 + nodetest 断言 |
| G7 | 特权写入守门人在写入门(鉴权写入同门) | 安全会审 sign-off/orchestrate |
| G8 | 触真实产线资产必转 jiqun:8081(§13.2#9) | grep finance 走 jiqun |
| G9 | jiqun 502 显式降级:transient 重试 vs 持久标 MISSING(`success:false`) | retry wrapper 单测 |
| G10 | root tsc + pnpm build 双门绿 | CI |

**"已交付" ⇔ 适用 G 全绿 + 一条真数据流过 + sourceLabel 诚实。不是"页面能打开"。**

## 4. 统一价值输出契约(三方 SSOT)— 协同核心
### 4.1 收敛(守铁律2,禁平行)
现状三套平行信封(`ZApiEnvelope`/`courtos-decision-store.ApiEnvelope`/`jiqun-api.JiqunEnvelope`)+ SourceLabel 真身在 `src/core/courtos/source-label.ts`(**5值,已是 SSOT**)。
**驳回 7 值提案**(`+RULE_SEED/+MISSING`)——再造枚举=违铁律2。SEED→`FALLBACK`、MISSING→`success:false`。
### 4.2 落地方式(会审 H3 校正:从 Zod 推导,不手写平行 interface)
- 新建 `src/lib/contracts/value-envelope.ts`:**re-export** `SourceLabel`+assert族(自 `core/source-label`),**不重定义**。
- envelope 形状在 `schemas.ts` 加 `ZValueEnvelope`(Zod),`value-envelope.ts` 用 `z.infer` 导出类型——**一个形状,Zod 校验与 TS 类型同源**(不与 schemas.ts Zod SSOT 打架)。
- 三套旧信封收敛为别名(铁律3:合并即清理)。
### 4.3 字段(v1 冻结,待 UI 签字)
`ValueEnvelope<T>` = `success/data/error` + `sourceLabel`(强制) + `evidenceChain[]` + `missingEvidence[]` + `riskFlags[]` + `nextAction/needsHumanConfirmation` + `trace_id`(LIVE_SWARM必填) + `loop_trace_id` + `meta{source,fetchedAt,confidence}` + `schema_version:'ValueEnvelopeV1'`。
三层 T:`DepartmentOpinion`/`SwarmDeliverable`/`MemorialScroll`,外壳唯一。
### 4.4 所有权
枚举/守门=后端 core/(全员 import);envelope 外壳=后端 contracts/(UI 提需求+互审否决);T=后端定义 UI 签字;jiqun 产线产出=:8081(本仓适配不伪造)。

## 5. 路线图(事实门校正版)
| 阶段 | 内容(校正) | 完成判据 |
|---|---|---|
| **D0 裁定** | 部门学习冻结矛盾(§2):解冻/删/隔离 + 处置未提交悬空文件 | 工作区干净、矛盾消解 |
| **①诚实债** 4-6h | 吏/礼/工 标 DEMO;draft-edict 停硬编 FALLBACK 按实标 | G1/G2 绿;断言 DEMO 进 decision 抛错 |
| **①.5 契约冻结** | 落 `value-envelope.ts`(Zod 推导)+ UI 签字字段 | tsc 绿 + UI 签字 |
| **②验真链(非接通)** 6-10h | dispatch 已通——**验 trace 真假**:swarm-deepen/orchestrate-all 的 trace_id 能否在 jiqun 反查;把真链接进**主决策路径**(draft-edict 当前 FALLBACK 不激活) | E2E `swarm-deepen-live.spec` 断言真 trace 可反查;主路径产真 LIVE_SWARM |
| **③稳 jiqun** 2-4h | `_jiqun-source` retry:transient 502 重试 vs 持久 MISSING | G9 绿 |
| **④补真空壳** 12-20h | `retrieveContext` 接 RAG(runMenxia 失效根因)+ `runZhongshu` 接 callLLM + `assertGatePassed` 接 archive 写入门 | 三省非空;G4/G5 绿 |
| **⑤壳部门接真数据** 各8-16h | 吏/礼/工 接 Turso → DEMO 升真 | G1 绿 |
**阶段门:②未绿不进④。**

## 6. 协同协议(与 UI 窗口)
- **契约所有权**:后端定义+冻结 `value-envelope.ts`;UI 提消费需求+互审否决,禁内联拼 sourceLabel/evidence(违铁律2)。
- **互审检查点**:①契约冻结评审(①.5前双方签字 6 消费点:判决卡/证据侧栏/蜂群卡/大臣意见/质门/决策追踪)②每阶段 seam 评审 ③写主表/决策视觉权重的 PR 开**不在作者上下文**的 code-reviewer/expert-panel 读真 diff,禁自审。
- **地盘(防对撞 §13.2#10)**:
  - 后端窗口:`src/core/courtos/**`、`src/features/governance/**`(三省)、`src/app/api/court/**`、`src/lib/swarm/**`、jiqun seam。
  - UI 窗口:`src/components/**`、`src/features/**/components/**`、页面消费层。
  - 共享(`value-envelope.ts`/`contracts/**`/`jiqun-api.ts`/`AGENTS.md`/`package.json`):改前 commit 首行 `[shared] <文件>`,改完即 `pnpm build`,**禁 `git add .`**。
- **PR 模板强制**(铁律§13.3):影响哪条Loop/产出sourceLabel/需人工门/失败怎办/持久化/会审链接/回归断言——缺一不合并。

## 7. 第一周(最小最高杠杆)
**目标:证明"一条真链胜过六部假灯"。周交付 = 一条 LIVE_SWARM 真链 E2E 绿 + 所有壳标 DEMO + 冻结矛盾消解。**
- **D0**:裁定部门学习冻结矛盾 + 清工作区悬空文件 + `curl :8081/api/swarm/run` 探 finance 蜂群真出活(铁律5:答不出第一条真数据=冻结别建)。
- **D1**:契约冻结(`value-envelope.ts` Zod 推导,UI 签字)。
- **D1-D2**:诚实债(吏/礼/工 标 DEMO;draft-edict 停硬编)+ 断言。
- **D2**:jiqun retry(G9)。
- **D3-D4**:**验 + 接主路径**——确认 dispatch 返回的 trace 在 jiqun 真可反查(非构造),把真链接进 draft-edict 主路径(当前 FALLBACK)。
- **D5**:E2E 钉真 trace 断言 + 独立会审写主表改动 + 双门绿。
**第一周禁任何窗口写"功能完成";只准 `honesty:`(标DEMO/修冒真)与 `live:`(接通/验证一条真 trace)两类 commit。**

## 8. 大神视角
- **Deming/Bezos**:最危险是"号称基于事实却带着错事实"——综合方案漏看 orchestrate/all,把已通的链写成"零调用临界点"。事实门(贴命令+输出)是解药。自信≠正确。
- **Jobs/张小龙/Rams 减法**:六部别同时假装在线;先把假货诚实下架(标DEMO),腾信号位给第一条真链。Less but better。
- **最高杠杆**:不是"接通 dispatch"(已通),是**让主决策路径 draft-edict 用上已有的真链 + 验 trace 非伪造**,把"28% 架构演练"变成"第一条真蜂群产出回写老板"。

## 9. 下程第一动作 · finance 接线最小清单(经会审基线,照此起跑)
> 验真承重墙已就位(`78270eb`:`src/core/courtos/source-label.ts` + `runtime/reverify-swarm-trace.ts`,6/6 红队绿)。接线落点已确认 clean 可改:`draft-edict/route.ts`、`jiqun-live-swarm-adapter.ts`、`orchestrate/all/route.ts`。

**已探明的精确事实(2026-06-22 实跑)**:
- finance 蜂群 id = `finance`;请求体 `{task_input, config_path?, entry_swarm:'finance'}` → POST `:8081/api/swarm/run`。
- 真返回 `{success:true, session_id:'20260622_085226_a15fb9', entry_swarm, route_matched, route_reason}`。
- 反查 = GET `:8081/api/tasks`(返 `{running[],recent[]}`),session 在内即真登记。

**最小接线(5 处,改前确认仍 clean)**:
1. `draft-edict/route.ts:53` `buildLocalDraftEdict({...sourceLabel:'FALLBACK'})` → 真 fetch `:8081/api/swarm/run`(entry_swarm=finance,仅"咨询类、无重资产副作用"决策走前端引擎,触产线资产仍转后端·§13.2#9)拿 `session_id`。
2. `await reverifyLiveSwarmTrace(session_id)`(已就位)→ `verified` 才标 `LIVE_SWARM`;否则 `mergeTwo` 降 `MIXED`/`FALLBACK`,绝不盖假章。
3. 持久化进主库 `tasks`(经 `upsertPrimaryTask`),`briefing` 读回同 `taskId` 验闭环。
4. **铁律4 双门**(强制):开**不在作者上下文**的 `code-reviewer`/`expert-panel` 读真 `git diff`;新增回归断言 `e2e` 或 `nodetest`:「假 trace 进 draft-edict 必降级、绝不盖 LIVE_SWARM」+「LIVE_SWARM 必带可反查 session」。
5. E2E `finance-live-swarm.spec.ts`:一句财务问题进 → finance 蜂群真跑 → trace 可反查 → 老板见 `LIVE_SWARM` 真奏折。

**验收(一句话,可证伪)**:老板在上书房问财务问题,sourceLabel 真显 `LIVE_SWARM`,点开 trace 是 finance 蜂群真实分奏,且一条 CI 断言钉死"这条 trace 不是本地伪造"。
**前置**:`pnpm guard:freeze` 必须先转绿(部门学习冻结越界先经交接单 `FREEZE_BYPASS_HANDOFF_2026-06-22.md` 清掉)。
**风险等级**:单向门——一条假 LIVE 上线=信任不可逆。值得新鲜上下文 + 一次正经会审,别在长上下文尾段抢。
