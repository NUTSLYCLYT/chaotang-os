# 史馆 · 天才设计(归档证据 / 复盘 / 学习样本 / 能力清单)

> 定稿 2026-07-01。对齐第一份部门设计 `docs/dept_design/xingbu.md`,复用其定下的**全院文书标准**与**印章品牌系统**。
> 视觉基调沿用刑部:**卷宗×现代融合**(古典骨:史笔/案号/骑缝/楷体 + 现代肉:灯/卡/渐进展开)。
> 边界:本仓做**机器面(JSON 契约 + 后端飞轮)**;**人类面(卷宗渲染/CSS/组件)在前端仓 chaotang-web-lyt 实现**。

## 一、史馆定位

史馆 = 客户的**护身符 + 复盘脑**,不是文件柜。卖的是两样底气:

- **出事能调出当时的依据**:任何决策都留卷宗,带依据/赔率/签字/证据回链。客户被追责时,一键调出"我基于这些当时已知的事实,做了合理决策"——这是护身符,不是事后补的说辞。
- **过往同类怎么处理 + 系统从每次决策里学到了什么**:新议案进来先翻旧卷(编年+纪事本末),自动带"以史为鉴";每次结案都喂进化飞轮,系统下次少犯同样的错。

协议定义(`departments.yaml`):史馆 `owns: archive / learning_record / capability_manifest`,`input_from: all`(全院结案产物都流经史馆),绿灯即 `done`。它是飞轮的**沉淀端**,不是业务决策端。

## 二、五个震撼点

1. **一案一卷宗,出事一键调依据(护身符)**:每份结案会审过 `shiguan_archive` 四官流水线(决策提炼官→鉴往提炼师→史册撰写官→归档索引员→QA),落成结构化卷宗。每条关键结论 `evidence_ref` 回链 `truth_ledger`,出事即调取"当时依据"。忠实记录,无依据的结论一律标"待考",不美化、不臆造。

2. **以史为鉴:过往同类怎么处理自动浮出**:`annals_writer` 出编年体史册条目(纪事+附议+史评);`flow_shiguan_archive.yaml` 的 `knowledge_pre_retrieval(scope=["shiguan_annals"])` 让新决策进来先检索历史同类卷宗,把"上次这类客户/这类风险我们怎么判的"端到判官面前,而不是每次从零。

3. **复盘出可执行教训,不是空泛感慨**:`lesson_distiller` 把结案材料炼成**带触发条件**的成功经验 / 失败教训 / 风险预警(下次该怎么做),而非"要注意"。BATCH 模式还逐项列算式算成交率/失败率,缺明细就明写"需补数",严禁把推测当数据规律。

4. **三条进化飞轮:系统真的在学**(核心):史馆把"学到了什么"落成三股可检索信号,喂回下一轮路由——
   - **朝会沉淀**(`court_flywheel.archive_session_to_knowledge`):每日朝报+各部奏折要点回流知识库 `domain="朝会沉淀"`,供未来 `pre_retrieve` grounding。error 状态不入库(脏燃料不进飞轮)。
   - **失败记忆**(`failure_memory`,Reflexion):自动质量分低+触发修复循环+语义命中"重复犯的错"才写入,下次同 flow 注入历史教训,降 `repair_cycle` 触发率。
   - **签字学习**(`signoff_learning`):皇帝/二审 `reject` 是稀缺人类判决,按 `dept` 沉淀教训,下次该部上奏前 `recall_lessons` 取回规避。
   三股信号源/键/存储各不相同,刻意不并成一个表(避免 embedding 依赖与键错配)。

5. **燃料干净 + 飞轮健康可账面审计**:`truth_ledger.record` 带 `provenance` 鉴权(`authenticated` run_id 可查 / `orphan` 疑似投毒 / `unknown` 未鉴权),源头挡脏数据;`health()` 区分飞轮"在转/空转"(PASS/FAIL 计数),让"系统在学习"这句话可被验证,而不是口号。

> 核心一句:**证据链卷宗(护身符) + 复盘自进化(喂飞轮)**——史馆既保客户的命,也让系统越跑越聪明。

## 三、史官团(知识/复盘大神,带知识库)

复用 `config/advisor_protocols.yaml` 的 `knowledge_archive` profile(史馆/翰林院),`shiguan_archive` 蜂群挂此 profile:

- **判官席(坐堂定论)**:
  - **deming**:复盘与系统学习权威——区分"普通波动 vs 特殊原因",教训只对系统改进,不对个人惩罚;BATCH 复盘的算式纪律由他把关。
  - **andrew-ng**:数据中心主义——盯学习飞轮"是否真在改进下一次",而非堆历史文本。
- **专科顾问(出意见,不定论)**:
  - **charity-majors**:可观测性——卷宗必须留 run_id/provenance/证据,出事能回溯。
  - **karpathy**:工程闭环——失败记忆/签字学习要真接回 flow,形成闭环而非死档。
  - **jeff-bezos-perspective**:长期记忆与不可逆记录——把"当时的依据"写成未来能复用的备忘,服务长期复盘。
- **铁律**:史馆结论同样受 RAG 纪律约束——史评/教训若要下断言,须回链原始材料行号/出处;无依据标"待考"。**编造的历史比没有历史更危险。**
- 每条教训配 golden 样本,过 `persona_eval` 才升判官,同一套飞轮。

