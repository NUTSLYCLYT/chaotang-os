# 锦衣卫 · 天才设计与谍报文书

> 定稿 2026-07-01。本文对齐刑部设计稿(`docs/dept_design/xingbu.md`),复用全院文书标准
> (`schemas/court_doc.json`)与现有锦衣卫资产:`锦衣卫` skill(可信度核查 + 异动雷达)、
> `src/jinyiwei_vet.py`(入库把关 check)、`config/flow_jinyiwei.yaml`(三卫蜂群)、
> `src/truth_ledger.py`(真值台账)。
> 边界:本仓做**机器面(JSON 契约 + 后端)**;**人类面(谍报卡渲染/CSS/组件)在前端仓 chaotang-web-lyt 实现**。
> 协议定义(`departments.yaml`):锦衣卫管外部信号、开源项目、竞品、风险情报;
> owns `open_source_signal / external_signal / risk_intel`;绿灯转钦天监、黄灯过御史、黑灯落刑部。

## 一、锦衣卫定位

锦衣卫 = 客户的**外部之眼**,不是爬虫和剪报机。卖的是"底气":让客户知道**市场/竞品现在到底变了什么、
哪条情报能信、有没有异动该提前预警**。出去谈单、定价、改路线,心里有底——因为锦衣卫帮你盯着外面。

它治两个真痛点:
- **"采得多但不可信"**:网上抓一堆,里头混着 AI 编的认证、媒体转载的孤证、对手放的假料,脏情报污染决策比没情报更糟。
- **"只有快照没有预警"**:今天行业现状报告一份、明天又一份,没人告诉你"昨天到今天**变了什么**"。情报的价值在 delta,不在快照。

## 二、五个震撼点

1. **情报可信度分级(脏情报 / AI 硬声明挡门外)**:每条情报入史馆前必过 `jinyiwei_vet` 闸,
   自动分一手(官网/公告/年报/招标公告/交易所)/ 二手(媒体/号/转载)/ 未证实,跨源去重计数 ≥2 才算印证。
   **硬声明铁律**:含认证(GJB/GB-T)、具体数字、百分比、绝对化排名("全球领先/唯一/最")且**非一手来源**的,
   一律判"待核",不自动入库——这正是 AI 自己会编"已通过 GJB 认证"的解药。接 `src/jinyiwei_vet.py` 的 `vet_intel`。

2. **异动雷达(盯"变了什么")**:不只给快照,对比上轮 vs 本轮,自动标**新增 / 消失 / 突变(数值跳变超阈值)/ 持续**。
   "宁德发了 -40℃/90%"这种**突变**,比"行业现状"快照值钱十倍——它直接触发兵部改 battlecard、户部重算报价。
   接 `锦衣卫` skill 的 `detect_change(prev, curr, value_thr)`。

3. **入库把关写进证据链**:`vet_and_record` 把每条核查结论(入库=PASS / 拒=FAIL / 待核=UNKNOWN)
   写入 `truth_ledger`,带来源、等级、理由。事后能回答"这个判断当时基于哪几条情报、可信度多少",
   情报和判官一样要留痕,不是只在聊天记录里飘。

4. **三卫蜂群,宁少不假**:`flow_jinyiwei` 三卫流水——采集卫(每条带来源/时间/类别,反捏造)→
   核查卫(分级 + 跨源印证 + 硬声明拦截)→ 整理卫(时间线 + 分类 + 相关性评级 + 截止时间)。
   铁律:**无法获取真实信息就明说"未能获取",绝不编造充数**;`scripts/intel_check.py` C1-C7 确定性兜底
   (无源=谣言直接 FAIL,孤证=UNKNOWN)。

5. **谍报即预警,不止简报**:整理卫输出的不是一篇可读文章,而是**决策就绪的异动清单**——
   每条异动直接挂可信度等级 + 对我方相关性 + 建议动作 + 回链证据。客户看一眼就知道"该不该动、动哪",
   而不是读完三千字还要自己提炼。

## 三、谍报参谋(出场大神)

复用 `config/advisor_protocols.yaml`。锦衣卫横跨 `operations`(生产健康/观测/异常)与 `strategy_forecast`
(情景推演/肥尾)两套 profile,因此判官席取这两套里最贴情报安全与信号研判的人:

