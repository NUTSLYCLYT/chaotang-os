# 任务：上书房左右侧抽屉

> 所有任务必须阅读并遵循 `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`；若任务与该基线冲突，必须标记为 `Blocked`，不得自行变更流程。

## Status

Accepted

## Product Definition

- 用户确认：用户于 2026-07-28 明确要求使用自动交付；左侧抽屉内容已确认；用户于同日确认右侧抽屉暂时空白并要求实现真实丞相对话；用户通过 product-flow 委托自动确认 Ready
- 问题：上书房左右两侧目前没有可展开的辅助空间，用户无法在不离开主场景的情况下回看本次会话内的下旨记录或与丞相继续对话。
- 目标用户：登录后使用上书房下旨与查看回奏的用户。
- 目标：点击上书房页面左、右两侧触发区时分别打开对应侧抽屉；左抽屉上半部分展示此前下旨记录，下半部分提供当前页面会话内的真实多轮丞相对话；右侧抽屉保持空白。
- 非目标：丞相对话不产生旨意或业务决定，不调度六部/军机处，不调用锦衣卫，不写入史馆；不伪造史馆持久化成功；不把浏览器当前会话记录冒充跨会话历史；不改变 ADR 0028 的下旨业务流；右侧抽屉本次不承载业务内容；不新增聊天持久化、跨设备同步或流式输出。

## Acceptance Criteria

- [ ] 上书房桌面端左右两侧均有可识别、可键盘操作的抽屉触发区，分别只打开对应侧抽屉。
- [ ] 抽屉打开后可通过明确的关闭按钮和 Escape 关闭，焦点状态可见，且不会触发任何下旨或模型调用。
- [ ] 左抽屉上半部分显示当前页面会话内已经由用户主动提交的旨意记录，并明确其会话级范围；没有记录时显示可行动的空状态。
- [ ] 左抽屉下半部分提供与丞相真实多轮对话的输入和消息区域；用户主动发送后通过新的同源、受认证保护的聊天 BFF 调用丞相咨询端点，成功时追加真实答复，失败时展示稳定脱敏错误且保留既有消息。
- [ ] 丞相对话仅携带当前页面会话内按顺序排列的用户/丞相消息，不持久化；刷新页面后对话为空，并明确提示其会话级范围。
- [ ] 丞相对话端点严格限制消息角色、非空文本、单条长度、消息数量与总长度；拒绝畸形或越界请求，不把内部模型错误、提示词、凭据或后端地址返回浏览器。
- [ ] 丞相系统提示明确声明该通道只提供咨询，不代表下旨、审批、执行或归档；需要办理的事项引导用户使用御前“下旨”入口。
- [ ] 发送聊天消息只调用一次丞相模型，不进入六部、军机处、锦衣卫或史馆路径；离线测试通过注入假模型证明边界，不产生真实模型用量。
- [ ] 左抽屉上下区域在内容较长时各自保持可读和可滚动，不遮断关闭操作。
- [ ] 右侧触发区打开一个明确标记为“暂未开放”的空白抽屉，不显示模拟数据、虚构功能或可提交控件。
- [ ] 360px 窄屏下抽屉不溢出视口，主页面仍可恢复操作；减少动态效果偏好得到尊重。
- [ ] 原有御前输入、下旨、处理中、成功与错误状态继续工作，且导入页面不会自动发请求。

## Delivery Constraints

- 范围：产品任务文档；前端上书房页面、视觉工作台、聊天 BFF 与后端客户端；后端独立丞相咨询 Agent/服务和受认证 API；相关测试、ADR、`ARCHITECTURE.md` 与 scoped `AGENTS.md`。准确允许路径由架构角色锁定。
- 兼容性：保持 `/study` 登录保护、既有同源 `POST /api/decrees/chancellor`、结构化回奏字段与 ADR 0028 不变；聊天使用独立契约，不能复用下旨端点或归档路径。
- 风险与限制：右侧抽屉按用户确认保持空白；聊天会产生一次真实 DeepSeek 模型调用，UI 必须在发送前清楚表达；对话仅为咨询且当前页面会话内存保存，不能被表述为已办理或已归档。
- 技能计划：`using-superpowers`、`product-flow`、`codex-engineering-workflow`、`brainstorming`、`writing-plans`、`test-driven-development`、`frontend-design`、`verification-before-completion`。
- Codex-only：否；无阻塞后按 product-flow 调用 Claude Code runner。

## Affected Modules

