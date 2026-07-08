# 史馆 · 前端 UI 策划(卷宗 × 现代 · 史笔印 / 墨)

> 给前端仓 `chaotang-web-lyt`。后端只产 **court_doc(机器面 JSON,`schemas/court_doc.json`,`doc_type=archive`)**;本文是把它画成史馆那张脸的渲染策划。
> 上游契约见 `docs/dept_design/frontend_handoff.md`(渲染纪律真相源)、`docs/dept_design/shiguan.md`(部门定位)、`docs/dept_design/README.md`(11 部门印章表)。
> 史馆视觉身份:**doc_type=archive · dept=shiguan · 官印=史笔印 · 主色=墨**。统一卷宗骨架,换印换色,不另起一套组件。

---

## ① UI 定位:史馆这张脸要让客户一眼信什么

史馆不是"文件柜列表页",是客户的**护身符**与系统的**复盘脑**。整个史馆界面只回答三个问题,UI 必须把这三问做成第一屏可见的主结构,而不是埋在档案列表里:

1. **出事了,调当时的依据**(护身符 / 保命)
   - 客户被追责时一键调出"我当时基于这些已知事实做了合理决策"。
   - UI 落点:每张卷宗卡的 `evidence_ref` 必须**可回链可展开**;顶层有醒目的「一键调取护身符」入口(导出带签字+证据链的卷宗包)。

2. **过往同类怎么处理**(以史为鉴 / 检索)
   - 新议案进来先翻旧卷,把"上次这类客户 / 这类风险我们怎么判的"端到眼前。
   - UI 落点:**证据链时间线**(编年体)+ **案件检索**(纪事本末:按部门 / 风险类型 / 客户检索同类卷宗)。

3. **系统从每次决策学到了什么**(自进化 / 飞轮)
   - 失败记忆、签字学习、朝会沉淀三股信号在转还是空转,客户看得见。
   - UI 落点:**复盘飞轮看板**,直接读后端 `health()` 的 PASS/FAIL 计数,把"系统在学习"做成可账面审计的指标,而非口号。

**一句话定位**:左边是一卷一卷的护身符(出事能调),右边是一个会进化的脑(每案都学)。卷宗庄重、可回链、可导出;飞轮透明、可审计、不吹牛。

---

## ② 主屏卷宗卡 ASCII(套 court_doc / archive)

主屏 = **卷宗信息流**(编年倒序)+ 单卷展开。下面是单张 archive 卡的人类面渲染,字段全部来自 `court_doc.json`:

```
┌──────────────────────────────────────────────────────────┐
│ 📜 史馆卷宗                       〔史笔印〕  案号 SG-20260701-031 │ ← headline 区:楷体标题 + 墨色官印 + case_id
│ ────────────────────────────────────────────────────────── │
│ 🟢 已封存 · 当时依据齐全,判赔合理可保命                          │ ← light(green) + headline,人话一行在前
│                                                              │
│ 🛡 史馆为你留底:这单决策的全部当时依据 + 御史签字,日后追责可一键调取  │ ← shielded(心意①,高亮心意条)
│                                                              │
│ 卷宗要点 / 以史为鉴                              〔点击展开 ▸〕   │ ← items 列表,渐进展开;红项置顶
│  1 🟢 决策依据完整                         → 回链证据 ⛓        │   item.level/title + evidence_ref 可回链
│  2 🟡 成交率明细缺 per-case 数据   中·复盘失真  → 需补数·待考 ▾  │   odds/impact 右对齐;fix 折叠二级;无源→待考
│  3 🟢 教训已喂飞轮                         → 下次同部规避 ⛓     │
│                                                              │
│  〔接地:法条/重算接地〕   〔御史闸:passed〕   〔来源:LIVE_SWARM〕 │ ← provenance.grounding / gate / source_label
│ ────────────────────────────────────────────────────────── │
│  [翻旧卷]   [查证据]   [喂飞轮]   [导护身符]                     │ ← actions[] 映射底部按钮
│                                                              │
│  留痕已封存 · 史馆 SG-20260701-031          ╲〔骑缝史笔印〕╱     │ ← seal.sealed_archive(心意②③,骑缝朱印=护身符具象)
└──────────────────────────────────────────────────────────┘
```

字段映射表(史馆专属取值):

