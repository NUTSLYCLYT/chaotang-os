# 丞相 / 上书房 · 前端 UI 策划(相旨 / 主线 edict)

> 定稿基线 2026-07-01。本文是**人类面渲染策划**,落地在前端仓 `chaotang-web-lyt`,后端只产 court_doc(机器面 JSON)。
> 必读对齐:[../dept_design/frontend_handoff.md](../dept_design/frontend_handoff.md)(court_doc→卷宗渲染契约)、[../dept_design/prime_minister.md](../dept_design/prime_minister.md)(丞相设计 + 主线聚合)、[../dept_design/README.md](../dept_design/README.md)(印章品牌系统表)。
> 同骨架样板:[xingbu.md](xingbu.md)(刑部判决书 UI)。丞相**复用同一套卷宗组件**,只换印换色 + 加一组主线特有件。
>
> 基调:**卷宗×现代**。古典骨 = 楷体标题 / 相官印 / 案号 / 骑缝留痕 / 宣纸微纹;现代肉 = 红黄绿黑灯 / 卡片 / 渐进展开 / 无衬线正文。
> 丞相身份:文书 = 相旨 / 主线 edict,官印 = **相印**,主色 = **朱紫**(`--prime-accent`,帝王近臣之色,区别于刑部朱砂红)。

---

## 1. 部门 UI 定位:客户在这一屏要的是什么决策

丞相 = 客户的**主心骨**,不是又一个出意见的部门。六部各出一张文书(刑部判风险、户部算钱、工部看交付……),客户看完只会更乱:"六张纸都对,那我**现在到底先干哪一件**?" 这一屏要回答客户的**一个决策**:

> "各部门一堆结论摆在面前,**我第一步先做什么、按什么顺序、谁来做**?能不能一键就把它推成真实任务?"

所以主屏不是"部门意见汇总页",是**主线卡 / 相旨**。一屏看完就能开工:

- **现在先做这一件** —— 主线第一句(`headline`),人话在前,唯一首步。
- **丞相替我把乱压成一条** —— 心意条(`shielded`),把"六部各说各话→一条主线"的价值说出来。
- **按这个顺序的下一步** —— 主线时间轴(`items[]`),每条带**源部门灯徽**(照搬源部门原灯,不改),部门原文折叠在二级。
- **一键开工** —— 把主线推成真实会审/任务(`confirm_start`),不用自己把结论翻译成指令。
- **可续可复盘** —— 骑缝相印 + 史馆封存号(主心骨具象,下一轮回来直接看上次走到哪)。

设计纪律:**决策不是知识堆叠**。一屏先给"先做哪件 + 按这个顺序",各部门判决/奏报/赔率全部默认折叠在二级。**丞相只调序,不软化任何部门的灯**(见 §4.5 铁律)。

---

## 2. 主屏卷宗卡布局(精细线框,套 court_doc 真字段)

下面线框每一块都标注它吃的 court_doc 字段。字段名以 `src/court_doc_builder.py:assemble_mainline` 的**真实输出**为准(不是画饼):
- `headline` = `先办:{源部门} — {源部门 headline}`(主线第一句 = 最严重那条)。
- `light` = 各源部门里**最差的那盏灯**(主线总灯不得比最差的更乐观)。
- `items[]` = 各部门 court_doc 按灯严重度(黑>红>黄>绿)排序后,逐条复制成 `{level: 源部门原灯, title: "{源部门}: {源部门 headline}", evidence_ref: 源部门 archive_id}`。
- `actions` = `["confirm_start","reorder","escalate_court"]`。
- `seal` = `{stamp:"相印", color:"朱紫", sealed_archive: archive_id}`。

