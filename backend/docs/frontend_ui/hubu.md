# 户部 · 前端 UI 策划(奏报卷宗 · 算盘印 · 金)

> 定稿 2026-07-01。落地仓:`chaotang-web-lyt`(本仓只产 court_doc 机器面,本文是渲染策划)。
> 必读上游:`docs/dept_design/frontend_handoff.md`(渲染契约)、`docs/dept_design/hubu.md`(户部设计)、`schemas/court_doc.json`(机器面契约)。
> 基调:**卷宗 × 现代**。户部 `doc_type=memorial`、官印=**算盘印**、主色=**金**、接地方式=**确定性重算**(`provenance.grounding=deterministic`)。
> 一句话:户部不卖财务台账,卖客户**敢拍胸脯回答"赚不赚钱 / 报价靠不靠谱 / 现金撑不撑得住 / 最坏赔多少"的底气**。数字按住来源,现金跑道靠重算,缺证据就降级"需人工",绝不假 PASS。

数据源真字段(全部已在本仓就绪,前端按字段渲染,不要画饼):
- court_doc 装配:`src/court_doc_builder.build_court_doc("hubu", ...)`。
- 现金跑道奏报:`src/hubu_cashflow_runway_memorial.build_cashflow_runway_memorial` → `src/hubu_memorial_verdict.cashflow_to_court_doc`(已出 L1 court_doc)。
- 付款裁决预览:`src/hubu_payment_preview.build_hubu_payment_preview`(显式 `previewOnly/executionAllowed=false/sideEffects=none`)。
- 数字可信度章:`src/confidence_tag.classify / tag_confidence`(一手/二手/推算·待核)。
- 三柱就绪记分卡:`src/hubu_three_pillar_scorecard.build_hubu_three_pillar_scorecard`。
- 闸:`src/hubu_treasury.payment_gate`(可用资金)、`src/hubu_financing_gate.financing_gate`(DSCR 偿债)。

---

## ① UI 定位:户部页面只回答四句话

户部主屏的存在意义是把这四句话在**一屏**内拍死,明细全部藏二级。任何元素若不服务于这四问,降级或折叠:

| 客户的问题 | 主屏回答位 | 真字段来源 |
|---|---|---|
| **这单赚不赚钱** | headline 一行 + 毛利/ROI 柱 | court_doc `headline`、`items[level=green/red]`、`memorial.metrics` |
| **报价靠不靠谱** | "报价=假设+敏感性+需签字"区块 | `flow_quotation` / `prompts_quotation` 产出(假设、价格区间、需签字项) |
| **现金撑不撑得住** | 现金跑道条(月数 + 区间 + 精度) | `runway_months / runway_low / runway_high / runway_precision` |
| **最坏赔多少** | "最大亏损"柱(肥尾前置) | `risks` 中的断流/缺口项、`next_month_forecast.ending_cash_estimate` |

定位红线(接后端宪法,前端必须守):
- **缺源数字 = 不存在**。没有来源章的硬数字不许单独成柱、不许进 headline。
- **预览 ≠ 执行**。任何屏幕都要可见 `previewOnly` 落款,真付款/对外报价按钮在 `signed=false` 时不可点。
- **确定性接地是户部底气**:`grounding=deterministic` 才落"重算接地"章;`needs_evidence`/`grounding=none` 一律盖"需补现金证据·待人工"。

---

## ② 主屏卷宗卡 ASCII 线框(套 court_doc)

一屏先给结论;科目明细、来源凭证、闸细节全在二级。线框对应真字段已标注。

