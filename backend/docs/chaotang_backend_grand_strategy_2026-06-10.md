# 朝堂后端整体方略：一纲三层 · 六部确立 · 蜂群 I/O 与编排定纲

日期：2026-06-10
主线仓：`/home/ubuntu/workspace/jiqun_ai`（后端，端口 8081）
配套：`docs/chaotang_study_swarm_contract_2026-06-10.md`（上书房↔蜂群 I/O 契约 + 飞轮五机制）
定位：后端 agent 架构的**顶层定纲**——收敛分类学、确立六部、统一蜂群 I/O、定死编排控制流。

> 两个不可逆分叉已由老板拍板（2026-06-10，钦天监前置参谋）：
> - **分叉 A（agent 本体论）= 双轨 + 前台统一六部**：业务蜂群保持纵向交付管线，六部=横向权威+对外圣旨统一人格层，前台只暴露六部圣旨。
> - **分叉 B（控制流入口）= 路由前置·按可逆性分流**：`decree_swarm_router` 前置判定，reversible→直投业务蜂群，irreversible/多部门冲突→走 court 三省治理。

---

## 0. 病根：四套并行 ontology + 三处漂移（真实现状）

四套"agent"语义没桥接：①朝堂 11 主 agent（`src/chaotang_agents.py` 前端冻结）②14/17 业务蜂群（`jiqun_registry.yaml` vs `swarm_orchestrator.yaml`）③6 庄园能力组（`manor_groups.yaml`）④三省治理角色（court flow）。

三处真实漂移：
- **计数漂移**：registry 定义"14 蜂群"，orchestrator 实注册 17（多 storage_aftercare/gongbu_review/shiguan_archive）。
- **角色重复**：opc 有自己的 `market_intel`，又 `manor_routes:[intel]` 调锦衣卫——横向情报权威谁说了算没定。
- **六部人格半空**：`minister_personas.py` 只定义 4 个 council 人格（jin_yi_wei/qin_tian_jian/li_bu/scribe），核心六部 hu_bu/xing_bu/gong_bu/li_bu_rites/bing_bu **回退通用模板**——上一轮"户部vs兵部分歧"建在沙子上。

---

## 1. 定纲：一纲三层（唯一规范分类学）

```text
                    ┌─────────────────────────────────────┐
   老板一句话  ───► │  纲｜court 三省六部治理流（控制流编排器）│  ← 仅 irreversible/多部门冲突时介入
                    └─────────────────────────────────────┘
                         │ 派单（尚书 dispatch）
       ┌─────────────────┼──────────────────────────────────┐
       ▼                 ▼                                    ▼
┌──────────────┐  ┌──────────────────┐            ┌────────────────────┐
│ 层1 横向权威层 │  │ 层2 纵向交付层      │            │ 层3 横切服务层        │
│ 朝堂 11 主agent│◄─┤ 17 业务蜂群        │──delegate─►│ 庄园/critic/persona  │
│ 六部+三辅+丞相 │  │ haolong/opc/...    │            │ /IMA/truth_ledger    │
│ +太医         │  │ (纵向交付角色)      │            │ (被调用的工具池)      │
└──────┬───────┘  └────────┬─────────┘            └────────────────────┘
       │ 唯一对外人格         │ 产出经"六部 edict adapter"
       └──────────► 一道圣旨 edict.v2（上书房，老板只看这一个）
```

- **纲｜治理**：court 是**控制流**，不是业务执行者。三省（中书起草/门下复核/尚书派单）编排，六部执行是派单目标。**默认不介入**，只在分叉 B 判定 irreversible/多部门冲突时上线。
- **层1｜横向权威层 = 朝堂 11 主 agent**（前端冻结，`chaotang_agents.py` 是真相源）。**唯一对外人格层**——圣旨"分奏 departments"就是这 11 位说话。既是 council 会审人格、又是 manor 庄园横向专家。**前台只认这 11 位 + 圣旨。**
- **层2｜纵向交付层 = 业务蜂群**（资产：有真实 golden cases + 检查器，不动）。后台执行细节，不直接对老板说话，产出经"六部 edict adapter"翻译成圣旨分奏。
- **层3｜横切服务层** = 庄园能力组 + critic + persona 评审 + IMA + truth_ledger，被层1/层2 调用的工具池。

