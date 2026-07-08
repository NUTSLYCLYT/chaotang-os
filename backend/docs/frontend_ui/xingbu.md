# 刑部 · 前端 UI 策划(判决书 verdict)

> 定稿基线 2026-07-01。本文是**人类面渲染策划**,落地在前端仓 `chaotang-web-lyt`,后端只产 court_doc(机器面 JSON)。
> 必读对齐:[../dept_design/frontend_handoff.md](../dept_design/frontend_handoff.md)(court_doc→卷宗渲染契约)、[../dept_design/xingbu.md](../dept_design/xingbu.md)(刑部设计 + 全院文书标准)、[../dept_design/README.md](../dept_design/README.md)(印章品牌系统表)。
>
> 基调:**卷宗×现代**。古典骨 = 楷体标题 / 天平官印 / 案号 / 骑缝留痕 / 宣纸微纹;现代肉 = 红黄绿黑灯 / 卡片 / 渐进展开 / 无衬线正文。
> 刑部身份:文书 = 判决书 verdict,官印 = **天平印**,主色 = **朱砂红**(`--xingbu-accent`)。

---

## 1. 部门 UI 定位:客户在这一屏要的是什么决策

刑部 = 客户的**风险护身符**,不是法务刹车。这一屏要回答客户的**一个决策**:

> "这件事(签合同 / 上线承诺 / 开自动化)**我现在敢不敢做?如果做,先改哪一处保命?**"

所以主屏不是"法务知识展示页",是**判决卡**。一屏看完就能拍板:

- **能不能做** —— 灯(绿/黄/红/黑)+ 一句结论,人话在前。
- **刑部替我挡了什么** —— 心意条,把价值说出来(底气来源)。
- **最致命的几个口子 + 一句话改法** —— Top items,赔率/损失右对齐,法条折叠在二级。
- **对方律师/监管/黑产会怎么打我** —— 红蓝对抗标签。
- **出事我有据可保命** —— 骑缝朱印 + 史馆封存号(护身符具象)。
- **下一步动作** —— 一键改 / 开庭 / 存证按钮。

设计纪律:**决策不是知识**。一屏先给"敢不敢 + 先改哪",法条、判例、依据全部默认折叠在二级。客户读完结论就能走;想深究再展开。

---

## 2. 主屏卷宗卡布局(精细线框,套 court_doc 真字段)

下面线框每一块都标注它吃的 court_doc 字段(契约 `schemas/court_doc.json`,字段名以刑部 §4.1 样例为准)。

```
┌──────────────────────────────────────────────────────────────┐
│ ╔════════════════════════════════════════════════╗   ╭──────╮ │  ← 宣纸微纹背景 + 朱砂红描边
│ ║ ⚖ 刑部判决                            案号 XB-007 ║   │ ⚖天平 │ │
│ ║   楷体标题(dept+doc_type)        (case_id)      ║   │ 朱印  │ │  右上官印:seal.stamp=天平 / seal.color=朱砂红
│ ╚════════════════════════════════════════════════╝   ╰──────╯ │
│ ────────────────────────────────────────────────────────────── │  ← 朱砂红细分隔线(古典)
│                                                                │
│  🟡  可签 —— 先改 2 处,否则尾款可能要不回来                      │  ← light=yellow → 灯+整卡边框色
│      (light)  (headline / verdict_oneline,楷体大字,人话在前)    │
│                                                                │
│  ┃ 刑部为你挡了:80万尾款拖欠口子                                │  ← shielded,左侧朱砂红竖条高亮(心意①)
│                                                                │
│  ┌────────────────────────────────────────────┐  〔点击展开〕   │
│  │ 致命风险 Top 3                  红蓝对抗 ▣攻:schneier      │ │  ← items[] 标题行 + adversarial 标签
│  │                                  最弱口:验收模糊          │ │     (red_blue.attacker / weakest)
│  │ ─────────────────────────────────────────── │             │
│  │ 1 🔴 验收标准模糊        赔率 高   损失 ¥80万   ▸ 改…       │ │  ← item: level/title 左,odds/loss 右对齐
│  │      └─[展开]一句话改法 + 法条依据(二级,默认折叠)          │ │     fix 折叠在二级,▸ 表可展开
│  │ 2 🟠 违约金条款偏软      赔率 中   损失 ¥15万   ▸ 改…       │ │     红项置顶,按 level 排序
│  │ 3 🟡 交付时间无缓冲      赔率 低   损失  时间   ▸ 改…       │ │
│  └────────────────────────────────────────────┘             │
│                                                                │
│  落款:法条接地 ✓ RAG · 判官 posner / 顾问 schneier             │  ← provenance.grounding + advisors
│  ────────────────────────────────────────────────────────────  │
│  留痕已封存 · 史馆 XB-20260630-007        ╭─╮                    │  ← seal.sealed_archive + archive_id
│                                          │骑│ 骑缝朱印(跨边压印) │     (心意②:护身符具象)
│                                          ╰─╯                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                       │
│  │ 一键改 ✎ │ │ 开庭 ⚖ │ │ 存证 🛡 │                          │  ← actions[]: apply_fixes/escalate_court/archive_amulet
│  └──────────┘ └──────────┘ └──────────┘                       │
└──────────────────────────────────────────────────────────────┘
```

