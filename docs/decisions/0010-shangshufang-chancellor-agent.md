# 决策 0010：上书房下旨到丞相 Agent 的首个业务闭环

## Status

Accepted — 2026-07-17

## Context

`docs/decisions/0007-langgraph-runtime-foundation.md` 和
`docs/decisions/0008-deepseek-langgraph-integration.md` 只确定了最小 LangGraph 运行时和
唯一 DeepSeek provider 接入，明确排除"具体业务工作流"和"任何新增的公开 HTTP 业务接口"。
在此之前仓库没有任何业务 API：前端只有健康检查页面，`build_deepseek_graph()` 只是一个
demo 级图工厂，没有专用 system prompt、没有业务身份、也没有被任何 HTTP 端点调用。

产品任务 `docs/product/tasks/2026-07-17-shangshufang-chancellor-agent.md`（用户于
2026-07-17 通过"自动交付：现在做一个用户通过上书房页面下旨然后到丞相，丞相是agent"确认）
要求交付第一个可运行的业务闭环：用户在 `/study`（上书房）页面输入旨意并点击"下旨"，请求
经 Next.js 服务端边界转发给 FastAPI，由专用 LangGraph"丞相"Agent 调用现有 DeepSeek 能力
生成回奏。范围明确排除：拟旨二次确认、六部/军机处派发、知识库、任务队列、SSE、会话记忆、
checkpointer、数据库持久化、历史列表、登录/RBAC、公开部署。本轮仅支持 `127.0.0.1` 本地
运行，真实调用只在用户点击"下旨"时触发一次 DeepSeek API 用量，自动化测试全程离线。

## Decision

### 依赖方向

```
浏览器（同源相对路径，不获取 BACKEND_BASE_URL）
  -> frontend/src/app/study/page.tsx（客户端组件）
  -> frontend/src/app/api/decrees/chancellor/route.ts（Next.js Route Handler，服务端边界）
  -> frontend/src/lib/backendClient.ts::submitDecree()（服务端专用后端客户端）
  -> POST /api/v1/decrees/chancellor（FastAPI，backend/app/api/decrees.py）
  -> backend/app/agents/chancellor/graph.py::build_chancellor_graph()
  -> backend/app/langgraph_runtime/deepseek_config.py + deepseek_client.py（只读复用）
```

`backend/app/langgraph_runtime/graph.py`、`state.py`、`deepseek_graph.py` 零改动；新的
丞相 Agent 不调用 `build_deepseek_graph()`，只复用其下层的配置加载
（`load_deepseek_provider_config()`）和聊天模型构建（`build_deepseek_chat_model()`）。

### 为什么新增独立的 `app/agents/` 子包，而不是扩展 `langgraph_runtime/`

`backend/AGENTS.md` 把 `langgraph_runtime/` 明确限定为"图工厂和配置加载入口，不新增聊天
HTTP API"这类基础设施边界。把业务 Agent（专属 system prompt、业务状态、业务错误类型）
放进这个目录会和它自身的既有职责声明冲突，也会让未来非 DeepSeek 的业务 Agent 难以找到
干净的落脚点。新建 `backend/app/agents/chancellor/`
（`prompts.py` + `graph.py`，独立的 `ChancellorGraphState`、`ChancellorGraphInvocationError`、
`build_chancellor_graph(chat_model=None, dotenv_path=None)`，与 `build_deepseek_graph`
同构的依赖注入契约）作为纯新增子包，把"基础设施"与"业务"的所有权边界维持清晰，这也是
验收标准里"专用 Agent，而不是把通用 DeepSeek demo 直接当业务 API"的直接落地方式。

### 为什么新增独立的 `app/api/` 子包承载 HTTP 契约

同理，`backend/app/health.py` 和 `backend/app/main.py` 此前只承载健康检查这一个跨端
契约面。新建 `backend/app/api/decrees.py` 独立承载 `POST /api/v1/decrees/chancellor`
的请求/响应模型和路由，`main.py` 只做一次 `include_router` 与异常处理器注册的追加式编辑，
`GET /health` 的既有代码路径不受影响。

### 为什么端点不把 Agent provider 包装成 FastAPI `Depends()` 参数

架构分析阶段用最小复现验证了一个 FastAPI 行为：当端点把某个可调用对象包装成
`Depends()` 参数时，即便请求体随后未通过 Pydantic 校验（触发 422），该 `Depends()`
仍然会被执行一次。如果把 `get_chancellor_graph` 包装成 `Depends()`，一次空白或超长的
旨意就会在返回 422 之前提前触发 Agent 构建（进而可能触发真实配置加载），直接违反验收标准
"空白、超长或非法 JSON 返回稳定 4xx 且不调用 Agent"。因此 `submit_decree` 端点函数体内
显式调用模块级函数 `get_chancellor_graph()`，只有 `payload: ChancellorDecreeRequest`
（非 `Depends`、必需参数）校验通过后才会进入函数体。自动化测试通过
`monkeypatch.setattr(decrees_module, "get_chancellor_graph", ...)` 注入假图，并显式断言
校验失败场景下假 provider 调用次数为 0，把这条约束固化为回归测试。

### 错误脱敏设计

`DeepSeekConfigError`（及其子类：配置文件缺失、解析失败、schema 错误、API key 缺失）统一
映射为 503；新增的 `ChancellorGraphInvocationError`（模型调用失败）映射为 502。两类响应体
都是固定文案的 `{"status": "error", "reason": <稳定枚举>, "message": "丞相暂时无法处理
旨意，请稍后再试"}`，通过 `register_chancellor_exception_handlers(app)` 在 `main.py`
中注册一次，从不拼接原始异常的 `str()`，因此不会把 key、文件路径、provider 内部配置、
traceback 或图内部状态透传给客户端。

