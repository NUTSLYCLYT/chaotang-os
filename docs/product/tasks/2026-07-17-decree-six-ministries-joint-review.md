# 任务：圣旨分流至六部或军机处会审

## Status

Accepted

## Product Definition

- 用户确认：用户于 2026-07-17 通过“自动交付：我下旨后，丞相判断是否是单部门处理还是需要多部门处理，如果是单部门就继续往下走到六部的其中一个部，如果是多部门的话需要走军机处，然后军机处拉六部其中相关的部门，进行会审”委托自动确认与交付；并明确要求先提交、推送上一批改动后再实现，本任务已在干净基线上开始。
- 问题：当前下旨流程止于丞相生成一段回奏，无法把旨意按职责派往六部，也无法在涉及多个部门时进入军机处并组织相关部门会审。
- 目标用户：在本地使用朝堂 OS 下旨并查看办理路径的决策者。
- 目标：丞相收到旨意后判断单部门或多部门事项；单部门事项进入吏、户、礼、兵、刑、工六部之一并形成办理意见；多部门事项进入军机处，由军机处召集至少两个相关部门，各部给出意见后形成会审结论；上书房页面清晰展示完整流转路径、丞相判断、参与部门及最终结果。
- 非目标：不执行现实政务动作，不做人工确认、任务队列、SSE/流式输出、数据库持久化、历史记录、并行模型调用、知识库、登录/RBAC、公开部署或真实部门外部集成。
- 最小假设：六部固定为吏部、户部、礼部、兵部、刑部、工部；“相关部门”由丞相的结构化判断给出。每个被召集部门只形成咨询性办理意见；军机处只在多部门路径中组织并汇总会审，不自行扩大部门范围。真实请求可产生“丞相判断 + 各参与部门 + 军机处汇总”多次 DeepSeek 调用费用，自动化测试全部使用假模型且不读取私有环境文件。

## Acceptance Criteria

- [x] 后端下旨成功响应包含稳定、可校验的流转结果：丞相身份与判断说明、`single|multi` 路由类型、有序流转路径、参与部门列表、每个部门的非空办理意见，以及最终非空结论；部门值只能来自固定六部。
- [x] 单部门旨意只选择一个部门，流转路径为“上书房 → 丞相 → 对应部”，不出现军机处；对应部门形成办理意见，该意见同时作为本次最终结论或有明确、稳定的最终结论字段。
- [x] 多部门旨意选择至少两个且不重复的相关部门，流转路径包含“上书房 → 丞相 → 军机处”及全部被召集部门；各部门均形成独立非空意见，军机处在取得全部意见后形成非空会审结论。
- [x] 丞相模型输出采用严格结构化契约；非法 JSON、非法路由类型、未知/重复部门、单部门数量不为 1、多部门数量少于 2、空判断说明、空部门意见或空会审结论均失败关闭，映射为既有脱敏模型错误，不返回半成品或内部异常。
- [x] 六部与军机处使用清晰、可审计的专用角色提示词，不声称尚未发生的现实执行已经完成，不触发工具或不可逆外部操作；多部门处理按确定顺序调用部门，避免共享工作区或模型调用的隐式并发。
- [x] 保持现有 `POST /api/v1/decrees/chancellor`、输入校验、503/502 脱敏错误和 `GET /health` 兼容；前端 Next.js 服务端边界仍是浏览器访问后端的唯一通道，浏览器不得获取 `BACKEND_BASE_URL`。
- [x] `/study` 在成功后展示丞相判断、单部门办理或军机处会审路径、参与部门意见和最终结论；处理中与费用提示反映一次下旨可能触发多次模型调用；校验、配置、模型、网络和未知错误仍有可理解且脱敏的反馈。
- [x] 后端图与 API 可注入假模型/假图并完全离线测试，覆盖单部门、多部门、六部范围约束、结构化输出失败、调用失败、输入校验零调用和健康回归；前端测试覆盖新成功契约的解析、BFF 转换与 UI 状态映射。
- [x] 新增 ADR 记录丞相结构化分流、六部顺序办理、军机处多部门会审、同步多模型调用与无持久化取舍；同步更新架构、scoped AGENTS 与 harness 基线。
- [x] backend ruff/全部 pytest、frontend lint/typecheck/test/build、harness 与相关自测全部通过；不读取或提交私有环境文件，不调用真实 DeepSeek，不修改范围外文件。