- **判官席(坐堂下结论)**:
  - **bruce-schneier**(情报安全 / 攻击者视角):专治**情报投毒**——竞品/对手会不会喂假料?这条"GJB 认证 / 全球领先"
    是不是钓鱼?他坐镇可信度闸,脏情报与非一手硬声明一律挡门外。(出自 `operations` / `legal_risk`)
  - **deming**(统计过程控制 SPC):异动雷达本质是控制图——区分"常因波动(噪声)"与"异因突变(真信号)"。
    deming 判"这个变化是该报警的特殊原因,还是别天天喊狼来了的普通抖动",治告警疲劳。(出自 `operations`)

- **顾问席(加权不拍板)**:
  - **soros-perspective**(反身性):竞品叙事与市场预期会自我强化,价格战/技术路线拐点常在"叙事突变"时出现。
    他提示"哪条异动是趋势自我实现的拐点信号,而非一次性噪声"。(出自 `strategy_forecast`)
  - **charity-majors**(可观测性):异动雷达 = 对外部世界的 observability。她管"雷达盯哪些维度、突变阈值怎么定、
    告警别太吵",把"未知的未知"变成可告警信号。(出自 `operations`)
  - **taleb-perspective**(肥尾):有些异动是黑天鹅前兆——突然消失的供应商、凭空入局的强对手,
    不能用均值思维。他给"这条异动会不会是肥尾事件的早信号"。(出自 `strategy_forecast`)

口径:判官席 2 人(schneier 把可信度、deming 判异动真伪)下结论,顾问席 3 人加权研判拐点与肥尾,
对应协议 `swarms.jinyiwei`(level=substantial,2 位判官即可;涉及不可逆/烧钱预警升 design,加 taleb 与人工签字点)。

## 四、谍报文书(套全院文书标准)

doc_type = **`brief`**(全院文书标准 7 类之一)。锦衣卫专属官印 = **绣春刀印**,主色 = **玄黑暗红**。
补进全院印章品牌系统:

| 部门 | 文书类型 | 官印 | 主色 |
|---|---|---|---|
| 刑部 | 判决书 | 天平印 | 朱砂红 |
| 户部 | 奏报 | 算盘印 | 金 |
| 钦天监 | 天象策 | 星盘印 | 靛蓝 |
| 史馆 | 卷宗 | 史笔印 | 墨 |
| **锦衣卫** | **谍报 / 异动预警** | **绣春刀印** | **玄黑暗红** |

### 4.1 机器面 —— court_doc JSON(brief)

`items` 即**异动项**:`level`=异动严重度;`title`=异动描述(新增/消失/突变);`odds`=可信度等级
(一手 / 二手多源 / 待核);`impact`=对我方影响;`fix`=建议动作;`evidence_ref`=回链 truth_ledger/史馆。

```json
{
  "doc_type": "brief",
  "dept": "jinyiwei",
  "case_id": "JYW-20260701-014",
  "light": "yellow",
  "headline": "竞品 -40℃/90% 追平你的卖点,且供应链冒出 1 个该盯的口子",
  "shielded": "为你挡了:1 条 AI/媒体编的『GJB 认证』脏情报没进你的决策库",
  "items": [
    {"level":"red","title":"突变:宁德某型 -40℃ 容量保持率 80%→90%(+12.5%)","odds":"一手(官网公告)","impact":"你的 -40℃/90% 卖点被追平","fix":"兵部更新 battlecard;工部核实是否实测口径","evidence_ref":"truth://jinyiwei/JYW-014#chg1"},
    {"level":"yellow","title":"新增:XX 储能入局高寒储能招标","odds":"二手(3源印证)","impact":"高寒标段多一个竞争者","fix":"haolong 补客户身份核查","evidence_ref":"truth://jinyiwei/JYW-014#chg2"},
    {"level":"yellow","title":"待核:某媒体称『YY 电池通过 GJB 认证』","odds":"待核(硬声明·非一手)","impact":"若属实影响军工标段","fix":"jinyiwei_vet 已挡在库外,需人工查公告原文","evidence_ref":"truth://jinyiwei/JYW-014#chg3"},
    {"level":"yellow","title":"消失:某低温电解液产品下架","odds":"二手(2源印证)","impact":"潜在供应风险","fix":"户部评估替代料","evidence_ref":"truth://jinyiwei/JYW-014#chg4"}
  ],
  "actions": ["push_battlecard","archive_intel","escalate_qintianjian","mark_for_review"],
  "provenance": {
    "advisors": ["bruce-schneier","deming","soros-perspective"],
    "archive_id": "JYW-20260701-014",
    "gate": "passed",
    "rag_grounded": true
  },
  "source_label": "LIVE_SWARM",
  "signed": false,
  "seal": {"stamp":"绣春刀印","color":"玄黑暗红","sealed_archive":"JYW-20260701-014"}
}
```

