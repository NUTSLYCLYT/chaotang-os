# 吏部 CHRO/CAO Office — CourtOS 规格（仓内 source-of-truth, v1）

> 本文是吏部开发的唯一规格源。规划态,**先不改代码**。
> 原始全量叙述见用户 2026-06-17 spec;本文在其上**接到真实代码**:吏部 = 把已落地的
> **户部 / `hubu` CFO Office 模式**照搬给 `personnel`。不发明,镜像已验证的兄弟模块。

## 0. 顶层判断
吏部不是 HR 管理系统,是**人与组织决策系统**(招不招/转不转/辞不辞/组织接不接得住/提成怎么定/行政费为何涨/AI 岗位归谁管/谁负责下一步)。覆盖 CHRO + 行政总监 CAO + OD + HRBP + 招聘/薪酬绩效/员工关系/行政运营 + **AI Agent/蜂群劳动力治理**。

## 1. 在统一朝堂的位置(硬约束)
**不做特殊流程。** 作为 `court_unified_decision_loop_v1` 的 **department skill** 接入(升级现有 `personnel`,不新建)。**禁 `libu_special_review`。**

## 2. 关键现状锚点(真实文件)
| 概念 | 真实位置 | 吏部对应动作 |
|---|---|---|
| 部门注册表 | `src/core/courtos/unified/department-registry.ts`(`personnel` 现为 generic HR) | 升级 `personnel` → CHRO/CAO |
| 契约类型 | `src/core/courtos/unified/unified-types.ts`(`DepartmentCapability`/`DepartmentOpinion`) | 加可选 `libuOpinion?`(镜像 `cfoOpinion?`) |
| **模板:CFO Office** | `src/core/courtos/hubu/`(`HubuCFOOpinion`/`HubuDepartmentWorkOrder`)+ `/api/court/hubu/*` | **整套照搬给 `libu/`** |
| 统一 loop | `src/core/courtos/unified/unified-decision-loop.ts` | personnel 改调吏部子-loop |
| loop 声明 | `loops/court_unified_decision.loop.yaml` | 新增 `loops/libu_chro_cao_office.loop.yaml` |
| 史馆 recall | be91a6c(`/api/court/backend/archive/*`、`/api/court/backend/memory/similar`)+ `EvoMapEvent`(unified-types 已有) | 吏部决策带 category 落库 + 同类 recall |

## 3. 12 子司(P0=8 先做,P1=4 registry 可插拔, `enabled:false`)
**P0**:① 吏部尚书(CHRO/CAO 合成官)② 官制司(组织/编制/职责/RACI)③ 选才司(招聘/JD/面试/录用)④ 考功司(绩效/转正/晋升/淘汰/盘点)⑤ 薪酬司(薪酬/奖金/提成/福利/人力成本)⑥ 人事司(入转调离/合同/考勤/档案)⑦ 劳关司(员工关系/劳动风险/PIP/离职·**高风险**)⑧ 行政司(办公/资产/印章/证照/后勤/行政预算·CAO)
**P1**(后续插拔,不重写主流程):⑨ 学政司(培训/梯队)⑩ 文化司(文化/体验)⑪ 数据司(People Analytics/HRIS 预警)⑫ **机仆司(AI Agent/蜂群岗位/权限/绩效/停用/审计)**
> 子司 schema 必须**完全一致**(只 keywords/requiredEvidence/highRiskKeywords 不同)。加子司 = 填一行注册表,不是写新模块(抄户部做法)。

## 4. 12 问题分类(`LibuQuestionClass`)
`ORG_DESIGN · HIRING · ONBOARDING · PERFORMANCE · COMPENSATION · HR_OPS · EMPLOYEE_RELATIONS · ADMIN_OPS · ORG_EXECUTION · AI_WORKFORCE · CULTURE_LD · PEOPLE_ANALYTICS`
> P0 阶段 `AI_WORKFORCE / CULTURE_LD / PEOPLE_ANALYTICS` 命中时:路由到"组织缺口/人工",因对应子司(机仆/文化/数据)是 P1。