- 模块：上书房侧边抽屉与会话交互；丞相非业务咨询契约。
- 允许路径：以下模块 A、模块 B 清单中的明确路径；未列出的路径禁止修改。
- 依赖模块：现有上书房提交状态、视觉工作台、认证会话、同源 BFF、DeepSeek 配置与聊天模型构建器；均按下述只读或写入边界处理。

- 模块 A：上书房侧边抽屉与会话交互（前端 UI/会话状态）
  - 允许路径：
    - `frontend/src/features/study-visual/DevStudyWorkspace.tsx`（改）
    - `frontend/src/features/study-visual/DevStudyWorkspace.module.css`（改）
    - `frontend/src/features/study-visual/DevStudyWorkspace.test.ts`（改）
    - `frontend/src/features/study-visual/StudySideDrawers.tsx`（新增）
    - `frontend/src/features/study-visual/StudySideDrawers.module.css`（新增）
    - `frontend/src/features/study-visual/StudySideDrawers.test.ts`（新增）
    - `frontend/src/app/study/decreeSessionLog.ts`（新增）
    - `frontend/src/app/study/decreeSessionLog.test.ts`（新增）
    - `frontend/src/app/study/chancellorConsultStatus.ts`（新增）
    - `frontend/src/app/study/chancellorConsultStatus.test.ts`（新增）
    - `frontend/src/app/study/chancellorConsultSubmission.ts`（新增）
    - `frontend/src/app/study/chancellorConsultSubmission.test.ts`（新增）
    - `frontend/src/app/study/StudyClient.tsx`（改）
    - `frontend/src/app/study/StudyClient.test.ts`（改）
    - `frontend/src/app/court-migration-assets.test.ts`、`frontend/src/app/court-entry-pages.test.ts`（仅当既有源码守卫断言因新增文件受影响才可touch，默认不应改动其断言意图）
- 模块 B：丞相非业务咨询契约（后端 Agent/API + 前端 BFF/客户端 + 契约决策记录）
  - 允许路径：
    - `docs/decisions/0030-chancellor-consult-chat-contract.md`（新增 ADR）
    - `ARCHITECTURE.md`（改：仅追加新增聊天契约的“当前状态”说明，不改写既有段落）
    - `backend/AGENTS.md`（改：追加子包说明）
    - `frontend/AGENTS.md`（改：追加新 BFF 路由说明）
    - `backend/app/agents/chancellor_consult/__init__.py`（新增）
    - `backend/app/agents/chancellor_consult/graph.py`（新增）
    - `backend/app/agents/chancellor_consult/prompts.py`（新增）
    - `backend/app/api/chancellor_consult.py`（新增）
    - `backend/app/main.py`（改：仅新增 `include_router` 与异常处理器注册）
    - `backend/tests/test_chancellor_consult_api.py`（新增）
    - `backend/tests/test_chancellor_consult_graph.py`（新增）
    - `frontend/src/lib/backendClient.ts`（改：新增 `chancellorConsult()`，独立类型，不复用 `SubmitDecreeResult`）
    - `frontend/src/lib/backendClient.test.ts`（改）
    - `frontend/src/app/api/chat/chancellor-consult/route.ts`（新增）
    - `frontend/src/app/api/chat/chancellor-consult/route.test.ts`（新增）
  - 硬约束：`chancellor_consult` 子包禁止导入 `app.agents.chancellor`、`app.agents.ministries`、`app.agents.junjichu`、`app.agents.bureaus`、`app.agents.evidence_protocol`、`app.jinyiwei.*`、`app.shiguan.*`、`app.junjichu_cases.*`；只允许复用 `app.langgraph_runtime.deepseek_config`/`app.langgraph_runtime.deepseek_client` 底层辅助函数。
- 依赖模块（只读）：`backend/app/api/auth.py`（`CurrentUser`/`require_current_user`）、`backend/app/langgraph_runtime/deepseek_client.py`、`backend/app/langgraph_runtime/deepseek_config.py`、`frontend/src/lib/session.ts`、`frontend/src/lib/requireUser.ts`、`docs/decisions/0028-decree-evidence-flow-governance-baseline.md`（禁止修改）。

## Technical Plan