## 四、文书:史馆卷宗(套全院 CourtDoc 契约)

沿用 `schemas/court_doc.json` 全院骨架,史馆身份字段:

| 字段 | 取值 |
|---|---|
| `doc_type` | `archive` |
| `dept` | `shiguan` |
| 官印 | **史笔印** |
| 主色 | **墨** |

### 4.1 机器面 —— CourtDoc(archive)JSON 样例

```json
{
  "doc_type": "archive",
  "dept": "shiguan",
  "case_id": "SG-20260701-031",
  "light": "green",
  "headline": "已封存:储能售后召回决策卷宗 —— 当时依据齐全,判赔合理可保命",
  "shielded": "为你留底:这单决策的全部当时依据 + 御史签字,日后追责可一键调取",
  "items": [
    {"level":"green","title":"决策依据完整","odds":null,"impact":null,
     "fix":"无需补","evidence_ref":"truth://shiguan/SG-20260701-031#authenticated"},
    {"level":"yellow","title":"成交率明细缺 per-case 数据","odds":"中","impact":"复盘失真",
     "fix":"补回各主因数量再算占比,当前标'待考'","evidence_ref":"annals://shiguan_annals/2026Q2"},
    {"level":"green","title":"教训已喂飞轮","odds":null,"impact":null,
     "fix":"failure_memory + signoff_learning 已写入,下次同部规避","evidence_ref":"truth://flywheel/health"}
  ],
  "actions": ["open_annals","trace_evidence","feed_flywheel","export_amulet"],
  "provenance": {
    "advisors": ["deming","andrew-ng","charity-majors","karpathy","jeff-bezos-perspective"],
    "archive_id": "SG-20260701-031",
    "gate": "passed",
    "rag_grounded": true
  },
  "source_label": "LIVE_SWARM",
  "signed": true,
  "seal": {"stamp":"史笔印","color":"墨","sealed_archive":"SG-20260701-031"}
}
```

机器面喂飞轮/检索/门禁/eval,`evidence_ref` 可逐条回链 `truth_ledger` 与 `shiguan_annals`。

### 4.2 人类面 —— 卷宗×现代渲染(在前端仓)

```
┌───────────────────────────────┐
│ 📜 史馆卷宗      〔史笔印〕案号SG-031 │   ← 楷体标题 + 墨色官印
│ ───────────────────────────── │
│ 🟢 已封存·依据齐全可保命          │   ← 红黄绿灯,结论一行在前
│ 史馆为你留底:全部当时依据+御史签字 │   ← 心意①
│ 卷宗要点 / 以史为鉴   〔点击展开〕 │   ← 渐进展开,原始材料藏二级
│  1🟢 决策依据完整   →回链证据    │
│  2🟡 成交率明细缺   →需补数·待考 │
│  3🟢 教训已喂飞轮   →下次规避    │
│ ───────────────────────────── │
│ [翻旧卷] [查证据] [喂飞轮] [导护身符]│
│ 留痕已封存 · 史馆SG-031 〔骑缝史笔印〕│   ← 心意②③:护身符具象化
└───────────────────────────────┘
```

**艺术方向**:楷体/宋体标题 + 墨色主色 + 宣纸微纹 + 编年时间轴留白 + 红黄绿灯卡。古朴庄重,现代可读。与全院印章品牌系统(刑部天平印/朱砂、户部算盘印/金、钦天监星盘印/靛蓝……)同骨架异印,史馆=**史笔印/墨**。

## 五、心意三触点

1. 开头"**史馆为你留底了什么**":把护身符价值说在最前(留了哪些当时依据+谁签的字)。
2. 落款"**留痕已封存**"骑缝史笔印:护身符具象化,可一键导出。
3. 结论永远**人话在前、史料在后**:卷宗结论一行讲清,编年原文与证据回链折叠在二级——复盘不是堆档案。

## 六、落地

- **后端 MVP(本仓)**:
  - `flow_shiguan_archive.yaml` 输出契约改为 §4.1 的 CourtDoc `archive` JSON(现四官流水线 + QA 已就位);`POST /api/archive/case`。
  - 卷宗每条结论接 `truth_ledger.record(provenance=...)` 存证,`evidence_ref` 回链;`health()` 暴露飞轮在转/空转。
  - 三飞轮接线:结案触发 `court_flywheel.archive_session_to_knowledge`(朝会沉淀回流)、`failure_memory`(自动失败)、`signoff_learning`(人类签字驳回),三者各司其职不合并。
  - `knowledge_pre_retrieval(scope=["shiguan_annals"])` 已开,新案先翻旧卷;史评/教训走 RAG 纪律(无源标"待考")。
  - golden:史馆自身 golden 卷宗过 `persona_eval`,质量基线单独提交(`scripts/golden_cases/quality_baseline.json`,先跑完整 `validate_flows.py`)。
- **人类面渲染(前端仓)**:卷宗×现代 archive 卡 + 编年时间轴 + 史笔印/墨色 → `chaotang-web-lyt`,不在本仓做。

---

shiguan: 出事调得出当时依据(护身符),每次结案喂得动进化飞轮(复盘脑)——证据链 + 自进化,一份卷宗两件事。
