# 朝堂OS · 智能化 + 通用化 实施方案（SoT）

> 立：2026-06-30 · 基于 3 份「文件:行」级体系测绘综合
> 定位：把朝堂从"模板空转的电池决策工具"升级为"接真 LLM 的、行业可插拔的通用决策 OS"。
> 与 `CLAUDE.md` 铁律平级：铁律管"怎么写"，本方案管"按什么顺序接线与解耦"。

---

## 0. 核心判断（一句话）

**你不缺技术，缺"接线"。** 实测证据：真 LLM 引擎、干净内核状态机、习惯学习、技能治理、数据驱动 registry 都已造好，但大多是**没通电的孤儿**。

- **智能化 = 接线**：让主闭环走你已造好的真 LLM + 内核 runtime（现在主链路是纯模板）。
- **通用化 = 解耦**：把"电池/制造"假设从内核剥离成"行业可插拔包"（现在散落硬编码在内核里）。
- **顺序**：先接线（A），再解耦（B）。没有真 LLM，行业包装配的也只是模板。

---

## 1. 体系现状全景（三份测绘综合）

### 1.1 干净内核（行业无关，原样保留）
| 资产 | 文件:行 |
|---|---|
| 状态机 `transition/nextState/getAvailableActions` | `orchestrator/decision-loop.ts:18-77` |
| 注入式 runtime 编排（executor 注入位） | `runtime/courtos-runtime.ts:30-137`（注入位 `:36,62`） |
| 部门→蜂群派发（参数化、诚实降级、rollout 闸） | `runtime/dept-swarm-dispatch.ts:35-69`、`live-swarm-adapter-factory.ts:50-78` |
| source-label 治理（FALLBACK/DEMO 不得终局、LIVE_SWARM 必带 trace） | `local-decision-loop.ts:435-485`、`swarm-runtime.ts:108-146` |
| 归档 schema `buildShiguanArchiveRecordV1` | `local-decision-loop.ts:292-323` |
| 风险门机制 + `HIGH_RISK_KEYWORDS`（词表中文B2B但行业无关） | `local-decision-loop.ts:131` |
| 数据驱动部门选择 `selectRegistryDepartments`（换数据源即可注入行业包） | `registry.ts:135-158` |

### 1.2 已造好但没通电的「孤儿能力」（智能化的金矿）
| 孤儿 | 造好在 | 没接的事实 |
|---|---|---|
| **真 LLM 引擎** `llm-executor`（三层 fallback + 预算治理） | `executors/llm-executor.ts:11` | 仅 `/api/court/decision` 用；**主链路 shangshufang 全程纯模板** |
| **干净状态机** | `decision-loop.ts:18-77` | 主链路用手写的三套并行状态词表，没走它 |
| **习惯学习** `updateProfileFromDecision`（ministryWeights 部门加权） | `habit-learner.ts:20` | 仅测试调用，**无持久化表、不注入 loop** |
| **技能治理账** `skill-ledger`（candidate→armory→retired） | `hanlin/skill-ledger.ts:10-91` | 治理逻辑在，但不接可执行单元、无落库 |
| **真出意见链路** `OFFICE_PROFILES` | `offices.ts:21,122` | 真在用，但 `review_skill` 字符串标签是**假执行**，与它无关 |

### 1.3 行业假设藏匿点（解耦的清单）
| 藏匿点 | 文件:行 | 归属 |
|---|---|---|
| **工部交付分类器/子司/证据/产物**（最重灾区） | `gongbu-cto-cpo-office.ts:74-185` | → 制造交付包 |
| 工部工单 `BOM/供应链/交期/现场/并网`（`并网`=储能专属） | `unified-decision-loop.ts:345-355` | → 储能包 |
| 入口蜂群路由 `selectEntrySwarm` 电池词（pack/电芯/BMS/模组） | `jiqun-live-swarm-adapter.ts:78-84` | → 电池包 |
| works 部门关键词 `BOM/并网/产能/施工/设备` | `department-registry.ts:89-91` | → 制造包 |
| offices.ts works 证据/风险（BOM/供应链/现场） | `offices.ts:74-75,109` | → 制造包 |
| 吏部硬编码"军工电池厂资质" | `libu-personnel-admin-office.ts:46` | → 租户配置 |
| 后端 4 蜂群（pack_rd/stage_gate/sourcing/storage_aftercare）+ 5 条 binding | 后端 `swarm_orchestrator.yaml` | → 电池/储能包 |
| 行业同义词组（锂电/BMS/军工，写死纯函数） | `skill-match.ts:7-14` | → 行业包知识 |

