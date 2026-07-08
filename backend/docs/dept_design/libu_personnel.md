# 吏部 · 人员/角色/权限/绩效/任免/责任归属设计

> 定稿 2026-07-01。对齐第一份部门设计 `xingbu.md` 与全院文书契约 `schemas/court_doc.json`。
> 视觉基调沿用全院:**卷宗×现代融合** —— 古典骨(官印/案号/骑缝/楷体)+ 现代肉(灯/卡/渐进展开)。
> 协议定义见 `harness/chaotang_department_protocol/departments.yaml` 的 `libu_personnel`。
> 边界:本仓做**机器面(JSON 契约 + 后端)**;**人类面(任免卡渲染/CSS/组件)在前端仓 chaotang-web-lyt 实现**。

## 一、吏部定位

吏部 = 客户的**责任定心丸**,不是考核鞭子。卖的底气是:**"这件事出了问题,我知道找谁;这个权限给了谁,有据可查;这份功劳是真做出来的,不是自评刷的。"**

(协议定义:人员、角色、权限、绩效、任免、责任归属;决定谁负责、谁复核、谁能自动化执行、功绩如何记录;无 owner、权限过大、职责冲突、无人签字自动 yellow/red。)

本系统里吏部有一层别人没有的身份:它同时管**人**,也管 **agent / 大神 / skill 的"任免与权限"**。
"谁能下结论"在本仓不是口号,而是落在代码里的**分席**——`persona_registry` 把每位大神判成**判官席(can_conclude)**或**观点席(rag_required)**,`gate_conclusion` 拦掉没资格下结论的发言,`persona_eval` 的 `promotion_gate` 决定谁能升判官。这套就是 agent 世界的吏部:**任命、授权、考功、升降席。**

## 二、五个震撼点

1. **一句话进,一张任免/责任判出**:大白话进(谁负责这块?这权限该给谁?)→ 单屏任免书(灯+谁是 owner+替补+权限边界+一句话补漏),RBAC 细则藏二级。无人负责/权限过大/职责冲突自动亮黄红。

2. **责任图秒级追责(accountability_map)**:每个跨部门任务强制有 `owner / reviewer / approval_path / backup`。点任意一个结论,反向链到"谁拍的板、谁复核、谁签字、出事找谁",对齐协议 `function_upgrades`——**没有 owner 的任务不准往下走。**

3. **给 agent/大神评绩效、定权限、升降席(本系统独有)**:吏部把 `persona_registry` 的分席 + `persona_eval` 的考功做成产品。大神不是凭名气坐判官席,而是**靠 golden 判例过 `promotion_gate` 才升判官**;证据变薄/eval 掉线就降回观点席强制 RAG。`merit_record` 只记**真实结果和可复用学习,不奖励自评分数**(协议明文)。

4. **权限边界 = 自动化闸(接御史)**:L4/L5 自动化、客户承诺、资金动作**必须有人类负责人**(协议 `gate`)。吏部把"谁能自动执行到哪一级"写成权限位,缺人类 owner 时直接 `signed=false` 卡死,联动 `yushi` 全局闸——**高权限不是默认,是被授予且留痕的。**

5. **任免留痕做成护身符**:每次任命/授权/升降席自动归档 `shiguan`(史馆),带依据、eval 分、签字人。任命类输出**只学系统改进,不学老板对人的偏好**(协议 `appointment` 蜂群铁律)——把"任人唯亲"挡在机器面之外。

## 三、出场大神(人事分席,带知识库)

`config/advisor_protocols.yaml` **没有独立 `personnel` profile**。吏部对应的 `appointment` 蜂群挂的是 `governance` profile(owner=吏部/三省,level=irreversible)。本设计的取法:

- **底座取 `governance` profile**:`richard-posner`(权责的法经济:授权边界 vs 滥用成本)、`bruce-schneier`(权限即攻击面:最小权限/越权检测)、`deming`(系统而非考核个人,反对靠 KPI 制造恐惧)、`charity-majors`(谁背 pager = 谁有 owner)、`andy-grove-perspective`(任免与组织产出)。
- **必须补 `drucker`(管理/人事最贴)**:`drucker` 当前挂在 `finance` profile,但他是"管理即让平凡人做出不平凡事""目标管理(MBO)""用人之长"的人事原典——**吏部场景应显式借调 `drucker`,并建议未来在 `advisor_protocols.yaml` 新增 `personnel` profile 收编他。**(暴露矛盾:profile 缺位,这里先借调不默选。)
- **谁判官谁顾问**:`drucker` + `deming` 坐**判官席**(can_conclude:任免/绩效定调、责任图拍板),证据厚度过 `JUDGE_MIN_BYTES` 且过 `persona_eval`;`posner / schneier / charity-majors / andy-grove` 为**观点席顾问**,发言**一律 RAG 强制(`gate_conclusion`)**——讲权限边界必须命中真规则/真红线,没命中只提示"需人工 owner 拍板"。**幻觉式任命比不任命更危险。**
- 每位配 golden 任免/绩效判例,过 `promotion_gate` 才升判官,同一套飞轮(吏部自己也用这套给自己的大神考功——吏部管吏部,自指闭环)。

## 四、文书:吏部任免书(套全院文书标准)

**一份内容,两副面孔。** 吏部文书类型 `doc_type=edict`(旨/任免),官印 **印绶印**,主色 **紫**。

