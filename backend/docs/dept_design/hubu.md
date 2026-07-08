# 户部 · 天才设计(对齐刑部 / 全院文书标准)

> 定稿 2026-07-01。第二份部门设计,复用刑部已定的**全院文书标准**(`schemas/court_doc.json`)。
> 户部 doc_type = `memorial`(奏报),官印 = **算盘印**,主色 = **金**。
> 边界:本仓做**机器面(JSON 契约 + 后端)**;**人类面(卷宗渲染/CSS/组件)在前端仓 chaotang-web-lyt 实现**。

## 一、户部定位

户部 = 客户的**钱袋子底气**,不是财务报销窗口。卖的是四句话能不能拍胸脯回答:

1. **这单赚不赚钱**——毛利多少、ROI 几成、收益证据成不成立。
2. **报价靠不靠谱**——报的价是怎么反推出来的、假设变了价怎么动、哪几项必须人签字。
3. **现金流安不安全**——付得出、收得回、撑不撑得过缺口期。
4. **最大亏损是多少**——最坏情况赔多少、先告诉你再让你签,不是出事才知道。

(协议定义:钱/预算/ROI/报价/成本/收益真实性;`finance`/`quotation` 蜂群 level=irreversible;红线"无来源数字、无签字报价、虚假 ROI 一律 red";流向 green→军机、yellow/red→御史、black→刑部。)

## 二、五个震撼点

1. **一句话进,一张奏报出**:大白话进 → 单屏奏报(灯 + 这单赚不赚钱一行 + 毛利/现金流/最大亏损三柱 + 一句话改法),明细藏二级。接现有 `src/hubu_memorial.py`(recommendation / risk_level / missing_evidence / metrics)+ `src/hubu_payment_preview.py`,后者**显式 `previewOnly / executionAllowed=false / sideEffects=none`**——奏报只是裁决预览,绝不等于真付款。

2. **每个数字都按住来源**:奏报里每个硬数字带可信度章——「营收 152.8 万[一手·财报]」「净利率 45%[待核·无源]」。已有 `src/confidence_tag.py`(一手/二手/推算/待核四档)直接打章;且 `src/finance_facts.py` 的 `verified_facts` 是 **LLM 唯一被允许引用的数字来源**,缺来源即 `hard_fail`。**没来源的数字,户部当它不存在。**

3. **报价做成"假设 + 敏感性 + 需签字",不是一口价**:从客户长期不变需求和真实成本**反推**报价(graham/drucker 视角),输出报价区间 + 关键假设 + 假设变动后的价格敏感性 + 必须人工签字项。已有 `config/flow_quotation.yaml`、`src/prompts_quotation.py`——红线:**无依据数字、单点报价、交期承诺一律 blocked**。客户拿到的不是一个数,是一张"价格为什么是这样、什么情况下会变"的明白账。

4. **现金流安全闸 + 最大亏损前置**:签字前先过两道硬闸——`src/hubu_treasury.py` 的可用资金闸(`可用资金 < 付款金额` 直接报资金缺口),`src/hubu_financing_gate.py` 的偿债能力闸(DSCR:经营现金流够不够覆盖新增 + 存量债务)。再把"最坏情况赔多少"算在前面给客户看(taleb 肥尾视角),把"出事才知道"变成"签字前已知悉"。

5. **三柱就绪度记分卡 + 成交结果回填飞轮**:`src/hubu_three_pillar_scorecard.py` 给"供应链/财务/投资"三柱打就绪分,`ready` 才允许存档;成交/流失结果回填后,更新报价基线和商业 golden cases——下一单报得更准。这是户部版的"用真实结果修正自己",不是一次性算完拉倒。

## 三、户部钱袋议事(财务大神,带证据门)

复用大神体系(分席/RAG/eval),建一个**财务分支**(取自 `config/advisor_protocols.yaml` 的 `finance` profile:ben-graham / drucker / taleb-perspective / deming / dalio-perspective / howard-marks-perspective / duan-yongping)。

