# 御史 · 前端 UI 策划(封驳/放行总判 — 黑金·獬豸)

> 面向前端仓 `chaotang-web-lyt`。后端只出 **court_doc(机器面 JSON,`schemas/court_doc.json`,`doc_type=review`/`dept=yushi`)**,
> 本文是把它画成**卷宗×现代**那张脸的渲染策划。基调:玄黑底 + 金线 + 楷体题(獬豸纹官印),古典御史台的肃杀庄重 + 现代黑/红/黄/绿灯卡。
> 上游契约:`docs/dept_design/frontend_handoff.md`(渲染纪律真相源)、`docs/dept_design/yushi.md`(部门设计)、`docs/dept_design/README.md`(印章表)。
> 后端实现台:`harness/yushi_global_gate/`(run_gate.py + rules.yaml + ledger)、`src/yushi_gate.py`、`src/governance.py`、`src/guard_rails.py`、`POST /api/yushi/review`。
>
> **共享骨架原则**:御史复用全院通用卷宗组件(刑部/户部同一套),只换印(獬豸)、换色(黑金)、加御史特有的总闸件。不为御史另写一套卷宗。

---

## ① UI 定位

御史是**全局总闸**,不是又一个挑刺评审。它是上线 / 发布 / 自动执行**之前的最后一道门**:刑部判完法务、户部算完 ROI、工部验完 POC、钦天监定完方向,这些产出谁都不能自己宣布"可以上了",全部汇到御史,由御史**定灯**(绿/黄/红/黑),对外只有一个口径:**这件事现在能不能放行、放行带什么条件、出事查谁。**

前端要把这件事变成客户**敢按下执行键的底气**:

- **一句话上线请求进,一张封驳/放行书出**:"这报价能发客户吗 / 这自动化能开自动执行吗 / 这版本能上线吗" → 单屏出总判卡(灯 + 能不能 + 挡了什么 + 放行条件 + 出事查谁 + 留痕号),四维评分藏二级。
- **黄灯是主产品**,不是失败态。绝大多数真实请求不是非黑即白。御史把模糊地带产品化成**带条件放行**("报价 7 日有效 / 自动执行降为草稿待签 / 上线先灰度 10%")+ 人工签字点。客户拿到的不是"驳回",是"这样改就能走,且已记在案"。
- **一票否决**:任一硬核查 FAIL(数字无来源 / 越权自动执行 / 踩红线 / 证据缺)直接 `block`,不被收益分赎买。前端必须把"否决不可被美化"做进交互。
- **与刑部分工**:御史**定灯**,刑部**深查**。只有**黑灯**才落刑部红蓝对抗深查 —— 前端在黑灯态提供"落刑部"跳转,不在御史卡里画法条。

UI 一句话:**刑部是风险护身符,御史是放行总开关。** 御史这张脸的全部任务,是让"按下放行键"这个动作既有底气、又留痕、又可回链。

---

## ② 主屏 · 封驳/放行卷宗卡(套 court_doc 字段)

ASCII 蓝图(黄灯·带条件放行,对应 `docs/dept_design/yushi.md §4.2`):

```
╔══════════════════════════════════════════════╗
║ 獬豸 御史总判        〔獬豸金印〕案号 YS-20260701-014 ║  ← 玄黑底·金线楷题 + 獬豸金印(seal.stamp/color)
║ ────────────────────────────────────────────  ║
║ 🟡 可放行 · 须带 2 条件                          ║  ← light=yellow 黑金灯卡;headline 放行/驳回人话在前
║ ┌ 御史为你挡了 ─────────────────────────────┐  ║
║ │ 越权自动外发报价 + 1 处无来源数字           │  ║  ← shielded(心意①:先说挡了什么)
║ └───────────────────────────────────────────┘  ║
║ 放行条件 / 致命项 Top3              〔点击展开〕  ║  ← items[] 渐进展开,红项置顶,四维分藏二级
║  1 🔴 自动化越级 L5(外部承诺走自动执行)         ║      level/title
║      高 · 不可逆外发        → 降 L3:草稿+人工确认 ║      odds · impact      → fix
║  2 🟡 报价含未锚定数字 ¥120万                    ║
║      中 · 对外口径风险      → 回链 verified_facts ║
║  3 🟢 ROI 测算证据足 · 刑部法务已绿              ║      → 回链 XB-20260701-009(evidence_ref)
║ ────────────────────────────────────────────  ║
║ 总闸:已盖〔passed〕   出事查:本案号链 YS-014    ║  ← provenance.gate 状态显式 + 回链
║ 参谋:posner · schneier · andy-grove  接地:未接地⚠ ║  ← provenance.advisors + grounding=none 警示
║ 来源:LIVE_SWARM     签字:未签 ✗(放行键待签字)   ║  ← source_label + signed
║ [应用条件] [签字放行] [升级会审] [存证归档]       ║  ← actions[]
║ 留痕已封存 · 史馆 YS-014           〔骑缝金印〕    ║  ← seal.sealed_archive(心意②③:放行也留痕)
╚══════════════════════════════════════════════╝
```