```
┌──────────────────────────────────────────────────────┐
│ 🧮 户部奏报            〔金 · 算盘印〕  案号 HB-20260701-014 │ ← seal.stamp/color + case_id(楷体标题,金算盘印右上)
│ ──────────────────────────────────────────────────── │
│ 🟡 可接 · 须先调付款节奏                                 │ ← light(灯) + headline(人话结论一行)
│                                                        │
│ ┌── 赚多少 ──┐ ┌── 现金跑道 ──┐ ┌── 最坏赔多少 ──┐      │ ← 三柱(户部特有)
│ │ 毛利 23%   │ │ 🔴 缺口47天  │ │  -¥47万         │      │   毛利←items/metrics
│ │ [一手·财报]│ │ 4.2–7.8 月  │ │  (估末现金转负)  │      │   跑道←runway_low/high
│ └───────────┘ └─────────────┘ └────────────────┘      │   最坏←risks/forecast
│                                                        │
│ 🛡 户部为你挡了:一笔会让账上转负 47 天的付款节奏          │ ← shielded(心意①,高亮金底小字)
│                                                        │
│ 致命账目 Top                              〔点击展开〕   │ ← items[](按 odds×impact 排,红项置顶)
│  1 🔴 现金流缺口      高 · -¥47万   → 改"40%预付+30%到货" │   level/odds/impact/fix
│  2 🟡 毛利依赖电芯报价 中 · 23%→11% → 补一手供应商报价单   │   [待核·无源] 章 + tooltip
│  3 🟢 偿债 DSCR=1.8   低 · 达标      —                    │   DSCR 来自 financing_gate
│ ──────────────────────────────────────────────────── │
│ 落款:重算接地 · 来源覆盖率 78%                          │ ← grounding=deterministic + source_coverage_pct
│ [调付款节奏] [带证据锁价] [签字] [存草稿]                 │ ← actions[](signed=false 时"签字/真付款"灰)
│ 预览 · 未执行付款  ·  史馆 HB-014  〔骑缝金印〕            │ ← previewOnly + seal.sealed_archive(护身符)
└──────────────────────────────────────────────────────┘
```

布局优先级:① 灯+headline → ② 三柱 → ③ shielded → ④ items Top → ⑤ 落款+actions → ⑥ 预览印。三柱是户部相对刑部判决卡的**唯一结构性新增**,其余复用共享卷宗骨架。

---

## ③ 组件清单

### 3.1 共享卷宗组件(全院 11 部门复用,户部只换印章/主色)

| 组件 | 吃的字段 | 说明 |
|---|---|---|
| `<CourtDocCard>` | 整个 court_doc | 卷宗外框,印章/主色由 `seal` 驱动,户部传 `算盘印/金` |
| `<SealBadge>` | `seal.stamp` `seal.color` | 右上官印,算盘印 SVG + 金色 |
| `<VerdictLight>` | `light` | 红黄绿黑灯 + 整卡边框色 |
| `<Headline>` | `headline` | 楷体大字结论,人话在前 |
| `<ShieldedNote>` | `shielded` | 心意①"为你挡了"高亮条(空则不渲染) |
| `<ItemList>` | `items[]` | 渐进展开列表,红项置顶,`impact`/`odds` 右对齐,`fix` 折叠二级 |
| `<ProvenanceFooter>` | `provenance.grounding` `gate` `source_label` | 落款接地章 + 来源标签 |
| `<ActionBar>` | `actions[]` `signed` | 底部按钮,`signed=false` 锁不可逆动作 |
| `<ArchiveSeal>` | `seal.sealed_archive` | 骑缝朱印(户部=金印)+ 史馆封存号 |

### 3.2 户部特有组件

| 组件 | 吃的字段 | 说明 |
|---|---|---|
| `<ConfidenceNumber>` | `confidence_tag` 章(一手/二手/待核·无源) | **数字带来源 tooltip**。每个硬数字旁挂角标,悬停展开来源 tier + 出处摘要。`[待核·无源]` 角标必须警示色(灰/橙),不可与 `[一手]` 同色 |
| `<CashRunwayBar>` | `runway_months` `runway_low` `runway_high` `runway_precision` | **现金跑道条**:水平条 + 安全/关注/危急三段着色(<3 月红 / 3–12 月黄 / ≥12 月绿,阈值同 `SAFE_FLOOR_MONTHS=3`、`WATCH_MONTHS=12`)。`precision=rough` 显示区间带 + "粗估"标;`measured` 显示单点;`no_pressure` 显示"无烧钱压力" |
| `<ThreePillarStat>` | 三柱(毛利/现金跑道/最坏赔) | 主屏三柱卡,每柱可点进对应二级 |
| `<OddsImpactCol>` | `items[].odds` `items[].impact` | **赔率/金额列**:右对齐,金额负数标红,赔率"高/中/低"配权重底纹 |
| `<QuoteAssumptionBlock>` | quotation 假设/区间/敏感性/需签字项 | 报价不是一口价:假设列 + 价格区间 + "假设变了价怎么动"敏感性 + 必签字项徽章 |
| `<ScorecardRing>` | `overallScore` `grade` `pillars` | 三柱就绪记分卡环,`status=ready` 才点亮"存入史馆草稿" |
| `<MoneyStuckBreakdown>` | `money_stuck.*` | 二级:可动现金/应收(逾期90天)/库存/应付(拖欠60天)/净速动头寸 |
| `<NextMonthForecast>` | `next_month_forecast.*` | 二级:预计流入/流出/净额/估末现金;`available=false` 显示"缺到期数据,不可用" |

---