## Delivery Constraints

- 范围：允许修改 `backend/app/agents/**`、`backend/app/api/decrees.py`、相关后端测试、`frontend/src/lib/backendClient*`、`frontend/src/app/api/decrees/chancellor/**`、`frontend/src/app/study/**`、`backend/AGENTS.md`、`frontend/AGENTS.md`、`ARCHITECTURE.md`、新增 ADR、`scripts/check_harness.mjs` 和本任务文件；最终允许路径由程序团队负责人经架构分析后收窄。
- 兼容性：保留现有请求体 `{ decree_text }`、API 路径、输入长度、错误状态码、服务端环境变量边界与 `GET /health`；允许在成功响应中用新的结构化流转结果替代旧的单段 `memorial_text`，但前后端必须在同一变更中升级并由测试锁定。
- 风险与限制：同步多次模型调用会增加延迟和费用；本轮仍是仅绑定 `127.0.0.1`、无鉴权、无限流、无持久化的本地 MVP。不得读取、修改、打印或提交 `backend/.env.example`，不得运行真实模型 smoke。
- 交付过程不得再次提交、推送、部署或创建外部资源；本次新改动保持未提交，等待用户后续明确指令。

## Affected Modules

- 模块：丞相分流与六部办理 Agent（模块 1）
- 允许路径：`backend/app/agents/chancellor/graph.py`、`backend/app/agents/chancellor/prompts.py`、
  `backend/app/agents/chancellor/__init__.py`、`backend/app/agents/ministries/__init__.py`（新增）、
  `backend/app/agents/ministries/prompts.py`（新增）、`backend/app/agents/ministries/agent.py`（新增）、
  `backend/app/agents/structured_output.py`（新增，供三个 agent 包共用的严格 JSON 解析辅助函数）、
  `backend/tests/test_chancellor_graph.py`、`backend/tests/test_ministries_agent.py`（新增）、
  `backend/tests/test_structured_output.py`（新增）
- 依赖模块：现有 DeepSeek 客户端与丞相 Agent（`app.langgraph_runtime.deepseek_client`/`deepseek_config`，只读复用，不修改）
- 模块：军机处会审编排（模块 2）
- 允许路径：`backend/app/agents/junjichu/__init__.py`（新增）、`backend/app/agents/junjichu/prompts.py`（新增）、
  `backend/app/agents/junjichu/agent.py`（新增）、
  `backend/app/agents/chancellor/graph.py`（仅限：新增多部门条件边、注册军机处节点、导入 `app.agents.junjichu`；
  不得重写模块 1 已交付的单部门节点逻辑）、`backend/tests/test_junjichu_agent.py`（新增）、
  `backend/tests/test_chancellor_graph.py`（追加多部门端到端图测试，不得删除模块 1 的单部门测试）
- 依赖模块：丞相分流与六部办理 Agent（复用 `invoke_ministry_agent`、图状态字段、异常类型）
- 模块：下旨 HTTP 契约与上书房展示（模块 3）
- 允许路径：`backend/app/api/decrees.py`、`backend/tests/test_decrees_api.py`、
  `frontend/src/lib/backendClient.ts`、`frontend/src/lib/backendClient.test.ts`、
  `frontend/src/app/api/decrees/chancellor/route.ts`、`frontend/src/app/api/decrees/chancellor/route.test.ts`、
  `frontend/src/app/study/page.tsx`、`frontend/src/app/study/decreeStatus.ts`、
  `frontend/src/app/study/decreeStatus.test.ts`、
  `docs/decisions/0012-decree-six-ministries-joint-review.md`（新增 ADR，`0011` 已被占用）、
  `ARCHITECTURE.md`、`backend/AGENTS.md`、`frontend/AGENTS.md`、
  `scripts/check_harness.mjs`（把新 ADR 路径加入 `REQUIRED_FILES`）
