# 朝堂部门宪法(全院铁律)

> 首次定稿 2026-07-01;2026-07-03 依据诸司现状核查校准 C8、新增 C9(展示层真实性护栏)。
> 所有部门(现 11 个 + 将来新增)**必须遵守**本宪法。
> 由 `scripts/validate_dept_conformance.py` 强制校验——违宪红灯,新部门不守宪不得入院。
> 配套架构见 [court_pipeline_layering.md](court_pipeline_layering.md)。本宪法把缺陷护栏直接写成条款。
> 宪法条款与 [dept_design/README.md](../dept_design/README.md) 现状表冲突时,以现状表(逐代码核实)为准;
> 冲突本身即视为宪法**待校准**信号,不得默认宪法条款优先——见文末"现状对齐"。

## 七条铁律(可被校验)

**C1 · 四层分工不互抢**
部门走"手(蜂群执行)→ 嘴(大神/律师参谋)→ 闸(御史裁决)→ 脸(court_doc 呈现)"。

**C2 · 大神只参谋,不放行**(堵缺陷#3)
大神/律师只供警示/建议/失败路径/法条接地,名字只进 `provenance.advisors`;
**绝不出现在 gate 决策路径**——定灯只能是御史/harness 的确定性规则。校验器扫这条。

**C3 · court_doc 是唯一聚合标准**(堵缺陷#4)
部门对客产出一律是 `schemas/court_doc.json`;不得新立第二套聚合层。
共用骨架,部门特有内容放可选扩展字段(堵缺陷#2),不另起 schema。

**C4 · 默认最简,按需升档**(P0–P3)
入口先过 `pipeline_tier`:P0 直答 / P1 单参谋 / P2 部门蜂群 / P3 会审。
**默认不开蜂群**;只有任务"挣到"才升档。

**C5 · 不确定往上抬,不往下漏**(堵缺陷#1)
分档拿不准时**升一档**,绝不降档省事;御史对 P0/P1 产出也做廉价抽检,防高风险任务被轻问绕过。

**C6 · 接地凭证据,缺证据降级不放行**(堵缺陷#5;借工部融合)
下结论必须有证据,**两种接地源**(`court_doc_builder` 统一):
  - **RAG 接地**(法务/参谋):`gate_conclusion` + 真实命中法条/证据库;`rag_hit` 只能系统检索得出,不接受自报。
  - **确定性重算接地**(工程/财务,借工部 `run_sizing_gate`):重新推导真值对比 claimed,对得上才算接地。
**禁假 PASS**:任一接地源缺证据(RAG 未命中 / 重算 UNKNOWN)→ 文书降级 `pending`/`需人工`,**绝不出绿灯**。
不可逆动作必须人工签字(P3 `needs_signoff`)。

**C8 · 丞相只调序,不得改写**(上书房收口护栏;2026-07-03 校准)
丞相层聚合各部门 court_doc 时**只能排序**,物理上不得改写任一部门的灯/原文;
主线总灯不得比最差部门更乐观。

本条原钦定实现是 `assemble_mainline`(防篡改、已测、`assert_mainline_preserves` 会拦截软化红灯),
但截至 2026-07-03 诸司现状核查(见 [dept_design/README.md § 诸司现状](../dept_design/README.md))
`assemble_mainline` **零生产调用方**,真正在跑的丞相/军机处生产逻辑是 `src/shangshufang_loop.py`。

**裁决**:`shangshufang_loop` 是唯一在产环境的丞相入口,`assemble_mainline` 正式退役,不得再接生产,
避免制造第 4 个"综合回奏"分支。但 `shangshufang_loop` 目前**不合宪**——其六部意见来自内部模板
(`_rule_department_swarm`,`source_label=FALLBACK`),未读取任何部门真实 `court_doc` 产出,违反 C3。
此项判定为**已知违宪、待修复**,不得以"已接线"对外宣称;修复口径见 C9。

**C9 · 展示层不得冒充部门判断**(2026-07-03 新增,堵"引擎真但零路由/零展示"同款洞)
一切对客展示端点(上书房 `/api/shangshufang/*`、`/api/chaotang/study/*`、`/api/throne/*` 等)呈现的
"部门意见/奏折",必须来自该部门已注册的真实 `court_doc` 产出或真实 API 调用(如
`/api/bingbu/battlecard`、`/api/gongbu/review`、`/api/yushi/review`、`/api/intel/brief`、
`/api/chaotang/hubu/cashflow/preview`);**不得**用内部模板、关键词规则或角色扮演 LLM 生成的文本
冒充部门正式判断。凡未接入真实引擎的部门意见,展示层必须显式标注`模拟/未接线`
(如 `source_label: FALLBACK`),不得使用与真实文书相同的呈现样式。
**违反本条即使测试全绿也判"违宪"**——测试覆盖模板输出不构成合宪证据。

**C7 · 一切留痕可追溯 + 喂飞轮**
每次产出归档史馆(`truth_ledger`/`shiguan_archive`),带证据链 + 来源标签;复盘喂自我进化飞轮。

## 校验口径(validate_dept_conformance.py)

逐部门检查:
- 有设计文档 `docs/dept_design/<slug>.md`(C1 落档)
- 设计引用 `court_doc`(C3)
- 在 `advisor_protocols.yaml` 有参谋席(C1 嘴层)
- 实现态:有无接 court_doc 的装配/判决引擎(报告"已实现/仅设计")
全局不变量:`global_contract` 仍声明"大神不是放行人"(C2 源头)。

## 遵宪等级

- **L0 仅设计**:有设计文档 + 守 C1/C3 口径(当前多数部门)。
- **L1 已实现**:有接 court_doc 的引擎(当前仅刑部 `xingbu_verdict`)。
- **L2 已接蜂群**:court_doc 接成蜂群装配末段 + 御史闸(待 A' 深焊)。

目标:全院先到 L0(守宪),再逐部门升 L1/L2。

丞相(`shangshufang_loop`)当前判定:**L0 且已知违宪**(C9)——有真实生产入口,
但六部意见未接真实 `court_doc`,不计入 L1,待六部真实端点逐个接入后再升级。

## 现状对齐(治理规则,2026-07-03 新增)

本宪法条款与 `docs/dept_design/README.md` 的"六部现状/诸司现状"表**必须保持一致**。
两者冲突时,以现状表(逐代码核实的最新真相)为准,冲突本身视为本宪法**待校准**信号。
任何改动涉及现状表列出的模块(`shangshufang_loop`、`assemble_mainline`、真实部门 API、
`court_doc_builder`、上书房/study/throne 展示端点)时,必须同步检查本文件对应条款是否仍成立。
**待办**(未实现,不在本次范围):把这条一致性检查接入 `scripts/commit_closeout_check.py`,
在相关文件变更时自动提醒复核宪法条款。
