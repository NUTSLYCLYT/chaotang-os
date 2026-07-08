# 钦天监 · 天才设计与文书标准

> **现状（2026-07-04 补标）：设计定稿，实现冻结。** 本文是完整的产品设计（判官席/顾问席/文书schema/
> 落地计划），但截至今天 `POST /api/forecast/brief` 不存在，`flow_forecast` 未建，全仓没有任何生产代码
> 调用本文设计的能力——冻结是公司自己的策略决定（见 `docs/GO_TO_MARKET.md` 冷冻区："钦天监...仅设计+
> dept_doc桥,保留不推进"），先把刑部单垂直的第一个客户跑通，不是遗漏。**读这份文档时按0%实现对待**，
> 不要被"定稿"字样和详细的JSON样例误导成已经在跑。本文说的是朝堂产品里客户可见的钦天监功能，跟
> [`docs/qintianjian.md`](../qintianjian.md)（Claude/Codex 自己对话时用的前置参谋协议，那个是真在用的）
> 是两件不同的事，不要混淆。
>
> 定稿 2026-07-01。本文沿用刑部已定的**全院文书标准**(见 `xingbu.md`),套同一 `schemas/court_doc.json` 契约。
> 视觉基调:**卷宗×现代融合** —— 古典骨(官印/案号/楷体)+ 现代肉(灯/卡/渐进展开)。
> 边界:本仓做**机器面(JSON 契约 + 后端参谋闸门)**;**人类面(天象策渲染/CSS/组件)在前端仓 chaotang-web-lyt 实现**。
> 产品化对象:已有的"钦天监前置参谋"机制(`docs/qintianjian.md`),本文把它从聊天约定升级成可交付的部门能力。

## 一、钦天监定位

钦天监 = 客户的**重大决策护栏**,不是占卜,也不是又一个会议。卖的是"敢动手前的底气":
**这事该不该干、值不值、不可逆风险在哪、现在到底先定哪 3 个问题。**

协议里钦天监的职责(`departments.yaml`)就四件:**重大方向、主线价值、是否开工、是否需要红线**。它坐在蜂群入口当**参谋闸门** —— 大事进蜂群之前先过这一关,而不是会后点评。
区别于刑部:刑部判"能不能签"(法务红线),钦天监判"该不该开工"(方向与不可逆)。两者都黑灯落刑部、黄灯进御史。

## 二、五个震撼点

1. **一句话进,一张天象策出**:大白话进 → 单屏天象策(灯+该不该开工一行+最多 3 个必答问题+大神可选答案+人类签字点),长篇推演藏二级。
2. **最多先问 3 个"现在必须定"的问题**:把"重大决策"拆成"现在必须定的 ≤3 问"+"稍后再定",每问标注"为什么现在必须定"。降的是用户决策负担,不是考用户。
3. **答不上来?大神先给可选答案**:每个必答问题由 2 位相关大神先给 2-3 个带推荐项的选项,标注"选 A 会改变什么后续动作"。用户是选择题,不是问答题。
4. **观天象→定吉凶→给选项→人工签字(不可逆闸门)**:对烧钱/上线/客户承诺/架构分叉,钦天监只出"建议(ADVISORY)",必须接 `decision_guard` 具名人类签字才放行。未签字,下游蜂群不得开工。
5. **触发器盯"什么信号会推翻今天的判断"**:每条结论附 `qintianjian_trigger`(signal+threshold+watch_window+decision_change)。史馆归档真实结果后,触发器能改变下一轮建议——参谋不是一锤子,是带回路的。

## 三、参谋团(strategy_forecast profile,带分席)

复用大神体系,绑定 `config/advisor_protocols.yaml` 的 `strategy_forecast`:
`taleb-perspective / kahneman / jensen-huang / peter-thiel / munger-perspective / soros-perspective / mao`。

- **判官席(下吉凶裁定)**:`taleb-perspective`(肥尾/ruin 底线:有没有一次就出局的下行)+ `munger-perspective`(反过来想:怎样必然搞砸,先避蠢)。这两位定灯,因为钦天监的核心是"不可逆下行"而非"平均收益"。
- **顾问席(给视角与可选答案)**:
  - `kahneman` —— 认知偏差:这判断是不是过度自信/锚定/叙事谬误。
  - `jensen-huang` —— 技术拐点/算力曲线:方向是不是站在拐点对的一侧。
  - `peter-thiel` —— 逆向/垄断:这事是不是别人都不信但对的(0→1)。
  - `soros-perspective` —— 反身性:市场/客户预期会不会自我强化或反噬。
  - `mao` —— 矛盾论/集中兵力:主线是什么,先打哪个,什么阶段做什么。
- **规则**:判官席至少 2 席形成张力(`top_advisor_design.required_lenses` 要求 ≥2 lens);涉及客户/资金/生产/权限/合规,大神建议不替代证据,仍接 `decision_guard` 人类签字。每问的"可选答案"必须来自 2 位顾问,标注推荐项。

## 四、文书:钦天监天象策(套 court_doc 契约)

`doc_type = forecast`,官印 = **星盘印**,主色 = **靛蓝**(与刑部印章品牌系统同一骨架,身份各异)。

### 4.1 机器面 —— JSON 契约

