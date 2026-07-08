# 钦天监 · 前端 UI 策划(天象策卡)

> 给前端仓 `chaotang-web-lyt`。后端只产 **court_doc(机器面 JSON,`schemas/court_doc.json`,`doc_type=forecast`)** + `decision_guard` 签字闸对象;
> 把它画成**卷宗×现代**那张脸是前端的活。本文是渲染策划,不在后端实现 UI。
> 基调:卷宗×现代融合 —— 古典骨(星盘官印 / 案号 / 楷体)+ 现代肉(红黄绿黑灯 / 卡 / 渐进展开)。
> 配套:共享卷宗组件见 [`docs/dept_design/frontend_handoff.md`](../dept_design/frontend_handoff.md);本部门设计源见 [`docs/dept_design/qintianjian.md`](../dept_design/qintianjian.md);前置参谋机制见 [`docs/qintianjian.md`](../qintianjian.md);印章表见 [`docs/dept_design/README.md`](../dept_design/README.md)。

---

## ① UI 定位:钦天监这张脸要替用户回答什么

钦天监 = **重大 / 不可逆决策的前置参谋闸门**,不是占卜,也不是又一个会议。区别于刑部判"能不能签"(法务红线),钦天监判"**该不该开工**"(方向与不可逆)。

它坐在蜂群入口,大事进蜂群之前先过这一关。UI 的唯一使命是把用户从"重大决策的焦虑"里捞出来 —— 一屏内回答四个问题,且**让用户做选择题而非问答题**:

1. **该不该干** —— `headline` 一行人话(建议开工 / 先别动 / 落刑部)。
2. **值不值 / 不可逆风险在哪** —— `adversarial`(判官席攻击者找"哪个口子会让你一次出局")+ `shielded`(钦天监为你拦下了什么)。
3. **现在到底先定哪 3 个问题** —— `items[]` 在钦天监里不是风险条目,而是**必答问题 / 情景**,最多 3 个"现在必须定",其余沉到"稍后再定"。
4. **怎么验证、谁来签字** —— 每问带验证方式 + 不可逆动作的具名人类签字闸(`signed` + `signoff.status`)。

核心心智:**降的是用户决策负担,不是考用户**。用户不需要一次答完;每个必答问题都先由 2 位大神给可选答案 + 推荐项。

视觉身份:`doc_type=forecast`,官印 = **星盘印**,主色 = **靛蓝**(星象 / 夜空意象),与刑部朱砂红区分。统一卷宗骨架,换印换色驱动 —— 不为钦天监另写一套组件。

---

## ② 主屏:天象策卡(套 court_doc 卷宗骨架)

复用全院共享卷宗卡组件(`<CourtDocCard>`),钦天监只换 `seal=星盘印 / color=靛蓝` + 三个特有插槽(必答问题卡 / 情景推演 / 签字闸)。ASCII 主屏:

```
┌──────────────────────────────────────────────────┐
│ 🔭 钦天监天象策     〔★星盘印〕  案号 QTJ-20260701-003 │  ← 楷体标题 + 靛蓝官印(右上)
│ ────────────────────────────────────────────────  │
│ 🟡 建议开工 —— 但先定 2 件事,否则可能押错主线        │  ← light=yellow,headline 人话一行在前
│ 🛡 钦天监为你拦下了:一次性 all-in 不可逆架构分叉      │  ← shielded 心意条①(靛蓝高亮)
│   (已留可回退口)                                    │
│                                                    │
│ 你不用一次答完,先定这 2 个 ↓                         │  ← 降负担文案(必答 ≤3)
│ ┌────────────────────────────────────────────┐    │
│ │ 1 🔴 现在必须定:验证闭环是什么?              │    │  ← 必答问题卡(red 置顶)
│ │     押错可能性 高 · 押错=3 个月白做           │    │     odds / impact 右对齐
│ │     ▶ 推荐 A:先 dry-run + 10 个真实样本再扩量 │    │     fix=推荐选项
│ │       塔勒布:留回退口,下行无限平均收益没意义  │    │     2 位大神可选答案
│ │       毛:集中兵力先打主线,别铺摊子          │    │
│ │     ✓ 怎么验证:跑 dry-run 看 10 样本通过率     │    │     验证方式(必含)
│ └────────────────────────────────────────────┘    │
│ ┌────────────────────────────────────────────┐    │
│ │ 2 🟡 现在必须定:是否接受不可逆采购?          │    │
│ │     押错可能性 中 · ¥批量                     │    │
│ │     ▶ 推荐 B:小批试产 → 签字后再放量          │    │
│ │       芒格:反过来想,先问怎样必然搞砸         │    │
│ └────────────────────────────────────────────┘    │
│   〔稍后再定〕多蜂群治理粒度 — 开工后边做边收口 ▸    │  ← level=green 折叠沉底
│ ────────────────────────────────────────────────  │
│ 红蓝对抗 ⚔ 攻击者 塔勒布:最弱口 = all-in 无回退口   │  ← adversarial 小标签
│ 落款:LIVE_SWARM · 大神 塔勒布/芒格/卡尼曼/毛        │  ← source_label + advisors
│ 接地:⚠ 未接地·需人工(grounding=none)             │  ← provenance.grounding 警示
│ ────────────────────────────────────────────────  │
│ [① 选定方案]  [② 生成简报]  [③ 请人签字 🔒]         │  ← actions(签字动作锁态)
│ ⚠ 不可逆:需具名人类签字才开工(下游蜂群已锁)        │  ← 签字闸心意条②
│ 简报待封存 · 史馆 QTJ-003  〔⊙骑缝星盘印〕           │  ← seal 心意条③(护身符)
└──────────────────────────────────────────────────┘
```

