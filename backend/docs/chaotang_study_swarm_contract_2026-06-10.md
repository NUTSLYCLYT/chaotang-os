# 上书房 ↔ 蜂群 交互契约与天才设计（大神会审定稿）

日期：2026-06-10
主线仓：`/home/ubuntu/workspace/jiqun_ai`（后端 / 蜂群 / flow，端口 8081）
上一版：`docs/chaotang_workflow_swarm_upgrade_2026-06-07.md`（纸面圣旨契约 + Phase1/2/3 路线）
本版定位：把 06-07 的纸面设计，钉到**真实代码现状**上，给出可落地的 I/O 契约 + 天才设计 + 最小实现。

> 取证诚实：本轮大神会审 6 位中，因 API 通道 ECONNRESET，**仅 W. Edwards Deming 一位回传完整实录**，
> 是下文唯一的"大神实录"锚点。其余 4 位（Bezos / 张小龙 / E.O. Wilson / Charity Majors）为
> **镜片应用**（编排者 Opus 读其 SKILL.md 心智模型后推演，非伪造子 agent 实录）。决策以 Deming 实录为锚。

---

## 0. 真实现状（可 grep，先对账再设计）

### 已落地 real（尊重，不推倒）
| 能力 | 证据 | 状态 |
|---|---|---|
| 上书房 study/run 真链路 | `web/routers/chaotang.py:621-665,832-920`，真调 `SwarmOrchestrator` | real |
| 圣旨 edict 6 字段 | `chaotang.py:981-1059`：圣裁/分奏/证据/风险/后令/质门 | real |
| fallback truth label | `source_mode=LIVE_SWARM`(真) vs `MIXED`(兜底) | real |
| 17 蜂群注册 + 意图路由 | `src/decree_swarm_router.py`（无命中显式默认 opc，绝不静默回退） | real |
| LaunchLoopCase 复利写端 | `src/chaotang_launch_loop.py:152-238`：attempt/prior/goldenCandidate/repeatUnresolved | real（仅写端） |
| truth_ledger 写端 | `src/truth_ledger.py`：13 检查器 + 内容哈希幂等 + 鉴权三态 + health() | real（仅写端） |

### 五大缺口（升级靶心，每条踩中"飞轮三问"）
1. **飞轮半开路** —— `truth_ledger.gate()/latest_verdict()` 定义了但**全局零调用**（docstring 写明"回归门只读本台账"，线没接）。三套飞轮（launch_loop prior / ops_snapshot baseline / truth_ledger）各自自洽、互不通信。
2. **分歧是 STUB** —— `chaotang_orchestrator.py:470` 配了 `arbitration.strategy='all'` 但只统计 `ok_groups`，无冲突检测。蜂群最大价值（暴露老板没看见的分歧）被平均掉。
3. **质门空门** —— `config/swarm_orchestrator.yaml:130,137` 仍 `min_quality_score=0`，低分 product 自动触发 quotation，垃圾流转下游。
4. **flywheel_health 看不见** —— `health()` 只有 CLI，无 HTTP 端点，dashboard/ops_snapshot 读不到。
5. **outcome 反哺死链** —— 采纳/驳回/成交/失败写入 truth_ledger 但**无人读**，不改下次路由/质门/先验。

---

## 1. 五镜片的交叉点（天才设计的地基）

> 校验技巧（CLAUDE.md）：多镜片对同一段代码给相反评价时，真相在交叉点。

- **Deming（实录）** 要 **Study**：拿真实成交/失败对账当初圣旨的预测。"台账与飞轮账面唯一区别就是 Study。"
- **Wilson（镜片）** 要 **stigmergy 信息素**：outcome 写痕 → 改变下次路由 → 好路径被走更多（正反馈），无需中央仲裁。
- **Charity（镜片）** 要 **wide event**：每道圣旨落一条高基数事件，可任意切片，别被平均数骗。
- **Bezos（镜片）** 要 **飞轮轴**：outcome 是亚马逊飞轮的轴；接口即不可逆契约（API mandate）。
- **张小龙（镜片）** 要 **一套不是三套**：老板只看一道圣旨，别让 17 群复杂度泄露。