```
┌──────────────────────────────────────────────────────────────┐
│ ╔════════════════════════════════════════════════╗   ╭──────╮ │  ← 宣纸微纹背景 + 朱紫描边
│ ║ 📜 丞相相旨                          案号 XX-014 ║   │ 📜相 │ │
│ ║   楷体标题(dept+doc_type)        (case_id)      ║   │ 朱紫印│ │  右上官印:seal.stamp=相印 / seal.color=朱紫
│ ╚════════════════════════════════════════════════╝   ╰──────╯ │
│ ────────────────────────────────────────────────────────────── │  ← 朱紫细分隔线(古典)
│                                                                │
│  🟡  现在先做这一件:                                            │  ← light=最差源部门灯 → 灯+整卡边框色
│      先办:工部 — 先改验收口子,改完当天就能签                    │     (headline,楷体大字,人话在前)
│                                                                │
│  ┃ 丞相替你压成一条:六部各说各话 → 一条主线,别急着先锁价         │  ← shielded,左侧朱紫竖条高亮(心意①)
│                                                                │
│  ┌────────────────────────────────────────────┐  〔点击展开〕   │
│  │ 按这个顺序走                    主线时间轴 (items[])         │ │  ← 时间轴:按源灯严重度排,红/黑置顶
│  │ ─────────────────────────────────────────── │             │
│  │ ①│🔴 工部       改验收口子,否则尾款口子没堵   ▸源文 │       │ │  ← item.level=源部门原灯(锁定·不可编辑)
│  │  │   〔源部门灯 · 照搬不改〕  evidence_ref→工部判决       │ │     title="{dept}: {headline}",▸展开源 court_doc
│  │ ②│🟡 户部       验收改完当天签锁价单           ▸源文 │       │ │     ⠿ 拖拽手柄=可调序(但灯锁死)
│  │ ③│🟢 史馆       归档主线 + 留痕               ▸源文 │       │ │     红黑步在前,绿步殿后
│  └────────────────────────────────────────────┘             │
│   ⚠ 有红灯部门(工部🔴)→ 主线受阻:第①步不绿,后续步置灰         │  ← §4.3 受阻态提示
│                                                                │
│  落款:综合六部 · 判官 munger / drucker / bezos · 接地 MIXED     │  ← provenance.advisors + source_label
│  ────────────────────────────────────────────────────────────  │
│  主线已封存 · 史馆 XX-20260701-014        ╭─╮                    │  ← seal.sealed_archive + archive_id
│                                          │骑│ 骑缝相印(跨边压印) │     (心意②:主心骨具象 + 下轮可续)
│                                          ╰─╯                    │
│  ┌────────────┐ ┌──────────┐ ┌──────────┐                     │
│  │ 确认开工 ✍ │ │ 调整顺序 ⠿│ │ 升级会审 ⚖│                     │  ← actions: confirm_start/reorder/escalate_court
│  └────────────┘ └──────────┘ └──────────┘                     │     确认开工=主按钮(需签字,见 §5.4)
└──────────────────────────────────────────────────────────────┘
```

布局要点:

- **三段式纵向节奏**:案号印章头 → 结论区(灯+headline+shielded)→ 主线时间轴区 → 落款+动作区。骑缝留痕压在落款与卡边交界,跨边压印才有公文感。
- **官印右上角固定**,相印 + 朱紫,是部门身份的第一识别点。换部门只换 `seal.stamp`/`seal.color`,骨架不动(全院共享)。
- **主线时间轴是丞相区别于刑部的核心**:不是平铺风险列表,是**带序号 + 源部门灯徽 + 拖拽手柄**的纵向"先后步"。每步左侧是序号与源灯,右侧是源部门一句话 + 展开源文入口。
- **确认开工是主按钮**(朱紫强调),其余两个动作弱化。一屏先给"先做哪件",一键即可推真实任务。

---

## 3. 组件清单

### 3.1 复用全院共享卷宗组件(吃 court_doc,印章/主色配置驱动)

这些组件全院 11 部门共用,丞相只传入配置(stamp=相印、color=朱紫、doc_type=edict):

| 组件 | 职责 | 吃字段 |
|---|---|---|
| `<CourtDocCard>` | 卷宗卡外壳(宣纸纹背景 + 灯色描边 + 三段节奏) | `light` / `dept` |
| `<DeptSeal>` | 右上官印(SVG,部门换印换色) | `seal.stamp` / `seal.color` |
| `<CaseHeader>` | 楷体标题 + 案号 | `dept` / `doc_type` / `case_id` |
| `<VerdictLight>` | 红黄绿黑灯徽 + 一行结论(丞相=主线总灯+首步) | `light` / `headline` |
| `<ShieldedBanner>` | "为你压成一条"心意条(竖条高亮) | `shielded` |
| `<ProvenanceFooter>` | 落款:接地方式 + 大神席 | `provenance.grounding` / `provenance.advisors` |
| `<ArchiveStamp>` | 骑缝相印 + 史馆封存号 | `seal.sealed_archive` / `provenance.archive_id` |
| `<ActionBar>` | 底部动作按钮组(动作名→按钮映射) | `actions[]` / `signed` |
| `<NeedHumanOverlay>` | "需人工复核"半透印遮罩 | `provenance.gate` |
| `<UnsignedWatermark>` | "未签字"水印 | `signed` |