| court_doc 字段 | 史馆渲染 | 取值约束 |
|---|---|---|
| `doc_type` = `archive` + `dept` = `shiguan` | 标题"史馆卷宗" + 套 archive 模板 | 固定 |
| `seal.stamp`=史笔印 / `seal.color`=墨 | 右上官印 + 主色调(墨) | 固定身份色,不跟随灯色 |
| `light` | 顶部灯 + 卡边框色 | green/yellow/red/black 四色 |
| `headline` | 一级结论(楷体大字,人话在前) | 必有 |
| `shielded` | 🛡 心意条(护身符价值前置) | 可空,空则隐藏整条 |
| `items[].level` | 行首灯点,**red 置顶** | red/yellow/green |
| `items[].title` | 要点标题 | 必有 |
| `items[].odds` / `.impact` | 行右对齐(中 · 复盘失真) | 可空,null 则不占位 |
| `items[].fix` | 折叠在二级("怎么改就能过") | 可空 |
| `items[].evidence_ref` | ⛓ **回链徽标**,点开展开原始证据 | 见 §5 回链规则;null → 标"待考" |
| `actions[]` | 底部按钮 | `open_annals`/`trace_evidence`/`feed_flywheel`/`export_amulet` |
| `provenance.grounding` | 落款接地标签 | rag→"法条/重算接地" / deterministic→"重算接地" / none→灰条"未接地·需人工" |
| `provenance.gate` | 御史闸状态 | pending → 盖"需人工复核"半透印且禁绿 |
| `provenance.advisors` | 二级"史官团出场"列表 | deming / andrew-ng / charity-majors / karpathy / jeff-bezos |
| `source_label` | 来源真实性小标 | LIVE / LIVE_SWARM / MIXED / FALLBACK / DEMO |
| `seal.sealed_archive` | 骑缝朱印 + 封存号 | 即护身符可导出锚点 |
| `signed` | false → "未签字"水印,不可逆动作禁点 | bool |

---

## ③ 组件清单

### 3.1 共享卷宗组件(全院复用,史馆只配印/色)

| 组件 | 职责 | 关键 props(吃 court_doc) |
|---|---|---|
| `CourtDocCard` | 卷宗卡骨架(标题/灯/items/落款/印) | `doc:CourtDoc`, `sealConfig` |
| `VerdictLight` | 红黄绿黑灯 + 边框联动 | `light` |
| `SealStamp` | 官印渲染(换印换色) | `stamp=史笔印`, `color=墨` |
| `KissmarkBar` | 心意条(shielded) | `shielded` |
| `ItemList` | items 渐进展开,red 置顶,odds/impact 右对齐 | `items[]` |
| `ProvenanceFooter` | 接地/御史闸/来源/大神 落款 | `provenance`, `source_label` |
| `ActionBar` | actions[] → 按钮;signed=false 置灰 | `actions[]`, `signed` |
| `CrossSeal` | 骑缝朱印 + 封存号 | `seal.sealed_archive` |
| `PendingOverlay` | gate=pending 半透"需人工复核"印 | `gate` |

> 复用要求:史馆**不得 fork 这套组件**,只传 `sealConfig = { stamp:'史笔印', color:'墨' }` 与 `doc_type='archive'` 模板槽。

### 3.2 史馆特有组件(护身符 + 复盘脑)

| 组件 | 职责 | 数据来源 |
|---|---|---|
| `ArchiveTimeline`(证据链时间线) | 编年体竖向时间轴,卷宗按 `case_id` 日期倒序;节点展开即 `CourtDocCard`。骑缝印做节点锚 | `GET /api/archive/list`(编年序) |
| `EvidenceChainPanel`(证据回链面板) | 点 `evidence_ref` 展开右抽屉:显示 truth_ledger 原始行 + provenance 鉴权态(authenticated/orphan/unknown);无源显式"待考" | `evidence_ref` 解析(见 §5) |
| `CaseSearch`(案件检索) | 纪事本末式检索:按 部门 / 风险类型 / 客户 / 关键词 翻旧卷,命中即"以史为鉴"卡片流。对应后端 `knowledge_pre_retrieval(scope=["shiguan_annals"])` | `GET /api/archive/search?q=&dept=&risk=` |
| `FlywheelBoard`(复盘飞轮看板) | 三股信号各一块,显示在转/空转(PASS/FAIL)。**三股刻意分开展示,不合并成一个数**,与后端三表设计一致 | `GET /api/archive/flywheel/health` |
| `AmuletExport`(一键调取护身符) | 顶层醒目按钮 + 卡内 [导护身符]:把卷宗打包成 PDF/JSON(headline + items + evidence_ref 全链 + 签字 + 骑缝印),客户随时下载留底 | `POST /api/archive/export`(对应 action `export_amulet`) |

