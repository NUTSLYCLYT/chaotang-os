# 任务：上书房下旨到丞相 Agent

## Status

Accepted

## Product Definition

- 用户确认：用户于 2026-07-17 通过“自动交付：现在做一个用户通过上书房页面下旨然后到丞相，
  丞相是agent”委托自动确认与交付。
- 问题：当前前端只有后端健康检查页面，DeepSeek LangGraph 也只能由 Python 直接调用；用户无法
  在一个真实页面中输入旨意并获得由丞相 Agent 生成的回奏。
- 目标用户：在本地使用朝堂 OS 的决策者。
- 目标：交付第一个可运行的业务闭环——用户进入 `/study` 上书房页面，输入一句旨意并主动点击
  “下旨”，请求经 Next.js 服务端边界转发给 FastAPI，再由专用 LangGraph 丞相 Agent 调用现有
  DeepSeek 能力生成回奏，页面清晰展示处理中、成功或失败状态。
- 非目标：不做丞相拟旨后再次确认、不派发军机处/六部、不做知识库、任务队列、SSE、会话记忆、
  checkpointer、数据库持久化、历史列表、登录/RBAC、公开互联网部署或前端整体视觉迁移。
- 最小假设：本轮是仅绑定 `127.0.0.1` 的本地 MVP；真实模型只在用户明确点击“下旨”时调用并
  产生一次 DeepSeek API 用量。自动化测试与构建绝不调用真实模型。

## Acceptance Criteria

- [x] `GET /health` 与现有 `/` 健康展示契约保持不变；新增 `/study` 页面，包含明确的“上书房”
  标题、旨意输入、下旨按钮、模型费用提示、处理中状态、丞相身份和回奏/失败展示。
- [x] 后端新增清晰、版本化的同步接口（候选 `POST /api/v1/decrees/chancellor`），请求只接受去除
  首尾空白后 1–2000 字符的旨意；空白、超长或非法 JSON 返回稳定 4xx 且不调用 Agent。
- [x] 新增专用 LangGraph 丞相 Agent，而不是把通用 DeepSeek demo 直接当业务 API；它使用明确
  的丞相 system prompt，回奏必须包含对旨意的理解和建议下一步，不得声称尚未执行的事项已经
  完成，也不得自行触发不可逆操作。
- [x] 成功响应只返回稳定状态、丞相身份和非空回奏；配置/密钥错误映射为脱敏 503，模型调用错误
  映射为脱敏 502，响应不得包含 Key、provider 内部配置、traceback、异常原文或图内部状态。
- [x] 浏览器不直接获取 `BACKEND_BASE_URL`；前端只能通过 Next.js Route Handler/Server Action
  和 `src/lib/backendClient.ts` 的服务端客户端调用 FastAPI，成功、校验失败、后端不可达和非
  2xx 都给用户可理解反馈。
- [x] 后端依赖可注入假丞相 Agent，前后端自动测试完全离线，不读取 `backend/.env.example`，不
  访问 DeepSeek，不产生真实 API 用量；覆盖成功、输入校验、配置失败、模型失败和健康检查回归。
- [x] 新增 ADR 记录上书房 → Next.js 服务端边界 → FastAPI → LangGraph 丞相 Agent 的依赖方向、
  同步本地 MVP 取舍、费用触发边界和未来向确认/派发/持久化扩展的边界；同步更新架构与 scoped
  AGENTS 文档，并把长期文件/契约登记到 harness。
- [x] backend ruff/全部 pytest、frontend lint/typecheck/test/build、harness 与相关自测全部通过；
  私有环境文件未跟踪、禁止范围外无改动。

## Delivery Constraints

- 范围：允许修改 `backend/app/**`、`backend/tests/**`、`backend/AGENTS.md`、`frontend/src/**`、
  `frontend/AGENTS.md`、必要的前端配置/样式（不得新增依赖，除非架构角色证明必要）、
  `ARCHITECTURE.md`、`docs/decisions/0010-*.md`、`scripts/check_harness.mjs` 和本任务文件；最终
  允许路径由 Claude Code 负责人经架构分析后收窄并写回。
- 兼容性：保持现有 DeepSeek provider schema、环境解析优先级、通用图工厂、FastAPI app 入口、
  `GET /health`、首页健康展示、`BACKEND_BASE_URL` 服务端专用边界以及现有验证命令不变。