## 5. 吏部质量门 → 机制映射(工程落点,不靠 prompt)
| 质门 | 落在哪 |
|---|---|
| `source_label_required` | 全局已有 `assertSourceLabel` + registry `sourceLabelRequired:true`(复用,不重写) |
| `owner_or_gap_required` | 吏部子-loop 合成:每条执行建议必须有负责人,否则进 `missingEvidence`(Goal 2) |
| `role_scope_required` | 官制司 `requiredEvidence` 含 职责边界/RACI(Goal 1) |
| `hiring_requires_budget_and_success_criteria` | 选才司 `requiredEvidence`=[预算,90天目标,试用期成功标准](Goal 1) |
| `compensation_requires_hubu_review` | **跨部**:分类=COMPENSATION → `planUnifiedReview` 确定性加选 `finance`(Goal 3) |
| `termination_requires_evidence_and_xingbu_review` | **跨部**:EMPLOYEE_RELATIONS(辞退)→ 加选 `justice` + 缺证则 RED(Goal 2+3) |
| `labor_risk_requires_xingbu_review` | **跨部**:劳动风险 → 加选 `justice`(Goal 3) |
| `admin_cost_requires_budget_source` | 行政司 gate + 成本类加选 `finance`(Goal 2+3) |
| `no_people_decision_without_context` | 缺 岗位/绩效/预算/证据 → verdict=NEED_EVIDENCE,禁确定性(Goal 2) |
| `privacy_sensitive_data_guard` | 敏感数据(薪酬/健康/纪律/离职意向)→ 记录权限+来源(Goal 2,新字段) |
| `ai_agent_role_requires_permission_review` | AI_WORKFORCE → 要求 owner/权限/审计/停用;机仆司 P1 前先路由人工(Goal 1 分类) |
> **跨部门触发是对现 `planUnifiedReview`(纯关键词)的确定性增强** —— 见 Goal 3。

## 6. 吏部子-loop（`libu_chro_cao_office_loop_v1`,department 子循环,非主流程）
```
receive_libu_work_order        吏部接令(从军机处/统一 loop)
→ classify_people_admin_question  人力行政问题分类(12 类)
→ collect_people_admin_evidence   收集证据(命中子司的 requiredEvidence)
→ run_libu_sub_offices            7 子司并行审查(官制/选才/考功/薪酬/人事/劳关/行政)
→ synthesize_chro_cao_position    吏部尚书合议 → 一个 DepartmentOpinion(含 libuOpinion 明细)
→ libu_quality_gate               吏部质门(§5 规则 + 跨部触发标记)
→ return_to_junjichu              回传军机处(进 memorial.departmentSummaries)
```

## 7. 跨部门联动(确定性触发,写进 registry/loop,不靠 LLM 自由发挥)
| 场景 | 吏部主责 | 必触发 |
|---|---|---|
| 招聘销售负责人 | 岗位/JD/面试/试用期 | 户部·兵部·刑部 |
| 销售提成 | 激励/公平/绩效 | 户部·兵部·刑部 |
| 辞退/处分 | 绩效证据/PIP/流程 | 刑部 |
| 调薪/奖金 | 薪酬结构/激励 | 户部·刑部 |
| 组织调整 | 架构/职责/RACI | 兵部·户部 |
| 办公室搬迁 | 空间/行政/员工影响 | 户部·刑部·锦衣卫 |
| AI Agent 治理 | 岗位/owner/绩效 | 军机处·刑部·锦衣卫 |

## 8. 三层 UI(渐进,不一次全做)
1. **上书房吏部简报** — 老板 10 秒懂:一句主建议 + 原因 + 后令 + 1 主动作。
2. **军机处吏部分奏** — 立场/可信度/来源(LIVE…)/发现/缺证/依赖/下一步。
3. **吏部明细台** — 组织架构/编制/招聘管线/绩效/薪酬/劳动风险/行政费/资产/AI 岗位表(深挖才进,默认不推给老板)。
> Goal 4 **只先做第②层(军机处分奏渲染)**。

