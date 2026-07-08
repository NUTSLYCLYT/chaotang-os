# 朝堂 OS 1.0 业务架构 PRD

本文档基于当前项目代码、README 和现有产品定位整理，不按理想蓝图扩写。

## 1. 文档依据

本 PRD 主要依据以下现有项目内容：

- `README.md`：项目定位为朝堂 OS，一个统一项目；`CourtOS` 是内部决策内核/协议名，不是第三条产品线。
- `src/app/(dashboard)/*/page.tsx`：当前已存在的一线业务页面路由。
- `src/features/shangshufang/constants.ts`、`src/features/shangshufang/components/ChaotangTopNav.tsx`：顶部导航、六部、诸司等导航相关实现。
- `src/features/departments/lib/six-departments-content.ts`：六部页面内容、六部代码、部门定位。
- `src/features/departments/lib/department-governance.ts`：六部和下设各司的治理口径。
- `src/features/bureaus/lib/bureau-page-specs.ts`：六部下属各司页面规格。
- `src/app/(dashboard)/departments/[code]/page.tsx`、`src/app/(dashboard)/departments/[code]/[office]/page.tsx`：六部详情页与各司详情页路由。
- `src/app/(dashboard)/offices/page.tsx`、`src/app/(dashboard)/intel/page.tsx`：诸司大厅与锦衣卫情报页。
- `src/features/hubu/lib/bom-cost.ts`、`src/features/libu/lib/hiring-review.ts`、`src/features/bingbu/lib/bingbu-roster.ts`、`src/features/xingbu/lib/xingbu-roster.ts`、`src/features/lifu/lib/lifu-roster.ts`、`src/features/gongbu/lib/gongbu-roster.ts`：六部重点能力的现有代码依据。

## 2. 1.0 版本定位

朝堂 OS 1.0 是一个经营决策闭环系统，核心不是展示所有页面，而是收口成用户能理解、能使用、能跑通的主链路：

```text
大殿看全局
上书房发起事项
诸司/锦衣卫查证风险
六部给专业判断
军机处统筹执行
史馆归档复盘
```

1.0 的产品目标是：把用户的一句话经营问题，转成可查证、可会审、可执行、可裁决、可归档的正式事项。

## 3. 1.0 一级模块

1.0 一级模块确定为：

```text
大殿 / 上书房 / 军机处 / 六部 / 诸司 / 史馆
```

| 一级模块 | 现有路由 | 当前代码状态 | 1.0 定位 |
|---|---|---|---|
| 大殿 | `/overview` | 已存在 dashboard 页面 | 全局态势、今日事项、风险和入口总览 |
| 上书房 | `/court-briefing` | 已存在 dashboard 页面；另有旧 `/shangshufang` 页面 | 用户发起事项、拟旨、立案的主入口 |
| 军机处 | `/command-center` | 已存在 dashboard 页面 | 任务统筹、会审、执行过程和结果汇总 |
| 六部 | `/departments` | 已存在六部大厅、六部详情、各司详情路由 | 专业判断层 |
| 诸司 | `/offices` | 已存在诸司大厅；当前页面包含锦衣卫、太医院、钦天监、翰林院 | 1.0 收口后只展示锦衣卫 |
| 史馆 | `/archive` | 已存在 dashboard 页面 | 归档、复盘、证据链、旧案召回 |

## 4. 现有导航与 1.0 收口

当前代码里存在历史导航口径：

- `CORE_NAV` 里包含大殿、上书房、东宫、军机处、史馆。
- `MANOR_NAV` 里还有庄园入口。
- `SIX_MINISTRIES_NAV` 已列出六部。
- `COURT_OFFICES_NAV` 已列出诸司相关入口。
- `ChaotangTopNav.tsx` 中已有六部入口 `/departments` 和诸司入口 `/offices` 的常量。

1.0 需要把顶部一级导航收口为：

```text
大殿 / 上书房 / 军机处 / 六部 / 诸司 / 史馆
```

