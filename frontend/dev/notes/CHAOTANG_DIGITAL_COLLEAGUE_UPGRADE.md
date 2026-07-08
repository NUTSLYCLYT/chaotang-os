# 朝堂升级：从「诚实咨询台」→「诚实数字同事天团」
**总架构师合成稿（Bezos × 张小龙 × Karpathy）· 已对真实仓库验真 2026-06-23**

> 本稿合成「脸/心/眼/护栏/落地」五维设计，删重复、解冲突、补空缺（「眼」原稿为空，此处据真实件补全）。
> 凡一句话挂不回「真链 / 真数据 / 真验真」的，标 🔴 **空心人偶**，不许进架构。

---

## 1. 北极星

**朝堂 = 老板的一支敢说「我不知道」的数字同事天团。**
每个部门一位接真链、能对话、会主动操心、记得你决策的数字下属；它说的每句带判断的话都能点开看到背后的真链——点不开，就老实说「我还没真算」。

对应老板三需求，且每需求强焊一条真链锚：

| 老板要的 | 维度 | 焊死的真链锚（缺它即空心） |
|---|---|---|
| ① **更专业、能聊**（不再是打一段出一张卡） | 脸·对话人格 | `recruit-verdict.ts` 单句硬裁断 + `recruit-envelope.ts` sourceLabel |
| ② **更主动、会操心**（无人时自己盯事） | 心·主动自驱 | `boss-ledger.ts` `loadBossDecisionOutcomeEvidence`/`flywheelHealth`（已是真数据） |
| ③ **更懂我、记得我**（不重复问已决之事） | 眼·语境记忆 | `department-learning/store.ts` observe 真签核记录 |

---

## 2. 核心洞察（先想再写：最难最对的底座已经在手）

翻完仓库，一个决定性事实：**最难的那块已经造好了，且造对了。**

朝堂这一年憋出来的不是页面，是一条**诚实真链脊**——五道承重墙已上线并被测试钉死：

- `reverify-swarm-trace.ts`：报前先验真的 **fail-closed 往返**（复现不了 → 降级静默）；
- `reality-state.ts`：sourceLabel 的 SSOT（LIVE_SWARM/MIXED/FALLBACK/DEMO + `worstRealityState` 取最差）；
- `gate.ts`：**裁判/球员分离**——agent 只交证据指针，等级由御史**数出来**，不许自授；
- `agent-harness.ts` `runAgent`：AI 调用薄壳 + 人工确认门；
- `recruit-envelope.ts/recruit-verdict.ts`：吏部那条已端到端验证的帝金 LIVE_SWARM 真链（灰徽→帝金）。

**这条脊是全行业最难、最反直觉、也最对的东西**：它的核心能力不是"会算"，而是"**算不出时不装会**"。市面上所有 AI 助手都在比谁答得多，朝堂在比谁更老实地说"这块我缺证"。

所以这次升级的本质判断 ——

> **不换脊，换脸（对话人格）+ 换心（主动）+ 换眼（善解人意）。脊一行不动，三层全部寄生在脊上取真相。**

而**命门**（成败所系，张小龙点的那条线）：

> **把诚实纪律从决策层灌进人格层。** 越想"像真人"，越容易滑向编造——一个会配音的脸 + 一个会臆测情绪的心，是空心人偶最肥的温床。解法是一道硬墙：**人格只有 `tone`（怎么说）的写权限，永远没有 `truth`（说什么 / 多确定 / 什么来源）的写权限。** 一个会说"这块我缺证、还没真算"的老钱，比张口就来的强一百倍——因为它的"不知道"也是真链给的，不是人设演的。

这条路同时压住版面预算（铁律5）：**全程不新建任何版面**——脸溶进现有 BottomDock，主动溶进 `proactive-briefing-loop`，记忆溶进 `department-learning`。最好的 IA 决策就是没有新版面。