**字段 → 视觉映射(对齐 court_doc + decision_guard,务实接真字段):**

| 来源字段 | 渲染成 |
|---|---|
| `seal.stamp=星盘印` / `seal.color=靛蓝` | 右上官印 + 全卡主色调(夜空靛蓝) |
| `light`(green/yellow/red/black) | 顶部灯 + 卡边框色;black→落刑部样式 |
| `headline` | 一级结论(楷体大字,该不该开工人话在前) |
| `shielded` | "钦天监为你拦下了"心意条(靛蓝高亮) |
| `items[]`(level/title/odds/impact/fix/evidence_ref) | **必答问题卡**:title=问题,fix=推荐选项,odds/impact 右对齐;`level=green` 的"稍后再定"折叠沉底 |
| `adversarial`(attacker/weakest/why) | "红蓝对抗"小标签(判官席攻谁、最弱口) |
| `provenance.advisors[]` | 落款大神署名(判官席 + 顾问席) |
| `provenance.grounding`(rag/deterministic/none) | 接地标:法条接地 / 重算接地 / **未接地·需人工**(none→灰条警示) |
| `provenance.gate=pending` | 整卡盖"需人工复核"半透印,禁绿 |
| `source_label` | 落款来源真实性标签(LIVE_SWARM / FALLBACK 等) |
| `signed` + `signoff.status` | 签字闸:`PENDING_HUMAN_SIGNOFF`→"未签字"水印 + 不可逆动作禁点 |
| `seal.sealed_archive` | 骑缝星盘朱印 + 史馆封存号(护身符具象) |

---

## ③ 组件清单

### A. 共享卷宗组件(复用全院,钦天监换印换色即可)

| 组件 | 职责 | 钦天监配置 |
|---|---|---|
| `<CourtDocCard>` | 卷宗卡外壳:案号 / 灯 / headline / 落款 / actions 槽 | `doc_type=forecast`,印=星盘印,主色=靛蓝 |
| `<OfficialSeal>` | 右上官印 + 骑缝封存印 | `stamp=星盘印`,夜空靛蓝描边 |
| `<LightBadge>` | 红黄绿黑灯徽 + 卡边框联动 | 四色;black 触发落刑部样式 |
| `<ShieldedBanner>` | "本部门为你挡了/争取了"心意条 | 吃 `shielded`,靛蓝高亮 |
| `<ProvenanceFooter>` | 落款:大神署名 + 接地标 + source_label | 吃 `provenance` + `source_label` |
| `<ActionBar>` | 底部动作按钮组 | 吃 `actions[]`,签字动作走锁态 |
| `<AdversarialTag>` | 红蓝对抗小标签 | 吃 `adversarial` |

### B. 钦天监特有组件(本部门定制)

1. **`<ForecastQuestionCard>` 必答问题卡**(最多渲染 3 张,`level=red/yellow` 优先,红置顶)
   - 输入:单个 `item`(`title`/`odds`/`impact`/`fix`/`evidence_ref`)+ 该问绑定的 2 位大神可选答案。
   - 结构:问题标题(灯色徽)→ 押错可能性(`odds`)+ 代价(`impact`,右对齐)→ **推荐选项条**(`fix`,带 ▶ 推荐标)→ 2 位大神视角(各一行,署名 + 一句)→ 验证方式(✓,必含,来自 flow `output_fields` 的"可选行动与推荐顺序")。
   - 交互:选项可单选(命中 `choose_option` action),选中态高亮;大神视角默认展开一句,长推演点"展开"进二级。