1.0 不把以下内容放入一级导航：

- 东宫
- 庄园
- 太医院
- 钦天监
- 翰林院
- 任务列表
- 报告列表
- 后台/设置/治理类页面

这些页面可以保留直接访问或内部入口，但不作为 1.0 主叙事。

## 5. 二级模块定义

### 5.1 诸司

1.0 诸司只展示锦衣卫。

| 二级模块 | 现有路由 | 现有代码依据 | 1.0 范围 |
|---|---|---|---|
| 锦衣卫 | `/intel` | `src/app/(dashboard)/intel/page.tsx` 渲染 `JinyiweiPage`；`offices/page.tsx` 中锦衣卫卡片 href 为 `/intel` | 开放 |
| 太医院 | `/health` | `offices/page.tsx` 已配置 | 1.0 不展示 |
| 钦天监 | `/forecast` | `offices/page.tsx` 已配置 | 1.0 不展示 |
| 翰林院 | `/hanlin` | `offices/page.tsx` 已配置 | 1.0 不展示 |

诸司大厅 1.0 要求：

- 页面标题仍可保留“诸司”组织口径。
- 可见卡片只保留锦衣卫。
- 不展示太医院、钦天监、翰林院入口，避免用户误认为它们属于 1.0 主链路。

### 5.2 六部

六部大厅和六部详情页已存在。1.0 开放六部，但每部只突出一个核心司。

| 部门 | 现有部门路由 | 1.0 核心司 | 现有代码依据 | 1.0 业务定位 |
|---|---|---|---|---|
| 户部 | `/departments/finance` | 成本司 | `bom-cost.ts` 已有 BOM 成本核算逻辑；`bureau-page-specs.ts` 中有成本/报价相关司规格 | 成本、报价、毛利、BOM 成本判断 |
| 吏部 | `/departments/personnel` | 招聘司 | `hiring-review.ts` 已有招聘会审逻辑；`department-governance.ts` 中有人事编制/招聘相关口径 | 招聘必要性、岗位画像、预算和 90 天目标判断 |
| 礼部 | `/departments/market` | 对外话术司 | `lifu-roster.ts` 中存在对外承诺、关系台账、商务公关等礼部岗位；`bureau-page-specs.ts` 有客户沟通/对外表达规格 | 客户回复、外部表达、承诺边界 |
| 兵部 | `/departments/ops` | 销售司 | `bingbu-roster.ts` 明确用户可见后端六司，其中包含销售司 | 商机推进、客户下一步、成交路径判断 |
| 刑部 | `/departments/legal` | 合同审查司 | `xingbu-roster.ts` 明确合同审查司已接真引擎 | 合同条款、风险条款、合规审查 |
| 工部 | `/departments/gongbu` | 产品/架构司 | `gongbu-roster.ts` 中有方案架构师、产品/技术/架构相关岗位 | 产品方案、技术可行性、架构和交付判断 |

## 6. 一级模块产品需求

### 6.1 大殿

现有入口：`/overview`

1.0 定位：全局态势页。

用户问题：

- 今天有哪些事项需要处理？
- 哪些事项有风险？
- 哪些事项应进入上书房、六部、军机处或史馆？

1.0 范围：

- 展示今日态势。
- 展示待处理事项。
- 展示风险与关键入口。
- 作为总览，不承担主要立案动作。

验收口径：

- 一级导航能进入大殿。
- 大殿能让用户看到当前系统状态和关键入口。
- 复杂事项创建应引导到上书房。

### 6.2 上书房

现有入口：`/court-briefing`

现状说明：

- 当前项目中也存在 `/shangshufang` 页面。
- 当前 README 和现有页面地图口径均把 `/court-briefing` 作为主工作入口。
- 1.0 应以 `/court-briefing` 作为上书房主入口。

1.0 定位：事项发起和拟旨入口。

用户问题：