> 丞相**不为这些写第二套卡**。把刑部跑通的同一套组件直接复用,只换印章配置。

### 3.2 丞相特有组件

| 组件 | 职责 | 说明 |
|---|---|---|
| `<MainlineTimeline>` | 主线时间轴:把 `items[]` 渲染成带序号的纵向"按序下一步",按 `level` 严重度排(黑>红>黄>绿),红黑置顶。**替代刑部的 `<RiskItemList>`**(丞相语义是"顺序"不是"风险清单") | 吃 `items[]`;每条渲染序号 + `<SourceDeptBadge>` + title(去掉 `{dept}:` 前缀后作正文)+ 展开源文入口 + 拖拽手柄 |
| `<SourceDeptBadge>` | 源部门灯徽章:显示源部门名 + 该部门**原灯**(红/黄/绿),**不可编辑、灰态锁定** | 吃 `item.level`(= 源部门原灯)+ 从 `item.title` / `item.evidence_ref` 解析出的源部门 slug;hover 提示"此灯由源部门判定,丞相不可改" |
| `<DragReorderHandle>` | 调序拖拽手柄(⠿):允许拖动改 `items` 顺序,但**灯/原文锁死**(只发顺序意图,不改 level) | 拖拽产生新顺序数组 → 走 `reorder` action 回后端重算 light;前端不在本地翻转 level(见 §5.2 铁律) |
| `<SourceDocDrawer>` | 源部门原文二级抽屉(展开某步时弹出):显示该步 `evidence_ref` 指向的**源部门完整 court_doc**(刑部判决 / 户部奏报原文) | 吃 `item.evidence_ref`(= 源部门 archive_id)→ 拉源 court_doc 渲染(可嵌套 `<CourtDocCard>` 缩略) |
| `<EdictPreview>` | 拟旨预览:把 `headline` + 排序后的 `items` 拼成一段"派谁、查什么、要什么格式回奏"的拟旨草案,确认开工前给客户看一眼 | 接 `shangshufang_loop.draft_edict` 的 `refined_edict`;客户确认后才 dispatch |
| `<ConfirmStartButton>` | 一键开工:把主线推成真实会审/任务 | action=`confirm_start`;不可逆 → 需 `signed=true`(见 §5.4),点击先弹 `<EdictPreview>` 确认 |
| `<BlockedBanner>` | 主线受阻条:存在红/黑源步时,提示"有红灯部门 → 主线受阻,先解第①步" | 由 `items` 里是否有 `level∈{red,black}` 驱动 |

> 主线时间轴、源部门灯徽锁定、拟旨预览、一键开工 是丞相"震撼点"的 UI 落点(见丞相设计 §二)。其余复用全院组件。

---

## 4. 状态设计

### 4.1 灯(`light`)配色 —— 整卡边框 + 灯徽(丞相总灯 = 最差源部门灯)

丞相主线总灯由 `assemble_mainline` 取**各源部门里最严重的一盏**(`compute_light` + 严重度排序),前端直接渲染,不得"美化"成更乐观:

| light | 含义(主线层) | 灯徽色 | 卡边框 | 文案前缀 |
|---|---|---|---|---|
| `green` | 全部门绿,可直接开工 | 翠绿 `oklch(62% 0.17 150)` | 细绿描边 | "可开工 —— 按序推进即可" |
| `yellow` | 有黄步,先改再走 | 琥珀 `oklch(80% 0.15 85)` | 琥珀描边 | "现在先做这一件 —— 改完即可往下" |
| `red` | 有红步,主线受阻 | 朱砂 `oklch(58% 0.21 27)` | 加粗朱砂描边 | "主线受阻 —— 先解红灯那步" |
| `black` | 有黑步,落刑部深查 | 玄黑 `oklch(25% 0.02 0)` | 黑描边 + 暗红内晕 | "主线挡下 —— 触红线,先过刑部/会审" |

铁律具象:**主线总灯永远 ≤ 最差源部门灯的乐观度**。即使五部门绿、一部门红,主线必须红,不允许平均成黄。

