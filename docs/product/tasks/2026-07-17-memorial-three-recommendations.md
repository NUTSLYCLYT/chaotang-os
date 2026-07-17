# 任务：分层回奏与丞相三项建议

## Status

Accepted

## Product Definition

- 用户确认：用户于 2026-07-17 通过“自动交付”明确要求升级回奏流程，并委托 Codex 在无阻塞问题时自动确认、交付和验收。
- 问题：当前流程把司级意见直接当作部级意见，单部门路径直接把部级结果当最终结论，多部门路径把军机处结论直接当最终结论；缺少“司后部议、军机处后丞相、丞相最终三策”的完整分层回奏。
- 目标用户：在上书房下旨并需要看到可追溯、分层决策依据与可执行选项的经营决策者。
- 目标：司级 Agent 完成意见后，由所属部再进行一次独立补充与综合；单部门结果直接回丞相，多部门结果先由军机处综合讨论再回丞相；丞相最后统一总结并给出恰好三个非空、互不重复的建议。页面可分别辨认每一层意见与实际流转顺序。
- 非目标：不改变丞相首次 single/multi 分流规则，不并行调用部门或司，不自动执行任免、付款、签约、发布、销售承诺或生产部署，不持久化任何中间意见，不接入新模型供应商，不提交、推送或部署。
- 最小假设：为让层级可审计，成功响应增量扩展结构化字段：每个 `ministry_opinions[]` 保留部级 `opinion` 并新增有序 `bureau_opinions`；新增可空 `council_verdict`（single 为 `null`，multi 为军机处结论）和恰好三项的 `recommendations`；既有 `final_verdict` 改为丞相最终总结。现有字段、HTTP 路径和错误分类继续保留。
- 已有改动依赖：本任务基于上一轮已验收但尚未提交的 39 司全部开放实现继续开发；这些改动属于明确依赖，必须保留，不得覆盖、拆除礼部六司或恢复 1.0 门禁。

## Acceptance Criteria

- [x] 通用部级 Agent 严格按“选择本部一个或多个司 → 按顺序逐司获取独立意见 → 将全部有序司级意见交给本部进行一次新的部级补充/综合”执行；部级补充不是司级文本的机械拼接，且失败时不返回半成品。
- [x] 每个部门结果以稳定结构保存部门名、按选择顺序排列的非空 `bureau_opinions`（每项含司名与意见）和非空部级 `opinion`；39 司继续全部开放，未知司、跨部司、重复司及非法结构均失败关闭。
- [x] single 路径严格为“丞相分流 → 目标部选择并咨询司级 → 该部补充意见 → 丞相最终汇总”，不调用军机处；丞相能同时看到原旨意、分流说明、司级意见和部级补充意见。
- [x] multi 路径按丞相选定部门顺序串行完成各部的“司级意见 → 部级补充”，再由军机处读取全部分层部门结果形成一次非空会审结论，最后把会审结论及全部依据交给丞相；丞相最终调用发生在军机处之后。
- [x] 丞相最终回奏使用严格 JSON，包含非空 `summary` 和恰好 3 个非空、互不重复的 `recommendations`；single 与 multi 都必须调用丞相最终汇总，任一非法/缺失/多于或少于三项的响应均通过既有脱敏模型错误链失败关闭。
- [x] 图状态及成功 HTTP 响应继续保留 `route_type`、`rationale`、`processing_path`、`departments`、`ministry_opinions` 和 `final_verdict`；增量提供 `ministry_opinions[].bureau_opinions`、`council_verdict` 与 `recommendations`。`final_verdict` 明确为丞相 `summary`，single 的 `council_verdict` 为 `null`，multi 为非空字符串。
- [x] `processing_path` 与真实顺序一致且以丞相结束：single 能辨认“上书房、首次丞相、部、所选司、部、最终丞相”；multi 能辨认军机处召集、各部与其司、军机处会审、最终丞相，且不声称未发生的现实执行已经完成。
- [x] 上书房成功页面分层展示每部司级意见、部级补充意见、multi 专属军机处会审结论、丞相总结和编号 1–3 的三项建议；single 不显示军机处结论，现有输入、处理中、错误提示及费用提示继续工作。
- [x] API/BFF/UI 对新增字段进行严格运行时校验：司级数组、部级意见、single/multi 的 `council_verdict` 约束、非空丞相总结和恰好三条建议任一不合规时拒绝成功响应；既有 422/502/503/network/unknown 脱敏映射不回归。
- [x] 新增 ADR 0014 记录分层回奏拓扑、结构化契约、同步调用成本与兼容策略，并同步 `ARCHITECTURE.md`、相关 scoped `AGENTS.md` 与 harness 长期文件登记。
- [x] 离线测试覆盖 single/multi 调用顺序、部级确有独立模型调用、军机处只在 multi 且早于最终丞相、丞相精确三建议、分层数据与路径、非法结构短路、API/BFF/UI 展示和连续调用无状态泄漏；全部使用注入假模型，不读取私有 dotenv、不访问网络或真实模型。
- [x] backend ruff/全部 pytest、frontend lint/typecheck/test/build、四组 harness/self-test 与 `git diff --check` 全部通过；未跟踪私有环境文件、密钥、运行日志、缓存或运行态数据。