- 风险与限制：真实请求会产生 DeepSeek API 用量；本轮只支持文档规定的 `127.0.0.1` 本地运行，
  不得描述为可安全公开部署。不得读取、修改、打印或提交 `backend/.env.example`，不得提交密钥、
  日志、缓存或运行态数据；自动测试必须注入假 Agent。
- 禁止修改：`.github/**`、`docs/contracts/**`、现有 ADR 0001–0009 的既有决策正文、
  `backend/app/langgraph_runtime/graph.py`、`backend/app/langgraph_runtime/state.py`、任何私有环境文件。
- 交付过程不得提交、推送、部署或创建外部资源；不得运行真实模型 smoke。

## Affected Modules

- 模块：丞相 Agent（backend/app/agents/chancellor）
- 允许路径：`backend/app/agents/__init__.py`（新增）、`backend/app/agents/chancellor/__init__.py`
  （新增）、`backend/app/agents/chancellor/prompts.py`（新增）、
  `backend/app/agents/chancellor/graph.py`（新增）、`backend/tests/test_chancellor_graph.py`
  （新增）
- 模块：FastAPI 下旨契约（backend/app/api/decrees）
- 允许路径：`backend/app/api/__init__.py`（新增）、`backend/app/api/decrees.py`（新增）、
  `backend/app/main.py`（仅追加 include_router 与异常处理器注册，`GET /health` 路径不变）、
  `backend/tests/test_decrees_api.py`（新增）、`backend/AGENTS.md`（追加新增子包说明）
- 模块：Next.js 服务端后端客户端（frontend/src/lib/backendClient.ts）
- 允许路径：`frontend/src/lib/backendClient.ts`（编辑，新增 `submitDecree`，`fetchHealth` 不变）、
  `frontend/src/lib/backendClient.test.ts`（编辑，追加 decree 相关用例）
- 模块：上书房下旨体验（frontend/src/app/study, frontend/src/app/api/decrees）
- 允许路径：`frontend/src/app/api/decrees/chancellor/route.ts`（新增）、
  `frontend/src/app/api/decrees/chancellor/route.test.ts`（新增）、
  `frontend/src/app/study/page.tsx`（新增）、`frontend/src/app/study/decreeStatus.ts`（新增，纯函数）、
  `frontend/src/app/study/decreeStatus.test.ts`（新增）、`frontend/AGENTS.md`（追加 `/study` 与
  `src/app/api/**` Route Handler 说明）
- 治理/文档（负责人直接处理，非 module-engineer 交付）：`ARCHITECTURE.md`、
  `docs/decisions/0010-shangshufang-chancellor-agent.md`（新增 ADR）、`scripts/check_harness.mjs`
  （登记 ADR 0010 路径）、本任务文件
- 明确不修改：`docs/contracts/**`（整体禁止范围，本任务的契约只存在于后端 Pydantic 模型 + 后端
  测试、前端 TS 类型 + 前端测试中，不新增 schema 文件）、`.github/**`、ADR 0001–0009 正文、
  `backend/app/langgraph_runtime/graph.py`、`backend/app/langgraph_runtime/state.py`、
  `backend/app/langgraph_runtime/deepseek_graph.py`（专用丞相图不复用/不修改通用 demo 图）、
  `frontend/src/app/page.tsx`、`frontend/src/app/layout.tsx`
- 依赖模块：现有 FastAPI/health、DeepSeek LangGraph 与本地环境配置闭环（`deepseek_config.py`、
  `deepseek_client.py`，只读复用不修改）、Next.js App Router

## Technical Plan

- 架构边界：新建 `backend/app/agents/chancellor/`（专用丞相 LangGraph 子图，独立于
  `langgraph_runtime` 基础设施）与 `backend/app/api/decrees.py`（业务 HTTP 契约层），二者均为
  纯新增；`backend/app/main.py` 只做 include_router + 异常处理器注册的追加式编辑。前端新增
  `/study` 页面与 `src/app/api/decrees/chancellor/route.ts`（Next.js 服务端边界），
  `backendClient.ts` 追加 `submitDecree`，`fetchHealth` 与首页不受影响。