### 4.2 gate=pending → "需人工复核"半透印(禁绿)

`provenance.gate === "pending"` 时(`build_court_doc` 在接地不足时降级):

- 整卡盖 `<NeedHumanOverlay>`:朱紫半透明大印"需人工复核",压在结论区。
- **强制禁绿**:即使 `light=green` 也降级渲染为黄/灰,灯徽旁加"待核"小字(对应后端宪法 C6 禁假 PASS)。
- `<ConfirmStartButton>` 置灰(不可逆动作不准在 pending 态推真实任务)。

### 4.3 主线受阻态(丞相特有)—— 有红/黑源步 → 后续步置灰

当 `items` 里存在 `level∈{red,black}` 的步:

- 顶出 `<BlockedBanner>`:"⚠ 有红灯部门(工部🔴)→ 主线受阻:先解第①步"。
- 时间轴里**该红步之后的所有步置灰**(视觉上"被挡住"),hover 提示"依赖上一红步解除后才能走"。
- `<ConfirmStartButton>` 文案改为"先解红灯步",或弱化为只允许 `escalate_court`(升级会审 / 问钦天监)。
- 这把后端"红灯在前、绿步殿后"的排序语义可视化,客户一眼看到卡点在哪。

### 4.4 grounding / source_label → 落款标接地与来源

- `provenance.grounding`:`rag`→"法条接地 ✓" / `deterministic`→"重算接地 ✓" / `none`→"未接地 · 需人工"(灰条警示)。丞相多为汇总,常见 `source_label=MIXED`(混合各部门),落款明示"综合六部",不冒充单一权威接地。
- `provenance.advisors`:丞相席多为 `munger / drucker / bezos`(裁先后的跨域判官),落款显示"判官"而非"顾问",但仍**不下专业结论**,只调序。

### 4.5 signed=false → 禁开工水印(丞相铁律落点)

`signed === false`:

- 卡面叠 `<UnsignedWatermark>`:斜向淡灰"未签字"水印。
- **`<ConfirmStartButton>`(确认开工)是不可逆动作**(推真实会审/烧资源)→ 置灰,hover 提示"需人工签字后方可开工";`<DragReorderHandle>` 调序(可逆,只发顺序意图)与展开源文仍可用。
- 签字态切换由前端走签字交互(签字成功→后端回 `signed=true` 的新 court_doc→重渲染),前端不自行翻转 signed。

> **守则铁律(接 frontend_handoff §四 + `assert_mainline_preserves`)**:
> 1. gate=pending / grounding=none **绝不渲染成绿灯**。
> 2. 丞相主线里**各部门灯照搬不改**——`<SourceDeptBadge>` 的灯锁死,前端不得"美化"成更乐观;调序只改顺序不改 level(对应宪法 C8 与 `assert_mainline_preserves`:软化源灯后端直接抛 `ValueError`)。
> 3. signed=false 时确认开工置灰。

---

## 5. 交互流

### 5.1 P0–P3 复杂度档 → UI 轻重

同一组件,按档收放(丞相按 `items` 数 / 是否含红黑步 / 是否触不可逆自适应,不写四套页面):

| 档 | 场景 | UI 形态 |
|---|---|---|
| **P0** | 只有一两步、全绿 | **精简卡**:只灯 + headline(现在先做这一件)+ `确认开工`。无时间轴展开、无拟旨预览 |
| **P1** | 常规主线(3–5 步) | **标准卡**:线框全貌(灯+shielded+时间轴+落款+三动作),源文折叠二级 |
| **P2** | 含红/黑受阻步 | 标准卡 + `<BlockedBanner>` + 受阻置灰(§4.3),确认开工降级为"先解红步 / 升级会审" |
| **P3** | 含不可逆步(签字/烧钱/架构分叉) | **会审卡**:强制签字态(§5.4)、`<EdictPreview>` 必看、`escalate_court` 升钦天监前置参谋入口露出 |

### 5.2 调整顺序(`reorder`)—— 拖拽改序,灯锁定