### `docs/contracts/**` 保持不新增文件

`GET /health` 的跨端契约在根级 `docs/contracts/health.schema.json` 共享，但本任务的
Delivery Constraints 明确禁止修改整个 `docs/contracts/**` 路径。因此下旨接口的契约不
复制这个"共享 schema 文件"模式，而是分别独立维护：后端 Pydantic 模型 + 后端测试是唯一
真源，前端 TypeScript 类型（`SubmitDecreeResult`/`SubmitDecreeData`）+ 前端测试是另一个
独立真源。这是刻意的不对称，记录在此以避免被误认为是遗漏——后果和取舍见下文 Consequences。

### 前端服务端边界与超时

`frontend/src/lib/backendClient.ts` 新增 `submitDecree()`，遵循 `fetchHealth` 已建立的
"从不抛出、返回可辨识结果"契约，但使用独立于 `fetchHealth`（约 3000ms）的更长超时常量
（45000ms），因为真实 DeepSeek 调用可能比健康检查慢得多；沿用同一常量而不新增会导致真实
"下旨"点击在模型尚未响应时就被误判为"后端不可达"。`frontend/src/app/api/decrees/chancellor/route.ts`
把 `submitDecree` 的结果映射回真实 HTTP 状态码（200/422/503/502/503），浏览器只 fetch
同源相对路径 `/api/decrees/chancellor`，不获取也不引用 `BACKEND_BASE_URL`。

### 同步本地 MVP 取舍与费用触发边界

本轮不引入 SSE、任务队列或轮询：用户点击"下旨"后，浏览器发起的请求同步阻塞直到 FastAPI
返回结果或超时，页面在此期间展示"处理中"状态并禁用按钮防止重复提交。刷新页面会丢失结果
（无持久化、无会话记忆、无 checkpointer，均为本任务明确非目标）。真实 DeepSeek API 用量
只在用户主动点击"下旨"、请求到达未被测试替换的 `get_chancellor_graph()`/
`build_chancellor_graph()` 时产生；所有自动化测试（后端 pytest、前端 node --test）都通过
依赖注入使用假 Agent/假聊天模型，不读取 `backend/.env.example`，不访问网络。

## Consequences

- 收益：仓库有了第一个端到端可运行的业务闭环，验证了"浏览器 → Next.js 服务端 → FastAPI
  → LangGraph 业务 Agent → DeepSeek"这条依赖链在真实场景下可行；`langgraph_runtime/` 和
  `deepseek_graph.py` 等既有基础设施零改动，风险面局限在纯新增文件加两处追加式编辑
  （`main.py`、`backendClient.ts`）；错误脱敏和"校验失败不调用 Agent"两条硬约束都有专门
  的回归测试锚定，不依赖开发者记忆。
- 代价：
  - `docs/contracts/**` 之外维护的下旨契约存在后端/前端两处独立定义漂移的风险——未来任一
    侧修改字段名/错误 `reason` 枚举，如果不同步修改另一侧,只能靠人工审查或集成测试发现,
    没有共享 schema 文件做机械校验。
  - 同步阻塞设计意味着没有取消/重试机制，且完全依赖真实模型延迟；如果 DeepSeek 响应慢于
    `submitDecree` 的 45000ms 超时，用户会看到"网络错误"而非真正的模型超时原因，这是当前
    简化换来的可接受体验代价。
  - 本地 MVP 不具备鉴权、限流或公开部署所需的安全能力，任何把 `/study` 暴露到
    `127.0.0.1` 之外的尝试都需要新的产品任务和新的 ADR。
  - 新增 `app/agents/`、`app/api/` 两个子包扩大了后端目录结构；如果未来出现更多业务
    Agent，需要在那时决定是否需要更通用的注册/组合机制，本次不预先设计。

## Verification

2026-07-17 Claude Code 完成四个业务模块后触发会话额度上限，用户明确授权 Codex 切换为程序
团队负责人完成独立审查、有限返工与验收。最终由 Codex 复跑并确认（详见同一产品任务文件的
Implementation Report）：

- `backend/.venv/Scripts/python.exe -m ruff check .`：通过；
- `backend/.venv/Scripts/python.exe -m pytest -q`：`82 passed, 1 warning`，新增丞相 Agent 与下旨端点测试
  覆盖成功、校验失败（含 Agent 调用次数为 0 的回归断言）、配置失败（503 脱敏）、模型失败
  （502 脱敏）、`GET /health` 回归；
- `frontend`：`npm run lint`、`npm run typecheck`、`npm test`（31 个测试）、`npm run build` 全部通过，
  新增 `backendClient.submitDecree`、Route Handler、`/study` 页面状态映射的离线测试；
- `node scripts/check_harness.mjs`（41 个基线文件）、`node scripts/check_harness.mjs --self-test`（17 项）、
  `node .agents/hooks/check-harness.mjs --self-test`、
  `node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test`：分别 3 项、18 项通过；
- `npm run start` 一次性 smoke 后请求 `/study`：HTTP 200，包含“上书房”标题、下旨按钮和
  DeepSeek 费用提示；随后确认进程已关闭。未点击“下旨”、未触发真实 DeepSeek 调用；
- Codex 返工新增回归：旨意首尾空白归一化、空模型/空回奏拒绝、模型名错误脱敏 503、前端拒绝
  空成功响应，相关定向测试 19 个后端用例与 31 个前端用例全部通过。
