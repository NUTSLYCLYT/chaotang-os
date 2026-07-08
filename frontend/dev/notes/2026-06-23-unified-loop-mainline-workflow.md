# 朝堂统一 Loop 主线 Workflow 方案 + 验收标准（10 件事）

> 起点：`master` 干净同步，HEAD `428a394`，上书房确认→军机处统一 Loop 的 smoke 已绿。
> 本文是**研发流程方案 + 可验收 DoD**，不是多智能体编排工具。一切锚定真实 SSOT 文件，禁造平行类型（铁律2 / AGENTS.md §13.1）。
> 每条目"完成"的唯一判据：它的回归断言**进了每日主线 gate（item 10）且常绿**。口头"按构造正确"不算完成（铁律4 / Deming）。

---

## 0. 现状锚点（开工前已核实，不靠记忆）

| 关注点 | 唯一真相源（import 它） | 现状 |
|---|---|---|
| Loop 状态机 | `src/core/courtos/types.ts`（`DecisionState` 13 / `DecisionAction` 12）、`loop-trace.ts` | 有骨架 |
| 任务态/转移 | `src/lib/contracts/task.ts`（`TaskStatus` 11 + `TASK_STATUS_TRANSITIONS` + `LEGACY_TASK_STATUS_MAP`） | 冻结契约 |
| 决策入口 | `src/app/api/court/decision/route.ts`；上书房 `…/shangshufang/{draft-edict,confirm-edict}`；裁决 `…/shangshufang/tasks/[taskId]/decision/route.ts`（已调 `saveShiguanArchiveRecordV1`） | 通 |
| 丞相拟旨 | `src/lib/contracts/chancellor-decision.ts`（`verdict/theOneThing/conflictsResolved[]/reversibility/signoff`） | 冻结 |
| 部门意见 | `src/core/courtos/departments/registry.ts`（`DepartmentOpinionV1`：signal/verdict/missing_evidence/risks/next_order/human_confirmation_required/source_label）+ `offices.ts` | 有 builder |
| source_label | `src/core/courtos/source-label.ts`（`SourceLabel` 5 值 + `mergeTwo` + `isGenuineSwarmTraceId`/`assertLiveSwarmTrace`）↔ `src/lib/reality/reality-state.ts` | SSOT 就位 |
| 质门 | `src/features/governance/lib/gate.ts`（L0–L4 + blast-radius + `GateVerdict` + `assertGatePassed`） | 接入 decision |
| 短码↔registry | `src/core/courtos/unified/department-registry.ts`（`PROTOCOL_ID_BY_ID`）+ `src/lib/contracts/dept.ts`（`DEPT_TO_AGENT_CODE`）+ `agent.ts`（11 码 `AGENT_META`） | **三套并存=漂移风险** |
| 史馆归档 | `src/core/courtos/archive/archive-store.ts`（`saveShiguanArchiveRecordV1`→`backfillDepartmentLearningFromArchive`、`findSimilarCourtArchives`）；`ShiguanArchiveRecordV1` 现居 `src/lib/shangshufang/local-decision-loop.ts`（位置不在 contracts，待归位） | 有写路 |
| 军机处 | `src/app/(dashboard)/command-center/page.tsx`、`src/features/command-center/components/{command-center-workspace,BattleStream}.tsx`（`UnifiedLoopSummary` 定义了但**未铺全字段**） | 摘要级 |
| 上书房 UI | `src/features/shangshufang/components/*`（待加 testid） | 重首屏 |
| gate 原料 | `tsc --noEmit`、`test:core`、`build`、`test:e2e`、`guard:honesty/freeze`、`eval:*` | 散件齐 |

**当前 smoke 的真相**：`e2e/shangshufang-unified-loop-smoke.spec.ts` 走 **API 直连**（`page.request.post`）再跳 command-center，**没点真实 UI**——所以"点 dock 不稳定"没被覆盖。这是 item 1 的缺口，也是为何它排第一。