- 架构边界：新代码与既有下旨闭环（`app/agents/chancellor/`、`app/agents/ministries/`、`app/agents/junjichu/`、`app/agents/bureaus/`、`app/shiguan/`、`app/jinyiwei/`、`app/junjichu_cases/`）零导入依赖。`POST /api/v1/chancellor-consult` 与既有 `POST /api/v1/decrees/chancellor` 是平行、互不调用的两条业务入口；`app/main.py` 只新增路由挂载，不改变既有路由行为。前端新增同源 BFF `/api/chat/chancellor-consult`，与 `/api/decrees/chancellor` 平行，浏览器侧只通过新的 `chancellorConsultSubmission.ts` 调用，不复用 `studySubmission.ts`/`submitDecree`。左抽屉“会话内旨意记录”只回显 `StudyClient` 已有下旨提交结果（内存态追加），不发新请求、不读史馆/军机处台账。右抽屉为纯静态占位组件，无数据源。
- 接口与依赖：后端 `POST /api/v1/chancellor-consult`（`Authorization: Bearer <session>` 认证，复用 `CurrentUser`）。请求体 `{"messages": [{"role": "user"|"assistant", "content": "..."}]}`；校验：消息数 1–20 条，单条内容去空白后 1–4000 字符，总长度 ≤ 20000 字符，角色必须从 `user` 开始严格交替并以 `user` 结尾，禁止多余字段（`extra="forbid"`）。处理：拼接系统提示（声明仅咨询、不代表下旨/审批/执行/归档，需办理请走御前下旨入口）+ 消息，对 chat model 调用恰好一次，返回 `{"status": "ok", "consultant": "丞相（咨询）", "reply": "..."}`；失败按 `validation`(422)/`config`(503)/`model`(502)/`unauthenticated`(401) 分类，固定脱敏文案。前端 `backendClient.chancellorConsult()` 复用 `submitDecree` 的注入点模式（`fetchImpl`/`scheduleTimeout`/`cancelTimeout`），独立 `SubmitConsultResult` 类型，默认超时 30000ms；`route.ts` 读 `courtos_session` cookie 缺失→401、请求体非法→400，其余状态码来自 `chancellorConsult()` 的 `kind` 映射；`chancellorConsultSubmission.ts` 失败时不得把本次失败的用户发言计入下次请求要重发的历史，保证角色交替校验不被破坏。
- 实施顺序：决策记录与契约（ADR 0030 + `ARCHITECTURE.md`/scoped `AGENTS.md` 追加）→ 后端咨询端点（`chancellor_consult` 子包 + API + pytest）→ 前端 BFF/客户端（`backendClient.ts` + `route.ts` + `node --test`）→ 抽屉与会话 UI（`StudySideDrawers.tsx`、`decreeSessionLog.ts`、`chancellorConsultStatus.ts`、`chancellorConsultSubmission.ts`、接入 `StudyClient.tsx`/`DevStudyWorkspace.tsx`）→ 独立验证（test-engineer）。模块 B 的决策记录/后端/前端契约部分先于模块 A 的 UI 部分交付。
- 验证计划：前端先写红后写绿的纯函数/源码守卫测试（`decreeSessionLog.test.ts`、`chancellorConsultStatus.test.ts` 覆盖成功追加、失败保留既有消息且不破坏角色交替、发送中不可重复提交），随后 `npm run lint`、`npm run typecheck`、`npm test`、`npm run build`，以及不点击“下旨”/“发送”的 `/study` 页面烟雾验证（不产生真实模型用量）。后端 `ruff check .`、`pytest`（离线注入假聊天模型）覆盖单次调用、角色/长度/条数越界拒绝、401/422/502/503 分支。隔离证明：(1) 静态导入守卫测试断言 `chancellor_consult/graph.py`、`__init__.py` 源码不出现下旨/六部/军机处/锦衣卫/史馆相关模块名；(2) HTTP 集成测试比较聊天端点调用前后史馆/锦衣卫/军机处案卷存储行数不变；(3) 前端源码守卫断言新文件不出现 `/api/decrees/chancellor`、`submitDecree`、`/api/shiguan`、`/api/jinyiwei`、`/api/junjichu`；(4) 断言仅打开抽屉不触发任何 `fetch`。360px/`prefers-reduced-motion` 沿用 `DevStudyWorkspace.test.ts` 既有 CSS 源码断言模式。收尾运行 `node scripts/check_harness.mjs` 确认 ADR 0028 完整性基线未被破坏。
- 技术风险：`chancellor_consult` 子包意外 import 下旨相关模块会传递性拉入证据流，靠静态导入守卫测试锁死；消息角色交替状态机的失败重试/并发发送边界条件需先写红测试；UI 必须在发送前明确提示会产生一次真实 DeepSeek 调用；会话内旨意记录的记录粒度按“记录每次用户主动提交的尝试及其最终结果（成功/失败）”实现，满足“没有记录时显示可行动空状态”等验收标准。
- 架构复核补充（2026-07-28，solution-architect）：(a) 验证计划中“断言仅打开抽屉不触发任何 `fetch`”这条隔离证明写入 `StudySideDrawers.test.ts`；(b) `StudyClient.tsx` 需新增一个独立的会话内列表状态（如 `sessionLog`），在每次用户主动提交下旨前后调用 `decreeSessionLog.ts` 的纯函数追加一条“尝试 + 最终结果（成功/失败）”记录，再把列表通过 props 向下传给 `DevStudyWorkspace.tsx` → `StudySideDrawers.tsx`；不得复用单值 `uiState.phase` 冒充记录列表。(c) `backend/app/main.py`、`backend/app/agents/chancellor_consult/`、`backend/app/api/chancellor_consult.py` 及两个测试文件已有上一次交付遗留的实现，经架构只读审查确认接口、校验、错误分类、隔离边界均与本计划一致，可保留复用；module-engineer 的第一步动作是运行 `ruff check .` 与 `pytest tests/test_chancellor_consult_api.py tests/test_chancellor_consult_graph.py` 取得真实通过证据，而非重写。(d) `DevStudyWorkspace.tsx`/`.module.css`/`.test.ts` 当前工作区已有用户在同一工作区并行完成的、与本任务无关的改动（移除“真实任务库暂不可读”警示 UI），module-engineer 处理这三个文件前必须先用 Read 工具读取届时的最新内容并在其基础上做增量编辑，不得整体覆盖、不得回退该无关改动；`court-migration-assets.test.ts`、`ministriesVisual.test.ts` 的现有未提交改动同理原样保留。