- 依赖模块：现有 FastAPI 下旨接口、Next.js BFF 与 `/study` 页面；消费模块 1+2 最终确定的图状态形状

## Technical Plan

- 架构边界：
  - `backend/app/langgraph_runtime/**`（DeepSeek 客户端/配置）不在允许范围内，不得修改；`DeepSeekChatModel = Callable[[list[dict]], str]` 签名保持不变，结构化契约只能靠"提示词约束 + 共享严格解析/校验"在 `app/agents/**` 实现。
  - 单部门/多部门/军机处编排必须整体封装在 `app/agents/**` 内的一个已编译 LangGraph 图里；`app/api/decrees.py` 仍只做一次 `graph.invoke(...)` + 契约映射，不做多次图调用编排（沿用 `backend/AGENTS.md` "api 不实现 agent 图逻辑"的既有边界）。
  - 新增的所有结构化校验失败统一复用/继承既有 `ChancellorGraphInvocationError -> 502` 映射，不新增异常类型或异常处理器。
  - LangGraph 图在 `.compile()` 时一次性接好全部节点/条件边；军机处分支因此必须回写 `chancellor/graph.py`（新增条件边与节点注册），这是记录在案的、刻意的跨模块文件编辑，不是范围失控。
- 接口与依赖：
  - 六部固定名录单一事实来源：`app/agents/ministries/` 定义 `MINISTRIES = ("吏部","户部","礼部","兵部","刑部","工部")`，其余位置只导入使用。
  - 丞相路由 JSON 契约：`{"route_type": "single"|"multi", "rationale": "<非空>", "departments": [...]}`；校验规则：非法 JSON/`route_type`非法/部门不在六部/部门重复/single≠1个/multi<2个/`rationale`空——全部失败关闭。
  - 六部办理 JSON 契约：`{"opinion": "<非空办理意见>"}`，由 `invoke_ministry_agent(department, decree_text, rationale, chat_model) -> str` 产出，供模块 1（单部门）与模块 2（军机处顺序调用）共用。
  - 军机处会审 JSON 契约：`{"verdict": "<非空会审结论>"}`，`run_junjichu_council(state)` 用纯 Python `for` 循环按丞相给定顺序串行调用 `invoke_ministry_agent`（禁止并发/`Send` 扇出），收集保序 `ministry_opinions` 后产出 `verdict`。
  - 图状态 `ChancellorGraphState` 扩展为：`decree_text, chancellor_rationale, route_type, departments, processing_path, ministry_opinions, final_verdict`；拓扑 `START -> decide_route -> (条件边) -> {single: handle_single_ministry, multi: run_junjichu_council} -> END`。
  - HTTP 响应契约新增字段：`route_type, rationale, processing_path, departments, ministry_opinions([{department, opinion}]), final_verdict`；`department`/`route_type` 用 `str` 而非 `Literal`/`Enum`（强校验只在图层做一次，避免响应模型对理论不可能值再抛未捕获 500）。`ChancellorDecreeResponse` 保留既有 `status`、`chancellor` 字段（满足“丞相身份”验收点），删除旧的单段 `memorial_text` 字段，由上述新字段整体替代。
  - 前端契约驼峰化对应：`routeType, rationale, processingPath, departments, ministryOpinions, finalVerdict`；`route.ts` 原样透传映射，不新增错误分类；`decreeStatus.ts` 的 `success` 分支扩展这些字段；`page.tsx` 渲染判断说明、`processingPath.join(" → ")`、各部门意见列表、最终结论，费用提示文案改为反映"可能触发多次模型调用"。
  - `frontend/src/lib/backendClient.ts` 的 `DECREE_TIMEOUT_MS` 从 45000ms 上调至 **120000ms**：最坏情况 1(路由)+6(六部)+1(汇总)=8 次串行 DeepSeek 调用，45s 不足以覆盖，避免把"模型仍在处理"误判为网络错误；该数值及依据写入新 ADR。
