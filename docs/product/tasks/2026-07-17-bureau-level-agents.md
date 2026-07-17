# 任务：六部司级 Agent

## Status

Accepted

## Product Definition

- 用户确认：用户于 2026-07-17 通过“自动交付：帮我实现这些司级的 agent”逐项给出六部共 39 个司及职责；随后明确覆盖原“礼部 1.0 暂不开放”说明，要求“全部开放，忽略 1.0”，并授权提交推送上一轮改动后继续本任务。
- 问题：当前系统只能把旨意分流到六部，部级 Agent 直接形成一段意见；无法在部内按 39 个专业司职责进一步拆解。
- 目标用户：通过朝堂 OS 下达企业经营旨意并希望获得专业分工意见的经营决策者。
- 目标：建立数据驱动的司级 Agent 层；六部均能够从本部 39 个已开放司中严格选择一个或多个相关司、顺序获得专业意见并汇总为现有部级奏折。
- 非目标：不把每个司复制成独立 Python 包/类，不改变丞相或军机处拓扑，不新增 HTTP/前端字段，不并行调用模型，不持久化中间意见，不接入真实 HR/财务/CRM/法务/研发系统，不自动执行任何现实动作。
- 最小假设：全部 39 个司共用一个严格、可注入假模型的通用司级 Agent 实现，以不可变 profile 决定身份和职责；任一部级 Agent 均先通过严格 JSON 选择本部相关司，再按选择顺序逐一调用，最终把带司名的意见确定性汇总到既有 `{\"opinion\": \"...\"}` 字符串。真实请求的模型调用次数会增加，自动测试全部使用假模型。

### 司级能力定义

- 吏部：任免司（任免、晋升、职级、调岗、职责匹配）；招聘司（招聘需求、岗位缺口、候选人匹配、面试推进）；劳关司（劳动关系，员工入/离/调/转/续全过程风险）；薪酬司（薪酬区间、调薪、奖金、预算、内部公平性）；制度司（人事制度、流程规则、适用条款、例外处理）；协同司（责任人、跨司协同链路、卡点、逾期、催办）。
- 户部：预算司（预算、预测、费用控制、经营分析）；出纳司（现金安全、回款、付款、账期、资金安全垫）；盐铁司（报价、成本拆解、毛利底线、异常价格）；融资司（资金缺口、融资方案、资金成本、还款压力、融资红线）；审计司（异常报销、重复付款、缺证费用、流程绕行稽核）；会计司（收入、成本、费用、科目、项目归集、税务、月结）；投资司（投资评审、收益测算、风险分析、退出路径）。
- 礼部：品牌司（品牌表达、视觉资产、语气一致性、品牌风险）；公关司（舆情监测、事实核查、回应口径、危机升级）；客户沟通司（客户话术、沟通目标、禁用话术、承诺边界）；内容司（内容质量、事实校验、发布门禁、修改建议）；政企司（政企合作、材料准备、合规边界、跟进计划）；体验司（用户反馈、体验问题优先级、优化建议、结果验证）。上述六司与其他司同样开放。
- 兵部：报价司（商机推进、客户阶段、报价动作、赢率、阻塞点）；线索司（市场活动、线索质量、获客成本、投放复盘）；渠道司（渠道合作、报备、成交归属、返佣、渠道冲突）；客户司（客户健康、续约、投诉、交付问题、关键联系人）；竞情司（竞品对比、价格战风险、输赢原因、竞争策略）；增长司（漏斗转化、增长瓶颈、实验队列、实验优先级）。
- 刑部：合同司（合同条款、签署门禁、缺失条款、模板偏离）；合规稽查司（合规规则、风险等级、整改要求、稽查结论）；风控司（整体风险评分、风险趋势、控制措施、准入建议）；缺证核查司（证据完整性、授权链、审批状态、越权检查）；争议处置司（争议事实链、双方诉求、证据强弱、处置策略）；知识产权司（知识产权归属、授权、侵权风险、保护建议）；制度司（法律制度、处罚风险、整改路径、豁免条件）。
- 工部：产研司（需求、产品方案、用户价值、范围边界、优先级）；技术司（技术可行性、架构风险、研发成本、依赖、技术债）；物料司（库存、采购、供应商、缺料风险、替代方案）；进度司（里程碑、排期、延期风险、卡点责任人、交付预测）；质量司（质量检查、缺陷、验收证据、返工建议、质量裁决）；现场司（现场事实、客户反馈、处理进度、现场证据）；承诺司（客户承诺、兑现状态、承诺来源、责任人、越权风险）。

## Acceptance Criteria