布局要点:

- **三段式纵向节奏**:案号印章头 → 结论区(灯+headline+shielded)→ 证据区(Top items)→ 落款+动作区。古典"骑缝留痕"压在落款与卡边交界,跨边压印才有公文感。
- **官印右上角固定**,天平印 + 朱砂红,是部门身份的第一识别点。换部门只换 `seal.stamp`/`seal.color`,骨架不动(全院共享)。
- **赔率/损失右对齐成列**(odds / loss 两列),视觉上像账单,客户一眼扫"哪条最贵"。
- **fix(一句话改法)+ 法条依据默认折叠**,点 item 的 `▸` 才展开二级。一屏先给结论。

---

## 3. 组件清单

### 3.1 复用全院共享卷宗组件(吃 court_doc,印章/主色配置驱动)

这些组件全院 11 部门共用,刑部只传入配置(stamp=天平、color=朱砂红、doc_type=verdict):

| 组件 | 职责 | 吃字段 |
|---|---|---|
| `<CourtDocCard>` | 卷宗卡外壳(宣纸纹背景 + 灯色描边 + 三段节奏) | `light` / `dept` |
| `<DeptSeal>` | 右上官印(SVG,部门换印换色) | `seal.stamp` / `seal.color` |
| `<CaseHeader>` | 楷体标题 + 案号 | `dept` / `doc_type` / `case_id` |
| `<VerdictLight>` | 红黄绿黑灯徽 + 一行结论 | `light` / `headline` |
| `<ShieldedBanner>` | "为你挡了"心意条(竖条高亮) | `shielded` |
| `<RiskItemList>` | Top items 列表,渐进展开,红项置顶 | `items[]` |
| `<ProvenanceFooter>` | 落款:接地方式 + 大神席 | `provenance.grounding` / `provenance.advisors` |
| `<ArchiveStamp>` | 骑缝朱印 + 史馆封存号 | `seal.sealed_archive` / `provenance.archive_id` |
| `<ActionBar>` | 底部动作按钮组(动作名→按钮映射) | `actions[]` / `signed` |
| `<NeedHumanOverlay>` | "需人工复核"半透印遮罩 | `provenance.gate` |
| `<UnsignedWatermark>` | "未签字"水印 | `signed` |

### 3.2 刑部特有组件

| 组件 | 职责 | 说明 |
|---|---|---|
| `<RedBlueTag>` | 红蓝对抗标签:▣攻=攻击者(schneier),最弱口 | 吃 `red_blue.{attacker,weakest,why}`;hover 出 `why`。刑部专属,是"给合同做渗透测试"的视觉钩子 |
| `<OddsColumn>` | 赔率/损失右对齐列(高/中/低 + ¥金额) | 刑部 items 的 `odds`/`loss` 比通用列表更突出,做成账单感双列 |
| `<ApplyFixButton>` | 一键改:把 item.fix 应用到原文 | action=`apply_fixes`;需 `signed=true` 或非不可逆 |
| `<EscalateCourtButton>` | 开庭:升级会审(多大神/律师团) | action=`escalate_court`;触发更重档审议 |
| `<ArchiveAmuletButton>` | 存证:固化 truth_ledger 护身符 | action=`archive_amulet`;成功后高亮骑缝印 |
| `<ClauseDrawer>` | 法条二级抽屉(展开 item 时弹出) | 显示 fix + `evidence_ref` 指向的真法条/判例;grounding=none 时显式标"未接地·需人工" |

> 红蓝对抗、赔率列、一键改/开庭/存证 是刑部"震撼点"的 UI 落点(见刑部设计 §二)。其余复用全院组件,**别为刑部写第二套卡**。

---

## 4. 状态设计

### 4.1 灯(`light`)配色 —— 整卡边框 + 灯徽

