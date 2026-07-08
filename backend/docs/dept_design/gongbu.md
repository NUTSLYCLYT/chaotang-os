# 工部 · 天才设计与文书规格

> 定稿 2026-07-01。本文对齐《刑部》首份部门设计与全院文书标准(`docs/dept_design/xingbu.md`),
> 套用全院文书契约 `schemas/court_doc.json`,落实 `departments.yaml` 中 `gongbu` 定义。
> 视觉基调延续全院:**卷宗×现代融合** —— 古典骨(官印/案号/骑缝/楷体)+ 现代肉(灯/卡/渐进展开)。
> 边界:本仓做**机器面(JSON 契约 + 后端 + 确定性门)**;**人类面(验收单渲染/CSS/组件)在前端仓 chaotang-web-lyt 实现**。

## 一、工部定位

工部 = 客户的**交付底气**,不是接活的工头。卖的是一句话:**"这东西能不能做、做多久、POC 怎么搭、技术验收过没过。"**

客户最怕的不是"做不出来",是"答应了做不出来、做出来跑不起来、上线了出事说不清"。工部把这四件事提前判死:

- **能不能做** —— 给可行性裁定,不是拍胸脯。做不到的标红,讲清卡在哪(`elon-musk-perspective` 第一性原理拆约束)。
- **做多久** —— 给工期带宽,不给单点承诺。范围多大、风险加多少缓冲,讲明白(`sam-altman` 范围/速度)。
- **POC 怎么搭** —— 最小可运行系统先行;demo 只证明链路接通,**绝不冒充质量证明**(`karpathy`,协议 `demo` genius_design 原文)。
- **技术验收过没过** —— 过线靠**确定性证据**(测试通过、观测事件、确定性门),不靠 agent 自夸(`kent-beck` + `charity-majors`)。

(协议定义:工程建设/产品实现/研发交付/技术验收;输出 `implementation`/`dependency_security`/`poc_result`/`stage_gate_decision`。
门禁:工部产出必须过测试、flow 校验、御史漂移与 release observability gate;史馆归档工程证据。)

## 二、五个震撼点

1. **一句话进,一张验收单出**:大白话需求进 → 单屏验收裁决(灯+能不能做+工期带宽+Top3 风险+一句话怎么改就能过+自动留痕),架构细节藏二级。客户不用读 40 步蜂群日志,只看一张判决。

2. **确定性门兜底,不信 agent 自评**:工程数字(成本/串并/电流/能量)走 `src/pack_rd_cost_validator.py` + `src/pack_rd_sizing.py` 的 **no-LLM 确定性门**——精算 agent 只"选数",确定性门"验数",自报值与确定性算出对不上即 `FAIL`,抽不出字段标 `UNKNOWN` 绝不假装 `PASS`。**这是工部的护城河:算术不许 LLM 自评。**

3. **代码审查变任务卡(不是读后感)**:`config/flow_gongbu_review.yaml` 蜂群(代码质量→安全+功能并行→汇总)输出**可执行任务卡**——带文件、行号证据、风险、修复命令、验收命令(协议 `gongbu_review` genius_design 原文)。审查结论能直接 `git apply` 思路,不是"建议优化一下"。

4. **POC 三段验收,demo 不冒充交付**:沿 `flow_sdlc` 把需求拆成 **smoke(链路通没通)→ focused tests(功能对不对)→ release gate(能不能上)** 三段。每段独立判灯,demo 阶段强制标注"非质量证明 + 缺哪些 golden case + 下一步正式验收命令",杜绝"demo 跑通了就当交付"的偏移。

5. **失败样本回流,同错不犯第二次**:把 prompt / workflow 当代码管,失败样本进 regression;工程产出默认写 `production_events`,供发布红黄绿门禁读取。技术债与崩溃现场不是结束,是下一次验收的 golden case。

## 三、工程团(工程大神,判官/顾问分席)

复用全院大神体系(分席/eval/确定性锚),建一个**工程分支**。出场名册取 `config/advisor_protocols.yaml` 的 `engineering` profile:
`karpathy / kent-beck / martin-fowler / charity-majors / elon-musk-perspective / sam-altman`。

### 3.1 判官席(坐堂判验收过没过)

判官只回答"过线了吗",证据不足不放行:

- **kent-beck** —— **测试判官**:没有红→绿的测试就没有"完成"。验收以测试通过为准,不以"我跑了一下没问题"为准。
- **charity-majors** —— **生产可观测判官**:跑得起来 ≠ 能运维。无 `production_events`、无可观测、回滚路径不明 → 不准上 release gate。
- **martin-fowler** —— **架构/技术债判官**:架构是否可维护、债是否被记下而非被埋。结构性腐烂标红,挡的是后患不是进度。