**交叉点：五位全部指向同一个物件 —— `outcome 记录`。**
gap#5（outcome 死链）同时是五镜片的命门。
=> **天才设计的第一刀：让 `truth_ledger` 成为唯一的"信息素轨/飞轮真相源"，
砍掉并行飞轮，先闭合 outcome 这一条回路。** 其余四个缺口都挂在这条回路上。

---

## 2. 交互模式：一道圣旨，一条信息素轨

```text
老板一句话
  → 上书房 study/run（机器侧厚契约 StudyRunRequest.v2）
  → 编排器召蜂群（各群留"信息素轨"：结论+方向+证据+置信）
  → 冲突检测（两条轨反向 = 分歧涌现，不做平均合成）
  → 圣旨 edict.v2（人侧薄契约：6 字段 + 分歧一行 + 历史镜鉴一行）
  → 老板裁决（采纳/驳回/改）
  → outcome 写痕（truth_ledger.record，带鉴权 + 真实结果）
  ┌─────────────── 下一道同类圣旨 ───────────────┐
  └→ 读痕（truth_ledger.latest_verdict/gate）注入 prior → 圣旨显示"历史镜鉴" ┘
```

**老板看到几个东西？** 永远是 **1 个**：一道圣旨（张小龙铁律）。
蜂群数量、信息素轨、健康数字，全部不泄露进决策入口。
但圣旨里**新增两行白话**（Deming 实录裁决：极简 ≠ 一个干净平均数）：
- 一行分歧：`⚔️ 户部说划算 / 兵部说守不住 —— 分歧未解`（默认折叠，点开看 departments 明细）
- 一行镜鉴：`📜 上次同类：报价低于红线被驳，这次已预警`（来自读痕，不替老板决策）

---

## 3. 输入契约：上书房 → 蜂群（机器侧，加厚，版本化）

> Bezos API mandate：接口即不可逆契约，加厚但版本化（`contract_version`），机器侧消费者不怕字段多。
> 现状只有 `command + mode + taskId + entrySwarm + provider + asyncRun + idempotencyKey`（`chaotang.py:621-665`）。

```jsonc
// StudyRunRequest.v2 —— 现有字段 + 4 个新增（标 ★）
{
  "command": "string",            // 老板旨意（现有）
  "mode": "live | dry_run",       // 现有
  "taskId": "string",             // 现有
  "entrySwarm": "string|null",    // 现有，null 走意图路由
  "provider": "string|null",      // 现有
  "idempotencyKey": "string",     // 现有，幂等（燃料干净·写端）

  "contractVersion": "v2",        // ★ Bezos：契约版本，防不可逆漂移
  "decisionClass": "reversible | irreversible", // ★ Bezos 单向门：irreversible 强制 human_signoff
  "actor": {                      // ★ 燃料干净·源头鉴权（飞轮第二问）
    "id": "string",               //    写痕时 provenance=authenticated 的依据
    "role": "owner | agent | system"
  },
  "priorRef": "string|null"       // ★ Wilson 读痕：历史信息素引用（同 source/task 的上一条 outcome）
}
```

新增字段的唯一用途（拒绝装饰）：
- `decisionClass=irreversible` → 质门 `human_signoff_required=true`（对外发布/签合同/烧钱/杀项目）。
- `actor.id` → `truth_ledger.record(provenance=authenticated)`，杜绝枚举/重放投毒。
- `priorRef` → 编排器调 `latest_verdict()` 拉历史 outcome，注入 prior（**这一步就是闭合 gap#1**）。

---

## 4. 输出契约：蜂群 → 上书房（圣旨 edict，人侧，保持薄）

> 张小龙：人侧字段越少越好；新增的必须是"人的真实张力"，不是黑话堆料。
> 现状 6 字段已 real（`chaotang.py:981-1059`）。**只加 3 个，且默认折叠/单行。**

