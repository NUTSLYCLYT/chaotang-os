# 兵部 · 前端 UI 策划(战报卡)

> 定稿 2026-07-01。人类面渲染策划,落地仓 `chaotang-web-lyt`(本文不在后端仓实现 UI)。
> 真相源:机器面契约 `schemas/court_doc.json`(`doc_type:"brief"` / `dept:"bingbu"`)+ 设计稿 `docs/dept_design/bingbu.md` + 渲染契约 `docs/dept_design/frontend_handoff.md`。
> 基调:**卷宗×现代** —— 古典骨(令旗 / 案号 / 骑缝朱印 / 楷体)+ 现代肉(红黄绿黑灯 / 卡片 / 渐进展开)。
> 官印:**令旗印**;主色:**赤橙**(web token `bing_bu = #F5A524` 烈金,以 `design-tokens.ts` 实值为准)。
> 一句话:兵部 = 销售人员手里的**底气**。卖的不是分析,是四个一线最缺的答案 —— 这单怎么推进、这条异议怎么拆、遇竞品怎么打、下一步成交动作是什么。

---

## ① UI 定位:这屏到底解决什么

兵部战报卡是销售在客户面前 / 跟进前 30 秒会看的**单屏决策面**,不是 CRM 报表。它必须当场回答四件事,且**结论永远在前、理论永远折叠**:

1. **这单现在能不能推、怎么推** —— 顶部一行灯 + headline 给定论(可推进 / 先拆 N 条异议 / 暂缓 / 客户将流失),不是"加强跟进"这种废话。
2. **客户这条异议怎么拆** —— 每条异议给一句**能当场说出口的回应**(chris-voss 镜像 / 校准提问),SPIN 分析与背后真实顾虑藏二级。
3. **遇竞品怎么打** —— `adversarial` 区:对方会拿什么打你(价格 / 交期 / 案例 / 关系)、**你这单最弱的口子**、一句反制。
4. **下一步成交动作是什么** —— `items` 里的动作项 + 底部 `actions` 按钮(用这句回应 / 约 POC / 核报价 / 回填结果),谁做、卡点、要不要签字。

**反面清单(别做成这样)**:别做成话术大全;别把 SPIN / 谈判理论铺在一屏;别让报价 / 交期数字脱离户部复核裸奔;别把 `signed=false` 的对外承诺渲染成可直接发送。

---

## ② 主屏战报卡 ASCII(套 court_doc 字段)

字段映射全部锚定 `schemas/court_doc.json`。下图标注每块对应的 JSON 字段。

```
┌─────────────────────────────────────────────────┐
│ 🚩 兵部战报            〔令旗印·赤橙〕 案号 BB-20260701-031 │ ← dept+seal.stamp/color + case_id
│ ───────────────────────────────────────────────── │
│ 🟡 可推进 —— 先拆 1 条异议         〔LIVE_SWARM〕        │ ← light(整卡边框赤橙→黄) + headline + source_label
│                                                     │
│ 🛡 兵部为你挡了:一次盲目降价(客户卡的是验收风险,不是价格)│ ← shielded(心意①·高亮小字)
│ ───────────────────────────────────────────────── │
│ 下一步 / 异议 Top3                      〔点击展开〕     │ ← items[](红项置顶,impact/odds 右对齐)
│  1 🔴 异议:"太贵了想再看看"          高 × ¥120万单     │ ← level/title  ……  odds × impact
│      └ 当场说:"再看看,是预算这关,还是怕落地不达预期?"  ▾ │ ← fix(递到嘴边的话) + 二级折叠(SPIN/真实顾虑/evidence_ref)
│  2 🟡 补一次现场 POC,把验收标准当场写死  中 × 决定能否签   │
│  3 🟢 竞品 X 已报低价但无本地售后        高 × 我方优势点   │
│ ───────────────────────────────────────────────── │
│ ⚔ 竞品攻防(红蓝对抗)                                 │ ← adversarial
│   攻击者:竞品X销售   最弱口子:我方报价高 8%             │ ←   .attacker / .weakest
│   why:对方主攻价格;你最弱=没把"本地售后SLA值多少钱"算给客户│ ←   .why
│ ───────────────────────────────────────────────── │
│ 落款:法条接地 ✓ RAG  |  御史闸:需人工复核 ⏳             │ ← provenance.grounding + provenance.gate(pending)
│ ───────────────────────────────────────────────── │
│ [用这句回应]  [约POC]  [核报价⚠]  [回填结果]            │ ← actions[](核报价回链户部 flow_quotation)
│ 战报已封存 · 史馆 BB-20260701-031   〔骑缝令旗印〕  ✎未签字 │ ← seal.sealed_archive(心意②) + signed=false 水印
└─────────────────────────────────────────────────┘
```