**FlywheelBoard 三股信号(对齐后端)**:

```
┌─ 复盘飞轮 · 系统在学吗 ──────────────────────────────┐
│ 朝会沉淀  🟢 在转   今日回流 N 条 · error 状态已挡(脏燃料不入库) │ court_flywheel.archive_session_to_knowledge
│ 失败记忆  🟢 在转   命中"重复犯的错" M 次 · 已注入下轮 flow      │ failure_memory(Reflexion)
│ 签字学习  🟡 空转   本周无 reject 教训沉淀(无人类驳回信号)       │ signoff_learning
│ ──────────────────────────────────────────────── │
│ 燃料体检:authenticated K / orphan 0 / unknown 0  〔可账面审计〕  │ truth_ledger provenance 鉴权
└──────────────────────────────────────────────────┘
```

---

## ④ 状态规范

**灯(light)四态**:green 墨绿描边 / yellow 琥珀 / red 朱砂 / black 玄黑(black 表示已落刑部深查的归档)。灯只反映 `light` 字段,**前端不得美化成更乐观**(接 handoff 纪律 C8)。

**无源 → "待考"**:`evidence_ref` 为 null 或 `provenance.grounding=none` 的结论,一律渲染灰色"待考"标签,**禁止渲染成绿灯/权威结论**(接宪法 C6 禁假 PASS)。提示文案:"无依据,需人工补证"。理由:史馆铁律——编造的历史比没有历史更危险。

**封存态(sealed)**:`seal.sealed_archive` 非空 = 已封存。卡片加骑缝朱印 + 封存号,边角微做"封存"质感(轻微压暗 / 角标),表示该卷已不可改写,只可调取/导出。

**鉴权态(provenance)**:证据回链面板按 truth_ledger 标:
- `authenticated`(run_id 可查)→ 绿色"可信"
- `orphan`(疑似投毒)→ 红色"疑似脏源,勿采信"
- `unknown`(未鉴权)→ 灰色"未鉴权"

**门禁态**:`gate=pending` → 整卡盖半透"需人工复核"印,禁绿、不可导护身符;`gate=blocked` → 红条;`gate=passed` 正常;`gate=n/a` 不显。

**签字态**:`signed=false` → "未签字"水印,`export_amulet` 等不可逆动作按钮置灰。

---

## ⑤ 交互(分档 P0–P3 + 回链 + 检索)

按 handoff 复杂度分档,史馆动作落档:

| 档 | 含义 | 史馆动作 | 交互要求 |
|---|---|---|---|
| **P0** | 只读浏览 | 翻时间线、看卷宗卡、看飞轮看板 | 无确认,直接渲染 |
| **P1** | 检索/展开 | `CaseSearch` 翻旧卷、展开 items、`open_annals` 翻编年原文 | 即时响应,无副作用 |
| **P2** | 证据回链 | `trace_evidence`:点 ⛓ 展开 `EvidenceChainPanel`,看原始 truth_ledger 行 + 鉴权态 | 右抽屉展开;orphan 源红色警示 |
| **P3** | 不可逆 / 写动作 | `export_amulet`(导护身符)、`feed_flywheel`(喂飞轮) | **需 signed=true 才可点**;导出前二次确认"将生成对外可追责卷宗包" |

**证据回链展开(核心交互)**:
- 每条 item 的 `evidence_ref` 是可点徽标。点击 → 解析协议 scheme:
  - `truth://shiguan/<case_id>#authenticated` → 拉 truth_ledger 对应记录,显示行号/run_id/鉴权态。
  - `annals://shiguan_annals/<period>` → 拉编年体史册条目(纪事 + 附议 + 史评)。
  - `truth://flywheel/health` → 跳 `FlywheelBoard` 对应信号。
- 解析失败 / 源为 null → 显示"待考 · 无可回链证据",不报错崩卡。

**检索过往(以史为鉴)**:
- `CaseSearch` 支持 部门 / 风险类型 / 客户 / 关键词;命中结果以"上次这类我们怎么判"卡片流呈现,每张可一键"引为参考"附到当前议案旁。
- 检索结果带相似度/命中来源标注,空命中显式"暂无同类旧卷,本案为首例"。

---

## ⑥ 空 / 加载 / 错误态

