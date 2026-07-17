# 任务：六部企业职能定位

## Status

Accepted

## Product Definition

- 用户确认：用户于 2026-07-17 通过“自动交付：实现这些部的具体定位”逐项给出吏、户、礼、兵、刑、工六部定位，并在确认提交推送上一轮改动后委托继续自动交付。
- 问题：当前六部 Agent 仍使用官员任免、户籍田赋、典礼科举、军队边防、刑狱审理和工程水利等历史官署职责，无法按企业经营语境稳定接收任务、生成专业奏折，也会误导丞相的部门分流。
- 目标用户：通过朝堂 OS 下达企业经营旨意并查看六部专业意见的经营决策者。
- 目标：把六部的企业职能定位固化为运行时单一事实源，同时驱动丞相分流提示与各部专业奏折提示，使单部门办理和军机处多部门会审都按用户给定的六类经营职责工作。
- 非目标：不改变六部名称、LangGraph 拓扑、军机处会审顺序、HTTP/前端响应契约、页面布局、模型供应商、鉴权、持久化或真实企业系统集成；不自动执行招聘、付款、融资、对外发布、销售动作、合同审批或研发发布。
- 最小假设：“奏折”仍通过现有严格 JSON `{\"opinion\": \"...\"}` 的 `opinion` 字段承载，本轮不新增奏折 schema；“可追溯/可执行/可验收/有红线”等定位通过系统提示约束输出内容，不凭空声称已完成现实操作。

## Acceptance Criteria

- [x] 六部运行时定位存在唯一、可导入的数据源，且精确覆盖：吏部=组织招聘干部台、户部=财务决策中台、礼部=品牌与对外沟通中台、兵部=销售竞争作战台、刑部=法务风控案件台、工部=研发交付流水线；固定六部名录与既有顺序不变。
- [x] 每部定位完整包含用户给出的输入范围与奏折目标：吏部覆盖责任人/组织能力/绩效偏差/干部风险并产出人事奏折；户部覆盖现金流/预算/报价/融资/审计/投资研究并产出可追溯财务奏折；礼部覆盖品牌/客户沟通/公关/内容/体验并产出稳妥对外奏折；兵部覆盖客户/商机/渠道/竞争/增长漏斗并产出可执行攻防奏折；刑部覆盖合同/合规/授权/安全/争议并产出有红线风控奏折；工部覆盖产品/技术/交付/供应链/产能/质量并产出可验收交付奏折。
- [x] `ministry_system_prompt()` 对每个部门使用对应定位、输入范围和奏折目标，要求基于旨意与丞相判断形成专业建议；继续只输出严格 JSON，未知部门仍失败关闭。
- [x] 丞相路由提示从同一定位数据源获得六部职责摘要，能把企业经营语义映射到正确部门，并保持 single/multi 数量约束、军机处规则和严格 JSON 契约不变。
- [x] 六部与丞相提示继续明确禁止声称已执行现实动作，并把风险示例更新到企业语境；不得触发工具、付款、任免、发布、签约、销售承诺或生产部署等不可逆副作用。
- [x] 单部门与多部门图、军机处顺序会审、FastAPI 下旨接口、Next.js BFF、`/study` 展示和 `GET /health` 行为保持兼容，既有测试不回归。
- [x] 新增离线参数化测试锁定六部全部定位、输入关键词、奏折目标、丞相职责摘要与提示词约束；所有测试注入假模型，不读取私有 dotenv、不访问网络、不产生模型费用。
- [x] backend ruff/全部 pytest、frontend lint/typecheck/test/build、harness 与相关自测全部通过；私有环境文件、运行日志和服务运行态数据未被跟踪。

## Delivery Constraints

- 范围：优先只修改 `backend/app/agents/ministries/**`、`backend/app/agents/chancellor/prompts.py`、对应后端测试、必要的 `backend/AGENTS.md` 与本任务文件；最终允许路径由程序团队负责人经架构分析后填写。
- 兼容性：保持 `MINISTRIES` 顺序、`ministry_system_prompt(department)` 调用方式、严格 JSON `opinion` 契约、图状态、API/BFF/前端字段、错误映射和现有路由路径不变。
- 风险与限制：定位词是模型行为约束，不等同于真实组织授权；不得把建议包装成已批准或已执行事项。不得读取、修改、打印或提交 `backend/.env.example`，不得运行真实模型 smoke。
- 交付过程不得提交、推送、部署或创建外部资源；本轮改动保持未提交，等待用户后续明确指令。

## Affected Modules

- 模块：六部企业职能定位与丞相分流语义
- 允许路径：`backend/app/agents/ministries/prompts.py`、`backend/app/agents/ministries/__init__.py`、
  `backend/app/agents/chancellor/prompts.py`、`backend/tests/test_ministries_agent.py`、
  `backend/tests/test_chancellor_graph.py`、本任务文件