```jsonc
// edict.v2 —— 现有 6 字段 + 3 新增（标 ★）
{
  "verdict": "准奏 | 补证 | 复核 | 驳回",   // 圣裁（现有）
  "departments": [ /* 各部门结论+置信，分歧明细藏这（现有，折叠） */ ],
  "evidence": [ /* 来源·时间·材料·假设（现有） */ ],
  "risks": [ /* 不可逆/缺证/成本（现有） */ ],
  "nextActions": [ /* 下一步唯一主动作（现有） */ ],
  "qualityGate": {                          // 质门（现有）
    "status": "passed | needs_review | blocked",
    "score": 0.0,                           // ⚠ 只朝上对账 outcome，绝不朝下排名（Deming 铁律）
    "reasons": ["..."],
    "humanSignoffRequired": false,
    "repairAction": "string|null"           // ★ Deming：失败不显示"失败"，显示最小补救动作
  },

  "conflicts": [                            // ★ Wilson+Deming：分歧涌现（默认折叠，圣旨只渲染一行）
    {
      "axis": "户部 vs 兵部",
      "a": { "dept": "户部", "stance": "划算", "confidence": 0.7 },
      "b": { "dept": "兵部", "stance": "守不住", "confidence": 0.6 },
      "resolved": false
    }
  ],
  "priorMirror": {                          // ★ Wilson 读痕渲染：历史镜鉴一行（来自 latest_verdict）
    "line": "上次同类：报价低于红线被驳",
    "scoreDelta": 0.0,                      //    本次 vs 上次（复利信号，improving）
    "sourceCaseId": "string|null"
  },
  "provenance": "LIVE_SWARM | MIXED"        // ★ 把现有 source_mode 提到契约顶层（real/fallback 显式）
}
```

**关键纪律（Deming 实录）**：`qualityGate.score` 的合法用途**只有一个**——朝上对账真实 outcome 用于学习方向；
**永久禁止**用 `score`/`worst_swarm` 给蜂群排名、问责或自动惩罚路由（94% 的烂答案是系统造成的，不是某个群"不行"）。

---

## 5. 天才设计（五机制，全部挂在 outcome 回路上）

### 机制 1：信息素轨 = 唯一飞轮（闭合 gap#1 + gap#5）— Deming×Wilson 交叉点
- **写痕**：圣旨产生 + 老板裁决 + 真实 outcome（成交/失败/驳回/返工），一条事件写 `truth_ledger.record()`，
  新增 `outcome` 字段，`provenance` 由 `actor.id` 鉴权置 `authenticated`。
- **读痕**：下一道同类圣旨生成前，编排器调 **已存在但零调用的** `latest_verdict(swarm, case_id)` / `gate()`，
  把历史 outcome 注入 prior，渲染成 `edict.priorMirror`。
- **砍冗余**：`launch_loop` 的 prior 与 `ops_snapshot` 的 baseline 统一改为**从 truth_ledger 派生**，三套并一套。
- 回答"会复利吗"：✅ 一道圣旨证明改变了下一道圣旨。

### 机制 2：分歧涌现，不做平均（修 gap#2）— Wilson×Deming
- 不造中央仲裁器（Wilson：无中心控制）。蜂群各自把结论写成"轨"（含 stance 方向 + confidence）。
- 编排器只做**方向冲突检测**：同一 axis 上两条轨 stance 相反 → `conflicts[]`。把 `chaotang_orchestrator.py:470`
  的"只统计 ok_groups"升级为"对账 ok_groups 的 stance 向量"。
- 圣旨人侧只渲染**一行对立摘要**（张小龙：极简而不丢真相），明细折叠进 `departments`。
- 回答张小龙×Deming 张力：分歧不被删，只被默认折叠。

### 机制 3：质门即门，失败给补救（修 gap#3）— Deming×Bezos
- `swarm_orchestrator.yaml` 的 `min_quality_score=0`（line 130/137）改成有业务含义阈值。
- 质门失败显示 `repairAction`（缺证→去锦衣卫 / 数字冲突→去户部对账 / 法务→进刑部），不显示"失败"。
- `decisionClass=irreversible`（Bezos 单向门）→ `humanSignoffRequired=true`，人工圣裁不可绕。

### 机制 4：飞轮可见，但守序（修 gap#4）— Charity×Deming（顺序裁决采 Deming）
- `health()` 接出 HTTP 端点 + 每道圣旨落一条 wide event（user/dept/command/conflicts/score/cost/latency/outcome）。
- **硬门禁（Deming 实录·最高优先）**：**机制 1 的 Study 回路被一个真实案例点亮之前，
  dashboard / health 端点 / 任何排名一律不上线**——否则就是"内部自洽、单调上升、却从未被真实世界证伪"的假飞轮。