- 我想让系统帮我判断一件经营事项，应该怎么开始？
- 这件事需要哪些证据？
- 应该交给锦衣卫、六部还是军机处？

1.0 范围：

- 一句话发起事项。
- 生成拟旨/事项草案。
- 标出缺失证据。
- 推荐处理去向。
- 推入军机处或六部处理。

验收口径：

- 一级导航“上书房”进入 `/court-briefing`。
- 用户能从上书房发起事项。
- 事项能进入后续链路。

### 6.3 军机处

现有入口：`/command-center`

1.0 定位：任务统筹与执行中枢。

用户问题：

- 这个事项现在处理到哪里了？
- 哪些部门参与了判断？
- 最后形成了什么结果？

1.0 范围：

- 展示任务队列和任务上下文。
- 展示会审/执行过程。
- 汇总六部和锦衣卫意见。
- 输出可读结果或奏折材料。

验收口径：

- 一级导航能进入军机处。
- 军机处能承接上书房事项。
- 能看到任务处理过程和结果摘要。

### 6.4 六部

现有入口：`/departments`

1.0 定位：专业判断层。

用户问题：

- 这件事应该找哪个专业部门判断？
- 钱、人、话术、销售、合同、产品分别谁负责？

1.0 范围：

- 六部大厅展示六个部门。
- 六个部门详情页开放。
- 每部只突出一个核心司。
- 其他各司页面可保留路由，但不在 1.0 主界面强展示。

验收口径：

- 一级导航能进入 `/departments`。
- 六部大厅能进入六个部门页。
- 每个部门页能看到 1.0 核心司入口。

### 6.5 诸司

现有入口：`/offices`

1.0 定位：非六部专署入口，当前只开放锦衣卫。

用户问题：

- 这条外部信息可信吗？
- 来源、证据和风险是否足够？
- 是否可以进入六部或军机处判断？

1.0 范围：

- 诸司页面只展示锦衣卫。
- 锦衣卫入口进入 `/intel`。
- 不展示太医院、钦天监、翰林院。

验收口径：

- 一级导航能进入诸司。
- 诸司页面只出现锦衣卫。
- 锦衣卫页面可进入情报/风险核验体验。

### 6.6 史馆

现有入口：`/archive`

1.0 定位：归档、复盘、证据链和旧案召回。

用户问题：

- 这件事最后怎么裁决？
- 证据链在哪里？
- 下次遇到类似问题能不能复用？

1.0 范围：

- 展示归档案卷。
- 展示裁决结果和证据链。
- 支持从任务或结果进入归档视角。
- 支持旧案召回作为上书房参考。

验收口径：

- 一级导航能进入史馆。
- 已处理事项可以在史馆形成记录。
- 史馆记录不把 demo/fallback 数据伪装成真实结论。

## 7. 六部核心司需求

### 7.1 户部：成本司

代码依据：

- `src/features/hubu/lib/bom-cost.ts`
- `src/features/hubu/lib/bom-cost-document.ts`
- `src/features/departments/lib/department-governance.ts`
- `src/features/bureaus/lib/bureau-page-specs.ts`

现有能力：

- BOM 行解析。
- 成本核算。
- 成本结构拆解。
- 最大成本项识别。
- 缺价/缺证标记。
- 毛利计算需要销售价输入，不能凭空生成。

1.0 范围：

- 作为户部核心司展示。
- 处理成本、BOM、报价、毛利、价格依据相关问题。
- 必须展示缺证和来源边界。

不做：

- 不自动执行真实付款。
- 不伪造缺失价格。
- 不把建议报价包装成最终成交价。

### 7.2 吏部：招聘司

代码依据：

- `src/features/libu/lib/hiring-review.ts`
- `src/features/libu/lib/talent-search.ts`
- `src/features/libu/lib/org-headcount-review.ts`
- `src/features/departments/lib/department-governance.ts`

现有能力：

