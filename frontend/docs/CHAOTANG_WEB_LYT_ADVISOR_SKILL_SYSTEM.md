# Chaotang Web LYT Advisor + Skill System

> 主线仓：`/home/ubuntu/workspace/chaotang-web-lyt`。不要把 `/home/ubuntu/chaotang-os` 当作本项目主线。

## 1. 原则

每个实质任务必须有一个小型“会审蜂群”：

1. 至少两位相关 advisor 视角。
2. 至少一个板块 skill 或工作流 skill。
3. 明确工具：代码检索、测试、Playwright/Chrome 截图、数据源、MCP/plugin。
4. 明确验收：能否进入下一步、是否留证据、是否进入史馆/任务台账。

当前本机 Claude 蒸馏 skill 根目录：

```text
/home/ubuntu/.claude/skills
```

已盘点到 129 个 `SKILL.md`，其中朝堂主线优先使用下面这些。

## 2. 全局默认蜂群

| 场景 | 必配 advisor/skill | 产出 |
|---|---|---|
| 跨板块产品系统 | `chaotang-product-system-panel` + `chaotang-panel-maturity-rubric`; advisor: 张小龙 + Marty Cagan | 黄金路径、板块职责、下一步闭环 |
| 网站/UI/视觉导演 | `website-design-panel`; advisor: Don Norman + Jakob Nielsen + `chaotang-visual-director` + 张小龙审查 | 艺术效果、可用性删减、天才设计、截图验收 |
| 实现/修 bug | `frontend-patterns` + `tdd-workflow`/`verification-loop`; advisor: Deming + Charity Majors | 测试优先、最小改动、验证证据 |
| 高风险权限/钱/数据 | `bruce-schneier` + `chaotang-xingbu-panel`; 可加 Codex Security | 威胁模型、权限边界、审计点 |
| AI/蜂群能力 | `chaotang-swarm-ops-panel` + `eval-harness`; advisor: Andrew Ng + Harrison Chase | 评测、提示词/工具路由、成本质量 |
| 增长/对外表达 | `chaotang-libu-panel` + `april-dunford`; 可加 Seth Godin | 定位、话术、首屏表达 |

## 3. 真实路由到板块 skill

| 板块 | 真实入口 | 主 skill | 至少两位 advisor | 工具与验收 |
|---|---|---|---|---|
| 上书房/每日入口 | `/court-briefing`, `/study` | `chaotang-study-panel` | 张小龙, Marty Cagan | 首屏下一步、信号->草旨->军机处链路、截图 |
| 军机处/任务执行 | `/command-center` | `chaotang-command-center-panel` | Andy Grove, Charity Majors | SSE/状态机、任务 owner、错误/完成态、E2E |
| 工部/建设中台 | `/departments/gongbu`, `/manor-dept/gongbu`, `/manor-dept/works` | `chaotang-gongbu-panel` | Deming, Ohno Taiichi | 建设台账、验收闸、复用模板、build |
| 户部/预算 ROI | `/departments/finance`, `/manor-dept/finance` | `chaotang-hubu-panel` | Ben Graham, Drucker | 预算字段、ROI 假设、风险与来源 |
| 锦衣卫/情报 | `/intel`, `/intel/[signalId]`, `/manor-dept/guard` | `chaotang-jinyiwei-panel` | Daniel Kahneman, Bruce Schneier | 来源链接、置信度、时间戳、不可伪装真情报 |
| 史馆/复盘学习 | `/scribe`, `/scribe/[taskId]`, `/shiguan`, `/archive` | `chaotang-shiguan-panel` | Deming, Charity Majors | lesson、证据、复盘评分、下次 playbook |
| 礼部/对外材料 | `/libu` | `chaotang-libu-panel` | April Dunford, Paula Scher | 定位、话术、合规标签、材料清单 |
| 人员/组织问责 | `/settings`, `/settings/audit`, admin 相关 | `chaotang-libu-personnel-panel` | Peter Drucker, Julie Zhuo | 角色、权限、问责链、审计 |
| 刑部/治理规则 | `/governance`, `/governance/[caseId]`, `/governance/new` | `chaotang-governance-panel` + `chaotang-xingbu-panel` | Richard Posner, Bruce Schneier | 状态机、双签、租户隔离、授权证据 |
| 翰林/知识实验 | `/hanlin/*` | `chaotang-hanlin-panel` | Bret Victor, Alan Kay | 知识质量、实验复用、导出证据 |
| 东宫/人机权力边界 | `/donggong` | `chaotang-donggong-panel` | Stuart Russell, Bruce Schneier | 自主等级、人工裁决、脑检 gate |
| 钦天监/预测 | `/forecast`, `/forecast/[scenarioId]` | `chaotang-qintianjian-panel` | Daniel Kahneman, Taleb | 假设、反事实、置信区间、时间戳 |
| 兵部/战略竞争 | `/bingbu` | `chaotang-bingbu-panel` | Andy Grove, Peter Thiel | 竞争假设、战局、资源优先级 |
| 庄园/业务场景 | `/manors`, `/manors/[domain]`, `/departments/[code]` | `chaotang-manor-panel` | Marty Cagan, Teresa Torres | 用户任务、业务输入输出、下一动作 |
| 蜂群/Agent 运维 | `/jiqun/*`, `/swarm`, `/task/[id]/*` | `chaotang-swarm-ops-panel` + `chaotang-task-ledger-panel` | Andrew Ng, Harrison Chase | run 记录、评测、成本、失败复盘 |
| 实验室 | `/demo`, `/battery-exchange/*`, `/e2e-harness/*` | `chaotang-lab-panel` | Tony Fadell, Lenny Rachitsky | 实验目标、退出条件、是否进入主线 |

## 4. 成熟度闸门

