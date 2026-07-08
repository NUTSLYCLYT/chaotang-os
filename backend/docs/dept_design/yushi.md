# 御史 · 天才设计(全局风险/收益/证据/自动化权限总判)

> 定稿 2026-07-01。对齐第一份部门设计 `docs/dept_design/xingbu.md` 与全院文书契约 `schemas/court_doc.json`。
> 协议出处:`harness/chaotang_department_protocol/departments.yaml` 的 `yushi` 块 ——
> owns `global_gate` / `drift_monitor` / `release_gate`;裁定流向 **绿→史馆,黄/红→源部门返修,黑→刑部深查**。
> 边界:本仓做**机器面(JSON 契约 + 后端闸)**;**人类面(封驳卡渲染/CSS/组件)在前端仓 chaotang-web-lyt 实现**。

## 一、御史定位

御史 = 客户的**全局总闸**,不是又一个挑刺的评审。卖的是"敢按下执行键的底气":
上线前、发布前、自动执行前,有一个**统一的、可追溯的、一票否决的总判**站在所有部门产出的最后一道门。

- **它是所有部门的最后一道闸**:刑部判完法务、户部算完 ROI、工部验完 POC、钦天监定完方向——
  这些产出谁都不能自己宣布"可以上了"。最后都汇到御史,由御史**定灯**(绿/黄/红/黑),
  对外只有一个口径:**这件事现在能不能放行,放行带什么条件,出事查谁。**
- **与刑部分工(协议明确)**:御史**定灯**,刑部**深查**。
  御史看的是"全局四维"(风险×收益×证据×自动化权限)够不够格放行;
  只有**黑灯**(高危/不可逆/红线)才落刑部的法务+红蓝对抗深查。
  御史不替刑部做法条,刑部不替御史做放行——**定灯的和深查的分开,避免既当裁判又当运动员。**
- 一句话:**刑部是风险护身符,御史是放行总开关。** 没有御史盖闸的产出,不许进史馆,不许自动执行。

## 二、五个震撼点

1. **一句话上线请求进,一张封驳/放行书出**:
   "这个报价能发客户吗 / 这个自动化能开自动执行吗 / 这个版本能上线吗"——
   单屏出**总判卡**(灯 + 能不能 + 挡了什么 + 放行条件 + 出事查谁 + 留痕号),四维评分藏二级。

2. **release_gate 总判(四维合一,不靠人工感觉)**:
   把分散的判断收成一张确定性判决——
   `风险等级 × 收益分 × 证据分 × 自动化权限级`,按规则映射 `allow / allow_with_conditions / block / block_and_escalate`。
   低风险自动放行,高风险明确阻断,中风险**给出"改成什么就能过"的放行条件**(黄灯不是拒绝,是带条件的通行证)。
   实现已在仓内:`harness/yushi_global_gate/`(规则 + golden cases + 判决台账)。

3. **drift_monitor 漂移监控(盯"偏没偏",不只看单次对错)**:
   不止判单次产出,还盯**部门/蜂群是否在漂移**——质量分下滑、踩 web 主线红线、自动化权限越级、数字无来源。
   接 `src/governance.py` 的蜂群治理等级(pass_rate / 不可逆错误 → 升降权),漂移到线就自动**降级该蜂群的自动执行权限**,
   把"曾经能自动跑的,现在只能出草稿等人签"这件事做成自动闸,而不是等出事复盘。

4. **一票否决 / 放行留痕(放行也是一条可追溯的记录)**:
   高危**一票否决**——任一硬核查 FAIL(数字无来源 / 越权自动执行 / 踩红线 / 证据缺)直接 `block`,不被收益分赎买。
   但放行也不是拍脑袋:**每一次放行都留痕**——盖了什么灯、基于哪四维分、谁参谋、归档号是多少,全进史馆台账。
   出事时一键调取:"这是当时基于这些证据做的、带签字的合理放行决策"。**放行有据,否决有理。**