2. **`<LaterDecisionList>` 情景推演 / 稍后再定**
   - 输入:`level=green` 的 items + 多情景推演(乐观/基准/悲观,来自 flow `output_fields`「多情景预测+概率区间」)。
   - 默认折叠(▸),点开展开长推演(传导路径 + 时间维度)。一屏先给结论,推演藏二级。

3. **`<SignoffGate>` 签字闸**(钦天监的灵魂组件,接 `decision_guard`)
   - 输入:`signed` + `decision_guard` 对象的 `signoff.status`(`PENDING_HUMAN_SIGNOFF` / `APPROVED` / `ABSTAIN_INSUFFICIENT_EVIDENCE`)、`decision_type`、`signer`、`evidence.n_real_samples`/`min_required`。
   - 三态:
     - `PENDING_HUMAN_SIGNOFF` → "请人签字 🔒"按钮可点(弹具名签字框,signer 必填非空);整卡"未签字"水印;下游执行类动作禁点。
     - `APPROVED` → 显示签字人 + 签字时间,执行动作解锁。
     - `ABSTAIN_INSUFFICIENT_EVIDENCE` → 红条警示"证据不足已弃权"(展示 `abstain_reason` + `n_real_samples`/`min_required`),禁止签字、禁止执行,引导补真实样本。
   - 签字弹窗:必须输入具名责任人(对应 `sign(signer=...)` 非空校验);提交后 `POST /api/forecast/sign`(或前端约定的签字端点)。

---

## ④ 状态规则(灯 + 闸 + 接地)

### 灯(`light`)

| 灯 | 含义 | 卡样式 |
|---|---|---|
| green | 可开工 | 靛蓝正常卡,actions 全亮 |
| yellow | 须先定关键问题 | 黄边框,必答问题卡高亮,签字/选定后才放行 |
| red | 先别动 | 红边框,顶部告警条,执行类动作默认禁 |
| black | 落刑部深查 | 黑边框 + "已移交刑部"提示,本卡只读不可执行 |

### 不可逆 → 黑闸需签字(`decision_guard`)

- 命中 `IRREVERSIBLE_FLOWS`(quotation / sourcing / storage_aftercare / battery_stage_gate / pack_rd / finance / legal / appointment 等)或 `light` 非绿 → `signed=false` 时:
  - 卡渲染 **black 签字闸态**:整卡"⚠ 不可逆 · 需具名人类签字"黑条 + 执行动作锁(`🔒`)。
  - 顶部展示 `ADVISORY_HEADER`(AI 建议非最终决定,后果由签字人负责)。

### `needs_signoff` / `gate=pending` 水印

- `provenance.gate=pending` 或 `signed=false` 且不可逆 → 整卡盖**半透"需人工复核 / 未签字"水印**(靛蓝 8% 透明),禁渲染成绿灯。
- `grounding=none` → 落款灰条"未接地·需人工",不得当权威结论。

### 渲染纪律(接后端宪法,必须守)

1. `gate=pending` / `grounding=none` → **绝不渲染成绿灯/通过**,要显式"需人工"。
2. `signed=false` 的不可逆动作按钮置灰锁定,仅 `signoff.status=APPROVED` 才可点。
3. 丞相主线(`doc_type=edict`)里钦天监灯**照搬不改**,前端不得自行美化成更乐观。
4. 长推演 / 大神细节默认折叠(二级),一屏先给结论 —— 决策不是知识。

---

## ⑤ 交互(P0–P3 复杂度分档 + 问题作答 + 签字确认)

按管线复杂度分档渲染密度(对齐仓内 P0–P3 分档):

| 档 | 场景 | 主屏渲染 |
|---|---|---|
| P0 | 琐碎 / 可逆小事 | 钦天监不出场,或仅 `headline` + green 灯一行(不展开问题卡) |
| P1 | 一般决策 | headline + 1 个必答问题卡 + 灯,无签字闸 |
| P2 | 重大但可逆 | 完整卡:≤3 必答问题卡 + adversarial + 情景推演折叠 |
| P3 | 不可逆 / 上线 / 客户承诺 | 完整卡 + **签字闸强制** + ADVISORY_HEADER + 触发器展示 |

**问题作答流(状态机 `OBSERVING → AWAITING_CHOICE → SEALED_BRIEF → EXECUTING → REVIEWING`):**