- [x] 运行时存在唯一、不可变、可导入的司级 profile 注册表，精确包含上述 39 个司、所属部和全部职责关键词；名称在本部内唯一，六部全部 39 个司均可用，不存在 1.0 禁用分支。
- [x] 使用一个数据驱动的通用司级 Agent，而不是复制 39 套实现；系统提示包含所属部、司名、完整职责、只给专业建议及企业不可逆动作禁令，响应只接受严格 JSON 非空 `opinion`；未知司和跨部司均失败关闭。
- [x] 六部的部级 Agent 均先输出严格 JSON 司级路由（非空判断说明、一个或多个本部司、无重复），非法 JSON、未知/跨部/重复/空选择全部包装为既有脱敏模型错误，不返回半成品。
- [x] 被选司按路由顺序串行调用，每个司产生独立非空专业意见；部级最终 `opinion` 确定性带司名汇总全部意见，保留顺序且不额外声称现实操作已完成。
- [x] 礼部六司与其他五部的司采用完全相同的路由与调用机制；品牌司、公关司、客户沟通司、内容司、政企司、体验司均能被礼部选择、顺序调用并汇总，测试不得保留“礼部禁用”假设。
- [x] 单部门、多部门、军机处顺序会审和现有 FastAPI/BFF/UI 成功响应契约保持兼容；现有 `ministry_opinions[].opinion` 继续为非空字符串，可在页面看到带司名的汇总意见，无需新增字段。
- [x] 共享企业安全约束继续禁止工具、付款、任免、对外发布、签约、销售承诺和生产部署；司级提示不得自动执行 HR、财务、销售、法务或交付动作。
- [x] 新增 ADR 记录 `部 → 司` 数据驱动层、全部 39 司开放、顺序调用、兼容汇总和同步调用成本；同步更新 `ARCHITECTURE.md`、`backend/AGENTS.md` 与 harness 长期文件登记。
- [x] 离线测试精确覆盖 39 个 profile、六部全部开放、全部职责关键词、合法/非法路由、司级调用、礼部六司、顺序汇总、single/multi/军机处/API/health 回归与无状态泄漏；全部注入假模型，不读取私有 dotenv、不访问网络或真实模型。
- [x] backend ruff/全部 pytest、frontend lint/typecheck/test/build、harness 与相关自测全部通过；私有环境文件、日志、缓存和运行态数据未被跟踪。

## Delivery Constraints

- 范围：允许新增 `backend/app/agents/bureaus/**`，修改 `backend/app/agents/ministries/**`、相关后端测试、必要的 `ARCHITECTURE.md`、`backend/AGENTS.md`、新增 ADR、`scripts/check_harness.mjs` 与本任务文件；若兼容性要求无需改 API/前端，则禁止顺手修改它们。最终允许路径由程序团队负责人经架构分析后收窄。
- 兼容性：保持六部 profile 与顺序、`invoke_ministry_agent(department, decree_text, rationale, chat_model) -> str`、严格 JSON 部级 `opinion`、LangGraph 状态、FastAPI/BFF/UI 字段、错误映射、路由路径和 `GET /health` 不变。
- 风险与限制：司级拆解增加同步模型调用次数和延迟，现有前端 120 秒超时可能不足；本轮不得以扩大 API 或异步架构绕过该风险，只能在 ADR 与交付报告如实记录。全部 39 个司均开放，不得保留礼部 1.0 门禁。不得读取、修改、打印或提交 `backend/.env.example`，不得运行真实模型 smoke。
- 交付过程不得提交、推送、部署、重启现有服务或创建外部资源；本轮改动保持未提交，等待用户后续明确指令。

## Affected Modules

- 模块：司级能力注册与通用 Agent
- 允许路径：`backend/app/agents/bureaus/__init__.py`（新增）、
  `backend/app/agents/bureaus/profiles.py`（新增）、`backend/app/agents/bureaus/prompts.py`（新增）、
  `backend/app/agents/bureaus/agent.py`（新增）、`backend/tests/test_bureaus_agent.py`（新增）
- 依赖模块：六部企业定位与严格结构化输出
- 模块：六部司级路由与顺序汇总
- 允许路径：`backend/app/agents/ministries/prompts.py`、`backend/app/agents/ministries/agent.py`、
  `backend/app/agents/ministries/__init__.py`（仅必要的公开导出/说明）、
  `backend/tests/test_ministries_agent.py`、`backend/tests/test_chancellor_graph.py`、
  `backend/tests/test_junjichu_agent.py`、`backend/tests/test_decrees_api.py`
- 依赖模块：司级能力注册与通用 Agent、现有六部 Agent、军机处会审
- 模块：架构治理与验证
- 允许路径：`docs/decisions/0013-data-driven-bureau-agents.md`（新增）、`ARCHITECTURE.md`、
  `backend/AGENTS.md`、`scripts/check_harness.mjs`、本任务文件
- 依赖模块：上述两个业务模块