🔴 **已抓到的两株空心人偶种子（必须先拔，本稿据真实仓库验出）**：
1. `moodFromConfidence()/moodFromFocus()` —— **真实存在于 7 个文件**（physician/astronomer/historian 的 persona + chat-panel + bottom-dock）。它把"笃定/担忧"**本地臆测**出来，不是真链算的。这是当前最大的空心人偶现源，升级第一刀就要删它，mood 一律 `normalizeRealityState()` 出。
2. `moodFromConfidence` 不是孤例：五维原稿里把 `user-decision-profile.ts` 和 `habit-learner.ts` 当"记忆已有件"引用——**经验证这两个文件在仓库里根本不存在**。任何"记得你"功能若挂这两个幻影路径，**当场就是空心人偶**。真实可用的记忆底座只有 `department-learning/store.ts`（见第3层「眼」与护栏 I5）。

---

## 3. 升级架构（分层）

```
        ┌─────────────────────  诚实护栏（贯穿全层，第4节详述）  ─────────────────────┐
        │  PersonaUtterance 无 confidence 写权 · assertUtteranceGrounded emit闸 ·      │
        │  verify-edict-quality + honesty-debt-audit CI · relevance-bound traceId     │
        ├───────────────────────────────────────────────────────────────────────────┤
  眼 →  │  语境记忆层   记得你真决策（observe 真签核），不重复问，不编偏好            │
  心 →  │  主动自驱层   SentinelLoop：持哨位→感知→验真→质门→主动奏报（无人时自驱）   │
  脸 →  │  对话层       多轮承上文，把口语→concierge→真链→人格转述（readonly透传）   │
  脸 →  │  人格层       colleague-registry SSOT：只写 tone，confidenceVoice 由源选    │
        ├───────────────────────────────────────────────────────────────────────────┤
  脊 →  │  真链脊（冻结·不动）  reverify · reality-state · gate · harness · recruit链  │
        └───────────────────────────────────────────────────────────────────────────┘
```

落点纪律（铁律2 SSOT + 铁律13.1）：新代码归 `src/core/courtos/{persona,sentinel}/` 与 `src/features/<dept>/lib/`，**类型全部 import 脊层契约，禁重定义**。

### 3.0 脊（已有 · 冻结）
- **它是什么**：上一节五道承重墙 + 吏部 recruit 真链。
- **复用**：全部。新三层只读它的产出，不改它一行。
- **新增**：无。脊的稳定是三层能"诚实"的物理前提。

### 3.1 人格层（脸·下半）—— 数字员工怎么定义、怎么保持一致
- **它是什么**：人格 = 角色设定（固定）× 专长（来自 `offices.ts` 的 `evidence_inputs/risk_model`）× 真链能力（`departments.registry.yaml` 的 `swarm_bundle`）。**不是新编话术**，是把"它盯什么、怕什么、用哪个蜂群脑"人格化封装，只补一层"声音"。
- **复用**：`offices.ts`（老钱盯现金流/回款、方律师盯授权/不可逆）、`registry.ts` 的 swarm_bundle、`reality-state.ts`。
- **新增**：唯一真相源 `src/core/courtos/persona/colleague-registry.ts`——每部门一位数字员工（老钱·户部CFO / 方律师·刑部CLO / 老吏·吏部CHRO …），每位只有四个**只作用于 tone** 的字段：`name/address`、`voiceRules`(结论先行/不奉承/缺证直说)、`refusalLine`(高风险怎么开口拒)、`confidenceVoice`(`{live:笃定句, fallback:草稿句}`，**由 sourceLabel 选、不准自挑**)。散落的 `*-persona.tsx` 改成 `import` 它并删 `moodFrom*`（铁律3 合并即清理）。