机器面喂飞轮/归档/门禁/eval:可信度判定写 `truth_ledger`,异动项回链证据,可被钦天监/兵部下游消费。

### 4.2 人类面 —— 谍报 / 异动预警卡(ASCII 样例,前端仓渲染)

```
┌─────────────────────────────────────┐
│ 🗡 锦衣卫谍报      〔绣春刀印〕案号 JYW-014 │   ← 楷体标题 + 玄黑暗红官印
│ ───────────────────────────────────── │
│ 🟡 竞品追平你的卖点,1 个供应口子该盯     │   ← 结论一行在前(人话)
│ 锦衣卫为你挡了:1 条编造的『GJB 认证』脏情报│   ← 心意①
│ 异动雷达 · 本轮 vs 上轮      〔点击展开〕  │   ← 渐进展开
│  🔴 突变 宁德 -40℃ 80%→90% │一手·可信│追平 │
│  🟡 新增 XX 储能入局招标    │二手·3源 │多对手│
│  🟡 待核 YY『GJB认证』      │待核·挡库外│?  │   ← 脏情报挡门外可见
│  🟡 消失 某低温电解液下架   │二手·2源 │供应险│
│ ───────────────────────────────────── │
│ [推送 battlecard] [存档] [上呈钦天监]    │
│ 情报已核·封存 · 史馆 JYW-014 〔骑缝绣春刀印〕│   ← 心意②③
└─────────────────────────────────────┘
```

**艺术方向**:楷体/宋体标题 + **玄黑暗红**主色(夜行卫所的冷峻)+ 暗纹底 + 现代无衬线正文 +
红黄绿灯异动卡;可信度等级用小徽标贴在每条异动右侧,待核/脏情报用暗红边框标"挡库外"。古典肃杀,现代可读。

## 五、心意三触点

1. 开头"**锦衣卫为你挡了什么**":把"没让脏情报污染你决策"这个看不见的价值说出来(`shielded`)。
2. 落款"**情报已核·封存**"骑缝绣春刀印:可信度核查与归档具象化(`seal` + `truth_ledger`)。
3. 结论永远**异动在前、原始情报在后**:先告诉客户"变了什么、该不该动",原文与来源藏二级(情报不是阅读材料,是预警)。

## 六、落地

- **后端 MVP(本仓)**:
  - `flow_jinyiwei` 整理卫输出契约改为 §4.1 brief JSON;新增 `POST /api/intel/brief`。
  - 入库闸接 `src/jinyiwei_vet.py` 的 `vet_and_record`(入库/待核/拒 → PASS/UNKNOWN/FAIL 写 `truth_ledger`),
    与 `scripts/intel_check.py`(C1-C7 确定性)、`scripts/jinyiwei_vet_check.py` 并联做门禁。
  - 异动雷达接 `锦衣卫` skill 的 `detect_change`,把上轮归档快照与本轮采集做 diff,产出 `items` 异动项。
  - schneier / deming 入判官席,soros / charity-majors / taleb 入顾问席;配 golden(`jinyiwei_intel`)过 `persona_eval` 才升判官。
- **文书 schema(本仓)**:复用 `schemas/court_doc.json`(`doc_type=brief`),把 §4.1 字段映射落成 golden 样例;
  在印章品牌系统补 `jinyiwei → 绣春刀印 / 玄黑暗红`。
- **人类面渲染(前端仓)**:谍报 / 异动预警卡 + 绣春刀印 → chaotang-web-lyt,不在本仓做。
```
jinyiwei: 外部之眼——脏情报挡门外、异动盯 delta,让客户谈单定价心里有底。
```