## ④ 状态(灯配色 / 接地落款 / pending 印)

### 4.1 灯配色(整卡边框 + 灯点)

| light | 含义 | 配色(在金主色体系内) | verdict 映射来源 |
|---|---|---|---|
| green | 现金安全/可放行 | 金绿(`healthy` / DSCR 达标) | `verdict=healthy` |
| yellow | 可接须改 | 主色金/琥珀 | `verdict=watch` |
| red | 告急/挡住 | 朱砂红(警示压过金) | `verdict=critical` |
| black | 资金链断裂高危 | 玄黑描金,移交刑部 | `escalate_black` |

灯由后端 `compute_light` 定,**前端照搬不改**(宪法 C8:不得"美化"成更乐观)。

### 4.2 needs_evidence → "需补现金证据" pending 印

当 `verdict=needs_evidence`(无余额且无现金流,或缺关键支出表):
- 后端 `gate=pending`,headline 前缀"需补现金证据 —— …;初判:…"。
- 前端**整卡盖半透"需人工"印**(对应宪法 C6 禁假 PASS),**禁止渲染绿灯/通过样式**。
- "签字 / 真付款 / 带证据锁价"按钮全置灰。
- 用 `missing_evidence[]` 渲染一张"还差哪些证据"清单(如"现金流量表月份不足""应收账龄表缺失")。

### 4.3 deterministic 接地落款(户部底气可视化)

| `provenance.grounding` | 落款章 | 视觉 |
|---|---|---|
| `deterministic` | **重算接地** | 金色实心章 + "数字已按住来源,跑道经重算" |
| `rag` | 法条接地 | (户部少用,顾问视角时出现) |
| `none` | **未接地 · 需人工** | 灰条警示,等价 pending |

并排显示 `source_coverage_pct`(来源覆盖率)与 `source_label`(LIVE/LIVE_SWARM/MIXED/FALLBACK/DEMO);`FALLBACK`/`DEMO` 必须打"演示/兜底,非真实裁决"角标。

### 4.4 签字态

`signed=false`(默认):奏报是**裁决草稿**,不可逆动作(真付款、对外报价)按钮灰且不可点;只有"签字"后端回 `signed=true` 才解锁。`previewOnly` 落款常驻。

---

## ⑤ 交互(P0–P3 分档 + 二级展开)

按 `frontend_handoff` 复杂度分档,户部交互对应:

- **P0 一屏看懂**:进页即见灯+headline+三柱+shielded,零点击拿结论。
- **P1 一键改**:点 `fix` 旁"应用此改法"→ 调出对应 action(如"调付款节奏"预填"40%预付+30%到货")。`actions` 与 `decisionActions.allowedActions` 对齐,`blockedActions` 的按钮灰显并给"为什么不能"提示。
- **P2 二级展开**:
  - 点 item → 展开该项 `fix` 全文 + `evidence_ref` 凭证。
  - 点三柱"现金跑道" → `<MoneyStuckBreakdown>` + `<NextMonthForecast>`。
  - 点任意带章数字 → tooltip 展开**来源凭证**(tier + 出处 + `evidenceChain` 中对应 `section/path/ref`)。
- **P3 不可逆 / 需会审**:`requiresSecondConfirmation=true`(高风险门 `large_payment`/`related_party`/`external_commitment`/`over_budget`)→ 弹二次确认,逐条勾选 `riskGates` 才能 `confirm_with_risk_gate`;`legal_redline` → 引导"交刑部复核";缺证据 → "退回补证"。

按钮文案直接用后端 `BUTTON_LABELS`(批准 / 确认风险后批准 / 退回补证 / 退回修正 / 交军机处再议 / 交刑部复核 / 存入史馆草稿 / 保存草稿),前端不要另造词。

**展开来源凭证(二级)**:点数字 → 浮层显示
```
营收 152.8万  [一手 · 财报]
└ 来源:2025Q2 审计报告 · internal_uploaded_file
└ 凭证 ref:truth://finance/HB-014/revenue
```
`[待核·无源]` 的数字浮层显示"无来源 → 户部当它不存在,不参与裁决",并提供"上传凭证"入口。

---

## ⑥ 空 / 加载 / 错误态