## Implementation Report

- 改动摘要：新增独立、受认证的丞相咨询 Agent/API、同源 BFF 与前端客户端；实现页面会话级多轮咨询和下旨记录；新增左右可访问抽屉，右侧仅显示“暂未开放”；补充 ADR 0030、`ARCHITECTURE.md` 与前后端 scoped `AGENTS.md`。
- 自审：咨询路径与 ADR 0028 下旨闭环保持零业务依赖，每次发送只调用一次模型，不写入六部、军机处、锦衣卫或史馆。重叠的 `DevStudyWorkspace` 文件基于用户最新内容增量合并，保留移除 fallback warning 及其他并行改动。独立测试角色发现隐藏抽屉可聚焦、关闭后焦点未恢复及失败草稿被清空的问题后，已完成一次有限返工并复验通过。
- 验证：后端专项 Ruff PASS；后端咨询专项 pytest 37 passed；前端 lint、typecheck、299 项测试与 production build 全部 PASS；harness PASS（72 个基线文件）；`git diff --check` PASS。
- 实际使用的 skill：`using-superpowers`、`product-flow`、`codex-engineering-workflow`、`brainstorming`、`writing-plans`、`test-driven-development`、`frontend-design`、`record-decision`、`systematic-debugging`、`verification-before-completion`。Claude runner 返回明确 `five_hour` 配额限制后，按 product-flow 由 Codex `solution-architect`、`module-engineer`、`test-engineer` 顺序接力。
- 验证命令与结果：后端专项 Ruff — PASS；后端咨询专项 pytest — 37 passed；在 `frontend/` 运行 `npm run lint`、`npm run typecheck`、`npm test`、`npm run build` — 全部 PASS（299 tests）；`node scripts/check_harness.mjs` — PASS（72）；`git diff --check` — PASS。
- 未运行项与原因：未进行会产生真实 DeepSeek 用量的线上对话冒烟；离线测试通过注入假模型证明单次调用和端到端契约。后端全量 pytest/ruff 的唯一失败位于用户并行修改且不在本任务允许路径内的 `backend/tests/test_junjichu_cases_api.py`，本任务未越界修改。
- 剩余风险：真实对话依赖部署环境中的有效 DeepSeek 配置和网络；会话记录按产品定义仅存于当前页面内存，刷新后清空。

## Acceptance Review

- 验收结果：Accepted
- 验收证据：全部 12 条验收标准由实现代码、专项测试及独立 `test-engineer` 复验覆盖。非活动抽屉条件卸载；关闭按钮、遮罩和 Escape 均恢复对应触发器焦点；打开抽屉不发请求；失败咨询保留既有消息与草稿；成功后按顺序追加真实回复；右侧无模拟数据或提交控件；360px 和 reduced-motion 契约存在；原下旨流程与导入零请求守卫继续通过。
- 未通过项：无。