- 招聘需求会审。
- 年人力成本估算。
- ROI 判断。
- 是否有预算、90 天成功标准、JD 的门槛判断。

1.0 范围：

- 作为吏部核心司展示。
- 判断一个岗位是否应该招聘。
- 输出“可招 / 先定义清楚 / 养不起 / 缺证”等结论。

不做：

- 不自动发布招聘。
- 不代替 HR 完成人员录用。
- 不在缺预算、缺 JD、缺 90 天标准时直接建议开招。

### 7.3 礼部：对外话术司

代码依据：

- `src/features/lifu/lib/lifu-roster.ts`
- `src/features/lifu/components/lifu-workspace.tsx`
- `src/features/lifu/components/lifu-negotiation-tab.tsx`
- `src/features/lifu/components/lifu-crisis-tab.tsx`
- `src/features/bureaus/lib/bureau-page-specs.ts`

现有能力：

- 礼部已有对外关系、流量增长、对外承诺、商务公关等 roster。
- `bureau-page-specs.ts` 中已有客户沟通、内容、品牌、公关等司规格。

1.0 范围：

- 1.0 命名为“对外话术司”。
- 处理客户回复、对外表达、承诺边界、话术风险。
- 重点强调“能不能这样说”和“哪些话不能说”。

不做：

- 不把未核实事实写成对外承诺。
- 不替代刑部做合同/法务背书。
- 不展示完整礼部 8 司。

### 7.4 兵部：销售司

代码依据：

- `src/features/bingbu/lib/bingbu-roster.ts`
- `src/features/bingbu/components/bingbu-org-rail.tsx`
- `src/features/bingbu/components/bingbu-decision-cockpit.tsx`
- `src/features/bingbu/lib/bingbu-engines.ts`

现有能力：

- `bingbu-roster.ts` 明确用户可见口径为后端六司：销售司、市场司、渠道司、客户司、竞情司、增长司。
- 销售司范围为商机、客户推进、成交路径。

1.0 范围：

- 只突出销售司。
- 处理商机推进、客户下一步、销售路径判断。
- 可根据事项进入销售相关队列或筛选。

不做：

- 不把 CRM 列表本身当作判断结果。
- 不承诺真实成交。
- 不展开兵部全部六司作为 1.0 主界面。

### 7.5 刑部：合同审查司

代码依据：

- `src/features/xingbu/lib/xingbu-roster.ts`
- `src/features/xingbu/components/xingbu-contract-workbench.tsx`
- `src/features/xingbu/components/xingbu-office-page.tsx`

现有能力：

- `xingbu-roster.ts` 明确合同审查司已接真引擎。
- 合同审查司能力包括条款风险扫描、史馆踩坑率、合规报告。
- 缺证核查司也标记为已接真，但 1.0 只突出合同审查司。

1.0 范围：

- 作为刑部核心司展示。
- 处理合同条款、风险条款、责任边界、合规报告。
- 高风险事项需要人工/法务复核。

不做：

- 不自动签署合同。
- 不把系统判断当最终法律意见。
- 不展示刑部全部 8 司。

### 7.6 工部：产品/架构司

代码依据：

- `src/features/gongbu/lib/gongbu-roster.ts`
- `src/features/gongbu/components/gongbu-office-page.tsx`
- `src/features/gongbu/components/gongbu-workspace.tsx`
- `src/features/gongbu/lib/gongbu-engines.ts`

现有能力：

- 工部 roster 中已有方案架构师，职责包括技术选型、架构设计、API 契约、技术可行性。
- 工部也有质量、工期、供应链、承诺门等岗位，但 1.0 只突出产品/架构司。

1.0 范围：

- 判断一个产品/功能/技术方案能不能做、怎么拆、架构是否合理。
- 支持产品方案、技术可行性、MVP 范围判断。

不做：

- 不自动承诺真实交期。
- 不在前端伪造 BOM、成本、供应商和产线数据。
- 不展开工部全部班底作为 1.0 主界面。