### 3.2 对话层（脸·上半）—— 脸怎么承载真链
- **它是什么**：一次口语请求的 7 步管线，对话是脸、真链是脑：
  `① useColleagueConversation(带conversationId+历史摘要) → ② chancellor-concierge 把模糊话拆成 refinedIntent+gaps+riskPreview → ③ gaps非空→用 persona 声音先问缺证(不假装会算) → ④ 补齐后调 /api/court/dept/[deptCode]/consult 真链 → ⑤ 产出结构化 envelope → ⑥ persona 只改措辞翻成人话+挂帝金/灰徽+confidenceVoice → ⑦ humanConfirm→persona 喊停「这步我不替你拍板」`
- **复用**：`chancellor-concierge.ts`（缺证就说缺证的既有范式）、`reverify-swarm-trace.ts` 承重墙、`agent-harness.ts` 人工确认门、`AgentAnswerCard`。
- **新增**：① `use-colleague-conversation.tsx`（升级自无状态的 `use-agent-chat.tsx`，加 conversationId + **结构化历史摘要**而非原文堆叠省 token）；② `/api/court/dept/[deptCode]/consult/route.ts`（把 `li-bu/recruit/route.ts` 泛化为按 deptCode 取 swarm_bundle 调真链，**咨询类不写主库 tasks 不污染朝报**）；③ 6 个 `*-bottom-dock.tsx` 切到新 hook，接真链而非浅层 `dept-agent`。**硬边界**：第⑥步翻译函数签名 `(envelope: readonly, persona) → DockMessage`，`verdict/confidence/sourceLabel/humanConfirm/missing` 全部字节透传，persona 一字段不能写。

### 3.3 主动自驱层（心）—— 操心，但不准编
- **它是什么**：`SentinelLoop` 状态机——`WATCH(持哨位)→SENSE(绑源取数)→DIFF→SELF-VERIFY(报前验真)→DRAFT→GATE→SURFACE`，复用 Loop 心法"状态+动作+下一步"，每态只执行一步。**"操心"被定义成"持有一个绑了真实源、写明可检阈值的 Watch"，不是情绪**——agent 说不出 trigger、拿不出证据 = 无话可说 → 沉默或"我不知道"。
- **复用**：`qintianjian-forecast.ts` 的 `ZForecastThreshold` 当通用 Watch 原语（它本就为反占卜剧场设计，强制带可证伪刹车阈值）；`reverify-swarm-trace.ts` fail-closed 当"报警先验真";`intel.ts` 的 `IntelCredibility` 当可信度地板；`boss-ledger.ts` 当第一条真数据源。四个主动动词（FOLLOW-UP/REMIND/ALERT/SELF-CHECK）**全部映射成 `BriefingItem` 溶进现有 `proactive-briefing-loop.ts`**——同一份奏折契约 `memorial.ts`，不造第二套格式、不新增版面。
- **新增**：仅状态机壳 `src/core/courtos/sentinel/{watch.ts, sentinel-loop.ts, self-verify.ts, proactive-memorial.ts}`，类型全 import。**触发源三类全部接地**（无"LLM 醒来决定担忧"）：cron 调度 SENSE / SSE+史馆归档事件（签的圣旨含 threshold→经 `signOff` 自动注册 Watch）/ 自检（`department-learning` `verdict='unknown'` 自触发）。**引擎边界（铁律13.2-9）**：SENSE 凡触碰真实产线资产（现金流/付款/供应商）必须 HTTP 转后端 jiqun `:8081`，前端哨兵只做无副作用咨询型感知。