- 依赖模块：现有六部 Agent、丞相分流 Agent 与军机处会审编排

## Technical Plan

- 架构边界：只在 `ministries/prompts.py` 收敛企业业务语义；不修改 Agent 调用签名、LangGraph
  拓扑/状态、军机处实现、HTTP/BFF/前端契约、依赖或运行方式。该变更不构成新架构决策，无需 ADR。
- 接口与依赖：新增冻结的 `MinistryPositioning(department, positioning, inputs, memorial_goal)`；
  唯一原始数据为按既有顺序排列的 `MINISTRY_POSITIONINGS`，`MINISTRIES`、部门查找表、
  `ministry_system_prompt()` 与供丞相使用的 `ministry_routing_guide()` 均从它派生。
  `chancellor/prompts.py` 单向导入固定名录、路由摘要和共享不可逆约束；既有严格 JSON 契约不变。
- 实施顺序：先建立六部定位 tuple 和派生函数，再更新企业语境安全约束与六部系统提示，随后让
  丞相提示注入同源路由摘要，最后更新公开导出及参数化回归测试。
- 验证计划：后端参数化测试精确锁定六部顺序、定位、全部输入关键词、奏折目标、各部提示、丞相
  摘要、single/multi 与军机处规则、未知部门失败关闭；运行 backend ruff/全部 pytest、frontend
  lint/typecheck/test/build、四条 harness/self-test。全部模型测试注入 fake model。
- 技术风险：若复制定位文字会导致丞相与六部漂移，故只能从同一不可变 tuple 派生；企业定位是
  建议边界而非真实授权，共享约束必须禁止付款、任免、对外发布、签约、销售承诺和生产部署等
  未经批准的现实动作。

## Implementation Report

- 改动摘要：Claude Code 启动即明确触发 `five_hour` 配额拒绝，按 product-flow 协议由 Codex
  同名专业角色顺序接力。新增冻结、带 slots 的 `MinistryPositioning` 与唯一原始数据
  `MINISTRY_POSITIONINGS`，逐项固化用户给出的六部定位、输入范围和奏折目标；固定名录、部门
  查找、六部系统提示和丞相路由摘要全部由该数据派生。丞相提示注入同源企业职责摘要，保留
  single/multi、军机处和严格 JSON 契约；共享安全约束更新为企业语境，并公开导出定位类型、
  数据与路由摘要函数。
- 自审：`solution-architect` 只读确认该语义收敛不改变架构、图、API 或前端，无需 ADR；精确允许
  路径收窄为五个后端代码/测试文件。`module-engineer` 只修改登记文件并补参数化测试；独立
  `test-engineer` 又把丞相路由摘要校验收紧为逐行/顺序/数量完全相等，新增历史官署职责不得残留
  于运行时提示的回归，并把允许测试中的历史样例改为企业建议语境。最终 diff 只有登记的五个
  文件和本任务文件；未修改图、军机处、API、前端、架构或依赖。
- 验证：backend ruff 通过；backend pytest 为 `216 passed, 1 warning`；frontend lint、
  typecheck、`41 passed`、build 全通过；harness 46 个基线、harness self-test 20 项、Stop hook
  3 项、product-flow runner self-test 25 项全部通过；`git diff --check` 通过。运行时代码扫描确认
  历史官署职责关键词无残留，六个定位词在运行时代码中只定义于 `ministries/prompts.py`。
  全部模型测试注入 fake model，未读取私有 dotenv、未访问网络或真实模型。
- 剩余风险：提示词与路由摘要只能约束模型行为，真实分流和奏折质量仍依赖模型；本轮按安全约束
  未做真实 DeepSeek smoke。仓库其它不在允许路径内的旧回归测试仍可能含历史场景样例，但不进入
  运行时提示，不影响模型行为。

## Acceptance Review

- 验收结果：Accepted
- 验收证据：Codex 逐条核对 8 条验收标准。冻结的 `MINISTRY_POSITIONINGS` 精确包含六部定位、
  全部输入范围与奏折目标，并唯一派生 `MINISTRIES`、各部提示和丞相路由摘要；参数化测试锁定
  顺序、唯一性、冻结性、公开导出、逐项原文、严格 JSON、未知部门失败、企业不可逆约束、
  single/multi 与军机处规则，并确认运行时提示无旧历史官署职责。Codex 复跑 backend ruff、
  216 项 pytest、frontend lint/typecheck/41 项测试/build、46 个 harness 基线、20 项 harness
  self-test、3 项 Stop hook、25 项 runner self-test 与 `git diff --check`，全部通过。所有模型测试
  注入 fake model；未读取私有 dotenv、未访问网络或真实模型，工作区只有五个允许文件和本任务。
- 未通过项：无。