**桥接铁律（消除角色重复·分叉 A 落地）**：
> 横向权威判断（情报真伪 / 财务红线 / 法务可签 / 趋势研判）= **六部唯一**。
> 业务蜂群内部需要这类判断时，**delegate 给对应六部庄园**，不自起一套标准。
> 业务蜂群只保留**纵向交付角色**（opc_leader / solution_architect / cell_engineer 等管线专属）。

---

## 2. 六部主 agent 的确立（canonical · 四要素齐全才算"确立"）

"确立"= 每部钉死四要素：①唯一 job ②council 专属人格（铁律）③横向权威边界（对哪类判断有最终话语权）④结构化分歧对。

| 部 | code | 唯一 job | 横向权威边界（最终话语权） | council 人格 |
|---|---|---|---|---|
| **户部** | hu_bu | 让老板看见现金/利润/风险的真实边界 | 财务口径、毛利红线、现金缺口 | ❌→**补** |
| **工部** | gong_bu | 把需求变成可制造可交付的方案 | 可交付性、技术冲突、交付排期 | ❌→**补** |
| **兵部** | bing_bu | 竞争与运营资源的取舍 | 竞品定位、增长打法、资源冲突 | ❌→**补** |
| **刑部** | xing_bu | 防一句话承诺变成合同/合规风险 | 法务可签性、合规红线、内控 | ❌→**补** |
| **礼部** | li_bu_rites | 把真实能力变成对外可信表达 | 品牌口径、对外措辞、发布合规 | ❌→**补** |
| **吏部** | li_bu | 岗位/人才/组织结构与排期 | 人事硬性要求、组织能力缺口 | ✅ 有 |
| 锦衣卫 | jin_yi_wei | 情报检索与交叉验证 | 事实/信源可信度 | ✅ 有 |
| 钦天监 | qin_tian_jian | 趋势/风险/情景预测 | 信号分级、风险概率·时间窗 | ✅ 有 |
| 史官 | scribe | 复盘归档、可检索沉淀 | 历史镜鉴、复用条件 | ✅ 有 |
| 丞相 | prime_minister | 总判与编排（控制流角色，不入庄园组） | 圣旨终判 | 编排者 |
| 太医 | tai_yi_yuan | 健康管理（独立，暂不入经营回路） | 健康安全边界 | ❌→**补** |

**结构化分歧对（让"分歧涌现"有根·接上一轮天才设计机制2）**：
- 户部 vs 兵部 = **利润 vs 增长**
- 工部 vs 户部 = **可交付性 vs 预算**
- 刑部 vs 礼部 = **合规边界 vs 对外表达**
- 锦衣卫 vs 钦天监 = **既成事实 vs 趋势推演**

这 4 对是 `edict.v2.conflicts[].axis` 的合法取值；编排器只在这 4 个 axis 上做 stance 方向冲突检测，不做平均合成（Deming：surface variation，不 average）。

---

## 3. 蜂群 I/O 统一契约（复用上一轮，本方略加 manor delegation）

输入 `StudyRunRequest.v2` / 输出 `edict.v2` 见 `docs/chaotang_study_swarm_contract_2026-06-10.md` §3-4，不重复。本方略新增**横向 delegation 契约**（桥接铁律的代码面）：