字段映射(全部接真 court_doc,不画饼):

| court_doc 字段 | 卡上渲染 |
|---|---|
| `seal.stamp=獬豸印` / `seal.color=黑金` | 右上獬豸金印 + 玄黑底金线主题 |
| `light` green/yellow/red/black | 灯标 + 整卡边框色(绿放行/黄带条件/红驳回/黑落刑部) |
| `headline` | 一级结论楷体大字,"可放行/须改/驳回"人话在前 |
| `shielded` | "御史为你挡了"高亮心意条,放在结论正下方 |
| `items[]` level/title/odds/impact/fix/evidence_ref | Top 列表,红项置顶,impact 右对齐,fix 折叠二级,evidence_ref 可点回链 |
| `adversarial`(可空) | 黑灯/深查时显"红蓝对抗"小标签(attacker/weakest/why),非黑灯多为 null,不渲染 |
| `provenance.gate` passed/blocked/pending/n/a | **总闸状态条**,显式显示;pending→盖半透"需人工复核"印 |
| `provenance.advisors` | 落款"参谋:posner · schneier · …"(只是供料,不是放行人) |
| `provenance.grounding` rag/deterministic/none | 落款"接地:法条接地/重算接地/**未接地·需人工**",none→灰条警示 |
| `actions[]` | 底部按钮(应用条件/签字放行/升级会审/存证) |
| `source_label` | 来源真实性标签(LIVE/LIVE_SWARM/MIXED/FALLBACK/DEMO) |
| `signed` true/false | false→"未签"水印,签字放行键置灰锁定 |
| `seal.sealed_archive` | 骑缝金印 + 史馆封存号(护身符具象) |

---

## ③ 组件清单

### 3.1 共享卷宗组件(全院通用,御史只配印/色)

| 组件 | 职责 | 御史配置 |
|---|---|---|
| `CourtDocCard` | 吃一份 court_doc → 渲染整张卷宗 | `dept=yushi` |
| `SealStamp` | 右上官印 + 主题色驱动 | 獬豸印 · 黑金 |
| `LightBadge` | 红黄绿黑灯 + 边框色 | 复用,黑金描边 |
| `HeadlineBlock` | 结论楷体大字 | — |
| `ShieldedRibbon` | "为你挡了"心意条 | — |
| `ItemList` | Top 列表渐进展开,红项置顶,fix 折叠二级 | — |
| `ProvenanceFooter` | 参谋 / 接地 / 来源 / 签字落款 | — |
| `ArchiveSeal` | 骑缝印 + 史馆封存号 | — |
| `ActionBar` | actions[] → 按钮,signed=false 时锁不可逆键 | — |

### 3.2 御史特有组件(总闸专属,别处不需要)

| 组件 | 职责 | 接的真字段 |
|---|---|---|
| **`GateVerdictPanel`(四灯总判台)** | 总闸主屏头:绿/黄/红/黑四态一行可视,当前态高亮,旁注 `decision`(allow / allow_with_conditions / block / block_and_escalate) | `light` + `provenance.gate` + run_gate `decision` |
| **`ReleaseGateSwitch`(放行/驳回开关)** | 核心动作件:一个带"签字闸"的放行/驳回开关。`signed=false` 时开关锁死、显"待签字";签字后才允许扳到"放行"。扳动即生成留痕 | `signed` + `actions`(sign_and_release / apply_conditions) |
| **`ConditionChecklist`(放行条件清单)** | 黄灯时把 `conditions[]` / `items[].fix` 列成可勾选清单,全勾齐才解锁签字 | run_gate `conditions[]` + `items[].fix` |
| **`DriftMonitorBar`(漂移监控条)** | 顶部常驻细条,盯部门/蜂群是否漂移(质量分下滑 / 踩 web 主线红线 / 自动化权限越级 / 数字无来源)。漂移到线 → 显"已自动降级该蜂群自动执行权限" | `src/governance.py` 蜂群治理等级(pass_rate / 不可逆错误 → 升降权) |
| **`AutomationLevelGauge`(自动化权限表)** | 显示请求的自动化级 L0–L5,越级标红(如 L5 外部承诺却走自动执行) | rules.yaml `automation_levels` L0–L5 + `automation_level` |
| **`EscalateToXingbuLink`(黑灯→落刑部)** | 仅黑灯出现:一个醒目跳转,"此案高危,已转刑部红蓝对抗深查",带 `next_gate` 目标与案号回链 | `light=black` + run_gate `next_gate` + `red_team_required=true` |
| **`FourAxisDrawer`(四维评分抽屉)** | 二级抽屉:风险等级 × 收益分 × 证据分 × 自动化权限级。**默认折叠**,决策不是评分表 | run_gate `risk_level/benefit_score/evidence_score/automation_level` |