- 接口与依赖：
  - `POST /api/v1/decrees/chancellor`：请求 `{ decree_text: string }`，Pydantic 校验去除首尾空白
    后长度须在 1–2000（含）之间，否则触发 FastAPI 默认 422（不会调用 Agent）；成功返回
    `{ status: "ok", chancellor: "丞相", memorial_text: <非空字符串> }`（200）。
  - 端点函数体内显式调用 `get_chancellor_graph()`（模块级函数，不作为 `Depends()` 参数），确保
    payload 校验失败时 FastAPI 根本不会进入函数体、不会触发 Agent 构建/调用（已用最小复现验证：
    若把 Agent provider 挂在 `Depends()` 上，即便请求体后续校验失败，`Depends()` 仍会被调用）。
  - 错误映射：`DeepSeekConfigError` 及其子类（配置文件缺失/解析失败/schema 错误/API key 缺失）
    → 503；新建的 `ChancellorGraphInvocationError`（模型调用失败）→ 502；两类响应体均为脱敏
    `{ status: "error", reason: <稳定枚举>, message: <用户可读文案> }`，不包含 key、路径、
    traceback、图内部状态。异常处理器通过 `register_chancellor_exception_handlers(app)` 在
    `main.py` 中统一注册一次。
  - `build_chancellor_graph(chat_model=None, dotenv_path=None)`：与 `build_deepseek_graph` 同构
    的注入契约——传入 `chat_model` 时完全离线可测；不传时才会触发
    `load_deepseek_provider_config()` + `build_deepseek_chat_model()`（只读复用现有模块，不改动）。
    单节点图：拼装 `[system: CHANCELLOR_SYSTEM_PROMPT, user: decree_text]`，调用 chat model，写回
    `memorial_text`；模型异常包装为 `ChancellorGraphInvocationError` 并保留 `__cause__`，绝不吞异常。
  - 前端调用链：`/study`（客户端组件）→ 同源相对路径 `fetch('/api/decrees/chancellor')` →
    `route.ts`（`export async function POST`）→ `backendClient.ts` 的 `submitDecree()` → FastAPI。
    浏览器不获取 `BACKEND_BASE_URL`。`submitDecree` 遵循 `fetchHealth` 的"不抛出、返回可辨识结果"
    契约，返回 `{ ok: true, data } | { ok: false, kind: "validation"|"config"|"model"|"network"|
    "unknown", error }`；因 LLM 调用可能耗时较长，使用独立于 `fetchHealth`（3000ms）的更长超时
    （30–60s）。`route.ts` 把该结果映射回真实 HTTP 状态码（200/422/503/502），页面用
    `decreeStatus.ts` 纯函数把结果映射为处理中/成功/失败展示状态。
  - `docs/contracts/**` 保持不新增文件（Delivery Constraints 明确禁止整个路径）；该契约的
    唯一来源是后端 Pydantic 模型 + 后端测试、前端 TS 类型 + 前端测试，此不对称将在 ADR 0010
    中显式记录。
- 实施顺序：架构分析（已完成）→ 后端丞相 Agent（`app/agents/chancellor`）→ FastAPI 契约
  （`app/api/decrees.py` + `main.py` 追加）→ 前端服务端客户端 `backendClient.ts` 追加
  `submitDecree` → 前端 BFF `route.ts` → `/study` 页面与 `decreeStatus.ts` → 各模块独立测试 →
  ADR 0010 / ARCHITECTURE.md / scoped AGENTS 文档 / harness 登记 → 全量验证。
- 验证计划（全部离线，不产生真实 DeepSeek 用量）：
  - 后端：`cd backend && .venv\Scripts\python.exe -m ruff check .`，
    `.venv\Scripts\python.exe -m pytest`；覆盖成功、校验失败（含断言 Agent 调用次数为 0）、
    配置失败（503，不泄露 key/路径）、模型失败（502，不泄露原始异常）、`GET /health` 回归。
  - 前端：`npm run lint`、`npm run typecheck`、`npm test`、`npm run build`；`backendClient`
    覆盖成功/422/503/502/网络不可达；`route.test.ts` 直接调用 `POST` 并配合本地 stub 后端；
    `decreeStatus.test.ts` 纯函数覆盖处理中/成功/失败映射；构建后手动
    `npm run start` + `curl -i http://localhost:3000/study` 确认初始渲染包含标题/输入框/按钮/
    费用提示字样（仅验证首屏渲染，不构成端到端点击验证，需在实现报告中明确说明）。
  - Harness：`node scripts/check_harness.mjs`、`node scripts/check_harness.mjs --self-test`、
    `node .agents/hooks/check-harness.mjs --self-test`、
    `node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test`。
- 技术风险：同步模型调用延迟、模型费用、无持久化导致刷新后结果丢失、本地 MVP 不具备公开部署
  的鉴权与限流能力；新增 `app/agents/` + `app/api/` 子包与 `docs/contracts/**` 之外维护契约
  存在双处定义漂移风险（已在 ADR 0010 中记录为设计取舍）。