每个板块审视都用 `chaotang-panel-maturity-rubric` 打 0-5 分：

1. Product job：是否拥有明确用户任务和下一动作。
2. Evidence grounding：是否有来源、时间、假设、置信度。
3. Workflow power：是否能生成任务、预算、决策、归档。
4. State machine：loading/empty/error/locked/running/done/archived 是否齐。
5. Advisor quality：是否有至少两个相关大神监督。
6. Toolchain：是否知道该调用哪些测试、截图、插件、数据源。
7. UI clarity：首屏是否回答“现在该做什么”。
8. Learning loop：结果是否进入史馆并改变下次推荐。
9. Safety/governance：权限、隐私、成本、声明、审计是否处理。

目标不是“页面好看”，而是每个板块至少达到 L3；核心路径逐步达到 L4/L5。

## 5. 本仓执行顺序

优先一条黄金路径，不要同时铺满所有页面：

```text
/court-briefing
  -> /command-center
  -> /departments/gongbu or /manor-dept/gongbu
  -> /departments/finance or /manor-dept/finance
  -> /scribe or /shiguan
  -> 史馆 lesson 反哺下一次 briefing
```

第一轮审视顺序：

1. `/court-briefing`：用户进入后是否知道今天要裁什么。
2. `/command-center`：任务是否有状态、责任人、失败恢复和证据。
3. `/departments/gongbu` + `/manor-dept/gongbu`：建设中台是否真能派活和验收。
4. `/departments/finance` + `/manor-dept/finance`：预算/ROI 是否成为闸门。
5. `/scribe` + `/shiguan`：是否把每次协作变成可复用经验。
6. `/jiqun/*`：是否能让 agent 运行、评测、成本和失败原因可见。

## 6. 缺口建议

当前 skill 库已经够启动，但要达到“智能巅峰”，建议补三类 skill：

| 缺口 | 建议 skill | 用途 |
|---|---|---|
| 页面级视觉验收 | `chaotang-visual-qa` | 结合 Playwright 截图检查首屏、密度、溢出、主题一致性 |
| 数据真实性闸门 | `chaotang-data-provenance` | 区分 mock/fallback/真实 API/ licensed data，要求来源和时间戳 |
| 闭环归档 | `chaotang-lesson-archiver` | 每次任务结束自动抽取 lesson、验证证据、下一条 playbook |

这些先作为文档规则执行；等重复使用 3 次以上，再正式写成新 `SKILL.md`。

## 6.1 视觉导演蜂群（已确定）

用户已确认：朝堂 OS 需要强艺术效果，但必须兼顾张小龙式克制。最终不采用“普通美工蜂群”定位，改为：

```text
视觉导演蜂群 / Visual Director Swarm
强艺术，低干扰；有仪式，不挡路；有世界观，但不牺牲效率。
```

### 职责

| 角色 | 职责 | 输出 |
|---|---|---|
| 视觉导演 | 统一朝堂世界观、艺术气质、页面记忆点 | 艺术方向、关键画面、可复用视觉锚点 |
| 张小龙审查官 | 删除过度装饰、废话、干扰操作的效果 | 一票删减清单、减法理由 |
| 动效/仪式设计师 | 设计关键状态瞬间，不做全站撒花 | 登朝、落印、发布阻断、归档、风险告警动效 |
| 可用性审查官 | 检查首屏信息、按钮、阅读负担、移动端 | P0/P1/P2 可用性问题 |
| 浏览器验收官 | 用 Playwright/Chrome 截图验收真实渲染 | 桌面/移动截图、溢出、遮挡、掉帧记录 |

### 艺术权边界

视觉导演蜂群拥有“艺术权”，但不拥有无限创作权：

1. 艺术效果必须绑定状态：发布阻断、落印、归档、风险、胜利、等待。
2. 艺术效果必须强化用户判断：一眼知道发生了什么、下一步做什么。
3. 张小龙审查官拥有删减权：任何不服务行动的视觉都可退回。
4. 不改冻结资产：不重写 `globals.css`、不重写 design tokens、不自造主色板。
5. 不平均撒艺术预算：优先集中在 3 个关键瞬间。

### 第一批试点

| 场景 | 艺术目标 | 张小龙约束 | 验收 |
|---|---|---|---|
| 发布阻断 | 红色门禁、压迫感、不可发布 | 不能遮挡 issue 和下一步复核动作 | `/jiqun/swarm/[session]` 截图，QA fail 明确可见 |
| 圣旨生成/落印 | 仪式感、可信度、完成瞬间 | 动效不超过 3 秒，不阻断继续操作 | 上书房/圣旨页面截图 + 操作路径 |
| 史馆归档 | 成就感、历史沉淀、可复用经验 | 不做纯庆祝，必须露出 lesson/证据/下一次可用 | `/scribe` 或 `/shiguan` 截图 + lesson 可见 |

### 输出格式

视觉导演蜂群每次只交付以下内容：

```text
视觉裁决: pass / needs_rework / blocked
艺术锚点: 这个页面最该被记住的 1 个画面
张小龙删减: 必须删除或降噪的 1-3 个效果
P0/P1/P2: 可执行修改清单
截图验收: 桌面、移动、关键状态截图要求
```

### 天才设计

把艺术预算集中到“状态转折点”，不要铺满每个静态页面。朝堂 OS 的高级感应该来自关键瞬间的确定性：落印就是已裁、红门就是不可发、入史就是沉淀，而不是每个卡片都发光。

## 7. 输出格式

每次板块审视或实现任务，最终至少包含：

```text
大神视角:
- <advisor A>: ...
- <advisor B>: ...

Skill/工具:
- 使用/应使用的板块 skill
- 测试、截图、MCP/plugin、数据源

验收:
- 通过项
- 未跑或阻塞项
- 下一步最小任务
```