---

## 1. 总纲：Loop = 状态 + 动作 + 下一步

主闭环（§13）：**上书房问题 → 丞相拟旨 → 缺证检查 → 军机处会审 → 圣旨/奏折 → 用户裁决（采纳/补证/复核/驳回/追问） → 高风险人工确认 → 史馆归档 → 下次引用旧案。**

波次（按你的行进顺序，仅加一条依赖纠偏）：

- **Wave A · 把"老板提问→裁决归档"真闭环跑通**：item 1 → 2 → 4 → 5
- **Wave B · 把可信度与安全锁死**：item 6 → 7
- **Wave C · 统一部门体系**：item 3 → 8
- **Wave D · 接外脑/本地模型**：item 9（单向门，最后做）
- **脊柱（Day 0 起常驻）**：item 10 每日主线 gate

> ⚠️ **主动暴露的一条矛盾（Karpathy）**：item 2（会审工作台渲染"参审部门/各部门意见"）和 item 8 隐式依赖 `PROTOCOL_ID_BY_ID` 不漂移，而 item 3（统一词表）你排在 Wave C。
> 纠偏：**Wave A 内先做 item 3 的"读路 SSOT 钉死 + fail-fast 断言"这一最小子集**（所有渲染只准 `import PROTOCOL_ID_BY_ID`，未知码 `throw` 不 `?? code`），把"三套词表整体收敛"的重活留在 Wave C。否则等于在漂移地基上盖会审工作台。

---

## 2. 横切验收（**每个** item 都必须过，缺一不算完成）

派生自铁律 + §13.2/§13.3：

1. **SSOT-import**（铁律2）：新代码从第 0 节表 `import`，grep 不得出现第二份平行 map / 第二套奏折格式 / 第二套质门。
2. **source_label 全覆盖**（§13.2.2/3）：任何面向用户的判断都带 label；`FALLBACK/DEMO` 禁伪装 `LIVE`；roll-up 一律用 `mergeTwo`，禁手搓合并。
3. **双门**（铁律4）：`git diff` 命中 `upsertPrimaryTask`/`INTO tasks`/决策卡视觉权重（`boxShadow`/徽章/放大）→ 强制 (a) **独立子 agent 会审** 真实 diff（`code-reviewer`/`expert-panel`，禁自审）+ (b) **一条回归断言** 钉住"不该发生的事"。
4. **版面预算**（铁律5）：新能力先答"能否溶解进已有工位"+"第一条真实数据从哪来"；答不出=冻结，**默认不新增可见页面**（item 2/7/8 一律增强既有 command-center / ReviewDock，不新建路由）。
5. **fail-fast 不静默回退**（铁律2）：映射/契约校验失败 `throw` 或 `logger.warn`，禁 `?? code`/`?? null` 把漂移伪装成成功。
6. **§13.3 八问每改动自答**：影响哪条 Loop？从哪态进？去哪态？产出什么 sourceLabel？需否人工确认？失败怎么办？是否持久化？有无 eval/test？

---

## 3. item 10 · 每日主线 gate（**脊柱，先建**）

> 先有 gate，才能让后面每个 item"挂上去就被 CI 复核"。这是所有验收的绑定点。

**产出**：`scripts/daily-mainline-gate.mjs` + `package.json` 脚本 `gate:daily`，fail-fast、打印失败在哪一关：

```
1) pnpm exec tsc --noEmit
2) pnpm test:core                 # src/core/courtos/**/*.nodetest.ts
3) pnpm build                     # next build 比 tsc 严（AGENTS.md §9）
4) pnpm exec playwright test e2e/shangshufang-unified-loop-smoke.spec.ts --project=chromium
5) pnpm guard:honesty             # DEMO/FALLBACK 不得伪装 LIVE
6) pnpm guard:freeze              # 学习安全守护
```

**随波次生长**（每 item 落地把自己的断言追加进 gate）：