| light | 含义 | 灯徽色 | 卡边框 | 文案前缀 |
|---|---|---|---|---|
| `green` | 可做 | 翠绿 `oklch(62% 0.17 150)` | 细绿描边 | "可签 / 可上" |
| `yellow` | 有条件做 | 琥珀 `oklch(80% 0.15 85)` | 琥珀描边 | "可签 —— 先改 N 处" |
| `red` | 高风险/拦 | 朱砂 `oklch(58% 0.21 27)` | 加粗朱砂描边 | "暂缓 —— 有致命口子" |
| `black` | 红线/深查 | 玄黑 `oklch(25% 0.02 0)` | 黑描边 + 暗红内晕 | "拦下 —— 触红线,刑部深查" |

黑灯是刑部专属高权重态(御史落黑灯才到刑部),视觉上最重:玄黑 + 暗红内晕,且**默认不允许 `apply_fixes`**,只允许 `escalate_court` / `archive_amulet`。

### 4.2 gate=pending → "需人工复核"半透印(禁绿)

`provenance.gate === "pending"` 时:

- 整卡盖 `<NeedHumanOverlay>`:朱砂红半透明大印"需人工复核",压在结论区。
- **强制禁绿**:即使 `light=green` 也降级渲染为黄/灰,灯徽旁加"待核"小字(对应后端宪法 C6 禁假 PASS)。
- 不可逆动作按钮置灰。

### 4.3 grounding → 落款标接地方式

`provenance.grounding`:

| 值 | 落款文案 | 视觉 |
|---|---|---|
| `rag` | "法条接地 ✓ RAG" | 绿勾,正常 |
| `deterministic` | "重算接地 ✓" | 蓝勾,正常(工部语义,刑部少见) |
| `none` | "未接地 · 需人工" | **灰条警示**,法条抽屉里显式提示"幻觉律师比没律师更危险,需人工律师确认" |

grounding=none 时,`<ClauseDrawer>` 不展示任何"权威法条结论",只展示"未命中知识库,以下仅供参考,需人工律师"。

### 4.4 signed=false → 禁执行水印

`signed === false`:

- 卡面叠 `<UnsignedWatermark>`:斜向淡灰"未签字"水印。
- **不可逆动作**(默认 `apply_fixes` 改原文、`escalate_court` 升级)按钮置灰,hover 提示"需人工签字后方可执行"。
- 可逆动作(`archive_amulet` 存证、展开看法条)仍可用。
- 签字态切换由前端走签字交互(签字成功→后端回 `signed=true` 的新 court_doc→重渲染),前端不自行翻转 signed。

> 守则(接 frontend_handoff §四):gate=pending / grounding=none **绝不渲染成绿灯**;丞相主线里各部门灯**照搬不改**;signed=false 不可逆动作置灰。

---

## 5. 交互流

### 5.1 P0–P3 复杂度档 → UI 轻重

court_doc 的管线复杂度档(P0 琐碎 → P3 重大)决定卡的"信息密度"。同一组件,按档收放:

| 档 | 场景 | UI 形态 |
|---|---|---|
| **P0** | 一句话快判 | **精简卡**:只灯 + headline + 一个主 action。无 items 展开、无红蓝对抗。一行结论拍板 |
| **P1** | 常规判决 | **标准卡**:线框全貌(灯+shielded+Top3+落款+动作),items 折叠二级 |
| **P2** | 含红蓝对抗 | 标准卡 + `<RedBlueTag>` 高亮 + 赔率列展开默认显示 |
| **P3** | 重大/不可逆 | **会审卡**:多大神席位露出、强制签字态、`escalate_court` 主按钮,可能叠钦天监前置参谋入口 |

前端按 court_doc 里的档位字段(或 items 数量 / red_blue 是否存在)自适应,不写四套页面,只切显隐与强调。

### 5.2 点击展开法条二级

- 点 item 行的 `▸` → 滑出 `<ClauseDrawer>`:上半"一句话改法"(fix),下半"法条/判例依据"(`evidence_ref` 拉取)。
- 渐进式:**默认全折叠**,客户主动点才展开,保证一屏先给决策。
- 展开动画走 `clip-path` / `transform`(合成器友好),不撑卡布局抖动。

### 5.3 开庭 = 升级会审

- 点 `开庭` → 弹确认:"升级会审会调更多律师/大神,耗时更长,是否继续?"
- 确认后调 `escalate_court` API → 进入会审态(loading 见 §6)→ 返回新 court_doc(通常档位升到 P3、advisors 增加),卡重渲染。
- 黑灯/红灯卡的开庭按钮为主色强调按钮;绿灯卡弱化为次要。

---

## 6. 空 / 加载 / 错误态