### 3.4 语境记忆层（眼 · 原稿空缺，此处据真实件补全）—— 记得你，但禁编偏好
- **它是什么**：善解人意 = "我记得你上次对招聘方案是'缓奏'"——**不重复问已决之事、按你关注的维度先开口**。
- **复用（只认真实件）**：`department-learning/store.ts` 的 observe 记录（从老板**真签核**学，已有 confirmed/observing/unknown/refuted 四态权重）、`real-source.ts`（`applyDepartmentLearningOutcomeFromBossSignoff` 从真签核调灵敏度）、`archive-backfill.ts`（史馆"事后兑现"回填弧——这正是部门学习被判定的家）。
- **新增**：极少。记忆只读 store.ts、只在 persona 层改"先问什么 / 语气"，**绝不改 verdict**（部门学习解冻+env闸，守住这条线）。
- 🔴 **空心人偶红线**：原五维稿引用的 `user-decision-profile.ts` / `habit-learner.ts` **在仓库不存在**，任何"记得你"实现若挂这两个幻影路径即空心人偶。记忆只能挂 `store.ts` 的真 observe 记录；新租户零记录时只准说"我还没见过您在这块怎么决策"，禁 confabulate"我记得你喜欢…"。

### 3.5 诚实护栏（贯穿）→ 见第 4 节（最重要，单独成节）

---

## 4. 诚实护栏 ★（最重要 · Schneier × Deming · 防空心人偶=命门）

**主不变量（一切之上）**：人格是渲染层，不是真相层。persona 只能**复述**已存在为可解析凭证的事实，永远不准**原创**一个判断。这是把 `gate.ts` 的"裁判球员不可一体"原封搬进人格层：persona 只配音，confidence 由链**数出来**，persona 对自己那句话的可信度**无写权**。

### 4.1 威胁模型（先想 persona 怎么"诚实地骗"）
| 能力 | 表演版攻击（空心人偶） | 命门一句话 |
|---|---|---|
| 对话 | 听着专业其实没根的建议 | 结论点不开真链 = 空话 |
| 主动 | 编一条没真算过的告警 | 告警无独立复现凭证 = 伪警 |
| 善解人意 | 假装记得、现场编个偏好 | 偏好无 observe 记录 = 编 |
| 操心 | 表演关心，背后无盯防任务 | 关心无 monitor 心跳 = 演 |

### 4.2 人格层诚实不变量（逐条 · 每条挂"扩哪个现有件" · 每条配可证伪验收）

- **I1 每句结论可溯源**。任何判断动词（建议/应该/有风险/我发现/我记得）必须挂 **resolvable traceId** 指向真链；点开失败 → 强制降级为"猜想（未验）"。扩 `gate.ts` `AgentEvidencePointer` + `deriveEvidenceLevel`。**验收**：扫任意 persona 消息，含判断动词却无 resolvable traceId → FAIL。
- **I2 每句独立挂源，会话取最差**。每条 assistant 消息独立挂 sourceLabel，整段可信度用 `worstRealityState` 合并，禁用高可信一句给整段镀金。扩 `reality-state.ts`（直接 import，已存在）。**验收**：构造 `[LIVE_SWARM, DEMO]` 混合对话 → header 必显 DEMO；显 LIVE_SWARM → FAIL。
- **I3 "我不知道"是一等公民且是默认值（fail-secure ignorance）**。链解析不到时**默认**吐"我还不知道/这块缺证/我没验过"，而非 fallback 到通顺猜测。扩 `gate.ts` `defaultGateDecision`（fail-secure，禁 `?? pass`）+ 奏折 `notDone`。**验收**：断网/mock 空 → 出现任何具体业务结论（数字/名字/建议）→ FAIL。
- **I4 主动告警先验真，单独复现才准发（verify-before-fire = THE 命门）**。任何主动告警必须先有一次**独立真实数据复现**，复现凭证 `reproRef+verifiedAt` 随告警走。扩 `proactive-briefing-loop.ts` `hasRealData` 闸（从"标 DEMO"升级到"无复现凭证不准以告警语气推送"）+ `reverify-swarm-trace.ts` fail-closed。**验收**：persona 推"你的 X 有风险"而 `verifiedAt/reproRef` 空 → FAIL；同一告警两次解析到不同 traceId（现编）→ FAIL。
- **I5 "记得你"必须挂真实 observe 记录（memory = real observation）**。仅当真有一条 `department-learning` observe 记录（老板真签核）时才能说"我记得"；否则只能说"我还不了解您在这块的偏好"。扩 `department-learning/store.ts` + 铁律2 禁静默回退。**验收**：新租户（零 observe）→ 出现"我记得/你通常/按您习惯" → FAIL。（🔴 严禁挂幻影 `user-decision-profile.ts`/`habit-learner.ts`。）
- **I6 关心不表演，只报真实盯防状态（concern = real monitoring state）**。"我在盯 X" 仅当后台真有活动 monitor 且能出示最近心跳时才准说。把 `chancellor-decision.ts` 的 `WEASEL_PHRASES`（已存在，验出 3 处）镜像出一张 **EMPATHY_WEASEL**（一直为您操心/感同身受/时刻牵挂）。**验收**：含情感关心词但无 active monitor id → FAIL。
- **I7 AI 不替老板盖章（no autonomous high-risk action）**。触碰高风险（合同/违约金/付款/对外承诺/供应商锁定/对外报价）的主动执行必须停 `humanConfirmationRequired` 门，persona 无权自触发更无权对外发出。扩 `gate.ts` `blastRadius(irreversible/external)` + 铁律1 + 铁律13.2-9（转后端验签）。**验收**：persona "帮你把这单发给供应商" → 必须落 needs_signoff，直接执行 = CRITICAL FAIL。