---

## ④ 状态设计

### 4.1 灯态(light → 卡基调 + 决策)

| light | decision(run_gate) | 卡基调 | 主动作 | 流向 |
|---|---|---|---|---|
| 🟢 green | allow | 金边·已放行印 | 直接放行,留痕入史馆 | → 史馆归档 |
| 🟡 yellow | allow_with_conditions | 黄金边·条件清单 | 勾齐条件 + 签字放行 | 带条件通行,留痕 |
| 🔴 red | block | 朱红边·驳回戳 | 驳回返源部门修 | → 源部门返修 |
| ⚫ black | block_and_escalate | 玄黑加重·封杀印 | **禁放行**,落刑部深查 | → 刑部红蓝对抗 |

### 4.2 关键状态规则(接后端宪法,前端必须守)

1. **驳回 → 红**:`light=red` 整卡朱红描边 + "驳回·返修"戳,放行键不可点,只出"返修"动作。
2. **封杀 → black 落刑部**:`light=black` 玄黑加重 + 封杀印,放行键彻底隐藏(非置灰),强制出 `EscalateToXingbuLink`。`red_team_required=true` 时同步显红蓝对抗待办。
3. **放行留痕**:任何 green/黄签字放行,扳动 `ReleaseGateSwitch` 后**立刻**渲染 `ArchiveSeal`(史馆封存号)。无封存号不算放行成功。
4. **gate=pending / grounding=none 绝不渲染成绿/通过**(宪法 C6 禁假 PASS):盖半透"需人工复核"印,放行键锁死,即便 light 想绿也降级显式"需人工"。
5. **signed 决定不可逆动作**:`signed=false` 时,黄/红/黑下的 sign_and_release 一律锁定,只出文书不触发执行。
6. **丞相主线里灯照搬不改**(C8):御史卡若被丞相 edict 引用,前端不得自行"美化"成更乐观的灯。

---

## ⑤ 交互(分级 P0–P3 + 放行/黑灯硬规则)

按 `docs/chaotang_execution_protocol.md` 复杂度分档驱动交互重量:

| 档 | 场景 | 交互 |
|---|---|---|
| **P0** | 低风险产出(green,自动放行) | 单屏卡 + 一键存证,无需展开,无需签字 |
| **P1** | 黄灯带条件 | 展开 `ConditionChecklist`,勾齐 → 签字放行 |
| **P2** | 红灯驳回 | 显驳回理由 + fix,一键"打回源部门",不可放行 |
| **P3** | 黑灯/不可逆/越权 | 强制 `EscalateToXingbuLink` + 升级会审(4 位大神 + 人工签字),`FourAxisDrawer` 默认提示展开 |

硬交互规则:

- **放行必须留痕**:`ReleaseGateSwitch` 扳到"放行"是一个**两步确认 + 签字**动作 —— 先勾条件(若黄),再签字,扳动后写台账并回显封存号。无签字态开关物理锁死。
- **黑灯转刑部不可绕过**:黑灯卡不提供任何"我就要放行"的旁路;唯一前进动作是落刑部深查或升级会审。
- **四维分藏二级**:`FourAxisDrawer` 默认折叠,客户先看"能不能",想看分自己点。
- **驳回有理、放行有据**:每次放行/驳回都关联案号 + 参谋 + 接地标签,一键可回链史馆台账。

---

## ⑥ 空 / 加载 / 错误态