要点:`items` 装的是**下一步动作 / 异议拆法**(不是知识);异议项的 `fix` 直接渲染成"当场说"那一行,SPIN 全程藏二级;`gate=pending` → 整卡盖半透"需人工复核"印且**禁绿**;`signed=false` → 角标"未签字"水印 + `[核报价]` 等对外承诺动作置灰。

---

## ③ 组件清单

### 3.1 共享卷宗组件(全院 11 部门复用,兵部只配置不重写)

| 组件 | 职责 | 兵部传参 |
|---|---|---|
| `CourtDocCard` | 卷宗卡外壳:吃一份 court_doc → 渲染灯框 + 标题 + 印 + 分区 | `dept="bingbu"` 驱动印章 / 主色 |
| `DeptSeal` | 官印徽章(已存在,见 `src/components/DeptSeal.tsx`,`code:'bing_bu'`) | `令旗印`,variant 赤橙(走 gold/vermilion 之外的部门色) |
| `LightBadge` | 红黄绿黑灯 + 文案(`dept_doc.py` 的兵部口吻) | green=可推进 / yellow=可推进-先拆N个异议 / red=暂缓-异议未解 / black=高危-客户将流失 |
| `HeadlineBlock` | 一级结论楷体大字 | `headline` |
| `ShieldedRibbon` | "为你挡了/争取了"心意条 | `shielded` |
| `ItemList` | Top 列表,渐进展开,红项置顶,impact 右对齐,fix 二级折叠 | `items[]` |
| `AdversarialPanel` | 红蓝对抗小区(攻击者 / 最弱口子 / why) | `adversarial` |
| `ProvenanceFooter` | 落款:grounding(法条接地/重算接地/未接地·需人工)+ gate 印 | `provenance` |
| `ActionBar` | 底部动作按钮,`signed=false` 时不可逆动作置灰 | `actions[]` |
| `SealedArchiveStamp` | 骑缝朱印 + 史馆封存号 + 未签字水印 | `seal.sealed_archive` / `signed` |
| `SourceLabelTag` | 来源真实性标签(LIVE/LIVE_SWARM/MIXED/FALLBACK/DEMO) | `source_label` |

> 注:`chaotang-web-lyt` 已有 `OfficialDocument.tsx`(props: docNo/bluf/sections/risks/nextSteps/statusBanner)。它是"奏折/公文"通用壳,可作 `CourtDocCard` 的底座,但兵部战报需补「异议→话术」「红蓝对抗」两个 court_doc 专属分区——见 §8 对接方案。

### 3.2 兵部特有组件(其它部门没有,本部门核心价值)

| 组件 | 职责 | 数据来源 |
|---|---|---|
| `CustomerBattleTimeline` | **客户战情时间线**:首触→异议→POC→报价→签字/流失,每节点挂证据 ref。售后故障也回填到这条线上(出事不失分) | `customer_outcome` 回填 + `truth_ledger` 证据,`evidence_ref` |
| `ObjectionScriptCard` | **异议→话术卡**:左=客户原话(level 灯) / 右=能当场说的回应;展开见 镜像复述 + 标注情绪 + 校准提问 + 背后真实顾虑 | `items[]` 中 level=red/yellow 的异议项 + chris-voss 席输出 |
| `NextActionChecklist` | **下一步动作清单**:勾选式,每项标 谁做 / 卡点 / 是否需签字;勾完触发 `archive_outcome` 回填 | `items[]` 动作项 + `actions[]` |
| `BattlecardAdversarial` | 竞品攻防卡(可独立于战报卡复用到竞品库) | `adversarial` + `flow_opc` 产出 `sales_battlecard` |
| `PromoteToGoldenButton` | 赢单/拆解成功 → 人工 `promote` 成 `commercial_golden_case`(只人工,杜绝把侥幸当套路) | 写 `production_events`,人工签字 |

---

## ④ 状态机(灯 × 门禁 × 签字)

战报卡的可视状态由三个正交维度叠加,**不允许前端自行美化成更乐观**(对接宪法 C6/C8):

**A. 总裁定灯(`light`,整卡边框 + 顶部徽)**
- 🟢 green = 可推进 → 边框赤橙常亮,动作可点。
- 🟡 yellow = 可推进·先拆 N 个异议 → 边框琥珀,顶部提示"先拆 N 条"。
- 🔴 red = 暂缓·异议未解 → 边框转红,**异议未解项全部置顶高亮**,主推进动作降级为"先拆异议"。
- ⚫ black = 高危·客户将流失 → 边框玄黑暗红,顶部告警条"流失前兆",建议直送售后/上级。