- 点 `调整顺序` 或直接拖 `<DragReorderHandle>`(⠿)→ 进入排序态,时间轴各步可上下拖动。
- **铁律:拖拽只改 `items` 顺序,不改任何步的 `level`/原文**。`<SourceDeptBadge>` 的灯始终锁死灰态,不随拖拽变化。
- 放手后产生新顺序数组 → 走 `reorder` action 回后端,由后端重算主线 `light`(可能因把红步拖后导致受阻提示变化)并回 `assert_mainline_preserves` 校验;**前端不在本地翻转 level,也不本地重算灯**(防软化)。
- 若客户试图把红步拖到绿步之后"假装解决",后端排序仍按严重度兜底,前端展示后端回的真实顺序,不顺从本地拖拽的乐观摆放。

### 5.3 展开源部门原文(`<SourceDocDrawer>`)

- 点某步的 `▸源文` → 滑出 `<SourceDocDrawer>`:渲染该步 `evidence_ref`(源部门 archive_id)指向的**源部门完整 court_doc**(刑部判决书 / 户部奏报),可用缩略版 `<CourtDocCard>` 嵌套。
- 渐进式:**默认全折叠**,客户主动点才展开,保证一屏先给"先做哪件"。
- 这落实"人话在前、部门原文在后":主线给结论,源文藏二级。

### 5.4 确认开工(`confirm_start`)—— 拟旨预览 + 签字

- 点 `确认开工` → 先弹 `<EdictPreview>`:把 `headline` + 排序后的 `items` 拼成拟旨草案(派谁/查什么/要什么格式回奏,接 `draft_edict.refined_edict`),给客户看一眼"我要推的是这个"。
- **不可逆闸**:确认开工推真实会审/任务,属不可逆。`signed=false` 时按钮置灰(§4.5);需客户人工签字 → 后端回 `signed=true` 的新 court_doc → 按钮激活。
- 签字 + 确认后调 `confirm_start` API → 主线推成真实任务(接 `chaotang_orchestrator.assemble_flow` / shangshufang"丞相拟旨→皇上确认→军机处会审"闭环)→ 进 loading(§6)→ 返回执行态。
- 涉及资金/生产/权限/合规的不可逆步,`<EdictPreview>` 内提示"建议先问钦天监",并露出 `escalate_court` / 升钦天监入口。

---

## 6. 空 / 加载 / 错误态

| 态 | 渲染 |
|---|---|
| **空(无主线)** | 卷宗卡空壳 + 相印淡水印 + "尚无主线 —— 把各部门文书交给丞相,压成一条可执行主线"引导 + 部门文书选择/输入入口 |
| **加载(聚合中)** | 卡骨架屏:案号头占位 + 灯位旋转相印 + "丞相正在把六部结论压成一条…"。骨架走宣纸纹底,不用通用 spinner |
| **加载(确认开工/推任务)** | 在现有卡上叠半透层"主线推进中 · 已派 N 步",时间轴各步渐次点亮"已派发",**保留旧主线可读**(别白屏) |
| **错误(后端失败)** | 卡内黄条"丞相暂时无法收口 · 错误码 X",给"重试 / 转人工"两按钮;不静默吞错 |
| **错误(source preserve 校验失败)** | 若后端 `assert_mainline_preserves` 抛错(源灯被软化)→ 前端**绝不渲染该主线**,显式红条"主线一致性校验失败 · 已拦下,需人工核对源部门灯",而非展示一个可能软化的乐观主线 |
| **错误(court_doc 字段缺失)** | 缺关键字段(无 light/headline/items)→ 降级"主线残缺,需人工核对"灰态,绝不猜测渲染成绿 |
| **部分接地** | grounding=none / gate=pending 见 §4.2 / §4.4,作为半态处理,不算错误 |

加载/错误也守"禁假绿"纪律:任何不确定态都偏保守(灰/黄),不渲染成可开工。

---

## 7. 响应式

### 桌面(≥1024px)

- 卷宗卡居中,最大宽约 720px(保持公文纸比例,不铺满)。
- 官印右上、骑缝相印右下角压边;主线时间轴序号 + 源部门灯徽完整呈现在每步左侧。
- `<SourceDocDrawer>` 从右侧滑入,卡不动(side drawer)。

### 平板(768–1023px)

- 卡宽自适应;时间轴保留序号 + 源灯徽;拖拽手柄保留。

### 移动(<768px)