- 回答"能看见转吗"：✅ 但可见 ≠ 可信，先有 Study 再有 dashboard。

### 机制 5：燃料鉴权（堵 gap 的投毒面）— Bruce Schneier 补位 / 飞轮第二问
- `truth_ledger.record(provenance=...)` 在真实 web 流程里多数还是 `unknown`；
  接入 `actor.id` 后置 `authenticated`，`health().authenticated_ratio` 才有意义。
- 回答"燃料干净吗"：✅ 鉴权 + 内容哈希幂等（已有）。

---

## 6. 最小可发版本（先点亮 Study，再谈一切 — Deming 硬门禁顺序）

> 不全量改 17 flow。按 Deming 顺序，**命门 gap#5 先闭，dashboard 最后**。

| 步 | 动作 | 触缺口 | 验证（行为先于实现） |
|---|---|---|---|
| **S1** | `study/run` 产 outcome 后调 `truth_ledger.record(outcome, provenance=authenticated)` | #5 燃料 | 一次裁决在 `eval/truth_ledger.jsonl` 留 authenticated 痕 |
| **S2** | 下一道同类圣旨调 `latest_verdict()` 注入 `priorMirror`（**点亮零调用函数**） | #1+#5 复利 | 同 source 第二次 run，`edict.priorMirror.scoreDelta` 非空（PDSA 的 Study 实证） |
| **S3** | `orchestrator` ok_groups 升级为 stance 冲突检测，输出 `conflicts[]` + 圣旨一行 | #2 分歧 | 构造户部vs兵部对立 golden case，`conflicts[0].resolved=false` 上圣旨 |
| **S4** | `swarm_orchestrator.yaml` line 130/137 `min_quality_score` 给业务阈值 + `repairAction` | #3 质门 | 低分 product **不**触发 quotation，圣旨显示补救动作 |
| **S5**（守序最后）| `health()` 出 HTTP 端点 + wide event；**前置门禁：S2 已点亮** | #4 可见 | `/api/.../flywheel_health` 返回 worst_swarm/authenticated_ratio，且仅在 S2 通过后开放 |

**theater 检测清单（Deming/Charity）——上线前自检，任一为真即假飞轮**：
- [ ] `score` 是否被用于给蜂群排名/问责？（应：否）
- [ ] `conflicts[]` 是否恒为空或恒为模板话术？（应：否，有真实对立 golden case）
- [ ] dashboard 上线时 S2 的 Study 回路点亮了吗？（应：是）
- [ ] outcome 是否真的改变了下一次路由/先验？（应：是，scoreDelta 可证）
- [ ] 写痕 provenance 是否多数 authenticated？（应：是）

---

## 7. 飞轮三问对账（升级后逐问有答案）

| 飞轮三问 | 升级前 | 升级后机制 | 证据点 |
|---|---|---|---|
| 会复利吗 | ❌ gate() 零调用 | 机制 1 读痕注入 prior | S2：`priorMirror.scoreDelta` 非空 |
| 燃料干净吗 | ⚠ 多数 unknown | 机制 5 actor 鉴权 | `health().authenticated_ratio` 上升 |
| 能看见转吗 | ❌ 只有 CLI | 机制 4 HTTP 端点（守序） | `/flywheel_health`，但 S2 后才开 |

---

## 8. 大神视角（Deming 实录定调）

> 这个升级最可能怎么死：你会先修最好看的 gap#4，得到一块单调上升、却从未被真实世界证伪的仪表盘。
> 命门是 gap#5，它不闭，其余四个全是装修。**先证明"一道圣旨改变了下一道圣旨"，再谈飞轮 —— Where's the Study in your PDSA?**

落地铁律三条（会审采纳，写回本仓规则）：
1. **先点亮 Study（S2）再上任何 dashboard**——顺序不可调。
2. **score 只朝上对账 outcome，绝不朝下排名问责**——防 scorecard 反噬。
3. **分歧 surface 不 average，圣旨一行白话**——极简而不丢真相。