### 3.2 顾问席(参谋能不能做、做多久、怎么搭)

顾问出方案与判断,不下终裁:

- **karpathy** —— **总设计顾问**:最小可运行系统先行,每个工程建议必须带测试、观测事件、回滚路径(`departments.yaml` gongbu genius_design 原文)。
- **elon-musk-perspective** —— **可行性顾问**:第一性原理拆约束,先问"这步能不能删";判"能不能做"与最危险的物理/工程约束。
- **sam-altman** —— **范围/速度顾问**:判"做多久"、范围该砍到多小、先发哪一版;对抗范围蔓延。

### 3.3 工程铁律(对标刑部"律师 RAG 强制")

- **确定性优先于自评**:凡可被确定性验证的工程结论(算术/sizing/测试/门禁),**一律走确定性门或真实测试**,agent 自评只作草稿,不作裁定依据。**幻觉验收比没验收更危险**——它给客户假底气。
- **demo ≠ 质量**:任何 demo/spawn 产出强制标注"非质量证明 + 缺失 golden case + 下一步正式验收命令"。
- **每条结论可落任务卡**:判官输出必须能变成"文件 + 风险 + 修复命令 + 验收命令",不能落地的结论不算结论。
- 每位判官配 golden case,过 `persona_eval` 才升判官,同一套飞轮。

## 四、文书规格「工部验收单」

**一份内容,两副面孔。** 复用全院 `court_doc.json` 骨架,工部身份字段:`doc_type=review`、`dept=gongbu`、官印=**规矩印(尺规)**、主色=**钢蓝**。

### 4.1 机器面 —— JSON 契约(套 court_doc.json)

```json
{
  "doc_type": "review",
  "dept": "gongbu",
  "case_id": "GB-20260701-031",
  "light": "yellow",
  "headline": "能做 —— 工期 6~8 周,先补 2 项验收才算交付",
  "shielded": "为你拦了:把 demo 跑通当成交付的假底气(已标非质量证明)",
  "items": [
    {
      "level": "red",
      "title": "BMS 选型未过确定性成本门:cell_model 不在真值库",
      "odds": "高",
      "impact": "BOM 偏差 ¥不可估 / 报价失真",
      "fix": "换 cell_library 内真值型号,或补型号录入后重跑 pack_rd_cost_validator",
      "evidence_ref": "truth://gongbu/pack_rd/GB-031#cost_gate=FAIL"
    },
    {
      "level": "yellow",
      "title": "核心放电链路无 focused tests,仅 smoke 通过",
      "odds": "中",
      "impact": "上线后功能回归无网兜",
      "fix": "补 3 条 focused tests 覆盖低温放电分支,纳入 release gate",
      "evidence_ref": "truth://gongbu/sdlc/GB-031#stage=smoke_only"
    },
    {
      "level": "green",
      "title": "确定性 sizing 自洽:串并/电流与精算自报一致(带宽内)",
      "odds": null,
      "impact": null,
      "fix": null,
      "evidence_ref": "truth://gongbu/pack_rd/GB-031#sizing=PASS"
    }
  ],
  "actions": ["apply_fix_cards", "run_release_gate", "archive_evidence", "sign_waiver"],
  "provenance": {
    "advisors": ["kent-beck", "charity-majors", "martin-fowler", "karpathy", "elon-musk-perspective", "sam-altman"],
    "archive_id": "GB-20260701-031",
    "gate": "pending",
    "rag_grounded": false
  },
  "source_label": "LIVE_SWARM",
  "signed": false,
  "seal": {
    "stamp": "规矩印",
    "color": "钢蓝",
    "sealed_archive": null
  }
}
```

机器面喂飞轮/归档/门禁,可解析、可 eval、可回链证据。注:`items[].evidence_ref` 回链确定性门与三段验收的真实判据,不是 agent 旁白。

### 4.2 人类面 —— 卷宗×现代验收单(钢蓝 + 规矩印)

同一 JSON 渲染成有仪式感的验收单(基调=全院选定样例,主色换钢蓝、官印换规矩印):