### 1.4 持久化现状
- DB 36 表全 `tenant_id` 隔离，但**无 industry/行业包/用户配置表**（`schema.ts`）。
- 最佳抄作业模板：`health_profiles`（`schema.ts:349`，含 `profile_json` 快照范式）。

---

## 2. 目标架构：通用内核 + 行业可插拔包

```
┌─────────────────────────────────────────────┐
│  装配层（onboarding 输入职业 → 元编排推荐套餐）   │  ← 接入点 A
├─────────────────────────────────────────────┤
│  习惯层（habit-learner ministryWeights 注入）   │  ← 接入点 E
├─────────────────────────────────────────────┤
│  行业包（数据，非代码）                          │  ← 接入点 B/C/D
│  IndustryPack = {                              │
│    keywords, risk_triggers, required_evidence, │
│    office_profile_overrides,                   │
│    forbidden_actions, entry_swarm_routing,     │
│    knowledge_source(RAG), confidence_thresholds│
│  }                                             │
├─────────────────────────────────────────────┤
│  通用内核（行业无关，永远一套，代码零行业名）       │
│  状态机 · 注入式runtime · 会审编排 · 风险门机制   │
│  · source-label治理 · 归档schema · 蜂群派发      │
│  · 真LLM executor                             │
└─────────────────────────────────────────────┘
```

**铁律（Karpathy 生死线）：内核代码里永远不准出现任何行业名**（电池/BOM/并网/pack）。行业只能活在 `IndustryPack` 数据 + 知识库里。守住=服务 1000 行业；守不住=第 3 个行业逼你重构。

### 行业包五个接入点
| # | 接入点 | 文件:行 | 做什么 |
|---|---|---|---|
| A | 输入层 | `onboarding/page.tsx:19` | 增收"行业/职业"，写入租户配置 |
| B | 装配核心 | `unified-decision-loop.ts:76-91` + `department-registry.ts` | 部门选择循环加"行业覆盖层"（keyword/权重/evidence merge） |
| C | Agent 执行 | `agent.ts:157-163`（taskContext/userPreferences/skills[]） | 不增 AgentCode（Tier0冻结），用 input 上下文注入套餐 |
| D | 持久化 | 仿 `schema.ts:349` health_profiles | 新增 `tenant_config(industry, profile_json)` + `industry_packs` |
| E | 习惯对齐 | `habit-learner.ts:20` | 行业默认权重作 profile 初值，行业包与习惯共用权重机制 |

---

## 3. 分阶段实施路线图（可逐步落地，每步有判据）

### 阶段 0 · 接线地基：让一条主闭环真智能 ★最高优先（智能化的根）
**目标**：上书房一道旨，拟旨 + 奏折走真 LLM，不再恒 FALLBACK。
**动作**：
- 0.1 `draft-edict` 的 `buildLocalDraftEdict`（`local-decision-loop.ts:243`）改为可注入 executor，接已存在的 `makeRefineExecutor`（真 LLM 拟旨）。
- 0.2 `confirm-edict` 的 `buildMinimalMemorialV1`（`:387`）部门意见/executive_summary 接 `makeReportExecutor`（真 LLM 奏折）。
- 0.3 让 shangshufang route 经 `courtos-runtime`（`:30-137`）注入式编排，逐步收敛三套状态词表到 `decision-loop.ts` 一套。
**判据**：一道旨的奏折 sourceLabel 不再恒 FALLBACK，拟旨/奏折是真 LLM 生成（带 trace）。
**回归断言**（铁律4）：LLM 不可达时仍诚实降级 FALLBACK（模板兜底不删）。
**守**：铁律13.2（AI 经 harness）、13.2.3（sourceLabel 诚实）、铁律4 双门（独立会审 + 断言）。
**风险**：改主链路高危——必须独立会审 + 回归断言。

### 阶段 1 · 行业包架构骨架：把电池抽成第一个包（通用化的根）
**目标**：定义 `IndustryPack` 类型，把电池/制造假设从内核剥离成第一个包。
**动作**：
- 1.1 定义 `IndustryPack` 类型 + "内核默认 + 行业包 merge/override" 机制（`selectRegistryDepartments` 已数据驱动，换数据源即可）。
- 1.2 抽"制造交付包"：`gongbu-cto-cpo-office.ts:74-185` 分类器/子司/证据/产物 → pack；内核工部只留抽象"交付可行性 envelope"。
- 1.3 抽"电池包"：`selectEntrySwarm:78-84` + 后端 4 蜂群路由 + `unified-decision-loop.ts:345-355` 的 `并网/BOM`。
**判据**：内核代码 `grep -iE "电池|BOM|并网|pack_rd|电芯"` **零命中**；"通用内核 + 电池包" = 现状不退化（回归测试）。
**守**：铁律6（一个领域一 owner）、铁律9（不重造）、Karpathy（行业=数据）。