## 9. 15 条黄金用例(Goal 1/5 的 eval 基线)
招聘大客户销售负责人 · 销售经理转正 · 表现差能否辞退 · 提成方案 · 新项目设负责人 · 行政费为何涨 · 搬办公室 · 销售/交付/售后职责不清是否调架构 · AI Agent 归谁管 · 核心员工离职风险 · 某员工调薪 · 外包客服 · 招行政主管 · 印章/证照风险 · 某岗位取消/合并。
每条必查:source_label · evidence/missing_evidence · owner-or-gap · 高风险人工确认 · 户/刑/兵联动 · 是否生成可执行材料(JD/PIP/RACI…)· 是否进史馆。

---

# 5-Goal 执行计划 v1（含真实路径,逐 Goal 8 字段）

## Goal 1 — 吏部契约层
- **objective**:升级 `personnel`→CHRO/CAO;定 8 P0 子司 + 4 P1(enabled:false) + 12 分类 + 11 质门(§5)+ I/O schema(`LibuCHROOpinion`/`LibuSubOpinion`)+ 15 黄金用例。镜像 hubu-types。
- **files to read**:`department-registry.ts`、`unified-types.ts`、`src/core/courtos/hubu/hubu-types.ts`(模板)、`config/departments.registry.yaml`、`unified-loop.nodetest.ts`、DraftEdict/Memorial zod 契约(661ba7a)。
- **files likely to change**:`department-registry.ts`(升级 personnel)、新建 `src/core/courtos/libu/libu-types.ts`、`unified-types.ts`(加可选 `libuOpinion?` + `LibuQuestionClass`)、`config/departments.registry.yaml`、新建 `src/core/courtos/libu/libu.golden.json`。
- **non-goals**:不写运行逻辑(G2);不碰 UI;不建特殊流程;P1 子司只占位不实现。
- **acceptance**:tsc 0;8 子司 + 12 分类 + 11 质门 zod 可校验;personnel 升级后 `listDepartments` 不回归;`libuOpinion?` 可选不破坏 6 部。
- **test/eval**:`pnpm exec tsc --noEmit` · `pnpm test:core`。
- **stopping**:契约+8 子司+分类+11 质门字段+15 黄金用例落地且双绿,即停。
- **rollback**:删新建文件;registry/unified-types 改动 additive,`git checkout` 还原。

## Goal 2 — 吏部本地运行链路 `libu_chro_cao_office_loop_v1`
- **objective**:实现 §6 子-loop:分类→7 子司并行→尚书合成→吏部质门 → 一个 `DepartmentOpinion`(含 libuOpinion)。镜像 hubu loop。
- **files to read**:`unified-decision-loop.ts`(`runEnabledDepartmentReviews`/`buildDepartmentOpinion`)、`src/core/courtos/hubu/`(loop 模板)、`llm-executor.ts`(若真 LLM)、G1 libu-types。
- **files likely to change**:新建 `src/core/courtos/libu/libu-chro-cao-office-loop.ts` + `libu.nodetest.ts`。
- **non-goals**:不接统一 loop(G3);不碰 UI;不一次全 LLM。
- **acceptance**:HR 问题→返回 DepartmentOpinion(signal/verdict/missingEvidence/risks/libuOpinion);劳关司命中风险→RED+人工确认;owner 缺失→进 missingEvidence;node 测试覆盖招聘/绩效/劳动风险。
- **test/eval**:`pnpm test:core` · tsc 0。
- **stopping**:子-loop 独立可跑、3 类 green,即停。
- **rollback**:删 `src/core/courtos/libu/` loop+test。

