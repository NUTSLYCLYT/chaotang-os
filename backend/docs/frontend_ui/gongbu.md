# 工部 · 前端 UI 策划(验收单 review)

> 定稿基线 2026-07-01。本文是**人类面渲染策划**,落地在前端仓 `chaotang-web-lyt`,后端只产 court_doc(机器面 JSON)。
> 必读对齐:[../dept_design/frontend_handoff.md](../dept_design/frontend_handoff.md)(court_doc→卷宗渲染契约)、[../dept_design/gongbu.md](../dept_design/gongbu.md)(工部设计 + 验收单样例)、[../dept_design/README.md](../dept_design/README.md)(印章品牌系统表)。
> 同骨架参考:[xingbu.md](xingbu.md)(刑部已先跑通同一套卷宗组件)。
>
> 基调:**卷宗×现代**。古典骨 = 楷体标题 / 规矩官印 / 案号 / 骑缝留痕 / 蓝图微纹;现代肉 = 红黄绿黑灯 / 卡片 / 渐进展开 / 无衬线正文。
> 工部身份:文书 = 验收单 review,官印 = **规矩印(尺规)**,主色 = **钢蓝**(`--gongbu-accent`)。
>
> **工部与刑部最大的不同:接地源不是 RAG,是确定性重算。** `provenance.grounding="deterministic"`(借工部范式)。
> 工程数字(串并/电流/能量)走 `src/pack_rd_sizing.py` 的 no-LLM 重算门,自报值与重算对不上即红;抽不到字段 → **UNKNOWN → 禁假 PASS**,盖"不予验收·需人工"。

---

## 1. 部门 UI 定位:客户在这一屏要的是什么决策

工部 = 客户的**交付底气**,不是接活的工头。这一屏要回答客户的**一个决策**:

> "这东西**能不能做、做多久、POC 怎么搭、技术验收过没过?**如果不予验收,卡在哪、按什么数修就能过?"

所以主屏不是"架构知识展示页",是**验收单卡**。一屏看完就能拍板:

- **能不能做 / 验收过没过** —— 灯(绿/黄/红/黑)+ 一句结论,人话在前。
- **做多久** —— 工期带宽条(范围,不是单点承诺)。
- **工部替我拦了什么** —— 心意条(典型:"把 demo 跑通当成交付的假底气"已标非质量证明)。
- **最致命的几条不达标项 + 怎么改** —— Top items,重算偏差右对齐,架构细节折叠在二级。
- **凭什么说过/不过** —— 确定性接地徽章(重算接地,非 agent 自夸)。
- **出事我有据可保命** —— 骑缝钢蓝印 + 史馆封存号(工程证据具象)。
- **下一步动作** —— 按重算值修正 / 跑 release gate / 存证 按钮。

设计纪律:**决策不是知识**。一屏先给"能不能做 + 工期 + 过没过",架构、依据、重算明细全部默认折叠在二级。客户读完结论就能走;想深究再展开。

工部铁律落到 UI:**算术不许 LLM 自评**。所有灯/偏差/过线全由确定性重算门定;agent 只"选数",前端只渲染重算结论,绝不把 agent 自评渲染成"通过"。

---

## 2. 主屏卷宗卡布局(精细线框,套 court_doc 真字段)

下面线框每一块都标注它吃的 court_doc 字段(契约 `schemas/court_doc.json`,字段名以工部 §4.1 样例 + `src/gongbu_review_verdict.py` 实测为准)。