```jsonc
// 业务蜂群 → 六部庄园 的 delegation 调用（消除角色重复）
// ManorDelegateRequest
{
  "fromSwarm": "opc",               // 哪个业务蜂群发起
  "authorityAxis": "intel",         // 要哪类横向权威：intel|finlaw|rnd|content|exec|review
  "question": "string",             // 具体待判问题
  "context": { /* 蜂群已有材料 */ },
  "decisionClass": "reversible | irreversible"
}
// ManorDelegateResponse —— 六部权威判定，写回业务蜂群，并落一条信息素轨
{
  "minister": "jin_yi_wei",         // 实际作答的六部/辅臣 code
  "stance": "string",               // 该部立场（进 conflicts 检测）
  "confidence": 0.0,
  "evidence": ["..."],
  "ledgerHash": "string"            // 写入 truth_ledger 的痕（飞轮燃料）
}
```

铁律：业务蜂群内部凡涉及横向权威的角色（如 opc.`market_intel`、product.`competitive_research`、quotation.`cost_engineer` 的红线判断），改为发 `ManorDelegateRequest`，**不再自带一套标准**。纵向交付角色（opc_leader 等）保留。

---

## 4. 编排方式定纲（分叉 B 落地）

```text
老板一句话
  └─► decree_swarm_router 前置判定（已存在，src/decree_swarm_router.py）
        ├ 判 decisionClass + 涉及部门数
        │
        ├─[reversible & 单部门]──► 直投业务蜂群（快路径）
        │      → 蜂群跑 flow（纵向角色 + 按需 delegate 六部庄园）
        │      → 六部 edict adapter 翻译 → 圣旨（质门 passed 可直接呈老板）
        │
        └─[irreversible | 多部门冲突]──► court 三省治理（慢路径·强治理）
               中书 zhongshu_analyze  起草理解
               门下 menxia_review     复核（封驳可见化：缺哪条证据才能准奏）
               尚书 shangshu_dispatch  派单 → 相关六部 + 业务蜂群（并行）
               六部各留信息素轨 → 冲突检测（4 个 axis 上 stance 反向 = 分歧涌现）
               尚书 shangshu_aggregate 汇总（保留分歧，不平均）
               中书 zhongshu_conclude  终判 → 圣旨（带 conflicts + humanSignoffRequired）
```

- court agents 已在 registry（`taizi_intake/zhongshu_analyze/menxia_review/shangshu_dispatch/liubu_execute/zhuangyuan_analyze/shangshu_aggregate/zhongshu_conclude/taizi_output`），**控制流已就位，缺的是路由前置的分流判定**。
- 路由判定**绝不静默回退**（沿用 `decree_swarm_router` 现有纪律：无命中显式默认 + logger 可见）。

---

## 5. 三处漂移修复方案

| 漂移 | 修复 | 验证门 |
|---|---|---|
| 计数漂移（双向） | ✅ **已修(T3)**：`scripts/validate_registry_sync.py` 漂移地图当场抓出**双向**漂移——registry 补齐 storage_aftercare/gongbu_review/shiguan_archive，orchestrator 补注册 registry-only 的 `bingbu_sales_acquisition`（之前 Explore 也漏检，确定性门的价值）。现 18==18 in_sync | `tests/test_registry_sync.py`（6 passed）+ `python scripts/validate_registry_sync.py`（exit 0） |
| 角色重复 | 业务蜂群横向角色改 `ManorDelegateRequest`（§3）；列出待改角色清单 | golden case：opc 情报判断的 `ledgerHash` 指向 intel 庄园，不在 opc 内部另算 |
| 六部人格半空 | `minister_personas.py` 补 hu_bu/gong_bu/bing_bu/xing_bu/li_bu_rites/tai_yi_yuan 6 个专属人格 + 4 分歧对铁律 | 构造 4 个分歧对 golden case，`conflicts[].resolved=false` 能上圣旨 |

---

## 6. 落地路线（接上一轮 S1-S5，先制度后飞轮）

> 顺序铁律：**先收敛分类学（制度）→ 补人格让分歧有根 → 去重 → 对齐 → 再闭飞轮**。
> 飞轮（上一轮 S1-S5）依赖六部分歧有根，故 T1 必须在 S3 之前。