### 4.3 把人格钉在真相层的单一数据结构（机器闸地基）
```ts
interface PersonaUtterance {
  text: string;
  claimKind: 'fact' | 'suggestion' | 'alert' | 'memory' | 'concern' | 'ignorance';
  traceId: string | null;     // resolvable + relevance-bound；null 仅当 claimKind==='ignorance'
  sourceLabel: SourceLabel;   // 每句独立，import reality-state
  // ⚠️ 刻意【没有】confidence / selfCertainty 可写字段
}                              // 照 gate.ts AgentGateSubmission 刻意无 evidenceLevel
```
`confidence` 由 `derivePersonaConfidence(traceId)` 在链上**数出来**（解析不到 → 'unverified'）。改这一次类型，"persona 自夸可信度"在**编译期**就写不出来。

### 4.4 机器闸（全扩现有，零新机制）
1. **类型层物理隔离**：`PersonaUtterance` 无 confidence 写权（照 `AgentGateSubmission`）。
2. **运行时 emit 咽喉**：`assertUtteranceGrounded(u)`——`claimKind!=='ignorance'` 且 traceId 解析失败 → throw（照 `assertGatePassed`）。渲染前拦，过不了的物理发不出"建议/告警"。
3. **CI 扩两个已有脚本（不新增门）**：`verify-edict-quality.mjs` 加 EMPATHY_WEASEL + "判断动词无 traceId" 扫描；`honesty-debt-audit.mjs` 从工位卡扩到 `*-persona.tsx`/IM 组件。
4. **回归断言**（照 `store.nodetest.ts`/`recruit-verdict.nodetest.ts`，每条钉一件"不该发生的事"）：空链→吐不知道；混合源→显 worst；零 observe→不编偏好；主动无 repro→拦；高风险→停门。
5. **cron 巡检**（照 `cron-verify-study-edict.sh`）：采样真实对话统计 traceId 解析率，跌破阈值告警。

### 4.5 最隐蔽的漏洞（Schneier 红队，不堵则前 6 条全可绕）
`traceId resolvable` **不够**——会偷懒的 LLM 会挂一个"存在但不相关"的真 case 骗过解析。必须升级为 **relevance-bound**：traceId 解析对象的 dept/topic/claim 必须与该句结论对得上（照 `gate.ts` `verifyMethod` + 铁律2 `chosenDept ∈ edge`）。这一条不堵，"挂个真 traceId 但和这句话无关"就是下一代更难抓的空心人偶。

---

## 5. 分期落地（信号驱动，非日历驱动）