1. `OBSERVING` —— 加载中,卡显"观天象中…"骨架(见 ⑥)。
2. `AWAITING_CHOICE` —— 问题卡可作答:用户在每张 `<ForecastQuestionCard>` 选推荐项或改方向 → 触发 `choose_option`,选中态高亮 + 本地缓存选择。
3. 选满必答项后 [② 生成简报] 可点 → `SEALED_BRIEF`,卡顶出现骑缝印 + 史馆封存号。
4. **签字确认**:不可逆 → [③ 请人签字 🔒] 弹具名签字框 → 提交 `sign(signer)` → `signoff.status=APPROVED` → 执行动作解锁 → `EXECUTING`。
5. `REVIEWING` —— 史馆归档真实结果后,卡底展示 `qintianjian_trigger`(signal / threshold / watch_window / decision_change),提示"什么信号会推翻今天的判断"。

**触发器展示**:卡底"⏲ 触发器"小条,渲染 `qintianjian_trigger` 四字段,告诉用户参谋不是一锤子,是带回路的。

---

## ⑥ 空 / 加载 / 错误态

| 态 | 触发 | 渲染 |
|---|---|---|
| 加载(OBSERVING) | 提交问题后等蜂群 | 卷宗骨架屏 + "🔭 观天象中…正在请大神给可选答案" + 靛蓝呼吸动效 |
| 空(无必答问题) | `items[]` 全为 green / 空 | "此事无需前置参谋,可直接开工"绿条 + 仅 headline,不画问题卡 |
| 弃权(ABSTAIN) | `signoff.status=ABSTAIN_INSUFFICIENT_EVIDENCE` | 红条"证据不足已弃权",展示 `abstain_reason` + `n_real_samples/min_required`,引导补真实样本,禁签字 |
| FALLBACK 来源 | `source_label=FALLBACK/DEMO` | 落款灰标"⚠ 兜底输出·非实跑,仅供参考",禁渲染成绿灯 |
| 错误(蜂群失败) | API 5xx / 超时 | "天象未明,参谋暂不可用"+ 重试按钮;不伪造结论 |
| gate=blocked | `provenance.gate=blocked` | "御史已封驳"黑条,本卡只读 |

---

## ⑦ 响应式

- **桌面(≥1024)**:天象策卡居中,最大宽 720px;问题卡纵向堆叠,odds/impact 右对齐,大神视角并排两栏。
- **平板(768–1024)**:卡满宽 padding;大神视角改纵向单栏。
- **移动(<768)**:
  - headline / shielded 全宽,字号下调但保持楷体标题。
  - 问题卡纵向,`odds/impact` 移到标题下方一行(不再右对齐)。
  - 大神视角默认折叠为"2 位大神怎么看 ▸",点开展开。
  - 签字闸固定底部 sticky 条,避免长卡滚动错过签字动作。
  - 骑缝印缩为角标。
- 灯色 / 接地警示 / 签字水印在所有断点都不得被裁剪或弱化(护栏不可因屏小消失)。

---

## ⑧ 对接 chaotang-web-lyt

- **数据端点**:`POST /api/forecast/brief` 取天象策 court_doc;签字走约定的 `sign` 端点(提交 `case_id` + `signer`)。前端只渲染,不在本仓做。
- **组件落位**:复用前端仓全院 `<CourtDocCard>` 骨架 + 印章/主色配置(`stamp=星盘印` / `color=靛蓝`),新增本文 ③-B 三个特有组件(`<ForecastQuestionCard>` / `<LaterDecisionList>` / `<SignoffGate>`)。
- **建议交付顺序**:先用刑部判决跑通通用卷宗组件 → 配钦天监星盘印/靛蓝 → 接 `<SignoffGate>`(钦天监最关键差异)→ 接 `/api/forecast/brief`。
- **验证边界**:本仓 dry-run / schema 校验**不替代**前端真实浏览器验证;页面/样式/E2E 在 chaotang-web-lyt 完成。
- **不混提交**:Web 渲染改动不进本仓蜂群/flow 提交。

---

> 真字段清单(供前端对照,均来自本仓现有代码,非画饼):
> court_doc — `schemas/court_doc.json`;签字闸 — `src/decision_guard.py`(`signoff.status`/`signer`/`decision_type`/`evidence.n_real_samples`);触发器 — `src/chaotang_department_payload.py:build_qintianjian_trigger`(signal/threshold/watch_window/decision_change);印章 — `src/court_doc_builder.py`(`qintianjian → 星盘印 / 靛蓝`);flow 输出字段 — `config/flow_tianjian.yaml`(多情景预测 / 不可逆签字点)。
</content>
</invoke>