| 态 | 触发 | 渲染 |
|---|---|---|
| 空(无奏报) | 无 court_doc | 卷宗空壳 + 算盘印水印 + "等待户部出奏报" |
| 加载 | 等 `build_*` 返回 | 卷宗骨架屏(灯/三柱/items 占位),**不预染绿灯** |
| 证据不足 | `verdict=needs_evidence` | 见 §4.2,pending 印 + 缺证据清单(这是**业务态不是错误**,要明确区分) |
| 计算可用但数据弱 | `precision=rough` / `coverage<60` / `human_review_required=true` | 黄色"数据较少,按下界保守看待"提示带,跑道显区间 |
| 接口错误 | 后端异常/超时 | 错误卡 + "重算"按钮 + 不抹掉上一版结论;**绝不静默吞错**(接编码规范) |
| 兜底来源 | `source_label=FALLBACK/DEMO` | 全卡打"演示/兜底"水印,所有不可逆动作锁死 |

关键区分:**"证据不足"必须长得像"需要你补料",不能长得像"系统出错"**——前者是户部在保护客户,后者是故障。

---

## ⑦ 响应式

- **桌面(≥1024)**:三柱横排,items 右侧 `odds/impact` 列对齐,二级浮层悬停展开。
- **平板(768–1024)**:三柱仍横排但压缩,凭证 tooltip 改点击展开。
- **手机(<768)**:三柱**竖排堆叠**(赚多少 → 现金跑道 → 最坏赔),`<CashRunwayBar>` 占满宽;items 的 `odds/impact` 换行到标题下方;来源章改"长按看来源";actions 收成底部吸附按钮条,主动作(`primaryAction`)突出,其余进"更多"。
- 金色算盘印在小屏缩为角标但保留,保证品牌识别。
- 数字可读性是户部第一约束:任何断点下硬数字字号不低于正文,负数标红不靠颜色单一传达(加"-"号 + 形状)。

---

## ⑧ 对接 chaotang-web-lyt

### 8.1 交付顺序(接 handoff §五)

1. 复用前端已建的**通用 `<CourtDocCard>`**(刑部判决已跑通)→ 户部只注入 `算盘印/金` 配置即出基础卡。
2. 叠加户部特有组件(§3.2):先 `<CashRunwayBar>` + `<ConfidenceNumber>` + `<ThreePillarStat>`(覆盖四问主屏),再 `<QuoteAssumptionBlock>` + `<ScorecardRing>`(报价/就绪二级)。
3. 接真 API(下)。

### 8.2 数据契约(前端只消费 JSON,不碰后端逻辑)

- **现金跑道奏报** → `cashflow_to_court_doc()` 产出标准 court_doc(已 L1),前端直接喂 `<CourtDocCard>`;额外读 `memorial.money_stuck / next_month_forecast / perspectives / source_coverage_pct` 渲染二级。
- **付款裁决预览** → `build_hubu_payment_preview()` 返回 `{previewOnly, executionAllowed:false, sideEffects:"none", decision{recommendation,riskLevel,missingEvidence,riskGates,nextActions}, decisionActions{...buttonLabels}, archiveDraft, evidenceChain}`。`decisionActions` **直接驱动 `<ActionBar>`**(allowed/blocked/二次确认/按钮文案全现成)。
- **三柱记分卡** → `build_hubu_three_pillar_scorecard()` 返回 `{overallScore, grade, status, pillars, blockers, improvements, actions[{action,label,allowed}]}` 喂 `<ScorecardRing>`。
- **数字打章** → 后端已在 headline/perspectives 内用 `tag_confidence` 打好 `[一手·…]/[待核·无源]`;前端按章文本解析挂 `<ConfidenceNumber>` 角标,**不要在前端重新判级**(可信度判定是后端职责)。

### 8.3 边界纪律(本仓 AGENTS.md + handoff)

- 本仓只产机器面 court_doc;**所有 CSS/组件/E2E/浏览器验证在 `chaotang-web-lyt` 做**,不在 jiqun_ai 仓改前端。
- 渲染纪律照搬 handoff §四:`gate=pending`/`grounding=none` 绝不渲绿;丞相主线里户部灯照搬不改;`signed=false` 锁不可逆动作;明细默认折叠(决策不是知识)。
- 前端发现 court_doc 字段不够渲染(如需更细的报价敏感性结构),回本仓提"补薄包装",**不在前端硬造数字**。

---

### 附:户部相对刑部判决卡的差异速记
1. 印章金算盘 vs 朱砂天平;接地走 **deterministic 重算** vs 刑部 RAG 法条。
2. 主屏多一排**三柱**(赚多少/现金跑道/最坏赔)。
3. 多 `<ConfidenceNumber>` 数字来源章 + `<CashRunwayBar>` 跑道条这两个户部命脉组件。
4. `needs_evidence` 是户部高频态,pending 印 + 缺证据清单要做扎实——这正是户部"没来源的数字不上桌"的护身符。