```
┌──────────────────────────────────────────────────────────────┐
│ ╔════════════════════════════════════════════════╗   ╭──────╮ │  ← 蓝图微纹背景 + 钢蓝描边
│ ║ 📐 工部验收单                  案号 GB-20260701-031 ║   │ 📐规矩 │ │
│ ║   楷体标题(dept+doc_type)        (case_id)      ║   │ 钢蓝印 │ │  右上官印:seal.stamp=规矩印 / seal.color=钢蓝
│ ╚════════════════════════════════════════════════╝   ╰──────╯ │
│ ────────────────────────────────────────────────────────────── │  ← 钢蓝细分隔线(古典)
│                                                                │
│  🟡  能做 —— 工期 6~8 周,先补 2 项才算交付                       │  ← light=yellow → 灯+整卡边框色
│      (light)  (headline,楷体大字,人话在前)                      │
│  ├ 工期带宽  [████████░░░░] 6 ~ 8 周 ┤                          │  ← 工期带宽条(解析自 headline,见 §3.2 注)
│                                                                │
│  ┃ 工部为你拦了:把 demo 跑通当成交付的假底气(已标非质量证明)    │  ← shielded,左侧钢蓝竖条高亮(心意①)
│                                                                │
│  ┌────────────────────────────────────────────┐  〔展开架构〕  │
│  │ 验收/可行性 Top 3            确定性重算接地 🔵 │             │  ← items[] 标题行 + 接地徽章
│  │ ─────────────────────────────────────────── │             │
│  │ 1 🔴 BMS 未过确定性成本门   高 · 报价失真  ▸改 │             │  ← item: level/title 左,odds/impact 右对齐
│  │      └─[展开]重算偏差对比 + 修复命令(二级)     │             │     fix 折叠在二级,▸ 表可展开
│  │ 2 🟡 核心链路只有 smoke      中 · 回归无网兜 ▸改│             │     红项置顶,按 level 排序
│  │ 3 🟢 确定性 sizing 自洽      串并/电流带宽内   │             │     绿项 odds/impact/fix 为 null,不显右列
│  └────────────────────────────────────────────┘             │
│                                                                │
│  落款:确定性重算接地 🔵 · gate=pending · 判官 kent-beck/charity │  ← provenance.grounding + gate + advisors
│  ────────────────────────────────────────────────────────────  │
│  工程证据已封存 · 史馆 GB-20260701-031     ╭─╮                   │  ← seal.sealed_archive + archive_id
│                                           │骑│ 骑缝钢蓝印(跨边) │     (心意②:交付底气具象)
│                                           ╰─╯                   │
│  ┌──────────────┐ ┌────────────┐ ┌────────┐ ┌──────────┐      │
│  │ 按重算值修正 ✎│ │ 跑 release ▶│ │ 存证 🛡 │ │ 签风险单 ✍│       │  ← actions[]:见 §3.2 动作词表
│  └──────────────┘ └────────────┘ └────────┘ └──────────┘      │
└──────────────────────────────────────────────────────────────┘
```

布局要点:

- **四段式纵向节奏**:案号印章头 → 结论区(灯+headline+**工期带宽条**+shielded)→ 证据区(Top items + 重算偏差)→ 落款+动作区。古典"骑缝留痕"压在落款与卡边交界,跨边压印才有公文感。
- **官印右上角固定**,规矩印(尺规) + 钢蓝,是部门身份的第一识别点。换部门只换 `seal.stamp`/`seal.color`,骨架不动(全院共享)。
- **重算偏差右对齐成列**(odds / impact 两列),客户一眼扫"哪条最离谱"。工部的 `impact` 常是"偏差 N / 报价失真"而非金额。
- **工期带宽是范围条不是单点**,呼应"给带宽不给承诺"。
- **重算偏差对比 + 修复命令默认折叠**,点 item 的 `▸` 才展开二级。一屏先给结论。

---

## 3. 组件清单

### 3.1 复用全院共享卷宗组件(吃 court_doc,印章/主色配置驱动)

这些组件全院 11 部门共用,工部只传入配置(stamp=规矩印、color=钢蓝、doc_type=review):