| 态 | 触发 | 渲染 |
|---|---|---|
| **空·时间线** | 尚无任何封存卷宗 | "史馆待立卷 · 第一份结案归档后,这里会长出你的护身符卷轴" + 引导去结案 |
| **空·检索** | 检索无命中 | "暂无同类旧卷,本案为首例 —— 它将成为后人之鉴" |
| **空·飞轮** | health 三股皆 0 | "飞轮待启动 · 暂无沉淀信号(非故障)",不报红 |
| **加载** | 拉列表/检索/health | 卷轴骨架屏(宣纸纹占位 + 灯位/印位骨架),避免布局抖动 |
| **错误·取数失败** | API 5xx/超时 | "调阅失败,卷宗未损" + 重试;**绝不**用空数据冒充"无风险" |
| **错误·证据断链** | evidence_ref 解析失败 | 面板内"证据回链断裂 · 标记待考并上报",不静默吞掉(接 coding-style 错误处理) |
| **降级** | source_label=FALLBACK/DEMO | 卡顶显式"演示/降级数据,非真实封存",禁导护身符 |

---

## ⑦ 响应式

| 断点 | 时间线 | 卷宗卡 | 飞轮看板 |
|---|---|---|---|
| ≥1440 桌面 | 竖向时间轴 + 右侧卷宗详情双栏 | 完整 ASCII 布局,odds/impact 右对齐 | 三股横排 + 燃料体检 |
| 1024 | 时间轴 + 详情可切 | items 右列改下挂 | 三股横排 |
| 768 平板 | 单栏时间轴,点节点全屏卷宗 | 心意条 / 落款堆叠 | 三股两行 |
| ≤375 移动 | 单栏卡片流,返回键回时间线 | 楷体标题缩级,evidence_ref 改底部抽屉 | 三股竖排,体检折叠 |

- 证据回链面板:桌面右抽屉,移动改底部 sheet。
- 骑缝印在窄屏缩为右下角章,不抢内容。
- 楷体标题用 `clamp()` 缩放,正文保宋体可读。

---

## ⑧ 对接 chaotang-web-lyt

**契约**:唯一数据源是 `schemas/court_doc.json`(`doc_type=archive`)。前端按本文渲染,后端不在本仓做 UI。

**建议接入顺序**(接 handoff §5):
1. 先用已有 `CourtDocCard` 通用卷宗组件吃一份史馆 archive 样例(`docs/dept_design/shiguan.md` §4.1)跑通渲染,只配 `sealConfig={stamp:'史笔印',color:'墨'}`。
2. 再加史馆特有四件套:`ArchiveTimeline` / `CaseSearch` / `FlywheelBoard` / `AmuletExport`。
3. 最后接真实 API。

**后端已就绪/约定的接口**(真字段,本仓 `flow_shiguan_archive.yaml` + `scripts/archive_manager.py`):
- `POST /api/archive/case` — 结案归档,返回 archive court_doc(四官流水线:决策提炼官→鉴往提炼师→史册撰写官→归档索引员→QA)。
- `GET /api/archive/list` — 编年序卷宗列表(喂 `ArchiveTimeline`)。
- `GET /api/archive/search` — 纪事本末检索(喂 `CaseSearch`,对应 `knowledge_pre_retrieval scope=shiguan_annals`)。
- `GET /api/archive/flywheel/health` — 三飞轮 PASS/FAIL + 燃料鉴权计数(喂 `FlywheelBoard`,对应后端 `health()`)。
- `POST /api/archive/export` — 导护身符包(对应 action `export_amulet`)。

> 说明:list/search/export/health 的 REST 形态以 `docs/dept_design/shiguan.md` §6 落地清单为准,目前后端明确就绪的是 `POST /api/archive/case` 与三飞轮接线;其余按需补薄包装(`build_<dept>_*` 套路),前端先以 case 样例 + mock list/health 起步,真接口就绪即切换,不画饼。

**必守渲染纪律(照搬 handoff,史馆加严)**:
1. `gate=pending` / `grounding=none` / `evidence_ref=null` → 绝不渲染绿灯,显式"待考·需人工"。
2. 灯色照搬后端,前端不美化。
3. `signed=false` 的导护身符/喂飞轮按钮置灰。
4. 史料/编年原文默认折叠二级,一屏先给结论(决策不是知识)。
5. orphan 鉴权源必须红色警示——脏燃料不进护身符。

---

shiguan-ui: 一卷一护身符(出事点 ⛓ 调当时依据)+ 一个会进化的脑(飞轮看板 PASS/FAIL 可审计),套全院 court_doc/archive 骨架换史笔印·墨色,无源一律"待考"不美化。