| 阶段 | 动作 | 触缺口 | 验证 |
|---|---|---|---|
| **T0** | 本方略落档 = 制度层定纲（一纲三层 + 六部四要素） | 分类学 | 本文档 + manifest 指针（已做） |
| **T1** | 补全 6 个六部 council 人格 + 4 分歧对（`minister_personas.py`） | 人格半空 | 4 分歧对 golden case 各产 1 条 conflict |
| **T2** | 业务蜂群横向角色 → `ManorDelegateRequest`，六部权威唯一 | 角色重复 | opc 情报判定 ledgerHash 指向 intel 庄园 |
| **T3** | ✅ **已落地**：`validate_registry_sync.py` 漂移地图(双向漂移+质门空门一次扫清) + registry 补 3 蜂群 + orchestrator 补 bingbu + 数据链路质门 0→3.5（§5 同源洞同 commit 修） | 计数漂移+质门空门 | 18==18 in_sync, exit 0；6 测试通过 |
| **T4** | 路由前置分流（decree_swarm_router 判 decisionClass→court/直投） | 分叉 B | reversible 直投、irreversible 走 court 各 1 golden |
| **T5→** | 接上一轮 §6 的 S1-S5（信息素轨飞轮闭合） | 飞轮 5 缺口 | S2 priorMirror.scoreDelta 非空 |

**最小可发**：T0+T1（定纲 + 六部人格补全）。先让"户部vs兵部分歧"有真实人格支撑，这是后续一切分歧/飞轮机制的地基；其余 T2-T5 增量推进。

---

## 7. 大神视角（lens 已内化，标注背书）

- **张小龙（分叉 A 背书）**：老板永远只看一道圣旨 + 11 位部门，17 蜂群是后台细节——前台一个字段都别为蜂群数量泄露。
- **Bezos（API mandate）**：六部=不可逆服务接口，业务蜂群=可换实现。delegation 契约即接口契约，版本化。
- **Deming（顺序铁律）**：先补人格让分歧有根（T1）再谈飞轮——分歧建在沙子上时，conflicts 字段会沦为模板话术 theater。
- **flow-engine-god / harness-god**：计数漂移必须有确定性 validate 门，否则 registry 与 orchestrator 永远悄悄分叉。

> 🎲 最该警惕：这套方略最可能怎么变 theater——**T1 跳过、直接做 T4/T5 的炫技路由与飞轮**，得到一套能跑、但"户部vs兵部"永远输出同一句模板对立的假分歧。**先把六部人格的铁律灌进去（让户部真的只认现金红线、兵部真的只认增长），分歧才是真涌现，不是装饰。** 地基在 T1，不在 T5。

---

## 8. 多 agent 编排价值天才设计（编排镜片定稿）

> 镜片：Andrew Ng（agentic workflow 五式）/ Harrison Chase（编排即产品·LangGraph supervisor）/
> E.O. Wilson（stigmergy 涌现）/ Marvin Minsky（无中心涌现·相关性失败警告）/ Addy Osmani（别为编排而编排）。

### 8.1 第一性原理：N 个 agent 凭什么值 N 倍的钱

单 agent 已经很强。付钱跑 N 个 agent，**只有 4 个理由能回本**，否则就是"N 倍成本买单 agent 价值"：

1. **多样性 Diversity**（Minsky/Wilson）——N 个**真正不同**的镜片照到单镜片盲区。
2. **对抗验证 Adversarial**（CLAUDE.md 三票）——N 个怀疑论者证伪，挡"貌似对其实错"。
3. **分解 Decomposition**（Addy Osmani）——一个 context 装不下的范围，并行覆盖。
4. **涌现 Emergence**（Wilson stigmergy / Minsky society）——集体找到没有任何单个 agent 规划的东西。

**当前价值泄漏**：`arbitration.strategy='all'` 只统计 `ok_groups` + 平均合成 → 把 1/2/4 全压扁成平均。
**N 倍成本，单 agent 价值。这是后端编排最大的浪费。**

### 8.2 天才设计：四档编排器（按价值理由选形态，不再一律 all+平均）