| 组件 | 职责 | 吃字段 |
|---|---|---|
| `<CourtDocCard>` | 卷宗卡外壳(蓝图纹背景 + 灯色描边 + 四段节奏) | `light` / `dept` |
| `<DeptSeal>` | 右上官印(SVG,部门换印换色) | `seal.stamp` / `seal.color` |
| `<CaseHeader>` | 楷体标题 + 案号 | `dept` / `doc_type` / `case_id` |
| `<VerdictLight>` | 红黄绿黑灯徽 + 一行结论 | `light` / `headline` |
| `<ShieldedBanner>` | "为你拦了"心意条(竖条高亮) | `shielded` |
| `<RiskItemList>` | Top items 列表,渐进展开,红项置顶 | `items[]` |
| `<ProvenanceFooter>` | 落款:接地方式 + 闸状态 + 大神席 | `provenance.grounding` / `provenance.gate` / `provenance.advisors` |
| `<ArchiveStamp>` | 骑缝钢蓝印 + 史馆封存号 | `seal.sealed_archive` / `provenance.archive_id` |
| `<ActionBar>` | 底部动作按钮组(动作名→按钮映射) | `actions[]` / `signed` |
| `<NeedHumanOverlay>` | "需人工复核"半透印遮罩 | `provenance.gate` |
| `<UnsignedWatermark>` | "未签字"水印 | `signed` |

### 3.2 工部特有组件

| 组件 | 职责 | 说明 |
|---|---|---|
| `<DeterministicBadge>` | 确定性接地徽章:🔵"重算接地" | 吃 `provenance.grounding`;`deterministic`→蓝勾"重算接地",`none`→灰"未接地·需人工"。工部专属,把"不信 agent 自评、只认重算"的护城河视觉化。`deterministic_gated` 同源,可作 tooltip 细节 |
| `<RecomputeDiffTable>` | **重算偏差对比表(claimed vs 重算)** | 展开红/黄 item 时弹出。两列:**自报值** vs **确定性重算值**,差额(偏差)高亮红;数据源标 `evidence_ref=pack_rd_sizing`。这是工部"算术不许 LLM 自评"的核心 UI 落点(见 §3.3 字段映射) |
| `<LeadTimeBand>` | **工期带宽条** | 范围条(下限~上限周),不是单点进度条。当前从 `headline` 文本解析(如"工期 6~8 周");**结构化字段后端尚未提供 → 见下方注,前端先解析文本,不画饼** |
| `<ApplyRecomputeButton>` | 按重算值修正:把确定性重算值写回精算输入重跑 | action=`apply_fix_cards`/`apply_fixes`;红项"重算对不上"时,推荐值已写进 item.title("应为 12P"),此按钮一键采纳 |
| `<ReleaseGateButton>` | 跑 release gate:smoke→focused→release 三段验收 | action=`run_release_gate`/`escalate_court`;触发更重档验收门(御史 release/drift gate) |
| `<ArchiveEvidenceButton>` | 存证:固化工程证据到 truth_ledger | action=`archive_evidence`/`archive_amulet`;成功后高亮骑缝印 |
| `<SignWaiverButton>` | 签风险单:人工签字承担未达标风险后放行 | action=`sign_waiver`;只在确需带病放行时出现,签字后 `signed=true` |
| `<EvidenceDrawer>` | 证据二级抽屉(展开 item 时弹出) | 上半"怎么改"(fix / 推荐值),下半 `<RecomputeDiffTable>` + `evidence_ref` 指向的重算判据;grounding=none 时显式标"未接地·需人工" |

> 确定性接地徽章、重算偏差对比表、工期带宽条 是工部"震撼点"的 UI 落点(见工部设计 §二)。其余复用全院组件,**别为工部写第二套卡**。

**字段映射(`<RecomputeDiffTable>` 吃的真数据,来自 `src/pack_rd_sizing.py` 重算 verdict)**:

| 表格列 | court_doc / verdict 来源 | 说明 |
|---|---|---|
| 自报值(claimed) | item.title 内文 / verdict `claimed.series_S` `claimed.parallel_P` | 精算 agent 报的串/并数 |
| 确定性重算值 | item.title 内文("应为 12P") / verdict `deterministic.series` `deterministic.parallel` | no-LLM 重算推导值 |
| 偏差 | item.impact("偏差 3") / verdict `deviations.series` `deviations.parallel` | 差额,超带宽即红 |
| 判定 | item.level | `seriesTruth`/`parallelTruth` FAIL→red,green→绿 |
| 证据 | item.evidence_ref(`pack_rd_sizing`) | 回链确定性门,非 agent 旁白 |

> **工期带宽条的诚实边界**:court_doc 目前**没有结构化工期字段**,"6~8 周"活在 `headline` 文本里。前端先做文本解析渲染范围条;若要稳定结构化(`lead_time:{min,max,unit,buffer}`),需后端补 court_doc 薄字段——**这是前端回提需求项,不在前端硬编码业务推断**(见 §8.3)。

---

## 4. 状态设计

### 4.1 灯(`light`)配色 —— 整卡边框 + 灯徽

灯由**确定性重算门**定(`src/court_doc_builder.compute_light` + 工部重算 verdict),不是 agent 自评:

| light | 含义 | 灯徽色 | 卡边框 | 文案前缀 |
|---|---|---|---|---|
| `green` | 验收通过(重算一致) | 翠绿 `oklch(62% 0.17 150)` | 细绿描边 | "验收通过 —— 重算一致" |
| `yellow` | 可收,须先修 N 处 | 琥珀 `oklch(80% 0.15 85)` | 琥珀描边 | "能做 —— 须先补 N 项" |
| `red` | 不予验收(重算对不上/不自洽) | 钢红 `oklch(58% 0.21 27)` | 加粗钢红描边 | "不予验收 —— 重算对不上" |
| `black` | 高危,移交深查 | 玄黑 `oklch(25% 0.02 0)` | 黑描边 + 暗红内晕 | "高危 —— 移交深查" |

**工部特有红灯语义**:重算对不上时,item 为红且**不挂 fix**(后端 `gongbu_review_verdict.sizing_verdict_to_items` 故意不挂 fix,不软化成黄),推荐值写进 title。所以红项的 `▸` 展开是**重算偏差对比表**而非"一句话改法",修复路径靠 `<ApplyRecomputeButton>` 采纳重算值。

### 4.2 UNKNOWN / gate=pending → "不予验收·需人工"半透印(禁假 PASS)

工部最关键的护栏。当重算门**抽不到精算 JSON**(`extracted=false` → `deterministic_gated=false`)时,后端 `gate="pending"`,headline 前缀"不予验收 —— 重算 UNKNOWN":

- 整卡盖 `<NeedHumanOverlay>`:钢蓝半透明大印"**不予验收 · 需人工**"(`pending_note="不予验收"`),压在结论区。
- **强制禁假 PASS**:即使某些项看似绿,也降级渲染为黄/灰,灯徽旁加"待核"小字(对应后端宪法 C6)。
- 不可逆动作按钮置灰,只留"签风险单 / 转人工"。
- 对应实测样例:`抽不到精算 JSON → UNKNOWN:盖"不予验收·需人工"半透印,gate=pending`。

> 区分两种红:**重算成功但对不上**(`extracted=true`,gate=passed,红灯)→ 给 `<RecomputeDiffTable>` + 按重算值修正;**重算抽不到**(`extracted=false`,gate=pending,UNKNOWN)→ 盖需人工印,禁任何"通过"暗示。前端必须区分这两态,别都画成普通红。

### 4.3 grounding → 落款标接地方式

`provenance.grounding`(工部主场 = `deterministic`):