```json
{
  "doc_type": "forecast",
  "dept": "qintianjian",
  "case_id": "QTJ-20260701-003",
  "light": "yellow",
  "headline": "建议开工 —— 但先定 2 件事,否则可能押错主线",
  "shielded": "为你拦下了:一次性 all-in 不可逆架构分叉(留出可回退口)",
  "items": [
    {"level":"red","title":"现在必须定:验证闭环是什么","odds":"高","impact":"押错=3个月白做","fix":"选 A:先用 dry-run + 10 个真实样本验证再扩量","evidence_ref":"truth://qtj/loop"},
    {"level":"yellow","title":"现在必须定:是否接受不可逆采购","odds":"中","impact":"¥批量","fix":"选 B:小批试产签字后再放量","evidence_ref":null},
    {"level":"green","title":"稍后再定:多蜂群治理粒度","odds":"低","impact":"可后置","fix":"开工后边做边收口","evidence_ref":null}
  ],
  "adversarial": {"attacker":"taleb-perspective","weakest":"all-in 不可逆,无回退口","why":"下行无限,平均收益对 ruin 无意义"},
  "actions": ["choose_option","seal_brief","escalate_signoff","archive_brief"],
  "provenance": {
    "advisors": ["taleb-perspective","munger-perspective","kahneman","mao"],
    "archive_id": "QTJ-...003",
    "gate": "pending",
    "rag_grounded": false
  },
  "source_label": "LIVE_SWARM",
  "signed": false,
  "seal": {"stamp":"星盘印","color":"靛蓝","sealed_archive":null}
}
```

字段映射(对齐 court_doc):
- `light` —— 总裁定:绿可开工 / 黄须先定关键问题 / 红先别动 / 黑落刑部。
- `headline` —— **该不该开工**,人话一行在前。
- `items` —— 不是风险条目,而是**必答问题 / 情景**:`title`=问题或情景,`fix`=推荐选项(选 A 会怎样),`odds/impact`=押错的可能性与代价。"稍后再定"用 `level: green` 沉到末位。
- `adversarial` —— 判官席攻击者视角找"哪个口子会让你一次出局"。
- `signed` + `provenance.gate` —— 不可逆动作的人类签字闸,`pending` 时下游不得开工。

### 4.2 人类面 —— 天象策卡(ASCII 样例)

```
┌───────────────────────────────────┐
│ 🔭 钦天监天象策   〔星盘印〕案号QTJ-003 │   ← 楷体标题 + 靛蓝官印
│ ───────────────────────────────── │
│ 🟡 建议开工 · 先定2件事             │   ← 靛蓝/黄灯,该不该开工一行在前
│ 钦天监为你拦下:一次性 all-in 不可逆 │   ← 心意①
│                                     │
│ 你不用一次答完,先定这 2 个 →       │   ← 降负担:必答 ≤3
│  1🔴 验证闭环是什么?  押错=白做3月  │
│      推荐A 先dry-run+10样本再扩量   │
│      塔勒布:留回退口 | 毛:先打主线 │   ← 2位大神给可选答案
│  2🟡 接受不可逆采购吗? ¥批量        │
│      推荐B 小批试产签字后放量        │
│  〔稍后再定〕多蜂群治理粒度          │   ← 渐进展开,长推演藏二级
│ ───────────────────────────────── │
│ [选定方案] [生成简报] [请人签字]    │
│ ⚠ 不可逆:需具名人类签字才开工       │   ← 心意②:护栏具象
│ 简报待封存 · 史馆QTJ-003 〔骑缝印〕  │   ← 心意③
└───────────────────────────────────┘
```

**艺术方向**:楷体标题 + 靛蓝主色(星象/夜空意象)+ 宣纸微纹 + 现代无衬线正文 + 红黄绿灯卡。庄重而可读,与刑部朱砂红区分身份。

## 五、心意三触点

1. 开头"**钦天监为你拦下了什么**"(把"避免的下行"说出来,这是钦天监最大价值)。
2. 不可逆动作显式"**需具名人类签字才开工**"+ 落款骑缝星盘印(护栏具象,不是软提示)。
3. 结论永远**人话在前、推演在后**;**问题 ≤3 + 大神给选项**,让用户做选择题而非问答题(决策不是考试)。

## 六、落地

- **后端 MVP(本仓)**:把 `docs/qintianjian.md` 的前置参谋机制落成 `flow_forecast`,输出契约改为 §4.1 天象策 JSON;`POST /api/forecast/brief`。
  - 参谋闸门状态机沿用 `docs/qintianjian.md`:`OBSERVING → AWAITING_CHOICE → SEALED_BRIEF → EXECUTING → REVIEWING`。
  - 大神入审走 `strategy_forecast` profile;判官席 taleb+munger 定灯,顾问席给每问的可选答案。
  - **不可逆闸**:`light` 非绿或命中 `decision_guard.IRREVERSIBLE_FLOWS` 时,`signed=false` → 包 `wrap_advisory`,`assert_executable` 在下游开工前拦截,必须 `sign(signer=具名人类)` 才放行。
  - 接 `truth_ledger` 存简报 + `qintianjian_trigger`;史馆归档真实结果后回灌,改下一轮建议。golden 简报过 `persona_eval` 才升判官,同一套飞轮。
- **文书 schema(本仓)**:复用 `schemas/court_doc.json`,`doc_type=forecast` 已在 enum 内,无需改契约。
- **人类面渲染(前端仓)**:天象策卡 + 星盘印/靛蓝 → chaotang-web-lyt,不在本仓做。本仓 dry-run 不替代前端真实浏览器验证。