**B. 门禁(`provenance.gate`)** —— 覆盖灯色,优先级最高
- `pending` → 整卡盖半透"**需人工复核**"印,**禁止渲染绿灯**,headline 末尾追加"·待复核"。
- `blocked` → 红条"已驳回:无客户证据 / 无户部报价复核 / 无礼部话术复核",对外动作全禁。
- `passed` / `n/a` → 正常。

**C. 接地(`provenance.grounding`)**
- `rag` → 落款"法条/话术接地 ✓"。
- `deterministic` → "重算接地"(报价 / ROI 走户部确定性门时)。
- `none` → 灰条警示"**未接地·需人工**",该结论不得当权威,涉报价 / 交期一律压黄。

**D. 签字(`signed`)** —— 不可逆动作闸
- `false` → 角标"未签字"水印;`[核报价]`/交期承诺/赔付承诺等对外动作**置灰不可点**(幻觉承诺赔的是真金白银)。
- `true` → 解锁;骑缝印转"已签发"。

**派生状态(兵部业务态,前端据 items/customer_outcome 计算)**
- 异议未解(存在 level=red 且无 fix 落地)→ 该项红色脉冲,卡片标"⚠ N 条异议待拆"。
- 待跟进(`NextActionChecklist` 有未勾项且超期)→ 动作项标橙点"待跟进",可一键"标记已跟进/改期"。
- 售后回填缺失(`flow_storage_aftercare` 已出结果但 `customer_outcome` 未回填)→ 时间线该节点闪红"结果待回填"。

---

## ⑤ 交互(复杂度分档 P0–P3 + 核心手势)

按 `docs/chaotang_execution_protocol.md` / 管线复杂度分档,前端把动作映射到四档,**档位决定要不要弹确认 / 要不要签字**:

| 档 | 场景 | 交互 |
|---|---|---|
| **P0 直接做** | 展开异议看话术、勾选下一步动作、标记已跟进、查看证据 ref | 即时,无确认弹层 |
| **P1 轻确认** | 用这句回应(复制话术到剪贴板/话术台)、约 POC(写日程) | 单击执行 + toast,可撤销 |
| **P2 回链复核** | `[核报价]` → 跳 `flow_quotation`(户部)复核 / 礼部话术复核;`promote` 成 golden case | 二次确认 + 显示"将提交 X 部门复核",回填结果后才放行 |
| **P3 不可逆·需签字** | 对外报价/交期/ROI/安全承诺发出、召回/赔付承诺、客户资源覆盖 | **必须人工签字态**(`signed=true`)才可点;弹签字确认 + 走钦天监/刑部 |

**关键手势**
- **异议展开应对话术**:点异议行 → 二级抽屉滑出:① 当场说(大字,带[复制]) ② 镜像复述 ③ 标注的情绪 ④ 校准提问"我们怎么才能…" ⑤ 背后真实顾虑 ⑥ evidence_ref 跳证据。SPIN/谈判理论默认折叠在最底"为什么这么说"。
- **标记跟进**:`NextActionChecklist` 每项右侧三态——[未跟进]/[已跟进]/[改期],改状态即写回 `customer_outcome`(乐观更新 + 失败回滚)。
- **红蓝对抗展开**:点"竞品攻防"→ 展开完整 `sales_battlecard`(对方四张牌 + 我方逐条反制)。
- **回填结果**:`[回填结果]` → 表单(赢/输/拖黄 + 原因 + 售后故障)→ 触发史馆归档 + 钦天监复盘;赢单可一键进 `PromoteToGoldenButton`。

---

## ⑥ 空 / 加载 / 错误态

复用 web 仓现有 `DataState.tsx` + `DemoDataBanner.tsx`,**绝不拿假数据冒充 LIVE**:

- **加载中**:卷宗卡骨架屏(灯位 + 标题 + 3 行 items 占位),令旗印灰显,文案"正在调度销售战情团…(neil-rackham / chris-voss / aaron-ross / charity-majors)"。
- **空态(无此单战情)**:卷宗留白 + 令旗印淡纹,文案"暂无战报 —— 输入一句客户原话(如'客户说太贵了想再看看')即可生成",带 `PromptSuggester` 示例。
- **空态(items 为空但有结论)**:只渲染灯 + headline + shielded,Top 列表区显"本单暂无待拆异议,可直接推进"。
- **错误态(蜂群/flow 失败)**:红条"战情生成失败 + 重试",`source_label` 退为 `FALLBACK`/`DEMO` 时**显式打标**,卡片顶部挂 `DemoDataBanner`("演示数据,勿据此对客户承诺")。
- **门禁未过**:不是错误,是正常 `pending` 态,见 §④B,渲染"需人工复核"而非报错。
- **降级**:RAG 检索不可用 → grounding 降 `none` + 灰警示,涉报价/交期结论压黄并禁对外动作,不静默放行。