| 值 | 落款文案 | 视觉 |
|---|---|---|
| `deterministic` | "重算接地 ✓"(`<DeterministicBadge>` 蓝勾) | 钢蓝勾,正常。tooltip 出 `deterministic_gated=true` + 重算门名 |
| `rag` | "法条接地 ✓ RAG" | 绿勾(工部少见,跨部门复用时可能出现) |
| `none` | "未接地 · 需人工" | **灰条警示**,证据抽屉里显式"重算未取到数据,以下不构成验收结论,需人工工程师确认" |

grounding=none 时,`<EvidenceDrawer>` 不展示任何"已验收"结论,只展示"重算未命中/未取数,仅供参考,需人工"。**幻觉验收比没验收更危险——它给客户假底气**(工部设计 §3.3),UI 必须把这句态度落出来。

### 4.4 signed=false → 禁执行水印

`signed === false`(后端默认产出即 false):

- 卡面叠 `<UnsignedWatermark>`:斜向淡灰"未签字"水印。
- **不可逆动作**(`按重算值修正`改精算输入、`跑 release gate`升级、`签风险单`放行)按钮置灰,hover 提示"需人工签字后方可执行"。
- 可逆动作(`存证`、展开看重算偏差)仍可用。
- 签字态切换由前端走签字交互(签字成功→后端回 `signed=true` 的新 court_doc→重渲染),前端不自行翻转 signed。

> 守则(接 frontend_handoff §四):gate=pending / grounding=none **绝不渲染成绿灯/通过**;丞相主线里工部灯**照搬不改**;signed=false 不可逆动作置灰。工部尤其要守:**UNKNOWN 绝不假装 PASS**。

---

## 5. 交互流

### 5.1 P0–P3 复杂度档 → UI 轻重

court_doc 的管线复杂度档(P0 琐碎 → P3 重大)决定卡的"信息密度"。同一组件,按档收放:

| 档 | 场景 | UI 形态 |
|---|---|---|
| **P0** | 一句话可行性快判 | **精简卡**:只灯 + headline + 一个主 action。无 items 展开、无重算偏差表。一行结论拍板 |
| **P1** | 常规验收 | **标准卡**:线框全貌(灯+工期带宽+shielded+Top3+落款+动作),items 折叠二级 |
| **P2** | 含确定性重算 | 标准卡 + `<DeterministicBadge>` 高亮 + 红项 `<RecomputeDiffTable>` 默认半展开 |
| **P3** | 重大/不可逆/上线 | **三段验收卡**:smoke→focused→release 三段独立判灯露出、强制签字态、`跑 release gate` 主按钮,可能叠钦天监前置参谋入口 |

前端按 court_doc 里的档位字段(或 items 数量 / grounding 是否 deterministic)自适应,不写四套页面,只切显隐与强调。

### 5.2 POC 三段验收的视觉(工部专属)

工部沿 `flow_sdlc` 把交付拆 **smoke(链路通没通)→ focused tests(功能对不对)→ release gate(能不能上)** 三段,各段独立判灯。P2/P3 卡里:

- 三段做**横向三段进度灯条**(每段一个小灯),当前停在哪段一目了然。
- **demo/smoke 阶段强制贴角标"非质量证明 · 缺 N 个 golden case · 下一步正式验收命令"**——杜绝"demo 跑通就当交付"。这是把工部设计震撼点 #4 落成 UI 警示。
- 角标用警示橙底,不可被"看起来绿了"的视觉盖过。

### 5.3 点击展开重算偏差二级

- 点红/黄 item 行的 `▸` → 滑出 `<EvidenceDrawer>`:上半"怎么改"(fix 或"按重算值修正"提示),下半 `<RecomputeDiffTable>`(claimed vs 重算 + 偏差 + 证据 ref)。
- 绿 item(`odds/impact/fix` 为 null)不出展开箭头,只显"重算一致"。
- 渐进式:**默认全折叠**,客户主动点才展开,保证一屏先给决策。
- 展开动画走 `clip-path` / `transform`(合成器友好),不撑卡布局抖动。