| 态 | 渲染 |
|---|---|
| **空(无判决)** | 卷宗卡空壳 + 天平印淡水印 + "尚无判决 —— 把要判的事(合同/承诺/自动化)发给刑部"引导 + 输入框 |
| **加载(初判)** | 卡骨架屏:案号头占位 + 灯位旋转天平印 + "刑部正在审理…"。骨架走宣纸纹底,保持品牌感,不用通用 spinner |
| **加载(开庭升级)** | 在现有卡上叠半透层"会审进行中 · 已调 N 席",显示已到位大神头像渐次点亮,**保留旧结论可读**(别白屏) |
| **错误(后端失败)** | 卡内黄条"刑部暂时无法审理 · 错误码 X",给"重试 / 转人工律师"两按钮;不静默吞错(接编码风格错误处理) |
| **错误(court_doc 字段缺失)** | 缺关键字段(无 light/headline)→ 降级为"卷宗残缺,需人工核对"灰态,绝不猜测渲染成绿 |
| **部分接地** | grounding=none 见 §4.3,作为半态处理,不算错误 |

加载/错误也守"禁假绿"纪律:任何不确定态都偏保守(灰/黄),不渲染成通过。

---

## 7. 响应式

### 桌面(≥1024px)

- 卷宗卡居中,最大宽约 720px(保持公文纸比例,不铺满)。
- 官印右上、骑缝印右下角压边,赔率/损失双列右对齐完整呈现。
- `<ClauseDrawer>` 从右侧滑入,卡不动(side drawer)。

### 平板(768–1023px)

- 卡宽自适应,赔率/损失列保留;红蓝对抗标签换行到 items 标题下方。

### 移动(<768px)

- 单列纵向流;官印缩小移到标题行内右侧。
- 赔率/损失从右对齐双列改为 item 内**第二行小字**("高 · ¥80万"),不挤标题。
- `<ClauseDrawer>` 改**底部上拉抽屉**(bottom sheet),全宽。
- 动作按钮 `<ActionBar>` 固定底部吸附(sticky),主 action 占满宽,次 action 收进"更多"。
- 骑缝朱印缩为落款行内小印,不跨边(移动端跨边压印易溢出)。

所有断点(320/375/768/1024/1440)验证无横向溢出;展开动画只用 transform/opacity。

---

## 8. 与前端仓 chaotang-web-lyt 的对接点

> 边界(接 AGENTS.md):**本仓只产 court_doc(机器面)+ 写本策划文档**;真实 UI 实现、CSS、组件、E2E 全部归 `chaotang-web-lyt`,不在本仓写页面。

### 8.1 API(后端已就绪 / 本仓提供)

| 用途 | 端点 | 返回 |
|---|---|---|
| 初判 | `POST /api/legal/verdict` | court_doc(`schemas/court_doc.json`) |
| 一键改 | action `apply_fixes` → `POST /api/legal/verdict`(带 fix 应用意图) | 新 court_doc(原文已改) |
| 开庭升级 | action `escalate_court` → 重判(更多 advisors) | 新 court_doc(档位↑) |
| 存证 | action `archive_amulet` → 写 truth_ledger / shiguan_archive | 封存号 + sealed_archive |

构建函数:`xingbu_verdict.build_verdict`(刑部已出 L1 真 court_doc)/ 通用 `court_doc_builder.build_court_doc("xingbu", ...)`。

### 8.2 组件归属

- **共享卷宗组件库**(`<CourtDocCard>` 等,§3.1):建在 chaotang-web-lyt,11 部门共用。先用刑部判决跑通,再配印章/主色矩阵,最后接其余部门 API(交付顺序见 frontend_handoff §五)。
- **刑部特有组件**(`<RedBlueTag>`/`<OddsColumn>`/三动作按钮/`<ClauseDrawer>`,§3.2):放 chaotang-web-lyt 的 `components/xingbu/` 下。
- **印章/主色配置**:集中在前端仓的 `seal-registry`(部门→stamp SVG + 主色 token),驱动 `<DeptSeal>`。刑部 = `{stamp: "balance", color: "--xingbu-accent"}`。

### 8.3 契约纪律

- 前端**只渲染 court_doc 已有字段**,不臆造。字段缺失走 §6 降级态。
- 渲染纪律(禁假绿 / 灯照搬不改 / signed 闸)是**前后端共同契约**,前端实现时以本文 §4 + frontend_handoff §四为准。
- court_doc schema 变更由本仓发起,前端跟随;前端发现字段不够用(如缺档位字段)回提需求,本仓补薄包装,不在前端硬编码业务判断。

---

xingbu-ui: 一句话进、一张判决书出 —— 灯定敢不敢、心意条说挡了啥、Top赔率藏法条、骑缝印是护身符,禁假绿/未签字闸守住护身符不失效。
