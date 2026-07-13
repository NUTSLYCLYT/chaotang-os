---
name: chaotang-build-office
description: 朝堂"建部/建司"套件——用统一模具快速搭一个顶级智能体部门(六部/专署)或给现有部加一个司。当用户要"建一个部门/司、给某部加柜台、把某部顶级化、按吏部/户部模板做另一个部、决策前算账的顾问司、部门办公厅"时用。强制:声明式(roster+30行引擎)、复用 office-kit(VerdictCard/resolveDecisionLadder/DeptDigestBar/finance-capability)、诚实标、协办徽、守铁律5/6/9。触发词:建部 建司 部门 办公厅 柜台 顶级化 吏部模板 决策算账 智能体司。
---

# 朝堂 · 建部/建司套件(office-kit)

一个"部"= 一排"司"(柜台),每个司 = **决策前替老板算一件事**的顾问。不重写 UI,声明即成。
前端主仓 `frontend/`。范式实证:户部/工部/吏部(吏部 8 司最全)。

## 建一个司 = 5 步(照抄吏部)

1. **写引擎**(`src/features/<部>/lib/<司>-review.ts`,纯函数 ~30 行):
   - 定 `Input`(字段)+ `Verdict`(4 标签)+ `VERDICT_CN`。
   - 涉及**工资年成本/ROI**这两个具体指标 → **点用户部能力** `finance-capability`(`annualLaborCost`/`computeRoi`),禁自己重写这两个函数的逻辑(铁律6)。本部门自己专属的算账逻辑(如兵部定价毛利,见下文"每部找它独有的一条真回执")不受此限——那是本部该算的账,不用也不该套户部这两个函数。
   - 裁决用套件 `resolveDecisionLadder({missing,blockers,roi,extraValueFail})` → 映射成自己的 Verdict 标签。**禁重写 if 阶梯**。
   - 缺硬数字→`insufficient` / 缺质门→标"先定清楚" / ROI<1→"不值" / else→"准";缺则标缺,绝不替老板拍板。
2. **写 tab**(`<司>-tab.tsx`,照 `libu-hiring-tab`):`INPUT_BASE`+`BoolChip`(质门)+ 审查按钮 + 空态。
3. **写结果卡**:直接用 `office-kit/verdict-card` 的 `<VerdictCard verdictCn cfg title metrics nextStep opinions blockers collaborators sourceNote/>`。**禁抄卡片 JSX**。跨部借了谁→传 `collaborators`(从 `CAPABILITY_MENU` 取,如户部)。
4. **登记 + 挂载**:司进 `<部>-roster.ts`(name/role/engine 真骨架诚实);tab 进工作台;`<DeptDigestBar>` 顶条自动显"N 智能体员工/能算什么/每年约省(估)"。
5. **复核(必过,不可省)**:写引擎的 agent 不可自审。派 `gongbu-quality-gate`(独立 context,御史台)过一遍新司的 `sourceNote`/`metrics`/`opinions`,专挑"自己骗自己"的漏洞——仿 ai-job-search 的 drafter-reviewer:写的人和查的人必须是两个 context,查的人才敢真挑刺。

## 建一个新部 = 上面 ×N 司 + 注册一行

- `department-offices.ts` 加 `<code>: <部>OfficePage` → `/departments/<code>` 从空壳换三栏办公厅(左司花名册 / 中工作台 / 右活动 / 底部问丞相+问钦天监)。
- 复用冻结视觉(GlassPanel/DeptSeal/帝金 token,见 `chaotang-frontend-design` skill),禁另起 UI 语言。

## office-kit 现有件(import 即用,勿重造)

| 件 | 路径 | 用途 |
|---|---|---|
| VerdictCard | `features/shared/office-kit/verdict-card` | 通用决策卡(4色灯+指标+协办徽+展开) |
| resolveDecisionLadder / OfficeReview | `features/shared/office-kit/office-review` | 统一裁决阶梯 + 引擎契约 |
| finance-capability | `features/shared/office-kit/finance-capability` | 户部算钱能力 + `CAPABILITY_MENU` |
| DeptDigestBar | `features/shared/components/dept-digest-bar` | 部门一句话摘要(智能体员工数/每年约省估) |

## 铁律(违反=返工)

- **铁律6**:一个领域一个 owner。**户部通用算钱原语**(工资年成本、ROI,即 finance-capability 那两个函数)只户部维护,他部点用不重造;合规只刑部,风险只钦天监。但**部门自己专属的算账逻辑**(如兵部定价毛利、户部财政裁决本身)不算重造,那正是这个部该有的"独有一条真回执"——铁律6 管的是"抄户部的算钱函数",不是"不准算自己领域的账"。跨部协作用 `collaborators` 协办徽显形。
- **铁律9**:工作台=咨询(纯函数·本地·标 LOCAL);真发钱/发文/真产线=转后端蜂群(经唯一桥 `dispatchDeptToSwarm`),前端不编。
- **铁律5**:溶不进主 Loop 才给司;每司先答"第一条真实数据从哪来",答不出=空转,冻结别建。
- **诚实**:roster 标真/骨架;来源标 LIVE/LOCAL/FALLBACK 不伪造;"每年约省"必标"估"+假设,不当承诺。
- **验收**:每司引擎带 nodetest;改完 `pnpm exec tsc --noEmit` + `pnpm build` 双门绿 + 浏览器截图。

## 每部找它"独有的一条真回执"(不换皮)

六个部中间工具必须各不相同:户部=财政裁决 / 工部=PACK可行性(真后端) / 刑部=合同合规逐条 / 兵部=定价毛利 / 礼部=关系优先序 / 吏部=招辞薪转培编 6 算账。建新部先问:它替老板算的、别人给不出的那件事是什么?

## 一句话
建部 = 声明 roster + 每司 30 行引擎(点用套件)+ VerdictCard,UI/逻辑骨架全复用;改一次全生效,老板到哪个部都一个体验、都看得见跨部协作。