| 落地 item | 追加进 gate 的断言 |
|---|---|
| item 1 | `e2e/shangshufang-ui-to-edict.spec.ts`（真实 UI 路径） |
| item 4 | `…/user-ruling-loop.nodetest.ts`（5 动作转移+持久化） |
| item 5 | `…/shiguan-archive-pollution.nodetest.ts`（归档零污染主表） |
| item 8 | `…/department-opinion-shallow.nodetest.ts`（七部统一契约） |
| item 6 | `guard:honesty` 扩为"无 label 即失败" |
| item 7 | `…/signoff-gate.nodetest.ts`（高风险无签名即 throw） |

**DoD（item 10）**
- [ ] `pnpm gate:daily` 一条命令跑完全链，任一关红即非 0 退出并指明关号。
- [ ] 接 pre-push hook 或 CI：master 红 gate 阻止合入。
- [ ] gate 内每条断言都能独立复现（`--repeat-each=3` 不抖）。

---

## 4. Wave A — 真闭环（item 1 / 2 / 4 / 5）

### item 1 · 上书房真实 UI 输入 → 确认拟旨（稳定 E2E）
- **Loop**：`shangshufang.draft` → `awaiting_confirm` →（用户确认）→ 进统一 Loop（`reviewing`）。
- **锚点**：`src/features/shangshufang/components/*`（待加 `data-testid`）、`…/draft-edict`、`…/confirm-edict`、`command-center/page.tsx`。
- **改动边界**：① 给上书房提问框 + 确认按钮加 `data-testid="ssf-ask-input"` / `data-testid="ssf-confirm-edict"`；② 新建 `e2e/shangshufang-ui-to-edict.spec.ts` 走**真实点击**（非 `page.request`）。复用 smoke 的 JWT 种子（cookie `courtos.access_token` + localStorage `courtos.auth`，AGENTS.md §11）。
- **source_label**：拟旨卡显示 label（本地缺后端=`FALLBACK`，禁标 LIVE）。
- **双门**：否（不写主表、不加决策视觉权重）。
- **DoD**
  - [ ] spec 走真实 UI：种 JWT → `goto` 上书房 → 断言输入框 `toBeEditable()`（抓 hydration 未就绪）→ 输入真问题 → 点确认 → 拿到 `taskId` → 跳 command-center 见同一案号。
  - [ ] **零 `waitForTimeout`**，只用 `getByTestId`/`waitFor` 确定性等待（web/testing 规则）。
  - [ ] `--repeat-each=5 --project=chromium` 连过 5/5。
  - [ ] 进 gate（item 10）。

### item 2 · 军机处摘要 → 真正会审工作台
- **Loop**：`reviewing` 态的可视化；不改状态机，**只补渲染**。
- **锚点**：`command-center-workspace.tsx` 的 `UnifiedLoopSummary`、`BattleStream.tsx`、`DepartmentOpinionV1`（registry.ts）、`GateVerdict`（gate.ts）、`TChancellorDecision.conflictsResolved`。
- **改动边界**（铁律5：**增强既有页，不新建路由**）：在 command-center 加一个 view-model adapter `buildUnifiedLoopSummary(task, opinions, gate, chancellor)`，铺六块：① 参审部门（短码）② 各部门 `DepartmentOpinionV1`（signal 配色 + verdict + summary）③ 冲突（`conflictsResolved`）④ 证据缺口（各部门 `missing_evidence` ∪ `gate.missingEvidence`）⑤ 后令（`next_order`）⑥ 质门状态 + **阻断原因**（`gate.decision==='block'` 时的 `reason`）。
- **source_label**：每块带 label，整卡用 `mergeTwo` roll-up。
- **双门**：**是**（给会审结论加视觉权重）→ 需独立会审 + 回归断言。
- **DoD**
  - [ ] `buildUnifiedLoopSummary` nodetest：`gate.decision==='block'` 时 `blockingReasons` **非空**（禁静默空）；任一部门 `human_confirmation_required` 时摘要置 `signoffRequired=true`。
  - [ ] E2E（扩 item1 spec）：对真实 taskId 断言六块可见。
  - [ ] 独立 `code-reviewer` 子 agent 读真实 diff 出具会审记录（禁自评）。