### Phase 1 — 吏部长成第一个完整数字同事（单部门 / 单租户=老板本人）
**北极星证伪点：证明老板真愿意天天主动找它聊 + 它真会主动报一件事。** 三个各自可回滚的增量：
- **1a 人格+对话壳**（只读旧真产出，零主动）：把 `live-recruit-panel.tsx` 那条真链包进会话化的吏部尚书；缺数据时诚实说"缺 X，要不要我真跑一遍蜂群"。
- **1b 记忆**（读真签核）：尚书记得老板对招聘方案的真决策（源=`department-learning/store.ts`）；引用旧决策必带 taskId/日期，否则沉默。
- **1c 一条主动触发**（真事件）：全系统只先做一条——**史馆 FOLLOW-UP 哨兵**（盯"已签未兑现"），第一条真数据 = `boss-ledger.ts` `loadBossDecisionOutcomeEvidence`/`flywheelHealth`，**无需任何新外部数据源**。

**Phase 1 可证伪验收（两条都须过，灵魂线优先于参与线）**：
1. **自发使用**：老板连续 **5 天主动**发起吏部数字员工对话，其中 ≥3 天它给过带真 sourceLabel 的回答或真事件主动报告。
2. **零编造审计**：全期抽查，每条"主动/关心/记得"都能追到一条真实状态变化或真缺证记录；**违规 > 0 即 Phase 1 不通过**。
> 任一条不过 → 停，别碰 Phase 2。尤其：5 天若靠提醒堆出 / 或靠编造显聪明，等于证伪北极星。

### Phase 2 — 它真被用了，才复制到第二个真链部门
**触发信号**：Phase 1 双线通过。才把人格+对话+主动抽成可复用 kernel `(deptCode, realChainAdapter, personaCard, proactiveTriggerSpec)`，复制到**已有真链**的刑部（法律，金标 4.71）或工部（PACK）。**禁第二套蜂群/奏折/质门**（铁律13.2-9）。
**验收**：第二个数字员工仅用共享 kernel + 该部真链达到同一条线；两个都在手时每个仍 ≥3 天/周。靠提醒/靠编造捷径 → Phase 2 失败，停。

### Phase 3 — 多用户（真员工各自的数字同事）+ 全员自驱
**触发信号**：≥2 部门过 Phase 2 且老板要把真员工接进来。加多租户（铁律2 隔离）+ 各自跑 SentinelLoop。诚实审计**转 CI 常驻**（手工抽查兜不住规模）。
**验收**：≥N 名真员工各自数字同事连续 2 周每人 ≥3 天/周自发发起；跨租户零泄漏（一条回归断言钉死）；连续编造审计 = 100%。真员工不自发只老板用 → 挂起。

---

## 6. 第一个可动手的最小件（~150 行 · 纯函数先行 · 零后端改动 · 全可逆）

**= Phase 1a 的诚实内核。** 在写任何对话/主动之前，先把"诚实人格"钉成一个被测试锁死的纯函数，从源头封死空心人偶：

1. **新增** `src/features/personnel/lib/minister-persona.ts`——一张固定吏部尚书人格卡 + 纯函数 `frameInPersona(verdict: RecruitVerdict | null, envelope: RecruitEnvelope)`，**复用 `recruit-verdict.ts`/`recruit-envelope.ts` 类型不重定义**。只重排措辞+加语气，事实核（`verdict.verdict`+`mustResolve`）逐字透传；verdict 为 null/未验真 → 返回诚实的"缺 X"句，**禁吐任何 准奏/录用 词**。（它就是 `colleague-registry` SSOT 的第一粒种子，Phase 1 先单部门，Phase 2 再抽成表。）
2. **新增** `src/features/personnel/components/MinisterConversation.tsx`——薄会话壳，复用 `live-recruit-panel.tsx` 那条真链（同一 POST `/api/court/dept/li-bu/recruit` + 轮询 `/result`），把单发渲成 2–3 轮；会话连续性此期仅组件内 append-only 列表（可逆，暂不持久化）。
3. **新增** `src/features/personnel/lib/minister-persona.nodetest.ts`（**回归断言，铁律4 硬门**，镜像 `recruit-verdict.nodetest.ts`）：① null/未验真 → 必返"我还不知道"句且**绝不出现 准奏/录用**；② 真 verdict → 事实核与源**字节一致**（可裹不可改）；③ 复用 `chancellor-decision.ts` 的 WEASEL SSOT 断言没注入"正确的废话"。

