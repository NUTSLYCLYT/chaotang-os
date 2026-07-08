# 工部:PACK研发可行性会诊,一句话裁断(守住产线边界)

> 这一程工部只做一件事。其余 9 司见文末 BACKLOG(不建版面、不摆假卡)。
> 2026-06-22 · 4 大神会审(workflow wuz82tt8a)+ Jobs/张小龙/Schneier 取舍。学吏部教训:砍到一根脊 + 先验蜂群产出质量。

## 定位(一句话)
**工部 = 老板手里的工程可行性会诊台**(不是 Jira 看板)。任意 PACK/储能/硬件需求进来,一句裁断(准奏/补证/复核/驳回)+ 把握度 + 缺证 + **绝不能做什么(禁令)**,每个字标清来源真假。
**世界级 = 第一性原理正推(BOM→成本→交期,可溯源到 197 颗真实电芯库)+ 诚实到刺眼 + 守门人在写入门。**

## 脊:PACK研发可行性会诊(唯一真链)
接后端 `flow_pack_rd` 蜂群(成熟:12+ Agent、五维评审门、`cell_library.json` 197 真电芯、IMA 历史笔记、golden case 可证伪)。entry_swarm=`pack_rd`。**其余司无第一条真数据 → 不建。**

## 🔴 命门:咨询 vs 产线 边界 —— 防出参,不是防入参(会审 CRITICAL-1)
`flow_pack_rd` **骨子是产线引擎**:它整包返回 BOM成本/报价/供应商锁定/交期承诺(`presale_cost_estimator`/`supply_chain_feasibility`/`delivery_commitment_gate`)。**危险不在前端传执行参数,在蜂群返回的报价被渲染成"可采纳裁断",老板一点采纳=默认了一份对外报价。**

**硬约束(必须做成测试期物理墙)**:
1. **出参剥离 > 入参约束**:脊 BFF 必须剥离蜂群返回的**具体报价数字/供应商名/毛利率/交期承诺日期**——这些**不渲染为可采纳裁断**,只渲染"此项=产线资产,需转后端军机处/jiqun 确认"(灰锁按钮,前端不自发)。
2. **FALLBACK 本地引擎同样剥**:`gongbu-cto-cpo-office.ts` 本地八司**自己也算 BOM/报价**——后端挂走本地≠安全降级,是绕过守门人。FALLBACK 时强制 `stripProductionFieldsOnFallback()`:物理清空所有数值型产线字段(价格/毛利/交期天数/供应商),只留"造得出吗"的定性判断 + 缺证。
3. 脊 BFF **不写主库 tasks**(咨询类,铁律4)。

## 那张卡(复用吏部范式)
首屏只留 **verdict 一句(帝金大字)+ 一个把握度+来源徽**(`ConfidenceSourceBadge` 直接复用,FALLBACK 给暗灰不给帝金环,这条进 nodetest)。三栏证据链(依据→缺证→🔒禁令),不是三列看板。产线项=灰锁按钮+转后端提示。

## 复用清单(零另造)
| 能力 | 复用吏部已建 |
|---|---|
| 验真承重墙 | `reverify-swarm-trace.ts`(打 /api/swarm/sessions) |
| 诚实闸范式 | 仿 `recruit-envelope.ts` → 新 `gongbu-feasibility-envelope.ts`(含 stripProductionFieldsOnFallback) |
| BFF 范式 | 仿 li-bu recruit route → 新 `gong-bu/feasibility/route.ts`(entry_swarm=pack_rd) |
| 结果轮询 | 仿 recruit/result → 新 feasibility/result |
| 把握度徽 | `ConfidenceSourceBadge`(直接 import) |
| 契约 | **`GongbuCTOCPOOpinion` 已存在**(gongbu-types.ts,字段齐:position/confidence/missingEvidence/forbiddenActions/deliveryCommitmentRisk/humanConfirmationRequired/sourceLabel)——不新造 |

**脊 = libu recruit 真链的"换 entry_swarm=pack_rd + 换信封类型 + 加出参剥离"复刻。**

## 🌡️ 第 0.5 步:先验 pack_rd 蜂群产出质量(blocker,吏部教训·会审 CRITICAL-2)
**接前必做**:在 jiqun 真跑一次 pack_rd 金标(12V 1100Wh 低温储能),核对返回的电芯选型/电量/重量**物理自洽**、真用了 `cell_library` 非编造、quality_score ≥3.8。
- **不及格 → 工部脊冻结,先回后端修蜂群**,别在烂产出上建会诊台。
- (对称参考:吏部 libu 因产品QA C2 错套而结构坏;pack_rd 是产品蜂群,C2 正好该用,大概率健康——但用数据证,不靠推测。)

## 落地顺序
```
第0步 还债:删 gongbu-client 假 KPI 卡(76%/A-/88 硬编)→ 标 DEMO(guard:honesty 转绿)
第0.5步 验蜂群:pack_rd 金标 quality≥3.8 + 物理自洽(blocker)
第1步 接脊:feasibility BFF(entry_swarm=pack_rd)+ 诚实闸(含出参剥离)+ 验真 + 结果轮询 + 回归断言
第2步+ 冻结:②产品规划③SDLC评审 可后接(复刻脊范式);④⑤⑥⑦⑧⑩ 无真数据,不建
```

## 铁律合规
- 不新增版面(溶 gongbu 工位);§13.2#9 出参剥离(命门);sourceLabel 诚实(FALLBACK 不冒充);铁律4(不写tasks + 会审 + 断言「FALLBACK 不标 LIVE_SWARM」「envelope 带产线字段即 throw」);承诺类→humanConfirmationRequired(复用 gate.ts L0-L4)。

---
## BACKLOG(不建,诚实占位)
② 产品规划/竞品(flow_product,可后接) · ③ SDLC评审(flow_sdlc/gongbu_review,可后接) · ④ BOM成本正推(产线,转后端) · ⑤ 交期排期 · ⑥ 质量验收 · ⑦ 现场实施 · ⑧ 交付运作 · ⑨ 交付承诺门(溶进脊作裁决属性,不单建) · ⑩ 技术债治理 —— ④⑤⑥⑦⑧⑩ 无第一条真数据,铁律5 冻结别建。