---

## ⑦ 响应式

战报卡是"30 秒决策面",移动端(销售在客户现场掏手机)是一等公民:

- **桌面(≥1024)**:单卡居中 600–720px,右侧可挂 `CustomerBattleTimeline` 侧栏;异议二级抽屉右滑覆盖。
- **平板(768–1023)**:单列全宽,时间线折叠成顶部横向步骤条,抽屉改底部上拉。
- **手机(<768,主用场景)**:
  - 一屏先给 灯 + headline + shielded + Top1 异议的"当场说"那一行(其余 items 折叠为"展开 +N")。
  - `actions` 收成底部吸底操作条(主按钮"用这句回应"),`[核报价]` 等 P2/P3 动作收进"更多"。
  - 异议/红蓝对抗全部默认折叠,点开为全屏抽屉。
  - 字号守 web 仓红线:标签 ≥11px,正文 ≥13px(`fontSizeRedLine`)。
- **打印/导出**:战报可导成 PDF 卷宗(展开全部 items + 证据 ref + 骑缝印),供线下复盘。

---

## ⑧ 对接 chaotang-web-lyt(务实接真,不画饼)

**现状(web 仓已有,直接接)**:`src/features/bingbu/` 已落地——`components/bingbu-office-page.tsx`、`bingbu-main-view.tsx`、`bingbu-detail-panel.tsx`、`bingbu-decision-cockpit.tsx`、`bingbu-prospect-panel.tsx`、`customer-upload-qualify.tsx`、`bingbu-org-rail.tsx`;`lib/` 有 `bingbu-roster.ts`、`bingbu-real-decisions.ts`、`bingbu-engines.ts`、`prospect-qualify.ts`、`quotation-document.ts`、`sales-extract.ts`、`customer-import.ts`;`hooks/use-bingbu-overview.ts`。共享件 `OfficialDocument.tsx` / `DeptSeal.tsx`(`code:'bing_bu'`)/ `DataState.tsx` / `DemoDataBanner.tsx` 均在。

**落地步骤(前端)**
1. **接契约,不发明字段**:战报卡 props 直接吃 `schemas/court_doc.json`(`doc_type:"brief"`,`dept:"bingbu"`)。后端出 court_doc 的入口是 `src/court_doc_builder.py` 的 `build_court_doc("bingbu", ...)`(seal 已配 `令旗印`/`赤橙`);灯文案取自 `src/dept_doc.py` 的 `DEPT_HEADLINES["bingbu"]`。前端勿自造字段名。
2. **API**:对接设计稿规划的 `POST /api/bingbu/battlecard`(一句话客户原话进 → 战报 court_doc 出)。当前若后端 `flow_bingbu` 未就绪(本仓暂无 `config/flow_bingbu.yaml`),先用 `bingbu-real-decisions.ts` 走既有 `flow_haolong`+`flow_opc`+`flow_voice_sales` 编排的返回,`source_label` 据实标 `LIVE_SWARM`/`MIXED`。
3. **复用而非重写**:以 `OfficialDocument` 为 `CourtDocCard` 底座(`docNo←case_id`、`bluf←headline`、`statusBanner←gate=pending 时"需人工复核·禁外发"`、`risks/nextSteps←items`),**新增** `ObjectionScriptCard` + `BattlecardAdversarial` 两个 court_doc 专属分区填进 sections。
4. **印章 / 主色**:`DeptSeal` 传 `bing_bu`,主色用 token `bing_bu (#F5A524 烈金)` 作小徽点 / 标签,面板仍走 web 仓统一暗金底(遵 DESIGN.md 反 slop 红线,**别整图铺底**,接真数据)。
5. **守渲染纪律(对接后端宪法)**:`gate=pending`/`grounding=none` 绝不渲绿(C6);丞相主线里兵部灯照搬不改(C8);`signed=false` 不可逆动作置灰(§④D);报价/交期数字必带户部 `flow_quotation` 复核来源,无来源不渲染成定稿。
6. **回填闭环**:`[回填结果]`/`标记跟进` 写回 `customer_outcome`,售后经 `flow_storage_aftercare` 结果强制回填到 `CustomerBattleTimeline`;`promote` 成 `commercial_golden_case` 必走人工签字。
7. **边界**:页面/样式/E2E/Next build 全在 `chaotang-web-lyt` 做;本仓只供 court_doc JSON 与后端链路,不在此实现 UI。