### item 4 · 用户裁决闭环（采纳/补证/复核/驳回/追问）
- **Loop**：`awaiting_decision` →（`DecisionAction`）→ `adopted` / `awaiting_evidence` / `rechecking` / `rejected` / `followuping`。
- **锚点**：`…/shangshufang/tasks/[taskId]/decision/route.ts`、`types.ts` `DecisionAction`、`task.ts` `TASK_STATUS_TRANSITIONS`、`primary-store.upsertPrimaryTask`、command-center `ReviewDock`。
- **改动边界**：裁决路由按 5 动作写回任务态 + 保上下文（`original_question`/`draft`/`memorial` 不丢）；ReviewDock 五按钮。
- **source_label**：裁决结果 label 透传。
- **双门**：**是**（写共享主表 `tasks`，§13.2.7 禁丢任务）→ 独立会审 + 回归断言。
- **DoD**
  - [ ] 每动作一条 nodetest：给 `awaiting_decision` 任务，动作 X → 目标态正确且转移**合法**（`TASK_STATUS_TRANSITIONS`）；`result_json` 保留原问/拟旨/奏折（上下文不丢）。
  - [ ] 持久化回归：动作后 `getPrimaryTaskFull` 返回新态；模拟"刷新"重读不丢。
  - [ ] 仅 采纳/驳回 触达归档条件；补证/复核/追问 **不**提前归档。
  - [ ] E2E：ReviewDock 点每个动作→状态药丸更新→`reload`→态仍在。

### item 5 · 史馆归档 ↔ 真实裁决打通
- **Loop**：裁决 close → 自动 `ShiguanArchiveRecordV1` → `archived`；下次同类问题引用旧案。
- **锚点**：`archive-store.saveShiguanArchiveRecordV1` + `findSimilarCourtArchives`；`ShiguanArchiveRecordV1`（建议本 item 顺手归位到 `src/lib/contracts/archive.ts`，消除位置不对称——属"归档专项"内的合理收敛，非顺手重构）。
- **双门**：**是**（归档写 `court_archives` + backfill 学习；命中记忆 [[high-risk-change-double-gate]] / [[swarm-output-chain-fixed]] 的污染坑）→ 回归断言钉死。
- **DoD**
  - [ ] nodetest：采纳 → 恰好 1 条 `ShiguanArchiveRecordV1`；`archive_id` 稳定；`emperor_decision` + `human_confirmation_record` 齐。
  - [ ] **引用回路**：归档后 `findSimilarCourtArchives(同问题)` 返回 ≥1 含新档；下次拟旨带"旧案引用"。
  - [ ] **零污染回归**（铁律4 原案）：归档后 briefing 读的主库 `tasks` **不含**伪装成奏折的归档行（断言奏折计数不变，档只进 `court_archives`）。
  - [ ] 档上 source_label 诚实（禁 DEMO 当 LIVE）。

---

## 5. Wave B — 可信/安全（item 6 / 7）

### item 6 · source_label 全链路 UI 可见
- **锚点**：`source-label.ts`、`reality-state.ts`；已有渲染点 `WorldCourtStage`/`PalaceHero`/`DepartmentScrollStage`/`command-center-workspace`。
- **改动边界**：抽一个共享 `<SourceLabelBadge label>`（若无则建一次，复用禁 fork），铺到**每个决策面**：上书房拟旨 / 军机处会审 / 各部门意见 / 奏折 / 史馆记录。`FALLBACK`/`DEMO` 徽章**必带**警示文案"不能当真实最终判断"。
- **DoD**
  - [ ] `guard:honesty` 扩断言：渲染的 `Judgement`/`Memorial`/`DepartmentOpinion` 无 label 即失败；`FALLBACK`/`DEMO` 无警示文案即失败。
  - [ ] E2E：≥5 个面断言徽章可见；`FALLBACK` 任务断言警示文案在场。
  - [ ] roll-up 一律 `mergeTwo`（grep 无手搓合并）。