把 `arbitration.strategy` 从单一 `all` 升级为四档，`decree_swarm_router` 按任务性质选档：

| 档 | 回本理由 | 编排形态 | 朝堂落地（复用现有） | 何时用 |
|---|---|---|---|---|
| **T-Diverge 分歧档** | 多样性→冲突 | 六部并行 → 4 axis stance 冲突检测 → 分歧上圣旨（不平均） | council + `CONFLICT_AXES`(T1) | 决策类·多部门·有取舍 |
| **T-Verify 验证档** | 对抗验证 | 主答 → 3 票证伪(怀疑/攻击/框架) → 多数通过 | `global_tail_flow` critic + 三票 | 不可逆·对外·高 stakes |
| **T-Decompose 分解档** | 分解覆盖 | 范围拆片 → 并行覆盖 → 去重合并 | 庄园 spawn + pipeline | 大范围扫描/研究/审计 |
| **T-Reflect 反思档** | 迭代质量 | 产出 → critic → 修订环（Andrew Ng reflection），收敛或 N 轮停 | `pack_rd` 的 critic_first 推广 | 复杂产出·质量敏感 |
| **T-Solo（默认）** | 编排无价值 | 不编排，单 agent | 直投业务蜂群 | reversible·单部门（省钱） |

**关键纪律（Addy Osmani）**：默认是 **T-Solo**，不是 all。每次升档必须对应一个能回本的价值理由：
reversible 单部门→T-Solo；reversible 多部门→T-Diverge；irreversible→T-Verify(叠 T-Diverge)；
大范围→T-Decompose；质量敏感产出→T-Reflect。**编排无价值时退回单 agent，别为编排而编排。**

### 8.3 Minsky 最该警惕：相关性失败（假多样性）

> N 个 agent 用同一 base model + 相似 prompt，"多样性"是假的——它们会**一起犯同一个错**（correlated failure），
> 平均/投票都救不了。多样性必须来自**真实不同的约束**（T1 给六部装的对立铁律），不是换个名字。
> 否则四档编排只是把同一个脑子复制四份，涌现不出任何东西。**这就是为什么 T1（人格有根）是 8.2 的前置地基。**

### 8.4 落地接口

- ✅ **决策层已落地**（2026-06-10）：`src/decree_swarm_router.py::select_orchestration_tier(command, *, decision_class, involved_depts, entry_swarm)` 返回 `{tier, reason, value_thesis}`，按"不可逆>大范围>质量敏感>多部门>默认 Solo"确定性选档，绝不静默（reason+value_thesis 可观测）。测试 `tests/test_orchestration_tier.py`（8 passed）。
- ✅ **入口层已落地**（2026-06-10）：`web/routers/chaotang.py::_attach_live_study_run` 选完 entry_swarm 后调 `select_orchestration_tier`，把 `tier+value_thesis+reason` 写进 `edict["orchestration"]` + emit `orchestration_tier_selected` wide event（生产可见，绝不静默）。测试 `tests/test_chaotang_study_run_edict.py::test_study_run_live_records_orchestration_tier`。
- ✅ **执行层·T-Verify 闸已落地**（2026-06-10）：tier==T-Verify 时质门强制 `human_signoff_required=True`——不可逆/高 stakes 即使分数通过也不许自动放行（Bezos 单向门 + 契约 decisionClass→signoff）。测试 `test_study_run_live_tier_reflects_command_signal`（高分 8.1→passed 仍强制圣裁）。
- ⏳ **执行层·剩余 tier 待接**：T-Diverge 接 `CONFLICT_AXES` 冲突检测（依赖 minister stance 解析，留最后）；T-Decompose/T-Reflect **直接委派 `Workflow` 范式**（pipeline 分解 / loop-until-dry 反思），不在 FlowEngine 重造；T-Solo 不编排直投。
- ⏳ **decision_class 真值**：当前 tier 由 command 关键词推断；待 `StudyRunRequest.v2` 接入 `decisionClass` 字段后改传真值。