### 4.1 机器面 —— CourtDoc JSON(套 `schemas/court_doc.json`)

```json
{
  "doc_type": "edict",
  "dept": "libu_personnel",
  "case_id": "LR-20260701-012",
  "light": "yellow",
  "headline": "可任命 —— 但 L4 自动化缺人类 owner,先补再放行",
  "shielded": "为你挡了:无人负责的资金动作自动执行口子",
  "items": [
    {"level":"red","title":"L4 自动报价无人类 owner","odds":"高","impact":"越权执行/无人追责","fix":"指派人类 owner + approval_path,否则 signed=false","evidence_ref":"truth://run/8842#gate"},
    {"level":"yellow","title":"reviewer 与 owner 同人(自审)","odds":"中","impact":"复核形同虚设","fix":"拆分 reviewer 为独立角色","evidence_ref":"shiguan://LR-012#role"},
    {"level":"green","title":"drucker 已过 promotion_gate 升判官","odds":"-","impact":"可对绩效下结论","fix":null,"evidence_ref":"persona_eval://drucker#pass"}
  ],
  "actions": ["assign_owner","split_reviewer","promote_seat","archive_appointment"],
  "provenance": {
    "advisors": ["drucker","deming","richard-posner","bruce-schneier"],
    "archive_id": "LR-20260701-012",
    "gate": "blocked",
    "rag_grounded": true
  },
  "source_label": "LIVE_SWARM",
  "signed": false,
  "seal": {"stamp":"印绶印","color":"紫","sealed_archive":null}
}
```

机器面喂飞轮/归档/门禁/eval:`items` = 责任/权限问题按赔率排序;`provenance.gate=blocked` 对齐协议"无人类 owner 自动卡";`signed=false` 时不可逆动作(任命/授权)不执行。

### 4.2 人类面 —— 卷宗×现代渲染(前端仓做)

```
┌───────────────────────────────┐
│ 🪪 吏部任免        〔紫印〕案号LR-012 │   ← 楷体标题 + 印绶印(紫)
│ ───────────────────────────── │
│ 🟡 可任命·须先补1处               │   ← 红黄绿灯,结论一行在前
│ 吏部为你挡了:无人负责的资金动作   │   ← 心意①
│ 责任与权限 Top3      〔点击展开〕 │   ← 渐进展开,RBAC 细则藏二级
│  1🔴 L4自动化无owner 高 →指派…   │
│  2🟡 owner=reviewer 自审 →拆分   │
│  3🟢 drucker 升判官 可定绩效      │
│ ───────────────────────────── │
│ [指派owner] [拆复核] [升降席] [存档] │
│ 任免已封存 · 史馆LR-012 〔骑缝紫印〕│   ← 心意②③:责任具象化
└───────────────────────────────┘
```

**艺术方向**:楷体/宋体标题 + 紫主色(印绶/官阶之色)+ 宣纸微纹 + 现代无衬线正文 + 红黄绿灯卡。古典官制的庄重,现代责任图的可读。

### 4.3 印章品牌系统(补吏部一行)

| 部门 | 文书类型 | 官印 | 主色 |
|---|---|---|---|
| 刑部 | 判决书 | 天平印 | 朱砂红 |
| 户部 | 奏报 | 算盘印 | 金 |
| 礼部 | 策案 | 礼器印 | 青 |
| 钦天监 | 天象策 | 星盘印 | 靛蓝 |
| 史馆 | 卷宗 | 史笔印 | 墨 |
| **吏部** | **任免书** | **印绶印** | **紫** |

## 五、心意三触点

1. 开头"**吏部为你挡了什么**":把"没人负责""权限过大"这种隐患说成人话价值(`shielded`)。
2. 落款"**任免已封存**"骑缝紫印(责任图具象成可调取的留痕,`seal` + 史馆号)。
3. 结论永远**人话在前、RBAC 在后**:先说"谁负责、给谁权",再展开角色矩阵和权限位(责任不是术语)。

## 六、落地

- **后端 MVP(本仓)**:
  - 任免/权限/绩效链路输出契约统一改为 §4.1 CourtDoc(`doc_type=edict`)。
  - **复用已有资产,不造轮子**:agent/大神侧直接接 `src/persona_registry.py`(分席 `can_conclude`/`rag_required`、`reconcile_roster`、`gate_conclusion`)与 `src/persona_eval.py`(`promotion_gate`/`score_persona` 做升降席考功)。
  - **人侧 RBAC**:新增吏部 owner/role/permission/approval_path 分配 + `accountability_map` 生成;无 owner、权限过大、职责冲突、无人类签字 → `light` 自动 yellow/red,`provenance.gate=blocked`,联动 `yushi` 全局闸。
  - 借调 `drucker` 入审(并提 issue:`advisor_protocols.yaml` 增 `personnel` profile);任命输出接 `shiguan` 存证,绑 `appointment` 蜂群铁律(只学系统改进)。
  - golden:任免/权限/绩效判例,过 `persona_eval` 才升判官。
- **文书标准 schema(本仓)**:吏部直接复用 `schemas/court_doc.json`,仅 `doc_type=edict` + `seal`(印绶印/紫)区分身份,不另立 schema。
- **人类面渲染(前端仓)**:卷宗×现代 任免卡 + 责任图 + 权限矩阵 → chaotang-web-lyt,不在本仓做。