- 实施顺序：
  1. 模块 1（丞相分流与六部办理 Agent）——产出六部名录、共享结构化解析工具、丞相路由 schema、单部门全链路可运行图，是模块 2/3 的公共依赖。
  2. 模块 2（军机处会审编排）——在模块 1 的图上补多部门条件边和军机处节点，复用 `invoke_ministry_agent`。
  3. 模块 3（下旨 HTTP 契约与上书房展示）——图的最终状态形状（覆盖 single/multi）稳定后一次性对齐 HTTP 契约、前端与文档收尾（含超时值、ADR）。
  4. test-engineer 在三个模块交付后统一执行整体查漏和验收级验证（`test_decrees_api.py` 端到端用例、跨端契约测试需等模块 3 落地才有意义）；模块 1/2 各自的单元测试由 module-engineer 随交付同步补齐。
- 验证计划：
  - 后端（`backend/.venv/Scripts/python.exe -m ruff check .` / `pytest -q`）：路由判断合法 single/multi（含 6 部门边界）与全部非法分支（非法 JSON/route_type/六部范围/重复/计数/空 rationale）；`invoke_ministry_agent` 合法/非法 JSON、空 opinion、异常不泄密、system prompt 含身份与"不得声称已执行不可逆操作"约束；单部门全链路 `processing_path`/`final_verdict` 断言；军机处多部门全链路 `processing_path` 含"军机处"及全部部门、`ministry_opinions` 保序非空、`final_verdict` 来自汇总；调用次数与顺序回归证明无隐式并发；跨调用无状态泄漏；HTTP 层 single/multi 响应字段完整性精确断言、图层失败→502 脱敏、既有 503/输入校验零调用/`GET /health` 回归原样保留。
  - 前端（`npm run lint`/`typecheck`/`test`/`build`）：`backendClient.test.ts` 新契约解析（含字段缺失回退 unknown）与既有错误码用例、超时值调整后的超时分支验证；`route.test.ts` 新成功响应体透传与既有错误映射；`decreeStatus.test.ts` success 状态新增字段映射；`next build` + 一次性 `npm run start` 烟雾验证 `/study` 返回 200 且费用提示文案更新。
  - Harness：`node scripts/check_harness.mjs`、`--self-test`、`node .agents/hooks/check-harness.mjs --self-test`、`node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test`。
- 技术风险：
  - 多部门最坏 8 次串行调用延迟叠加超过前端超时 → 已上调 `DECREE_TIMEOUT_MS` 至 120000ms 并写入 ADR，同时如实记录"后端无法设置单次调用超时"（`langgraph_runtime` 不可改）这一已知限制。
  - 模型输出可能带 markdown 代码块包裹 → `structured_output.py` 提供唯一共享严格解析函数（仅允许去除首尾空白和可选 ```json/``` 包裹，其余一律 `json.loads` 失败即失败关闭），三个 agent 包必须复用同一函数。
  - 军机处若误用 LangGraph `Send`/fan-out 引入隐式并发 → 节点内部用纯 Python `for` 循环顺序调用，用调用顺序/计数回归测试锁定。
  - 提示词遗漏"不得声称已执行不可逆操作"约束 → 固化为模块 1 提供的共享常量，六部与军机处提示词统一引用，参数化测试遍历断言存在。
  - 六部名录多处漂移 → 只在 `app/agents/ministries/` 定义一次，追加名录一致性回归测试。
  - Pydantic 响应模型强类型可能把业务失败变成未捕获 500 → 响应模型字段保持 `str`，强校验只在图层做一次。
  - 后端 Pydantic 模型与前端 TS 类型仍是两处独立真源（沿用 ADR 0010 已知代价）→ 双侧测试锁定字段名/形状作为唯一机械校验手段。