## Delivery Constraints

- 范围：候选业务模块为部级分层综合、军机处会审、丞相最终回奏、后端成功契约、上书房 BFF/UI、架构治理与离线回归；具体允许路径由程序团队负责人经只读架构分析后收窄。保留上一轮未提交的 39 司实现和用户其他改动。
- 兼容性：保持 `POST /api/v1/decrees/chancellor`、请求体、健康检查、首次分流规则、固定六部/39 司名录、同步串行语义及既有错误状态码/分类；新增成功字段采用增量方式，前后端同批升级。
- 风险与限制：部级补充和丞相最终汇总各增加模型调用，最坏同步时延会继续放大并可能超过现有前端 120 秒；本轮不得以未确认的并发、异步任务或超时扩张改变产品边界。不得读取、修改、打印或提交 `backend/.env.example`，不得运行真实模型 smoke。交付过程不提交、推送、发布或创建外部资源；验收后才可重启本地前后端供用户试用。

## Affected Modules

- 模块：部级分层综合
- 允许路径：`backend/app/agents/ministries/agent.py`、`backend/app/agents/ministries/prompts.py`、
  `backend/app/agents/ministries/__init__.py`、`backend/tests/test_ministries_agent.py`
- 依赖模块：已验收的 39 司注册表与通用司级 Agent
- 模块：军机处与丞相最终回奏
- 允许路径：`backend/app/agents/junjichu/agent.py`、`backend/app/agents/junjichu/prompts.py`、
  `backend/app/agents/junjichu/__init__.py`、`backend/app/agents/chancellor/graph.py`、
  `backend/app/agents/chancellor/prompts.py`、`backend/app/agents/chancellor/__init__.py`、
  `backend/tests/test_junjichu_agent.py`、`backend/tests/test_chancellor_graph.py`
- 依赖模块：部级分层综合、现有丞相 LangGraph
- 模块：分层回奏 HTTP/BFF/UI
- 允许路径：`backend/app/api/decrees.py`、`backend/tests/test_decrees_api.py`、
  `frontend/src/lib/backendClient.ts`、`frontend/src/lib/backendClient.test.ts`、
  `frontend/src/app/api/decrees/chancellor/route.ts`、
  `frontend/src/app/api/decrees/chancellor/route.test.ts`、`frontend/src/app/study/decreeStatus.ts`、
  `frontend/src/app/study/decreeStatus.test.ts`、`frontend/src/app/study/page.tsx`
- 依赖模块：军机处与丞相最终回奏
- 模块：架构治理与回归验证
- 允许路径：`docs/decisions/0014-layered-memorial-three-recommendations.md`、`ARCHITECTURE.md`、
  `backend/AGENTS.md`、`frontend/AGENTS.md`、`scripts/check_harness.mjs`
- 依赖模块：上述全部业务模块

## Technical Plan

- 架构边界：保持 `bureaus → ministries → junjichu → chancellor graph → FastAPI → Next
  backendClient → Route Handler → UI` 单向依赖，不允许部级或军机处反向导入丞相。39 司包只读；
  LangGraph 拓扑升级为 `decide_route → single 部办理 / multi 军机处会审 → 共用
  finalize_chancellor → END`，无并发、异步、缓存或持久化。
- 接口与依赖：参数不变的 `invoke_ministry_agent(...)` 返回值从字符串升级为结构化
  `MinistryOpinion`：`department`、有序 `bureau_opinions[{bureau, opinion}]`、非空部级
  `opinion`。部级先严格选司并逐司调用，再以全部司级证据进行一次严格 JSON 的独立补充。
  `run_junjichu_council(...)` 返回结构化各部结果与严格会审结论。图状态增加条件式
  `council_verdict` 和三项 `recommendations`；共用丞相 finalizer 只接受精确
  `{"summary": ..., "recommendations": [三项]}`。HTTP/BFF/UI 增量映射嵌套司级意见、
  会审结论及三项建议，保留路径、请求体、既有字段和错误分类。