### 阶段 2 · 装配层：职业 → 套餐（你的"配套套餐"理念）
**目标**：用户输入行业 → 装配对应包。
**动作**：
- 2.1 DB 建表（仿 `health_profiles`）：`tenant_config(industry, profile_json)` + `industry_packs`。
- 2.2 onboarding（`page.tsx:19`）增收"行业/职业"，写入租户配置。
- 2.3 装配核心：`unified-decision-loop.ts:76-91` 部门选择循环加"行业覆盖层"。
- 2.4 元编排 agent：用户说一句"我是做农资经销的" → 推荐配哪些部门 + 知识包（intent-driven，2026 前沿）。
**判据**：选"农资经销商"→ 户部/锦衣卫装配农资套餐；选"电池"→ 现状。
**守**：铁律2 SSOT（行业映射单一真相源，禁平行 map）。

### 阶段 3 · 习惯 + 可信度通电（护城河）
**目标**：把悬空的 habit-learner / UserDecisionProfile / skill-ledger 落库通电。
**动作**：
- 3.1 `user_decision_profile` 落库 + 注入 loop 部门选择（`ministryWeights`）。
- 3.2 行业默认权重作 profile 初值（行业包与习惯共用权重机制）。
- 3.3 史馆 `recall-outcome` 喂事后兑现 → "行业 × 部门"可信度加权（2026 confidence-weighted consensus）。
- 3.4 `skill-ledger` 落库 + `review_skill` 假标签接到 `OFFICE_PROFILES` 真执行单元。
**判据**：系统按用户习惯调部门权重；史馆出现第一条"判断→兑现"数据。
**守**：铁律5（先有第一条真实数据）。

### 阶段 4 · 第二个行业包验证通用性
**目标**：加一个完全不同的行业包（农业/律所），**零改内核代码**。
**判据**：第二包插上零改内核 = "通用"被证明，不是吹的。

---

## 4. 第一步具体动作（马上能做）

**阶段 0.1 + 0.2 的最小可验证切片**：挑户部一道旨，把拟旨从正则模板换成真 LLM executor。

1. 读 `executors/llm-executor.ts` + `makeRefineExecutor` 现有签名。
2. 在 `draft-edict/route.ts` 增加一个 executor 注入开关（env 闸控制，默认关，灰度开），接真 LLM 拟旨。
3. 保留 `buildLocalDraftEdict` 作为 LLM 不可达的诚实 fallback。
4. 加回归断言：LLM 开 → sourceLabel 非 FALLBACK 且带 trace；LLM 关/挂 → 仍是 FALLBACK 模板（不崩）。
5. 双门验证（tsc + build）+ 独立会审。

**判据**：一道户部旨，拟旨内容是真 LLM 理解的（不是正则套话），且失败诚实降级。

---

## 5. 风险与纪律

1. **接线优先于解耦**：先证明一条真智能闭环（阶段0），再解耦行业包。否则装配的也是模板。
2. **行业=数据不是代码**：内核代码零行业名（Karpathy 生死线）。
3. **改主链路是高危**：阶段 0 / 2.3 改共享主路由，每次过铁律4 双门（独立会审 + 回归断言）。
4. **先深一个再通用**（Bezos）：电池包先做到"铭硕内部真离不开"，再抽象通用。别 10 个浅包。
5. **接孤儿不造新**（Karpathy）：llm-executor / courtos-runtime / habit-learner / skill-ledger 全是通电，不重造。
6. **唯一可加的新依赖**：Langfuse（trace/eval，看见用），其余 0 新依赖。
7. **提交纪律**：每阶段本地双门通过后等用户明确"提交"（铁律15）。

---

## 6. 一句话路线
**接线（阶段0）→ 抽电池包证明架构（阶段1）→ 装配层落地套餐（阶段2）→ 习惯/可信度通电（阶段3）→ 第二包证明通用（阶段4）。** 每阶段一条真实数据为判据，不靠"看起来对"。