## Implementation Report

- 改动摘要：Claude Code 依次完成架构复核与三个业务模块的大部分交付，并在独立测试阶段触发
  `five_hour` 配额拒绝；按 product-flow 协议由 Codex 同名专业角色顺序接力完成收口。
  - 丞相 Agent 改为严格结构化分流，固定从吏、户、礼、兵、刑、工六部中选择；单部门路径直接
    进入对应部，多部门路径进入军机处。
  - 新增六部 Agent、共享严格 JSON 解析和军机处 Agent；军机处按丞相给出的有序部门列表串行
    收集意见，再形成会审结论，不使用隐式并发或外部工具。
  - 下旨 API、Next.js 服务端客户端/BFF 和 `/study` 页面同步升级为结构化流转契约，展示丞相
    判断、办理路径、部门意见与最终结论；超时上调至 120 秒，费用提示明确一次旨意可能产生
    多次模型调用。
  - 新增 ADR 0012，更新架构、前后端 scoped AGENTS 与 harness 基线。
- 自审：Codex `solution-architect` 只读复核确认 Technical Plan、允许路径和依赖方向仍正确，
  所有改动均在任务范围内，无需新增产品决定。`test-engineer` 删除“multi 尚未接线”的过时假绿
  语义，改为真实军机处成功路径；把状态隔离测试改为同一 compiled graph 连续调用；补齐空部门
  意见经图包装并由 HTTP 脱敏映射为 502 的链路；全六部 multi 边界测试有效。负责人随后清理
  “forthcoming/草拟回奏”等已过时文案，并核对未修改 provider、私有 dotenv 或范围外文件。
- 验证：`backend/.venv/Scripts/python.exe -m ruff check .` 通过；
  `backend/.venv/Scripts/python.exe -m pytest -q` 为 `172 passed, 1 warning`；frontend lint、
  typecheck、`41 tests`、production build 全通过；harness 为 46 个基线文件，harness self-test
  20 项、Stop hook 3 项、product-flow runner self-test 25 项全部通过；`/study` production smoke
  返回 200 并包含“上书房/下旨/多次模型调用”，未提交表单、未启动后端、未调用真实模型；
  `git diff --check` 通过。所有模型行为测试均注入 fake model，pytest autouse fixture 把 dotenv
  fallback 指向不存在的临时路径。
- 剩余风险：同步调用最坏为丞相 1 次、六部 6 次、军机处汇总 1 次，仍可能超过 120 秒；本地
  MVP 仍无鉴权、限流、持久化、重试或流式进度。后端 Pydantic 与前端 TypeScript 仍分别维护
  契约。另有既存 Starlette/httpx2 弃用警告；本轮 smoke 验证首屏静态内容，不点击下旨以避免
  真实模型费用。

## Acceptance Review

- 验收结果：Accepted
- 验收证据：Codex 逐条核对 10 条验收标准。后端真实图测试覆盖 single、multi、固定六部、
  全六部边界、严格 JSON 失败关闭、空意见包装、同一 compiled graph 跨调用隔离与 HTTP 脱敏
  502；API 回归覆盖输入校验零调用、503/502 与 `GET /health`。前端 41 项测试覆盖成功契约解析、
  BFF 驼峰转换、状态映射、字段缺失与超时失败；生产构建成功。Codex 复跑 ruff、172 项 pytest、
  frontend lint/typecheck/test/build、46 个 harness 基线、20 项 harness self-test、3 项 Stop hook、
  25 项 runner self-test 和 `git diff --check` 均通过。测试工程师完成 `/study` 不点击下旨的生产
  smoke：HTTP 200 且包含上书房、下旨和多次模型调用提示。全程注入 fake model，未读取私有
  dotenv、未调用真实 DeepSeek、未提交本次改动。
- 未通过项：无。