- **判官席(坐堂裁定,卡门)**:
  - **ben-graham**——安全边际与价值底线:这价有没有兜底,跌到哪还不亏本金。
  - **deming**——数据真实性与系统:数字过不过恒等式/比率/账龄校验(已有 `src/finance_validators.py`),用系统而非拍脑袋下结论。
  这两位负责"能不能下结论":数字没回链 `verified_facts`、过不了校验,就不准出绿灯。

- **顾问席(给视角,不卡门)**:
  - **drucker**——报价从"客户要的成果"反推,而不是从我方成本加价。
  - **taleb-perspective**——最大亏损/肥尾:别盯期望值,先问最坏情况赔得起赔不起。
  - **dalio-perspective**——把客户当一台现金流机器看,债务周期到哪一段。
  - **howard-marks-perspective**——风险定价与赔率:现在在周期哪个位置,这个价是贵是便宜。
  - **duan-yongping**——本分与长期:不赚不懂的钱,不为成单牺牲长期信任。

- **财务安全铁律**:观点席发言可带视角,**判官席结论一律 RAG 强制回链 `verified_facts`**(`gate_conclusion` / finance swarm 的 `hard_fail`)——命不中真实数字只准提示"需人工财务核",不准编造。**幻觉财务比没财务更危险。** 每位配 golden cases,过 `persona_eval` 才升判官,同一套飞轮。

## 四、户部奏报(算盘印 · 金)

**一份内容,两副面孔**(标准见 `schemas/court_doc.json`,全院共用)。

### 4.1 机器面 —— JSON 契约(套 court_doc)

```json
{
  "doc_type": "memorial",
  "dept": "hubu",
  "case_id": "HB-20260701-014",
  "light": "yellow",
  "headline": "可接 —— 这单毛利 23%,但要先收 40% 预付,否则现金流撑不过 Q3",
  "shielded": "户部为你挡了:一笔会让账上现金转负 47 天的付款节奏",
  "items": [
    {"level":"red","title":"现金流缺口","odds":"高","impact":"-¥47万·缺口47天","fix":"合同改'40%预付+30%到货'","evidence_ref":"truth://treasury/HB-014"},
    {"level":"yellow","title":"毛利依赖电芯报价[待核·无源]","odds":"中","impact":"毛利23%→可能跌到11%","fix":"补一手供应商报价单再锁价","evidence_ref":"truth://quotation/HB-014"},
    {"level":"green","title":"偿债能力 DSCR=1.8 达标","odds":"低","impact":"经营现金流可覆盖新增债务","fix":null,"evidence_ref":"truth://financing/HB-014"}
  ],
  "actions": ["adjust_payment_terms","lock_quote_with_evidence","sign_off","archive_preview"],
  "provenance": {
    "advisors": ["ben-graham","deming","taleb-perspective"],
    "archive_id": "HB-20260701-014",
    "gate": "pending",
    "rag_grounded": true
  },
  "source_label": "MIXED",
  "signed": false,
  "seal": {"stamp":"算盘印","color":"金","sealed_archive":null}
}
```

机器面喂飞轮/归档/门禁:`items` 按赔率(odds)× 影响(impact)排序,每条带 `evidence_ref` 回链 `truth_ledger`;`rag_grounded` 标判官席结论是否经 `verified_facts` 命中;`signed=false` 时不可逆动作(真付款/对外报价)一律不执行。

### 4.2 人类面 —— 卷宗×现代渲染(前端仓做)

同一 JSON 渲染成有仪式感的奏报卡(基调=卷宗×现代,与刑部判决卡同一系统):