### 5.4 按重算值修正 / 跑 release gate

- 点 `按重算值修正` → 把确定性重算值(`deterministic.series/parallel`)写回精算输入重跑重算门 → 返回新 court_doc(理想态转绿/黄),卡重渲染。
- 点 `跑 release gate` → 弹确认:"将跑 smoke→focused→release 三段验收门,耗时更长,是否继续?"→ 进入验收态(loading 见 §6)→ 返回新 court_doc(三段灯更新)。
- 红灯/UNKNOWN 卡的 `跑 release gate` 为主色强调按钮;绿灯卡弱化为次要。

---

## 6. 空 / 加载 / 错误态

| 态 | 渲染 |
|---|---|
| **空(无验收单)** | 卷宗卡空壳 + 规矩印淡水印 + "尚无验收 —— 把要做的事(能不能做/做多久/POC)发给工部"引导 + 输入框 |
| **加载(初判重算)** | 卡骨架屏:案号头占位 + 灯位旋转规矩印 + "工部正在重算验收…"。骨架走蓝图纹底,保持品牌感,不用通用 spinner |
| **加载(跑 release gate)** | 在现有卡上叠半透层"三段验收进行中 · smoke→focused→release",三段灯渐次点亮,**保留旧结论可读**(别白屏) |
| **错误(后端失败)** | 卡内黄条"工部暂时无法验收 · 错误码 X",给"重试 / 转人工工程师"两按钮;不静默吞错(接编码风格错误处理) |
| **错误(court_doc 字段缺失)** | 缺关键字段(无 light/headline)→ 降级为"卷宗残缺,需人工核对"灰态,绝不猜测渲染成绿 |
| **UNKNOWN(重算抽不到数)** | 见 §4.2,**不是错误是合法的"不予验收·需人工"态**:盖需人工印、gate=pending,但卡正常渲染、可签风险单/转人工。前端绝不把 UNKNOWN 当后端故障吞掉 |

加载/错误也守"禁假绿"纪律:任何不确定态都偏保守(灰/黄),不渲染成通过。**UNKNOWN 与后端错误必须区分**:前者是工部刻意的护栏态,后者才是故障。

---

## 7. 响应式

### 桌面(≥1024px)

- 卷宗卡居中,最大宽约 720px(保持公文纸比例,不铺满)。
- 官印右上、骑缝印右下角压边,重算偏差双列右对齐完整呈现,工期带宽条横铺。
- `<EvidenceDrawer>` 从右侧滑入,卡不动(side drawer)。`<RecomputeDiffTable>` 在抽屉里完整两列。

### 平板(768–1023px)

- 卡宽自适应,重算偏差列保留;确定性接地徽章换行到 items 标题下方。
- 三段验收灯条保持横向。

### 移动(<768px)

- 单列纵向流;官印缩小移到标题行内右侧。
- 重算偏差从右对齐双列改为 item 内**第二行小字**("高 · 偏差 3"),不挤标题。
- `<RecomputeDiffTable>` 改**纵向堆叠**(自报值/重算值/偏差逐行),不横向挤。
- `<EvidenceDrawer>` 改**底部上拉抽屉**(bottom sheet),全宽。
- 工期带宽条压缩为"6~8 周"文字 + 迷你范围条。
- 动作按钮 `<ActionBar>` 固定底部吸附(sticky),主 action 占满宽,次 action 收进"更多"。
- 骑缝钢蓝印缩为落款行内小印,不跨边(移动端跨边压印易溢出)。

所有断点(320/375/768/1024/1440)验证无横向溢出;展开动画只用 transform/opacity。

---

## 8. 与前端仓 chaotang-web-lyt 的对接点

> 边界(接 AGENTS.md):**本仓只产 court_doc(机器面)+ 写本策划文档**;真实 UI 实现、CSS、组件、E2E 全部归 `chaotang-web-lyt`,不在本仓写页面。后端 dry-run 不替代前端真实浏览器验证。