## Goal 3 — 接入统一朝堂 Loop（含跨部确定性触发）
- **objective**:`personnel` 选中时调吏部子-loop;吏部分奏进 memorial;**实现 §5/§7 跨部触发**(COMPENSATION→户部、辞退/劳动风险→刑部…)+ 冲突联动。
- **files to read**:`unified-decision-loop.ts`(`planUnifiedReview`/`runEnabledDepartmentReviews`/`identifyUnifiedConflicts`/`synthesizeUnifiedMemorial`)、`api/court/decision/route.ts`、`loops/court_unified_decision.loop.yaml`。
- **files likely to change**:`unified-decision-loop.ts`(personnel 改调子-loop;`planUnifiedReview` 加**确定性跨部触发表**;`identifyUnifiedConflicts` 扩吏部张力)。
- **non-goals**:不建独立流程;不碰 UI;不改 LLM 脊柱契约。
- **acceptance**:含人事/劳动风险问题跑统一 loop→奏折含吏部分奏+自动拉户/刑;吏部 RED→`qualityGate.blockingIssues` 含人工确认;**既有 6 部 golden 不回归**。
- **test/eval**:`pnpm test:core` · `pnpm eval:court` · tsc 0。
- **stopping**:端到端含吏部+跨部触发、golden 不回归,即停。
- **rollback**:`git checkout unified-decision-loop.ts`。

## Goal 4 — 吏部三层 UI（本 Goal 只做第②层）
- **objective**:军机处吏部分奏渲染(灯号/子司摘要/缺证/依赖/下一步)。①上书房简报、③明细台留后续。
- **files to read**:`unified-ui-adapter.ts`、`src/features/shangshufang/components/MemorialScroll.tsx`、`throne/decision/page.tsx`、hubu UI 投影。
- **files likely to change**:`unified-ui-adapter.ts`、`MemorialScroll.tsx`。
- **non-goals**:不一次三层;不建 `/api/court/libu/*`;不动冻结视觉资产。
- **acceptance**:含吏部分奏的奏折在军机处视图正确显示;`pnpm build` 0;e2e 加吏部分奏断言。
- **test/eval**:`pnpm exec tsc --noEmit` · `pnpm build` · `pnpm test:e2e`。
- **stopping**:②可见且 build/e2e green,即停。
- **rollback**:`git checkout` 两文件;e2e 新增可删。

## Goal 5 — 史馆 / EvoMap
- **objective**:吏部决策(招聘/绩效/组织/行政/劳动风险)带 category 落库 + 同类 recall;EvoMap 沉淀用户习惯 + **组织风险预警**。镜像 be91a6c。
- **files to read**:史馆 persistence/recall(be91a6c)、`/api/court/backend/archive/cases`、`/api/court/backend/memory/similar`、`EvoMapEvent`(unified-types)。
- **files likely to change**:归档 schema 加吏部 `decisionCategory`;recall 支持吏部类目;EvoMap 加组织风险预警字段。
- **non-goals**:不重建史馆;不做全量 EvoMap;不碰别部归档。
- **acceptance**:两同类吏部问题,第二个能 recall 第一个(advisory);归档带 category;tsc 0 / node 测试 green。
- **test/eval**:`pnpm test:core` · `pnpm eval:court` · tsc 0。
- **stopping**:落库+同类 recall 生效,即停。
- **rollback**:schema migration 可逆,否则 `git checkout`。

---

## 待拍板的 3 个决策(实现 Goal 1 前)
1. **子司用真 LLM 还是规则版?** 默认跟 `hubu` 一致 → Goal 2 读完 hubu 实现后定。
2. **11 质门落点**按 §5 表(全局复用 1 条 / 子-loop 7 条 / 跨部 3-4 条)—— 确认?
3. **跨部触发**(§7)要做成**确定性表**(分类→必拉部门),这是对现纯关键词 `planUnifiedReview` 的增强 —— 确认在 Goal 3 做?

## 依赖顺序
G1 → G2 → G3(硬链);G4、G5 在 G3 后并行。**P1 子司(含机仆司)与三层 UI 的①③ 均不在本批。**