## 8. 数据真实性与展示边界

README 明确当前项目必须区分真实、混合、fallback、demo。

1.0 所有主链路页面必须遵守：

- 有真实来源时展示真实来源。
- 有 fallback 或 demo 时显式标识。
- 缺证时显示缺证，不编造结果。
- 涉及付款、合同、报价、股权、法务、真实交付承诺时必须保留人工确认边界。

特别要求：

- 户部不能伪造价格。
- 刑部不能替代正式律师意见。
- 工部不能在前端伪造真实产线资产。
- 礼部不能把未核实事实写成对外承诺。
- 锦衣卫必须保留来源和可信度边界。

## 9. 1.0 页面收口清单

1.0 一级导航：

```text
大殿 -> /overview
上书房 -> /court-briefing
军机处 -> /command-center
六部 -> /departments
诸司 -> /offices
史馆 -> /archive
```

1.0 诸司展示：

```text
只展示锦衣卫 -> /intel
```

1.0 六部展示：

```text
户部 -> 成本司
吏部 -> 招聘司
礼部 -> 对外话术司
兵部 -> 销售司
刑部 -> 合同审查司
工部 -> 产品/架构司
```

## 10. 1.0 不进入主界面的现有能力

以下能力可保留现有页面或内部路径，但不在 1.0 一级/二级主界面突出：

- 东宫
- 庄园
- 太医院
- 钦天监
- 翰林院
- 六部其他各司
- 任务列表、报告列表、运行日志类页面
- 治理、设置、后台、Admin 页面
- PRD 展示页、角色视角页、分享页、演示页

## 11. 当前需要改造或确认的点

### 11.1 顶部导航收口

当前导航常量仍有历史口径，需要按 1.0 收口：

- 移除一级导航中的东宫。
- 移除一级导航中的庄园。
- 增加或确认六部一级入口 `/departments`。
- 增加或确认诸司一级入口 `/offices`。
- 上书房一级入口应指向 `/court-briefing`，而不是旧 `/shangshufang`。

### 11.2 诸司页面收口

`/offices` 当前代码配置了四个诸司：

- 锦衣卫
- 太医院
- 钦天监
- 翰林院

1.0 要改为只展示锦衣卫。

### 11.3 六部核心司收口

现有各司规格较多，1.0 页面需要只突出一个核心司：

- 户部：成本司
- 吏部：招聘司
- 礼部：对外话术司
- 兵部：销售司
- 刑部：合同审查司
- 工部：产品/架构司

其余各司路由可以保留，但不在 1.0 主展示中密集铺开。

### 11.4 命名一致性

当前代码中存在现代 code 与古代名映射：

- `finance` = 户部
- `personnel` = 吏部
- `market` = 礼部
- `ops` = 兵部
- `legal` = 刑部
- `gongbu` = 工部

1.0 面向用户只展示中文组织名，不暴露 code。

## 12. 1.0 验收标准

### 12.1 信息架构验收

- 一级导航只有：大殿、上书房、军机处、六部、诸司、史馆。
- 诸司只展示锦衣卫。
- 六部展示六个部门。
- 每个部门只突出一个核心司。

### 12.2 链路验收

- 用户能从上书房发起事项。
- 用户能从事项进入军机处或六部判断。
- 用户能进入锦衣卫进行情报/来源/风险核验。
- 用户能进入史馆查看归档/复盘入口。

### 12.3 真实性验收

- 页面不能把 demo/fallback 包装成真实结果。
- 缺证必须显示缺证。
- 高风险动作必须提示人工确认。
- 涉及真实付款、合同签署、真实报价、真实交付承诺时，不自动执行。

## 13. 一句话产品口径

朝堂 OS 1.0 是一个经营决策闭环系统：

```text
在大殿看全局，
在上书房发起事项，
由锦衣卫查证风险，
由六部给专业判断，
由军机处统筹执行，
最后由史馆归档复盘。
```