| 态 | 触发 | 渲染 |
|---|---|---|
| **空** | 无待判产出 | "御史台静候 · 暂无待放行产出",獬豸印灰显,DriftMonitorBar 仍常驻显当前漂移基线 |
| **加载** | `POST /api/yushi/review` 进行中 | 卷宗骨架占位 + "御史核验中…(风险×收益×证据×权限四维)",獬豸印呼吸态 |
| **接地缺失** | `grounding=none` | 灰条警示"未接地·需人工",**不报错但禁绿**,盖"需人工复核"半透印 |
| **闸阻塞** | `provenance.gate=blocked` 或 yushi_gate=blocked | 红条"办差受阻:QA fail / 硬核查 FAIL / schema 残",显式入箱不静默吞,列出 FAIL 的 codes |
| **API 错误** | 网络/5xx | "御史台暂不可达,产出未放行(默认不放行)",**失败默认不放行**,提供重试,绝不 fallback 成绿 |
| **来源降级** | `source_label=FALLBACK/DEMO` | 角标"样例/降级数据",提示此判不可作真实放行依据 |

错误态铁律:**任何不确定都默认不放行**。御史宁可挡住等人工,不可在异常时静默放绿。

---

## ⑦ 响应式

- **桌面(≥1024)**:三段式 —— 顶 `DriftMonitorBar` 常驻细条 / 中卷宗卡(结论 + items + 总闸条) / 底 `ActionBar`。`FourAxisDrawer` 右侧抽出。
- **平板(768–1024)**:卷宗卡单列,四灯总判台横排不折,条件清单内联展开。
- **手机(<768)**:结论 + 灯 + shielded 优先首屏;items 折叠成"展开 Top3";`ReleaseGateSwitch` 吸底固定(签字态才亮);四维分进底部抽屉。獬豸金印缩为角标,保留主题黑金。
- 玄黑底 + 金线在小屏保证对比度;灯色不只靠颜色,附图标(🟢🟡🔴⚫)与文字,满足色盲可达性。

---

## ⑧ 对接 chaotang-web-lyt

- **数据入口**:`POST /api/yushi/review`,输入任一部门产出 → 输出 `doc_type=review` court_doc(§② 字段)。前端只消费 JSON,不在 web 仓重算门禁。
- **复用骨架**:御史卡 = 全院 `CourtDocCard` + 獬豸印/黑金主题配置 + 御史特有件(GateVerdictPanel / ReleaseGateSwitch / DriftMonitorBar / EscalateToXingbuLink)。先用刑部判决跑通通用卷宗,再叠御史总闸件。
- **主题令牌**:新增 `--seal-yushi`(獬豸)、`--color-yushi-bg`(玄黑)、`--color-yushi-line`(金)到设计令牌,与刑部朱砂红、户部金同一套 token 体系。
- **回链**:`evidence_ref` / `seal.sealed_archive` / 案号 → 跳史馆台账详情页(史馆卷宗页,墨色·史笔印)。`EscalateToXingbuLink` → 刑部判决页(朱砂红·天平印)。
- **边界纪律**:本仓只产机器面 JSON 契约,黑金獬豸卡的 CSS/组件实现全在 chaotang-web-lyt;后端不替前端"美化"灯,前端不自行软化后端灯(C8)。
- **门禁一致性**:前端渲染必须与 `harness/yushi_global_gate` 的 decision 映射逐字对齐(green→allow / yellow→allow_with_conditions / red→block / black→block_and_escalate),不得在 UI 层另立放行口径。

---

### 收口模板

1. **目标**:为【御史】写详细前端 UI 策划,落 `docs/frontend_ui/yushi.md`。
2. **应提交文件**:`docs/frontend_ui/yushi.md`(本轮唯一新增)。
3. **不应提交文件**:无运行产物/环境漂移改动;`eval/truth_ledger.jsonl`、`src/hubu_cashflow_runway_memorial.py` 为既有未跟踪文件,与本轮无关,不纳入本次提交。
4. **验证命令**:对照真字段核验 —— `schemas/court_doc.json`(字段)、`harness/yushi_global_gate/scripts/run_gate.py`(decision/conditions/next_gate/four-axis)、`rules.yaml`(L0–L5/红线词)、`docs/dept_design/yushi.md`(ASCII 卡蓝图)。未跑测试(纯文档)。
5. **回滚方式**:删除 `docs/frontend_ui/yushi.md` 即可,无其他文件改动。