```
┌───────────────────────────────────┐
│ 🧮 户部奏报      〔金·算盘印〕案号HB-014 │  ← 楷体标题 + 金色算盘官印
│ ───────────────────────────────── │
│ 🟡 可接·须先调付款节奏               │  ← 红黄绿灯,赚不赚钱一行在前
│ 毛利23%  现金流🔴缺口47天  最坏-¥47万 │  ← 三柱:赚多少/现金流/最大亏损
│ 户部为你挡了:会让账上转负47天的付款 │  ← 心意①
│ 致命账目 Top3            〔点击展开〕 │  ← 渐进展开,科目明细藏二级
│  1🔴 现金流缺口 高×-¥47万 →改预付40% │
│  2🟡 毛利依赖电芯报价[待核] →补一手单 │
│ ───────────────────────────────── │
│ 每个数字带来源章:152.8万[一手·财报] │  ← 心意③:反幻觉可视化
│ [调付款节奏] [带证据锁价] [签字] [存草稿]│
│ 预览·未执行付款 · 史馆HB-014 〔骑缝金印〕│  ← 心意②:previewOnly 具象化
└───────────────────────────────────┘
```

**艺术方向**:楷体/宋体标题 + 金色主色 + 算盘纹理 + 现代无衬线正文 + 红黄绿灯三柱卡。富贵不俗,数字可读。

### 4.3 印章品牌系统(沿用刑部已建表)

| 部门 | 文书类型 | 官印 | 主色 |
|---|---|---|---|
| 刑部 | 判决书 | 天平印 | 朱砂红 |
| **户部** | **奏报** | **算盘印** | **金** |
| 礼部 | 策案 | 礼器印 | 青 |
| 钦天监 | 天象策 | 星盘印 | 靛蓝 |
| 史馆 | 卷宗 | 史笔印 | 墨 |

## 五、心意三触点

1. 开头"**户部为你挡了什么**"(把省下/守住的钱说出来,如"挡了会让账上转负 47 天的付款节奏")。
2. 落款"**预览·未执行付款**"骑缝金印 + 史馆封存号(`previewOnly` 具象化:奏报永远是裁决草稿,不是真扣款)。
3. 结论永远**人话在前、科目在后**,且每个硬数字带来源章(决策不是台账;没来源的数字不上桌)。

## 六、落地

- **后端 MVP(本仓,接现有资产)**:
  - 奏报契约 → 复用 `src/hubu_memorial.py` + `src/hubu_payment_preview.py`,输出对齐 §4.1 的 court_doc `memorial` 形状(补 `light` 映射 recommendation、`items` 来自 gates、`seal=算盘印/金`)。
  - 数字门 → `src/finance_facts.py`(`verified_facts` 唯一来源)+ `src/finance_validators.py`(恒等式/比率/账龄)+ `src/confidence_tag.py`(每数字打章);缺源 `hard_fail`。
  - 现金流/偿债 → `src/hubu_treasury.py`(可用资金闸)+ `src/hubu_financing_gate.py`(DSCR)。
  - 🟡 **另一条现金流引擎(2026-07-03 补):`src/hubu_cashflow_runway_memorial.py` + `src/hubu_memorial_verdict.py`**,和本节 `hubu_treasury.py` 是**两套不同实现**(都真实、都确定性,但没有互相调用)——前者已接 `POST /api/chaotang/hubu/cashflow/preview`(六部能力评估时发现真引擎零真实入口,已补线,用本司 2025年12月真实报表验证过:现金跑道告急,1.6~2.9月)。以后要统一时注意别把两套现金流逻辑当同一套改。
  - 报价 → `config/flow_quotation.yaml` + `src/prompts_quotation.py`,输出假设 + 敏感性 + 需签字项。
  - 就绪记分卡 → `src/hubu_three_pillar_scorecard.py`,`ready` 才允许 `archive_preview`。
  - 大神入审 → `config/advisor_protocols.yaml` 的 `finance` profile;ben-graham/deming 判官,其余顾问;判官结论 RAG 强制。
  - golden 财务案例 + `persona_eval` 升判官飞轮;成交/流失结果回填更新报价基线。
- **文书标准(本仓)**:户部不新增 schema,直接套 `schemas/court_doc.json`(`doc_type=memorial`、`seal.stamp=算盘印`、`seal.color=金`)。
- **人类面渲染(前端仓)**:卷宗×现代 奏报卡 + 算盘金印 + 三柱灯 → chaotang-web-lyt,不在本仓做。