- 实施顺序：模块 1 完成部级结构化返回、独立补充与短路测试；模块 2 完成军机处读取分层结果、
  single/multi 共用丞相 finalizer、真实顺序路径与图测试；模块 3 同批升级 FastAPI、
  backendClient、BFF、UI 状态和页面分层展示；模块 4 使用 record-decision skill 新增 ADR 0014，
  同步架构、前后端 AGENTS 与 harness。最后由独立测试角色补足边界并全量验收。
- 验证计划：离线假模型精确记录所有调用，覆盖选司、逐司、部级补充、multi 军机处、最终丞相的
  相对顺序；验证 single 不调用军机处、multi 会审晚于全部部级补充、两路均恰好三项建议；覆盖
  缺失/多余字段、空值、重复/不足/超额建议、失败短路、嵌套 API/BFF 校验、UI 条件展示和连续
  调用无状态泄漏。运行 backend ruff/全部 pytest、frontend lint/typecheck/test/build、四组
  harness/self-test 与 `git diff --check`。
- 技术风险：本决策局部覆盖 ADR 0013 的内部字符串返回和“不扩成功字段”结论，须在 ADR 0014
  明示。最坏 single 为 11 次、全六部 multi 为 54 次同步模型调用，现有 120 秒前端超时很可能
  不足；按产品约束本轮不并发、不异步也不扩大超时，只在页面、ADR 和交付报告记录。任一步失败
  必须通过既有脱敏异常链关闭，不返回半成品；结构响应构造失败必须映射 502 而不是意外 500。

## Implementation Report

- 改动摘要：Claude runner 明确返回 `five_hour` 限额后，按 product-flow 规则由 Codex
  `solution-architect → module-engineer（四模块顺序）→ test-engineer` 接力完成。部级 Agent
  现在严格选司、逐司获取结构化意见，再进行一次独立部级补充；single 将分层部级结果交给丞相，
  multi 在全部部级补充后由军机处会审，再交给丞相。两路共用最终丞相节点，严格生成非空总结和
  恰好三项非空、互不重复的建议。FastAPI/BFF/UI 增量展示 `bureau_opinions`、条件式
  `council_verdict` 和 `recommendations`，并以真实顺序更新 `processing_path`。新增 ADR 0014，
  同步架构、前后端 AGENTS 与 harness。
- 自审：改动保持 `bureaus → ministries → junjichu → chancellor → API → BFF → UI` 单向依赖；
  未修改 39 司名录或恢复礼部门禁，未新增并发、异步、缓存、持久化或外部资源。HTTP 路径、请求体、
  既有成功字段、422/502/503/network/unknown 分类和 health 契约均保留。所有模型/结构失败均关闭，
  FastAPI 结果构造失败包装为既有脱敏 502，不返回半成品。实现与测试只落在 Affected Modules 的
  允许路径；任务文件仅由负责人写入。
- 验证：模块定向验证依次通过（部级 130 项、军机处/丞相 42 项、API 33 项、前端当时 53 项）；
  独立测试角色补充严格 schema、嵌套字段、条件会审、三建议边界与浏览器解析用例后，全量 backend
  ruff 通过、backend pytest `340 passed`（1 个既有 Starlette/httpx warning）、frontend
  lint/typecheck/test `70 passed`/build 通过、harness 48 个基线文件、harness self-test 20 项、
  stop hook self-test 3 项、product-flow runner self-test 25 项及 `git diff --check` 全部通过。
  全部 Agent 测试使用注入假模型；未读取私有 dotenv、访问外部网络或调用真实模型。
- 剩余风险：最坏 single 为 11 次、全六部 multi 为 54 次同步模型调用，现有前端 120 秒超时可能
  不足；本轮按产品约束不并发、不异步且不扩大超时。真实模型的语义质量和端到端延迟未在离线验收中
  测量。现有 Starlette/httpx 弃用警告仍存在，但不影响测试通过。

## Acceptance Review

- 验收结果：Accepted（2026-07-17）
- 验收证据：逐条核对 12 项验收标准均满足。产品经理独立复跑 backend ruff 与全部 pytest
  （340 passed，1 个既有 deprecation warning）、frontend lint/typecheck/test（70 passed）/build、
  harness（48 个基线文件）、harness self-test（20 项）、stop hook self-test（3 项）、
  product-flow runner self-test（25 项）和 `git diff --check`，全部通过。确认 single 无军机处且
  最终回丞相；multi 在全部部级补充后经军机处再回丞相；两路都严格产生丞相总结与三项建议；
  39 司继续全部开放，分层 API/BFF/UI 契约及既有错误映射通过。
- 未通过项：无；无需程序团队返工（返工次数 0）。