- 单列纵向流;官印缩小移到标题行内右侧。
- 时间轴每步:序号 + 源灯徽在第一行,源部门一句话在第二行小字,`▸源文` 与拖拽手柄收进步右侧。
- `<SourceDocDrawer>` 改**底部上拉抽屉**(bottom sheet),全宽。
- 动作按钮 `<ActionBar>` 固定底部吸附(sticky),`确认开工` 主 action 占满宽,`调整顺序`/`升级会审` 收进"更多"。
- 骑缝相印缩为落款行内小印,不跨边(移动端跨边压印易溢出)。
- 拖拽调序在触屏改为**长按拖动**;灯依旧锁定不可编辑。

所有断点(320/375/768/1024/1440)验证无横向溢出;展开/拖拽动画只用 transform/opacity(合成器友好)。

---

## 8. 与前端仓 chaotang-web-lyt 的对接点

> 边界(接 AGENTS.md):**本仓只产 court_doc(机器面)+ 写本策划文档**;真实 UI 实现、CSS、组件、E2E 全部归 `chaotang-web-lyt`,不在本仓写页面。

### 8.1 API / 构建函数(后端已就绪 / 本仓提供)

| 用途 | 后端入口 | 返回 |
|---|---|---|
| 聚合主线 | `court_doc_builder.assemble_mainline(docs)`(吃多部门 court_doc 列表) | 主线 court_doc(`doc_type=edict`,相印) |
| 一致性校验 | `court_doc_builder.assert_mainline_preserves(original_docs, mainline)` | 无返回;软化源灯则抛 `ValueError`(前端据此走 §6 校验失败态) |
| 拟旨 | `shangshufang_loop.draft_edict(...)` → `refined_edict` | 拟旨草案文本(供 `<EdictPreview>`) |
| 确认开工 | action `confirm_start` → `chaotang_orchestrator.assemble_flow` | 推真实会审 / 任务态 |
| 调序 | action `reorder` → 重排 + 重算 light + 重校验 | 新主线 court_doc(顺序变,灯由后端定) |
| 升级会审 | action `escalate_court`(必要时升钦天监前置参谋) | 新 court_doc(档位↑ / 进会审) |

> 真实 actions 以 `assemble_mainline` 输出为准:`["confirm_start","reorder","escalate_court"]`。前端按钮文案映射:`confirm_start→确认开工`、`reorder→调整顺序`、`escalate_court→升级会审`(不可逆/重大时引导问钦天监)。

### 8.2 组件归属

- **共享卷宗组件库**(`<CourtDocCard>` 等,§3.1):建在 chaotang-web-lyt,11 部门共用,与刑部同一套。
- **丞相特有组件**(`<MainlineTimeline>`/`<SourceDeptBadge>`/`<DragReorderHandle>`/`<SourceDocDrawer>`/`<EdictPreview>`/`<ConfirmStartButton>`/`<BlockedBanner>`,§3.2):放 chaotang-web-lyt 的 `components/prime_minister/` 下。
- **印章/主色配置**:集中在前端仓的 `seal-registry`(部门→stamp SVG + 主色 token),驱动 `<DeptSeal>`。丞相 = `{stamp: "prime", color: "--prime-accent"}`(朱紫)。

### 8.3 契约纪律

- 前端**只渲染 court_doc 已有字段**,不臆造。`assemble_mainline` 当前 `item.title` 为 `"{dept}: {headline}"`、`item.level` = 源部门原灯、`evidence_ref` = 源部门 archive_id;前端从 title 拆出源部门名作徽章,正文取冒号后部分。若后端后续把 owner/route/due/blocker 补进 item(见设计 §4.1 目标形态),前端按字段在到位时渐进渲染,字段缺失走 §6 降级,不在前端硬编码假数据。
- 渲染纪律(禁假绿 / **源灯照搬不改** / 调序不改 level / signed 闸)是**前后端共同契约**,以本文 §4 + frontend_handoff §四 + `assert_mainline_preserves` 为准。
- court_doc schema 变更由本仓发起,前端跟随;前端发现字段不够用(如 item 缺 owner/route/due)回提需求,本仓补薄包装,不在前端硬编码业务判断。

---

prime_minister-ui: 六部各说各话进、一张相旨主线卡出 —— 总灯=最差部门灯不许美化、主线时间轴按序给"先做这一件"、源部门灯徽锁死不可编辑、拖拽只调序不改灯、拟旨预览+签字才一键开工;禁假绿/源灯照搬不改/`assert_mainline_preserves` 守住护身符不被软化。