### item 7 · human signoff 强交互
- **锚点**：`gate.ts`（`GateVerdict.signoff{actor,at,note}`、`needs_signoff`、`assertGatePassed`）、`chancellor-decision.ts`（`signoff{required,basis}`）、§13.2.5 高风险清单。
- **铁律1 同门**：签名写入 + 采纳写入须**同一道门**（CSRF 同源 + 幂等 + 租户隔离），禁 decode-only 放行后直写 ledger。
- **改动边界**：`needs_signoff`/`signoff.required` 时，**采纳按钮禁用**直到填非空确认说明；提交写 `GateVerdict.signoff`。
- **双门**：**是**（高风险呈现 + 写台账）。
- **DoD**
  - [ ] nodetest：高风险 verdict 无 `signoff.note` → `assertGatePassed` `throw`；采纳 API 拒 4xx；同决策两次=一次写（幂等）。
  - [ ] 高风险关键词走 `gate.ts` `highRiskKeywords` SSOT（无平行清单）。
  - [ ] E2E：高风险任务→采纳被禁→填说明→采纳成功→档带 `human_confirmation_record`。

---

## 6. Wave C — 统一部门体系（item 3 / 8）

### item 3 · 统一短码 ↔ registry id（SSOT 收口）
- **锚点**：`unified/department-registry.ts`（`PROTOCOL_ID_BY_ID` 设为唯一表）、`dept.ts`、`agent.ts`。
- **改动边界**：所有侧 `import` 同一表；删/重定向平行 map；未知码 `throw`（禁 `?? code`）；写偏好前断言 `chosenDept ∈ edge`（铁律2）。
- **DoD**
  - [ ] nodetest：每个启用短码 → protocol id → 回程，启用集**双射**；未知码**抛错**（非静默）。
  - [ ] guard grep：映射模块内无 `?? code`/`?? null`。
  - [ ] UI 选部列表 === registry 启用列表（同源测试）。

### item 8 · 七部浅层可用 → 统一 `DepartmentOpinionV1`
- **锚点**：`department-registry.ts`（7 部 enabled）、`departments/registry.ts` `buildShallowDepartmentOpinionsV1`、`offices.ts` `buildDeepOfficeOpinionV1`。
- **改动边界**：锦衣卫/户部/吏部/礼部/兵部/刑部/工部全走 registry 进 Loop，输出统一 `DepartmentOpinionV1`；深层 Office 后续增强，**禁特殊流程**。
- **DoD**
  - [ ] nodetest：每启用部 `buildShallowDepartmentOpinionsV1` 产 schema 合法 `DepartmentOpinionV1`（必填全、source_label 设、signal ∈ 枚举）。
  - [ ] dispatcher **遍历 registry**（非硬编码列表）——增删一部，UI 选部 + Loop 自动跟随，零额外改动（同源测试）。
  - [ ] 浅层诚实标 label（非 `LIVE_SWARM`，除非有真 trace——接 item 9）。

---

## 7. Wave D — 外脑闸门（item 9，单向门）