5. **黄灯做成产品(把"不行"变"行,但带条件")**:
   御史的高价值不在红灯黑灯,在**黄灯**——绝大多数真实请求不是非黑即白。
   御史把"模糊地带"产品化成**带条件放行**:加上"此报价 7 日有效 / 自动执行限内部任务 / 上线先灰度 10%"这类显式条件 + 人工签字点,
   既不一刀切拦死业务,也不裸放行担风险。**客户拿到的不是'驳回',是'这样改就能走,且已记在案'。**

## 三、出场大神(governance profile,谁判官谁顾问)

复用大神体系。御史用 `config/advisor_protocols.yaml` 的 **governance profile**:
`richard-posner / bruce-schneier / deming / charity-majors / wang-yangming / andy-grove-perspective`。

铁律(`advisor_protocols.yaml` global_contract):**大神不是证据,也不是放行人。** 大神只给警示/天才建议/失败路径/证据缺口,**真正定输赢的是 harness 闸 + 人工签字。**

- **判官席(坐堂定灯口径,不直接放行)**:
  - `richard-posner` —— 法经济总账:放行的**收益 vs 风险×损失**算不算得过,黄灯条件值不值。
  - `bruce-schneier` —— 攻击者视角:这个放行**最弱的口子**在哪,自动执行权限会不会被滥用。
  - `andy-grove-perspective` —— 战略转折/10倍速威胁:这次放行是不是**不可逆的方向分叉**,该不该升级会审。
- **顾问席(供料,不坐堂)**:
  - `deming` —— 是不是**系统性漂移**(不怪单点,看流程):该降谁的权限,该补哪条规则。
  - `charity-majors` —— 可观测性:放行后**怎么知道它真没出事**,留痕够不够回链。
  - `wang-yangming` —— 知行合一:**结论和动作是否一致**,别判了"高危"却照样开了自动执行。
- **判官 vs 顾问的界**:判官给"定灯口径",顾问给"供料与复盘"。但**最终定灯是 release_gate 确定性规则**,大神口径只进 `provenance.advisors`,
  **不进 light**。高危/不可逆按 `irreversible` 级走小会审(4 位 + 人工签字),签字落 `signed=true` 才真执行。

## 四、文书 —— 御史封驳/放行书(套全院文书标准)

**一份内容,两副面孔**(同 xingbu.md §4)。御史的 `doc_type = review`,官印 = **獬豸印**(獬豸触不直,御史之兽),主色 = **黑金**(玄黑底 + 金线,庄重肃杀)。

### 4.1 机器面 —— court_doc.json 契约(御史封驳/放行)

```json
{
  "doc_type": "review",
  "dept": "yushi",
  "case_id": "YS-20260701-014",
  "light": "yellow",
  "headline": "可放行 —— 带 2 条件:报价 7 日有效 + 自动执行降为草稿待签",
  "shielded": "为你挡了:越权自动外发报价 + 一处无来源数字",
  "items": [
    {"level":"red","title":"自动化权限越级(L5 外部承诺却走自动执行)","odds":"高","impact":"不可逆外发","fix":"降为 L3:草稿+人工确认","evidence_ref":"truth://run/..."},
    {"level":"yellow","title":"报价含未锚定数字 ¥120万","odds":"中","impact":"对外口径风险","fix":"回链 verified_facts 或标注口径","evidence_ref":"truth://facts/..."},
    {"level":"green","title":"ROI 测算证据充分、刑部法务已绿","odds":"低","impact":"-","fix":null,"evidence_ref":"XB-20260701-009"}
  ],
  "adversarial": null,
  "actions": ["apply_conditions","sign_and_release","escalate_council","archive_amulet"],
  "provenance": {
    "advisors": ["richard-posner","bruce-schneier","andy-grove-perspective"],
    "archive_id": "YS-20260701-014",
    "gate": "passed",
    "rag_grounded": false
  },
  "source_label": "LIVE_SWARM",
  "signed": false,
  "seal": {"stamp":"獬豸印","color":"黑金","sealed_archive":"shiguan://YS-...014"}
}
```