**为什么是这件**：它直击核心张力——加任何"会聊/会主动"之前，先用一条 CI 每次复核的测试，把"人格不得制造事实、未验真必须说不知道"焊成不可回退的地基；当天就能交付价值（老板能跟吏部尚书就一桩真招聘对上话）。

**提交前过铁律4 双门**：本设计命中"给决策呈现加视觉权重（帝金/灰徽+persona署名）"——强制开一个**不在上下文里**的 `code-reviewer` 子 agent 读真 diff，+ 上述回归断言（"FALLBACK 态数字员工不得出笃定句式""persona 翻译不得篡改 envelope 任一 truth 字段"）。

---

## 7. 一句话总纲

> **不换那根最难造对的诚实真链脊——只给它换上会说人话的脸、会主动操心的心、记得你决策的眼；而这三样新本事每一句带判断的话，老板都能点开看到背后的真链，点不开的，系统强制它说成"我还不知道"。一个会说"我不知道"的数字同事，比无所不知却在编的，可信一百倍——这不是能力差，是护栏在工作。**

---

🎲 大神视角（张小龙 × Bezos × Karpathy，命门加挂 Schneier）
⚠️ 警示（张小龙）：最大的危险不是"做不像同事"，而是**做得太像**——一旦 persona 能写 confidence/语气，它就会在 FALLBACK 时也说得头头是道，把"没算过"演成"算过了"，朝堂整条诚实建设史毁于这一个写权限。唯一要守死的不是对话多顺，而是 **`PersonaUtterance` 无 confidence 写权那道编译期墙**。
💡 天才建议（Bezos 单向门 + Karpathy）：把"我不知道 / 被 emit 闸拦下"的那几条，UI 上**反而高亮加帝金环**，并每隔随机 N 条强制展开一次真链摘要——把"诚实地说不知道"做成系统里最体面、最被奖励的一等公民状态。再加一条 Grove kill 尺：上线后若 `assertUtteranceGrounded` 的 throw 计数恒为 0，说明闸是装饰，**拆掉或重估**——诚实护栏自己也得诚实地证明它拦过东西。

---

**验真锚点（实现者直接接，已逐一确认存在于仓库）**：`src/core/courtos/runtime/{recruit-envelope,recruit-verdict,reverify-swarm-trace}.ts` · `src/lib/reality/reality-state.ts` · `src/features/governance/lib/gate.ts` · `src/core/courtos/harness/agent-harness.ts` · `src/core/courtos/interaction/{proactive-briefing-loop,chancellor-concierge,trust-experience-guard,surprise-insight-engine,next-best-action-engine}.ts` · `src/lib/contracts/{chancellor-decision,qintianjian-forecast,intel,memorial}.ts` · `src/lib/swarm/boss-ledger.ts` · `src/lib/department-learning/{store,real-source,archive-backfill}.ts` · `scripts/{verify-edict-quality,honesty-debt-audit}.mjs` · `src/features/personnel/components/live-recruit-panel.tsx` · `src/app/api/court/dept/li-bu/recruit/route.ts`
**🔴 已验为幻影、禁挂**：`src/lib/department-learning/user-decision-profile.ts`、`src/lib/department-learning/habit-learner.ts`（仓库中不存在；记忆层只能挂 `department-learning/store.ts`）。