```
┌─────────────────────────────────────────────┐
│ 📐 工部验收单      〔规矩印〕案号 GB-031        │  ← 楷体标题 + 钢蓝官印(尺规)
│ ───────────────────────────────────────────  │
│ 🟡 能做 · 工期 6~8 周 · 须先补 2 项才算交付      │  ← 现代红黄绿灯,结论一行在前
│ 工部为你拦了:把 demo 跑通当成交付的假底气       │  ← 心意①
│ 验收/可行性 Top3              〔点击展开架构〕   │  ← 渐进展开,架构细节藏二级
│  1🔴 BMS 未过确定性成本门  高×报价失真  →换真值… │
│  2🟡 核心链路只有 smoke    中×回归无网兜 →补测试… │
│  3🟢 确定性 sizing 自洽    串并/电流带宽内通过    │
│ ───────────────────────────────────────────  │
│ [一键改] [跑 release gate] [存证] [签风险单]    │
│ 工程证据已封存 · 史馆 GB-031   〔骑缝钢蓝印〕    │  ← 心意②③:交付底气具象化
└─────────────────────────────────────────────┘
```

**艺术方向**:楷体/宋体标题 + **钢蓝主色** + 蓝图微纹(对应工程/图纸语义) + 现代无衬线正文 + 红黄绿灯卡 + **规矩印(尺规)**官印。古典庄重,工程精确。

### 4.2b 实测样例(已实现:`src/gongbu_review_verdict.py` 接 pack_rd 重算门)

工部已是 L1 —— `run_gongbu_review(presale_output, task_input)` 跑确定性重算门 → 装配 court_doc。
与刑部不同:工部**靠重算接地,不靠 RAG**(`provenance.grounding="deterministic"`);抽不到数据 → 禁假 PASS。

```
┌───────────────────────────────────────────────┐
│ 📐 工部验收单     〔规矩印〕案号 GB-20260701-031   │  钢蓝楷体 + 规矩印
│ ───────────────────────────────────────────── │
│ 🔴 不予验收 —— 重算对不上 / 不自洽               │  灯由重算偏差定
│                                               │
│ 致命项:                                        │
│  1🔴 parallel 串并数与确定性重算不符             │
│      (偏差 3,应为 12P)  证据:pack_rd_sizing   │
│ ───────────────────────────────────────────── │
│ 接地:确定性重算(deterministic)· gate=passed   │  ← 重算成功(只是对不上)
│ [按重算值修正] [开庭] [存证]   〔骑缝·规矩印〕     │
└───────────────────────────────────────────────┘
抽不到精算 JSON → UNKNOWN：盖"不予验收·需人工"半透印,gate=pending（禁假 PASS）。
```

### 4.3 在全院印章品牌系统中的位置

同一骨架,工部加入印章品牌系统(扩展刑部表):

| 部门 | 文书类型 | 官印 | 主色 |
|---|---|---|---|
| 刑部 | 判决书 | 天平印 | 朱砂红 |
| 工部 | 验收单 | 规矩印(尺规) | 钢蓝 |
| 户部 | 奏报 | 算盘印 | 金 |
| 礼部 | 策案 | 礼器印 | 青 |
| 钦天监 | 天象策 | 星盘印 | 靛蓝 |
| 史馆 | 卷宗 | 史笔印 | 墨 |

### 4.4 心意三触点

1. 开头"**工部为你拦了什么**"——把"避免假底气"的价值说出来(把 demo 当交付、把自评当验收,都是要拦的)。
2. 落款"**工程证据已封存**"骑缝钢蓝印——交付底气具象化(出事能调取"测试/事件/确定性门判据")。
3. 结论永远**人话在前、架构在后**——"能不能做、做多久"先讲,架构与代码细节藏二级(交付不是技术炫耀)。

## 五、落地

- **后端 MVP(本仓)**:
  - `flow_gongbu_review` / `flow_sdlc` / `flow_pack_rd` 的对外输出统一改为 §4.1 验收单 JSON(`doc_type=review`)。
  - ✅ 新增 `POST /api/gongbu/review`(验收/可行性裁决,`web/routers/gongbu.py`)——六部能力评估时发现这条一直没建,已补(2026-07-03);`engineering` profile 判官/顾问入审仍未接。
  - `items[].evidence_ref` 接 `truth_ledger` 存证 + `pack_rd_cost_validator` / `pack_rd_sizing` **确定性门**作 `level/impact` 真据;`provenance.gate` 接御史 release/drift gate。
  - golden case:把历史"demo 当交付""自评算术 FAIL"样本入 regression,过 `persona_eval` 才升判官。
- **文书标准 schema(本仓)**:工部直接复用 `schemas/court_doc.json`,仅以 `doc_type=review` + `seal.stamp=规矩印` + `seal.color=钢蓝` 区分身份,**不另立 schema**。
- **人类面渲染(前端仓)**:卷宗×现代 验收单 + 规矩印/钢蓝印章系统 → chaotang-web-lyt,不在本仓做;后端 dry-run 不替代前端真实浏览器验证。