字段对齐要点:`light` 四态(绿放行/黄带条件/红驳回返修/黑落刑部)= release_gate 的 `decision` 映射;
`headline` 永远"放行/驳回"人话在前;`gate=passed` 表示总闸已盖;**`signed` 决定不可逆动作能否真执行**——
黄红黑下 `signed=false` 时只出文书、不触发执行。机器面喂台账/治理/史馆,可解析、可 eval、可回链。

### 4.2 人类面 —— 封驳/放行卡(黑金·獬豸,前端仓渲染)

```
╔═══════════════════════════════════╗
║ 獬豸 御史总判      〔獬豸印〕案号YS-014 ║   ← 玄黑底·金线楷题 + 獬豸金印
║ ───────────────────────────────── ║
║ 🟡 可放行 · 须带 2 条件              ║   ← 黑金灯卡,放行/驳回结论一行在前
║ 御史为你挡了:越权自动外发 + 1处无来源数字 ║   ← 心意①
║ 放行条件 / 致命项 Top3   〔点击展开〕  ║   ← 渐进展开,四维评分藏二级
║  1🔴 自动化越级 L5  高  →降L3草稿待签 ║
║  2🟡 ¥120万无来源   中  →回链或标口径 ║
║  3🟢 ROI证据足·刑部已绿              ║
║ ───────────────────────────────── ║
║ 总闸:已盖〔passed〕 出事查:本案号链  ║   ← gate 状态显式
║ [应用条件] [签字放行] [升级会审] [存证] ║
║ 留痕已封存 · 史馆YS-014 〔骑缝金印〕   ║   ← 心意②③:放行也留痕
╚═══════════════════════════════════╝
```

**艺术方向**:玄黑底 + 金线 + 楷体标题(獬豸纹官印),古典御史台的肃杀庄重 + 现代黑黄绿红灯卡。
与刑部(朱砂红·天平印)、户部(金·算盘印)同骨架异印,归入 §4.3 全院印章品牌系统:**御史 · 獬豸印 · 黑金 · doc_type=review**。

### 4.3 心意三触点

1. 开头"**御史为你挡了什么**"(放行的价值先说出来,不止说拦了什么)。
2. 落款"**留痕已封存**"骑缝金印 + **总闸 gate 状态显式**(放行也是一条可追溯记录)。
3. 结论永远**人话在前("可放行/须改/驳回")、四维分在后**(决策不是评分表)。

## 五、落地

- **后端 MVP(本仓)**:御史已有底座,本轮按契约收口——
  - `harness/yushi_global_gate/`(run_gate.py + rules.yaml + ledger):**release_gate** 的确定性判决台,
    四维 → `green/yellow/red/black` + `conditions` + `red_team_required` + `archive_to_shiguan` + `next_gate`,**对齐 court_doc 字段**(decision→light、conditions→items.fix、archive→seal.sealed_archive)。
  - `src/yushi_gate.py`:回奏入箱前的**确定性质量闸**(verified/reserved/blocked,LLM 仅 advisory),并入御史"证据维"信号源。
  - `src/governance.py`:**drift_monitor** 接口——蜂群 pass_rate / 不可逆错误 → 升降自动执行权限,漂移到线自动降级。
  - `src/guard_rails.py`:**global_gate** 的红线/越权拦截层,踩高危词/越级自动化 → 一票 `block`。
  - 提供 `POST /api/yushi/review`:输入任一部门产出 → 输出 §4.1 封驳/放行 JSON;接 `truth_ledger` 存证、史馆归档号回链。
  - golden cases 走 `harness/yushi_global_gate/golden_cases/global_gate_cases.json`,过 `validate_flows` 才更新质量基线。
- **文书 schema(本仓)**:`doc_type=review` 复用既有 `schemas/court_doc.json`,新增 `dept=yushi` 印章映射(獬豸印/黑金),不另起一套契约。
- **人类面渲染(前端仓)**:黑金·獬豸封驳/放行卡 + 总闸状态条 → chaotang-web-lyt,**不在本仓做**。