## Technical Plan

- 架构边界：新增 `app.agents.bureaus` 作为第四个业务 Agent 子包，包含不可变 registry、提示和
  单一通用 Agent；`ministries` 只负责本部司级路由、顺序调用和兼容汇总。禁止修改
  `chancellor/**`、`junjichu/**`、`api/**` 与 `frontend/**` 生产代码，外部契约完全不变。
- 接口与依赖：冻结 `BureauProfile(department, bureau, responsibilities)` 与唯一 tuple
  `BUREAU_PROFILES` 精确保存 39 司，使用 `(department, bureau)` 复合键区分同名制度司；不定义
  enabled/version 字段，礼部六司与其余司同权开放。`invoke_bureau_agent(...) -> str` 严格解析
  `opinion`。`invoke_ministry_agent(...) -> str` 签名不变，先严格解析
  `{\"rationale\": ..., \"bureaus\": [...]}`，再串行调用并逐行汇总为 `司名：意见`。
- 实施顺序：模块 1 建立 registry、司级提示/Agent 与单测；模块 2 更新六部提示、严格路由、顺序
  调用、失败短路和兼容回归；模块 3 按 record-decision skill 新增 ADR 0013，同步架构、后端
  AGENTS 和 harness；最后由独立测试角色查假绿并全量验证。
- 验证计划：精确锁定 39 profiles、`6/7/6/6/7/7` 分布、全部职责词、冻结性、复合键、礼部六司
  可用；覆盖司级合法/非法响应、部级合法/非法路由、顺序调用、失败短路、确定性汇总、同一实例/
  compiled graph 无状态泄漏、single/multi/全六部/军机处/API 502/health 回归。运行 backend ruff/
  全部 pytest、frontend lint/typecheck/test/build、四条 harness/self-test 与 diff 检查。
- 技术风险：single 最坏 9 次、全六部 multi 最坏 47 次同步模型调用，现有 120 秒前端超时可能
  不足；本轮按产品约束不改 API/前端或异步架构，只记录风险。任一司失败必须立即短路并由既有
  异常链脱敏，不返回半成品；所有运行态选择/意见只用调用内局部变量，不新增缓存或持久化。

## Implementation Report

- 改动摘要：Claude Code runner 明确返回 `five_hour` 配额限制后，按项目自动交付规则切换为 Codex
  专业角色顺序接力。新增数据驱动的 `app.agents.bureaus` 包，以冻结 profile 注册表精确登记六部
  `6/7/6/6/7/7` 共 39 个司；全部开放且没有 enabled、version 或礼部 1.0 门禁。新增单一通用司级
  Agent；六部 Agent 先严格解析本部司级路由，再按返回顺序逐司调用并以 `司名：意见` 汇总到原有
  `opinion` 字符串。新增 ADR 0013，并同步架构、后端工作约束和 harness 长期文件登记。
- 自审：生产改动只涉及新增司级包和既有六部 Agent；没有修改丞相、军机处、API 或前端生产代码，
  `invoke_ministry_agent(...) -> str`、LangGraph 状态、HTTP/BFF/UI 字段、健康检查和错误映射保持兼容。
  路由拒绝空值、重复、未知及跨部司；司级响应只接受严格非空 `opinion`，任一失败立即短路且不会返回
  半成品。全部运行态数据均为调用内局部变量，无缓存、持久化或真实业务动作。
- 验证：独立测试角色已通过 backend ruff、backend pytest（306 passed）、frontend lint/typecheck/test
  （41 passed）/build、harness（47 项）、harness self-test（20 项）、stop hook self-test（3 项）、
  product-flow runner self-test（25 项）及 `git diff --check`。全部模型调用由离线假模型注入；未访问网络、
  真实模型或私有 dotenv。
- 剩余风险：同步调用放大为单部门最坏 9 次、全六部会审最坏 47 次，现有前端 120 秒超时可能不足；
  本轮按已确认范围不引入异步架构或扩展 API。真实模型的语义选司质量与端到端时延未在离线测试中
  测量。测试仍报告一个既有 Starlette/httpx deprecation warning，不影响通过结果。

## Acceptance Review

- 验收结果：Accepted（2026-07-17）
- 验收证据：逐条核对 10 项验收标准均满足。产品经理独立复跑 backend ruff 与全部 pytest
  （306 passed，1 个既有 deprecation warning）、frontend lint/typecheck/test（41 passed）/build、
  harness（47 项）、harness self-test（20 项）、stop hook self-test（3 项）、product-flow runner
  self-test（25 项）和 `git diff --check`，全部通过。确认 39 个司均已开放，礼部不存在 1.0 门禁；
  single、multi、军机处、API、health 与 UI 契约回归通过。
- 未通过项：无；无需程序团队返工。