## Implementation Report

- 改动摘要：Claude Code 完成四个顺序模块后在治理收口阶段触发会话额度上限；用户明确授权
  Codex 切换为程序团队负责人完成剩余工作。
  - 后端新增 `app/agents/chancellor/` 专用单节点 LangGraph Agent，使用丞相 system prompt，
    只读复用现有 DeepSeek 配置/客户端构造，并支持假聊天模型注入。
  - 后端新增 `app/api/decrees.py` 与 `POST /api/v1/decrees/chancellor`；Pydantic 在进入端点前
    校验旨意，成功返回稳定丞相回奏，配置/模型错误分别脱敏映射为 503/502，`main.py` 只追加
    router 和 handler 注册，`GET /health` 不变。
  - 前端 `backendClient.ts` 新增服务端 `submitDecree()`；Next.js Route Handler
    `/api/decrees/chancellor` 作为 BFF；新增 `/study` 客户端页面和纯函数状态映射，展示费用提示、
    处理中、丞相回奏和分类失败状态，浏览器不获取 `BACKEND_BASE_URL`。
  - 新增 ADR 0010，更新 `ARCHITECTURE.md`、前后端 scoped AGENTS 和 harness 基线。
- 自审：Codex 全量复核后做一次有限返工：请求旨意在后端统一 `strip()`；丞相图和 HTTP 层双重
  拒绝空模型/空回奏并映射为脱敏 502；`DeepSeekModelNameError` 映射为脱敏 503；前端只接受
  `status == "ok"` 且身份/回奏非空的成功响应，并阻止空白/超长页面提交；同步修正 `main.py`、
  `ARCHITECTURE.md` 和 `backend/AGENTS.md` 的旧“仅 health”说明。新增回归测试覆盖所有修复。
  禁止路径（`.github/**`、`docs/contracts/**`、ADR 0001–0009、通用图/状态）零改动；自动化未读取
  私有 dotenv，未执行真实模型调用。
- 验证：
  - `backend/.venv/Scripts/python.exe -m ruff check .`：通过；
  - `backend/.venv/Scripts/python.exe -m pytest -q`：`82 passed, 1 warning`；
  - `frontend`: lint、typecheck 通过，`npm test` 为 `31 passed`，`npm run build` 成功并生成
    `/study` 静态页与 `/api/decrees/chancellor` 动态 Route Handler；
  - harness：41 个基线文件、17 项 self-test、3 项 Stop hook、18 项 product-flow runner 全通过；
  - 一次性 `next start` smoke：`/study` 返回 200，包含标题、下旨按钮和费用提示，进程随后关闭；
    未点击下旨、未产生真实 DeepSeek 用量；
  - `git diff --check` 通过。
- 剩余风险：本轮是同步、无鉴权、无限流、无持久化的 `127.0.0.1` 本地 MVP；刷新会丢失回奏，
  45 秒超时可能把慢模型表现为网络错误；后端 Pydantic 与前端 TypeScript 各自维护同一契约，存在
  漂移风险。公开部署、登录/RBAC、确认后派发、任务状态/SSE、知识库和持久化必须另建产品任务。

## Acceptance Review

- 验收结果：Accepted
- 验收证据：Codex 在用户授权切换为程序团队负责人后逐项核对 8 条验收标准，并完成一次有限返工。
  `/study` 页面、Next.js BFF、版本化 FastAPI 接口和专用 LangGraph 丞相 Agent 已形成完整本地闭环；
  输入校验、非空回奏、503/502 脱敏映射、服务端环境变量边界与离线依赖注入均有自动化测试覆盖。
  `GET /health` 和现有首页保持回归通过，ADR 0010、架构文档、scoped AGENTS 与 harness 登记已同步。
  后端 ruff 与 82 项 pytest、前端 lint/typecheck/build 与 31 项测试、41 个 harness 基线、17 项
  harness self-test、3 项 Stop hook 和 18 项 product-flow runner self-test 全部通过；`/study`
  一次性本地启动冒烟返回 200 并包含标题、按钮与费用提示。全程未读取私有 dotenv、未调用真实
  DeepSeek、未修改禁止路径，`git diff --check` 通过。
- 未通过项：无。真实 DeepSeek 点击调用未纳入自动验收，以避免产生费用；该行为由用户在已配置
  本地密钥的环境中主动点击“下旨”触发。