### 8.1 API / 构建函数(后端已就绪 / 本仓提供)

工部已是 **L1**(出真 court_doc),核心入口在 `src/gongbu_review_verdict.py`:

| 用途 | 入口 | 返回 |
|---|---|---|
| 端到端验收 | `run_gongbu_review(presale_output, task_input, ...)` | court_doc(`doc_type=review`) |
| 重算 verdict → 文书 | `build_gongbu_review(sizing_verdict, ...)` | court_doc |
| 底层重算门 | `src/pack_rd_sizing.run_sizing_gate(presale_output, task_input)` | verdict{seriesTruth,parallelTruth,deterministic,claimed,deviations,green,extracted} |
| 通用装配 | `court_doc_builder.build_court_doc("gongbu", ...)` | court_doc |
| 拟新增 HTTP | `POST /api/gongbu/review`(设计 §五,待落地) | court_doc |

动作 → 后端语义映射(actions 词表,前端按此渲染按钮):

| 按钮 | action 值 | 行为 |
|---|---|---|
| 按重算值修正 | `apply_fix_cards` / `apply_fixes` | 采纳确定性重算值,重跑重算门 |
| 跑 release gate | `run_release_gate` / `escalate_court` | smoke→focused→release 三段验收门 |
| 存证 | `archive_evidence` / `archive_amulet` | 写 truth_ledger,出封存号 |
| 签风险单 | `sign_waiver` | 人工签字带病放行,翻 `signed=true` |

> 注:实测 `build_gongbu_review` 当前未显式传 `actions`,落到 builder 默认 `["apply_fixes","escalate_court","archive_amulet"]`;设计 §4.1 期望的是 `["apply_fix_cards","run_release_gate","archive_evidence","sign_waiver"]`。**前端按 action 字符串映射按钮文案,两套命名都要兼容**;若要统一,本仓在 `build_gongbu_review` 显式传 review 专属 actions——前端回提即可。

### 8.2 组件归属

- **共享卷宗组件库**(`<CourtDocCard>` 等,§3.1):建在 chaotang-web-lyt,11 部门共用。刑部已先跑通,工部**直接复用同一套**,只换印章/主色配置。
- **工部特有组件**(`<DeterministicBadge>`/`<RecomputeDiffTable>`/`<LeadTimeBand>`/四动作按钮/`<EvidenceDrawer>`,§3.2):放 chaotang-web-lyt 的 `components/gongbu/` 下。
- **印章/主色配置**:集中在前端仓的 `seal-registry`(部门→stamp SVG + 主色 token),驱动 `<DeptSeal>`。工部 = `{stamp: "ruler", color: "--gongbu-accent"}`(规矩印/钢蓝)。

### 8.3 契约纪律

- 前端**只渲染 court_doc 已有字段**,不臆造。字段缺失走 §6 降级态。
- 渲染纪律(禁假绿 / UNKNOWN 禁 PASS / 灯照搬不改 / signed 闸)是**前后端共同契约**,前端实现时以本文 §4 + frontend_handoff §四为准。
- **工期带宽结构化字段**是已知前端需求项:当前活在 headline 文本,前端先解析,**回提本仓补 court_doc 薄字段**(如 `lead_time:{min,max,unit}`),不在前端硬编码解析规则当长期方案。
- court_doc schema 变更由本仓发起,前端跟随;前端发现字段不够用回提需求,本仓补薄包装,不在前端硬编码业务判断。

---

gongbu-ui: 一句话进、一张验收单出 —— 灯定能不能做、工期带宽给范围不给承诺、确定性重算接地徽章+偏差对比表(claimed vs 重算)是护城河、骑缝钢蓝印封工程证据;红灯=重算对不上给"按重算值修正",UNKNOWN=抽不到数盖"不予验收·需人工",禁假 PASS 守住交付底气不变假底气。