### item 9 · OpenClaw / Hermes / Ollama 适配器闸门
- **锚点**：`source-label.ts` `isGenuineSwarmTraceId`/`assertLiveSwarmTrace`、`types.ts` `AgentHarnessInput/Output`、`llm/router.ts` `callLLM`；§13.2.1（AI 调用经 AgentHarness）、§13.2.9（**真实产线资产 → 转后端 jiqun `:8081`**）。
- **改动边界**：建 `ExternalAdapter`：校输入契约→设超时→失败=`FALLBACK`（绝不把裸输出/异常灌进裁决）→返 `{output, trace_id, source_label}`；`LIVE_SWARM` 仅当 `isGenuineSwarmTraceId(trace_id)`。
- **DoD**
  - [ ] nodetest：无 `trace_id` → label 强制 `FALLBACK`（不得 `LIVE_SWARM`）；超时 → `FALLBACK` + audit 记录；输出违约 → 拒不呈现。
  - [ ] 引擎边界测试：触碰 PACK/报价/BOM/交期/付款/对外承诺/供应商锁定 → 必 HTTP 转后端（路由测试断言），禁前端自建第二套产线 flow。
  - [ ] **门禁**：item 9 GATED 在 1–8 全绿之后；合并前过 `expert-panel`（接外部模型进裁决=单向门，§12 / 铁律）。

---

## 8. 验收总表（绑定到 gate）

| # | 一句话 DoD | 验收命令 / 断言载体 |
|---|---|---|
| 10 | 一条命令跑完全链、fail-fast | `pnpm gate:daily` |
| 1 | 真实 UI 点击拟旨，5/5 不抖 | `playwright … shangshufang-ui-to-edict --repeat-each=5` |
| 2 | 会审六块齐 + block 必显阻断因 | `buildUnifiedLoopSummary.nodetest` + 独立会审记录 |
| 4 | 5 动作合法转移 + 刷新不丢 | `user-ruling-loop.nodetest` + E2E reload |
| 5 | 归档零污染主表 + 旧案可引 | `shiguan-archive-pollution.nodetest` |
| 6 | 每决策面带 label，F/D 带警示 | `guard:honesty`（扩） + E2E ≥5 面 |
| 7 | 高风险无签名即拒 + 幂等同门 | `signoff-gate.nodetest` + E2E |
| 3 | 词表双射 + 未知码抛错 | `dept-mapping.nodetest`（双射 + throw） |
| 8 | 七部统一契约 + 遍历 registry | `department-opinion-shallow.nodetest` |
| 9 | 无 trace 不得 LIVE_SWARM + 产线转后端 | `external-adapter.nodetest` + 路由边界测试 |

**一个 item = done** ⇔ 它那行的断言**已进 `gate:daily` 且常绿**。

---

## 9. 风险 / 单向门 / 大神视角

- **单向门**：item 9（外部模型进裁决）、item 5 的 `ShiguanArchiveRecordV1` 归位（动归档 schema 位置）。前者过 `expert-panel`，后者属归档专项内合理收敛、需双门。
- **最易翻车**：item 2/5 双双命中铁律4（决策视觉权重 + 写共享表/学习 backfill），历史已被会审抓出 CRITICAL（自评必漏）——这两项**强制独立子 agent 读真实 diff**，不接受自审。

🎲 大神视角（Jeff Bezos）
⚠️ 警示：你把 item 10（每日 gate）排最后，是最危险的次序——没有脊柱先立，前 9 项的"完成"全靠口头，等回头补 gate 时一堆回归债已经埋进 master。gate 是**单向门**：越晚立，复核成本越高。
💡 天才建议：把 item 10 提到 **Day 0 先建空壳**——哪怕只跑 `tsc + test:core + 现有 smoke`，先让 `pnpm gate:daily` 红/绿可见；之后每落一个 item，**第一个动作是往 gate 追加它的断言，最后才写实现**（gate-first，不是 test-after）。这样"完成"永远等于"CI 替你复核过"，而不是"我觉得对"。

🎲 大神视角（张小龙）
⚠️ 警示：item 2/7/8 最大的诱惑是"给会审/签名/部门各开一个新页面"——那会踩爆铁律5 版面预算，把信号稀释成又一个让老板迷路的仪表盘。
💡 天才建议：强制自己**只在 command-center 一块画布内长出会审工作台**，ReviewDock 就地长出五动作 + 签名输入；新增可见路由数 = **0** 作为硬验收项写进 PR 模板。溶不进再谈版面，且先答"第一条真实数据从哪来"。
