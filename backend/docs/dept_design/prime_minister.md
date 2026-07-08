# 丞相 · 天才设计(总收口:把一堆结论压成一条主线)

> 定稿 2026-07-01。对齐《刑部》全院文书标准(`docs/dept_design/xingbu.md`)与 `schemas/court_doc.json`。
> 视觉基调沿用全院:**卷宗×现代融合**(古典骨:相印/案号/骑缝/楷体 + 现代肉:灯/卡/渐进展开)。
> 边界:本仓做**机器面(JSON 契约 + 后端编排)**;**人类面(主线卡渲染/CSS/组件)在前端仓 chaotang-web-lyt 实现**。
> 丞相定义见 `harness/chaotang_department_protocol/departments.yaml`(job:总揽上书房、三省六部、诸司的下一步,压缩成一条可执行主线;input_from: all)。

## 一、丞相定位

丞相 = 客户的**主心骨**,不是又一个出意见的部门。

各部门(刑部判风险、户部算钱、工部看交付、兵部攻防……)各出一份文书,客户看完只会更乱:
"六张纸都说得对,那我**现在到底先干哪一件**?" 丞相卖的就是这个底气——
**把所有部门的结论聚合、去冲突,压成"现在就做这一件、按这个顺序、谁来做、什么时候"的一条主线 + 一份拟旨草案。**

它是各部门文书**之上**的"总收口":别人产出零件,丞相产出装好的那一台。
(协议定位:`next_step_orchestration` / `cross_department_priority` / `owner_route_deadline`,接 shangshufang 上书房决策 loop 与 chaotang_orchestrator 编排。)

## 二、五个震撼点

1. **N 张文书进,一条主线出**:刑部判 + 户部奏 + 工部策……一堆 court_doc 进 → 单屏**一件事 + 按序下一步 + 谁做 + 截止 + 卡点**,部门原文藏二级。客户不再自己做"综合题"。
2. **去冲突,不和稀泥**:户部说"先签锁价"、刑部说"验收没改不能签"——丞相不是两边都贴,而是**裁定先后**:"先改验收(刑部红),改完当天签(户部黄),否则尾款口子没堵"。冲突显式列出 + 给裁定理由,不藏。
3. **拟旨草案,一键开工**:主线末尾自动生成**拟旨**(refined_edict:派谁、查什么、要什么格式回奏),接 shangshufang 的"丞相拟旨→皇上确认→军机处会审"闭环。客户点"确认开工"就把主线推成真实任务,不用自己翻译成指令。
4. **下一步最小行动(治"看完不知干啥")**:每条主线只露**第一个可立刻做的动作**(owner+route+due+blocker),其余折叠。治朝堂老毛病:部门给了一堆"应该",丞相只给"现在先点这个"。
5. **可路由可复盘的主线**:主线每一步带 route(进哪个部门/蜂群)、blocker(被什么挡住)、灯(绿开工/黄改/红挡/黑落刑部),归史馆。下一轮回来直接看"上次主线走到哪、哪步卡住",不是从零重述。

## 三、出场大神(丞相是协调者,点名跨域判官)

丞相本身**不抢专业话语权**(钱归户部、风险归刑部),它的大神是**裁先后、权衡全局**的"跨域判官",在"多部门结论打架、要排一条主线"时点名:

- **munger-perspective(多元思维 / 反过来想)**:主排序判官。"哪一步做错最致命?反过来想——先避免最大的坏,再追最大的好。"用来给 items 定红黄绿与先后,避免被单部门局部最优带偏。
- **drucker(管理 / 要事第一)**:聚焦判官。"哪件是真正要紧的一件事?其余都往后排。"压制"六件并列"的伪主线,逼出唯一首步 + owner。
- **jeff-bezos-perspective(长期 / 不可逆判断)**:闸门判官。遇到不可逆(签字、烧钱、架构分叉)主线步,标 single-threaded owner、要求 signed=true,并建议升钦天监前置参谋,而不是让主线默默推过去。

**用法铁律**:大神只调**先后与取舍**,不改各部门的专业结论原文(那是越权)。每条被大神改过排序的 item,`evidence_ref` 必须回链原部门文书,理由写进冲突裁定里——**丞相能裁先后,但不能凭空造结论**。涉及客户/资金/生产/权限/合规的不可逆步,仍按协议进御史闸 + 钦天监。

## 四、文书:相旨(doc_type=edict)

沿用全院"一份内容,两副面孔"。丞相文书在印章品牌系统里是 **相印 / 主色朱紫**:

| 部门 | 文书类型(doc_type) | 官印 | 主色 |
|---|---|---|---|
| 刑部 | 判决书(verdict) | 天平印 | 朱砂红 |
| 户部 | 奏报(memorial) | 算盘印 | 金 |
| 钦天监 | 天象策(forecast) | 星盘印 | 靛蓝 |
| 史馆 | 卷宗(archive) | 史笔印 | 墨 |
| **丞相** | **相旨 / 主线(edict)** | **相印** | **朱紫** |

### 4.1 机器面 —— court_doc 契约(套 `schemas/court_doc.json`)

丞相把 `headline` 用作**这一件事**,`items` 用作**按序的下一步**(每条带 owner/route/due/blocker,塞进既有 title/fix/evidence_ref),`actions` 用作**确认开工**:

```json
{
  "doc_type": "edict",
  "dept": "prime_minister",
  "case_id": "ZX-20260701-014",
  "light": "yellow",
  "headline": "先改验收口子,改完当天就能签 —— 别急着先锁价",
  "shielded": "替你把'六部各说各话'压成一条:先做哪件、谁做、卡在哪",
  "items": [
    {"level":"red","title":"① 工部改验收条款(owner=工部·李,route=xingbu复核,due=今日,blocker=无)","odds":"高","impact":"不改→¥80万尾款口子","fix":"按刑部判决补'验收以X报告为准,7日不反馈视同通过'","evidence_ref":"truth://XB-20260630-007"},
    {"level":"yellow","title":"② 验收改完当天签锁价单(owner=兵部·王,route=hubu复核,due=今日,blocker=依赖①)","odds":"中","impact":"晚签→本月锁价价位失效","fix":"①绿灯即触发","evidence_ref":"truth://HB-20260630-022"},
    {"level":"green","title":"③ 归档主线+留痕(owner=史馆,route=archive,due=签字后,blocker=无)","odds":"低","impact":"无","fix":"自动","evidence_ref":"truth://SG-..."}
  ],
  "actions": ["confirm_and_dispatch","escalate_qintianjian","reorder_items","archive_mainline"],
  "provenance": {
    "advisors": ["munger-perspective","drucker","jeff-bezos-perspective"],
    "archive_id": "ZX-20260701-014",
    "gate": "pending",
    "rag_grounded": false
  },
  "source_label": "MIXED",
  "signed": false,
  "seal": {"stamp":"相印","color":"朱紫","sealed_archive":null}
}
```

机器面直接接 shangshufang(`refined_edict` ← headline+items 拼成拟旨)与 chaotang_orchestrator(`actions.confirm_and_dispatch` → `assemble_flow` 推真实会审);可解析、可路由、可回链各部门 evidence。

### 4.2 人类面 —— 卷宗×现代渲染(在前端仓)

同一 JSON 渲染成有仪式感的**主线卡 / 相旨**:

```
┌─────────────────────────────────────┐
│ 📜 丞相相旨        〔相印·朱紫〕案号ZX-014 │   ← 楷体标题 + 朱紫相印
│ ─────────────────────────────────── │
│ 🟡 现在先做这一件:                     │   ← 结论一行在前,人话不术语
│   先改验收口子,改完当天就能签           │
│ 丞相替你压成一条:别急着先锁价           │   ← 心意①(为你挡了乱)
│ ─────────────────────────────────── │
│ 按这个顺序走        〔点击展开部门原文〕  │   ← 渐进展开,六部文书藏二级
│  ①🔴 改验收  工部·李 今日  →补X报告条款  │
│  ②🟡 当天签  兵部·王 今日  依赖①        │
│  ③🟢 归档留痕 史馆     签后            │
│ ─────────────────────────────────── │
│ [确认开工] [问钦天监] [调整顺序]        │   ← confirm_and_dispatch / escalate
│ 主线已封存 · 史馆ZX-014 〔骑缝相印〕      │   ← 心意②③:主心骨具象化
└─────────────────────────────────────┘
```

**艺术方向**:楷体/宋体标题 + 朱紫主色(帝王近臣之色,区别于刑部朱砂红) + 宣纸微纹 + 现代无衬线正文 + 红黄绿灯排序卡。庄重而清晰,一眼看到"先做哪件"。

## 五、心意三触点

1. 开头"**丞相替你压成一条**":把"六部各说各话→一条主线"这个价值直接说出来(shielded)。
2. 落款"**主线已封存**"骑缝相印(主心骨具象 + 下一轮可续,不用重述)。
3. 结论永远**人话在前、部门原文在后**:先给"现在先做这一件",部门判决/奏报/赔率折叠在二级——**决策不是知识堆叠**。

## 六、落地

- **后端 MVP(本仓)**:复用既有 `src/chaotang_orchestrator.py` 的 `draft_decree`(丞相拟旨)+ `assemble_flow` 的 L0 丞相理解 / L4 丞相汇总;新增**主线聚合器**:吃多部门 court_doc → 去冲突 → 输出 §4.1 的 `doc_type=edict` 主线 JSON。
- **接 shangshufang(本仓)**:`src/shangshufang_loop.py` 的 `draft_edict`/`review_memorial_for` 已是"原问→拟旨→会审"骨架;丞相主线作为其上层收口——把 `ministry_outputs` + `conflict_summary` 压成单条 headline + 排序 items,`next_best_action` 映射到 `actions`。
- **大神调序(本仓)**:`route_department_task` 之上加一层 munger/drucker/bezos lens 只调 items 先后与灯色,不改部门结论;不可逆步强制 `signed` 门 + 御史/钦天监升级。
- **契约(本仓)**:直接套 `schemas/court_doc.json`,`doc_type=edict` + `dept=prime_minister` + `seal.stamp=相印`,无需新 schema。
- **人类面渲染(前端仓)**:主线卡 / 相旨(朱紫 + 相印 + 排序展开) → chaotang-web-lyt,不在本仓做。

prime_minister: 六部各说各话,丞相只回你一句"现在先做这一件、按这个顺序",再附一道能一键开工的拟旨。
