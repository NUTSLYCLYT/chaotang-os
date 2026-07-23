# chaotang-os 当前架构事实

## 史馆边界

史馆属于后端域，以 `app/shiguan` 的 Pydantic 模型和 SQLite 存储为事实源。
丞相图只消费每部门一次召回生成的只读上下文；前端不推断复盘状态、匹配原因或归档成功。详见 `docs/decisions/0015-shiguan-archive-persistence.md`。

## 当前状态

仓库处于重建阶段。`backend/` 已完成最小工程骨架的技术选型（Python + FastAPI +
uvicorn + pip/venv，扁平 `app/` 包；选型与验证证据见
`docs/decisions/0006-frontend-backend-foundation-stack.md`），并在保持 `GET /health`
契约不变的前提下新增唯一的本地业务入口 `POST /api/v1/decrees/chancellor` 和专用丞相
Agent；当前仍不含数据库模型、持久化任务编排、鉴权或生产部署能力。
`frontend/` 已完成最小工程骨架的技术选型（Next.js App Router + React/react-dom +
TypeScript，npm 管理依赖，扁平 `src/app/`、`src/lib/` 结构，根路径 `page.tsx` 提供
登录前欢迎引导，`/health` 提供后端健康检查展示，`backendClient.ts` 封装对后端的服务端调用；选型与验证证据见同一
决策记录的 `## 前端` 章节）。生产部署方式和业务数据模型仍未确定；`GET /health`
跨端契约已确定为根级 `docs/contracts/health.schema.json`，调用路径为浏览器 →
Next.js 服务端 → FastAPI。`backend/` 已新增最小、无外部服务依赖的 LangGraph
运行时基础（`app/langgraph_runtime/`，仅暴露 `build_minimal_graph()` 与
`GraphState`），仅用于证明运行时可编译、可调用，不接入模型供应商或持久化，也
不构成已确定的业务 agent 架构；决策见
`docs/decisions/0007-langgraph-runtime-foundation.md`。在此基础之上，`backend/`
已接入唯一的 DeepSeek provider：声明式配置 `backend/config/providers.yaml`（顶层
`active: deepseek`，且只声明 `providers.deepseek`）+
只读配置加载校验 + 独立的 `build_deepseek_graph()` 图工厂（可注入假聊天模型用于
离线测试，默认走 `openai` SDK 调用 DeepSeek 的 OpenAI 兼容端点，密钥仅来自
`DEEPSEEK_API_KEY` 环境变量）；不迁移 `dev` 分支的完整多供应商模型层，不新增
聊天 HTTP API，`build_minimal_graph()` 与 `GET /health` 契约不受影响；决策见
`docs/decisions/0008-deepseek-langgraph-integration.md`。DeepSeek 密钥解析进一步新增
本地 dotenv 兜底能力：进程环境变量仍然优先，只有缺失/为空时才读取固定的私有路径
`backend/.env.example`，且不写入全局 `os.environ`；决策见
`docs/decisions/0009-deepseek-local-dotenv-fallback.md`。在此基础之上，仓库已交付第一个
端到端业务闭环："上书房"下旨到"丞相"Agent：前端新增 `/study` 页面和服务端专用的
`src/app/api/decrees/chancellor/route.ts`（Next.js Route Handler），`backendClient.ts`
新增 `submitDecree()`；后端新增独立的业务子包 `backend/app/agents/chancellor/`
（专用 LangGraph 丞相图，`build_chancellor_graph()`，只读复用 DeepSeek 配置加载和客户端
构建，不调用 `build_deepseek_graph()`）和 `backend/app/api/decrees.py`
（`POST /api/v1/decrees/chancellor`，唯一的业务 HTTP 端点，同步返回丞相回奏或脱敏
503/502/4xx 错误）。`langgraph_runtime/graph.py`、`state.py`、`deepseek_graph.py` 与
`GET /health` 契约零改动；本地 MVP 只支持 `127.0.0.1`，不支持鉴权/限流/公开部署；决策见
`docs/decisions/0010-shangshufang-chancellor-agent.md`。在此基础之上，丞相 Agent 已升级为
完整的六部/军机处分流会审闭环：丞相判断旨意是 `single`（单部门）还是 `multi`（多部门）
路由，单部门旨意进入吏、户、礼、兵、刑、工六部之一（`backend/app/agents/ministries/`）
形成办理意见，多部门旨意进入军机处（`backend/app/agents/junjichu/`）并按丞相给定顺序
串行召集至少两个相关部门会审后形成结论；`POST /api/v1/decrees/chancellor` 的成功响应体
删除了旧的单段 `memorial_text`，改为返回 `route_type`、丞相判断说明 `rationale`、有序
流转路径 `processing_path`、参与部门 `departments`、各部门意见 `ministry_opinions` 和
最终结论 `final_verdict`；`/study` 页面同步展示这条完整流转链路，费用提示文案反映"一次
下旨可能触发多次模型调用"；前端 `submitDecree()` 的超时常量从 45000ms 上调至
120000ms（对应最坏情况 8 次串行 DeepSeek 调用）。决策见
`docs/decisions/0012-decree-six-ministries-joint-review.md`。六部现已进一步增加数据驱动的
司级 Agent 层：`backend/app/agents/bureaus/` 用不可变 profile 注册表按
`(department, bureau)` 复合身份定义六部共 39 司，礼部六司与其余各司全部开放；每个部先
严格选择本部一个或多个司，再按选择顺序同步调用统一的通用司级 Agent（见 ADR 0013）。在此
基础上，部级会读取全部有序司级意见，通过一次独立模型调用形成补充和综合；
`invoke_ministry_agent` 返回结构化 `MinistryOpinion`，同时保存 `bureau_opinions` 与部级
`opinion`。single 路径把该部的分层结果直接交给丞相最终汇总；multi 路径按序完成各部司议和
部议，再交军机处形成 `council_verdict`，最后交给丞相。两条路径共用严格输出非空
`summary` 与恰好三个非空、互不重复 `recommendations` 的 finalizer；`final_verdict` 映射
`summary`，`processing_path` 记录真实调用顺序并以最终丞相结束。

`POST /api/v1/decrees/chancellor` 的路径、请求体及原字段保持不变，成功响应增量增加
`ministry_opinions[].bureau_opinions`、条件式 `council_verdict`（single 为 `null`，multi 为
非空字符串）和 `recommendations`；FastAPI、BFF 与 UI 同批严格校验和展示分层结果。模型、
结构或响应构造失败继续通过脱敏异常链失败关闭并映射 502，既有错误分类和 `GET /health`
不变。该同步设计不并发、不持久化，最坏 single 为 11 次、全六部 multi 为 54 次模型调用，
可能超过现有 120 秒前端超时。ADR 0013 中扁平字符串返回和不扩成功字段的局部结论由
`docs/decisions/0014-layered-memorial-three-recommendations.md` 覆盖。

## 所有权

| 区域 | 当前确认的归属 | 当前不作出的假设 |
| --- | --- | --- |
| 根目录 | 跨线约定、共享文档、CI、仓库级工具 | 具体业务实现 |
| `docs/product/tasks/` | Codex 与 Claude Code 的顺序交接契约和验收证据 | 运行态队列、自动编排服务 |
| `.agents/skills/product-flow/` | Codex 桌面任务内的一键产品交付编排 | 定时/CI 常驻服务、Claude 自主编排入口 |
| `.claude/agents/` | Claude Code 的架构、模块交付、测试专业角色 | 跨客户端通用角色、并行写入隔离 |
| `frontend/` | 前端工程及其验证；已确定 Next.js + React + TypeScript + npm 最小骨架；已交付第一个业务页面 `/study`（上书房下旨）和服务端 Route Handler `src/app/api/decrees/chancellor/route.ts`，见 ADR 0010；已升级为展示司级意见、部级补充、multi 军机处结论、丞相总结和三项建议，并严格校验增量契约，见 ADR 0014 | 其它业务页面、状态管理、UI 组件库、鉴权 |
| `backend/` | 后端运行/评测工程及其验证；已确定 Python + FastAPI + uvicorn 最小骨架；已确定最小 LangGraph 运行时基础（依赖版本范围、`app/langgraph_runtime/` 模块边界、`GraphState` 状态类型，见 ADR 0007）；已确定唯一的 DeepSeek provider 接入（`providers.yaml` 以 `active: deepseek` 固定激活项、配置加载校验、`build_deepseek_graph()` 图工厂、密钥仅来自 `DEEPSEEK_API_KEY`，见 ADR 0008）；已交付第一个业务 Agent 与 HTTP 契约：`app/agents/chancellor/`（丞相 Agent）+ `app/api/decrees.py`（`POST /api/v1/decrees/chancellor`），见 ADR 0010；已升级为六部/军机处分流会审闭环，见 ADR 0012；已增加 `app/agents/bureaus/` 数据驱动通用司级 Agent 与全部开放的 39 司复合注册表，见 ADR 0013；现已形成司议 → 部议 → multi 军机处会审 → 丞相总结与三项建议的分层回奏，并增量扩展成功契约，见 ADR 0014 | 其它业务 agent/workflow 图结构、DeepSeek 之外的模型供应商接入、持久化/checkpointer 方案仍未确定 |

`AGENTS.md` 只提供经常需要的操作指引；本文件只记录已确认架构事实。重要选择在
`docs/decisions/` 记录原因，不能把尚未决定的方案写成现状。

## 当前边界

- 前端实现只放在 `frontend/`；后端实现只放在 `backend/`。
- 根级工具可以检查两个工程，但不承接任何一侧的具体业务实现。
- Codex 默认拥有产品定义、任务就绪和验收结论；Claude Code 默认拥有实现、测试和交付报告。
  两者通过 `docs/product/tasks/` 顺序交接，不假设客户端之间能够自动调用或并行写入。
- Claude Code 主会话是交付负责人；架构角色只读，模块角色按任务允许路径端到端修改相关
  前后端代码，测试角色最后验证。业务模块是交付所有权边界，`frontend/`、`backend/` 仍是
  代码治理边界。有写权限的角色顺序运行，除非未来另行确定 worktree 隔离方案。
- `product-flow` 由当前 Codex 桌面任务担任总编排器，通过非交互 Claude CLI 启动交付团队，
  再由同一 Codex 任务验收。它不启动第二个 Codex，也不把产品验收权交给 Claude。
- 当前最小骨架的运行时依赖方向为浏览器 → Next.js 服务端 → FastAPI，共享契约位于
  根级 `docs/contracts/`；改变这些依赖方向、契约位置或运行时边界时，必须用可运行
  原型或测试验证，并记录决策。
- `backend/app/langgraph_runtime/` 的确定性运行时基础（`build_minimal_graph()`）
  不是已确定的业务 agent 架构；不得据此推断已可以随意扩展成业务工作流或启用
  持久化。同一目录下已额外接入唯一的 DeepSeek provider（`build_deepseek_graph()`
  及配套配置加载/客户端模块；配置要求 `active: deepseek`，见
  `docs/decisions/0008-deepseek-langgraph-integration.md`），
  这是本次范围内唯一确定的模型供应商接入；除 DeepSeek 外，当前仍明确排除：其它
  模型供应商接入、通用聊天 HTTP API、provider 管理 API、工具调用、
  RAG、LangSmith 追踪、LangGraph Studio/CLI、持久化/checkpointer、数据库、
  流式接口、human-in-the-loop、分布式执行、生产部署；`GET /health` 契约不变。完整清单与
  理由见 `docs/decisions/0007-langgraph-runtime-foundation.md` 与
  `docs/decisions/0008-deepseek-langgraph-integration.md`。仓库已确定的唯一业务 HTTP
  接口和业务 Agent 是 `POST /api/v1/decrees/chancellor` 与 `app/agents/chancellor/`
  （上书房下旨到丞相，同步、无持久化、仅 `127.0.0.1` 本地 MVP），见
  `docs/decisions/0010-shangshufang-chancellor-agent.md`；该闭环已升级为丞相分流 +
  六部办理（`app/agents/ministries/`）+ 军机处多部门会审（`app/agents/junjichu/`），
  HTTP 响应契约相应扩展，仍然同步、无持久化、仅 `127.0.0.1` 本地 MVP，见
  `docs/decisions/0012-decree-six-ministries-joint-review.md`；六部内部已新增
  `app/agents/bureaus/` 的 39 司数据驱动层，部级严格路由后按顺序同步调用相关司，礼部没有
  1.0 门禁，见 `docs/decisions/0013-data-driven-bureau-agents.md`。分层回奏进一步要求每个
  部独立补充司议，single 直接回丞相，multi 经军机处会审后回丞相，两路共用严格三建议的
  finalizer；成功契约增量保存司议、军机处结论与建议，见
  `docs/decisions/0014-layered-memorial-three-recommendations.md`。该链路仍不并发、不持久化，
  最坏 single/multi 同步模型调用数为 11/54；不得据此推断可以随意新增其它业务工作流或
  派发/持久化能力。

## 结构变化门禁

新增顶层工程、改变所有权边界、确定技术栈或改变跨线契约时，必须：

1. 先验证关键假设，再新建或更新 `docs/decisions/` 中的简短记录。
2. 更新本文件及受影响的 scoped `AGENTS.md`。
3. 把可机械判断的约束加入 `scripts/check_harness.mjs` 或所属工程测试。
4. 运行本地验证，并确保 `.github/workflows/harness.yml` 执行仓库级检查。

## 账户与所有者边界

本地账户体系以 FastAPI 为唯一身份、会话和数据所有者权威；Next.js 仅作为同源 BFF。浏览器仅保留 `HttpOnly` 、`SameSite=Lax`
cookie（生产环境加 `Secure`），BFF 仅在服务端将其转为后端认证请求。令牌、后端地址和密码哈希不得暴露给浏览器。
受保护的上书和史馆端点从 `require_current_user` 解析会话，并仅以该用户 ID 作为 owner 进行读写与过滤；客户端不可选择或传入 owner。
无 owner 的旧 SQLite 行保留但对所有账户不可见，不在此次变更中猜测归属。`GET /health` 、欢迎页、注册与登录保持公开；`/study`、`/shiguan` 及受保护 BFF 路由必须登录。详见 ADR 0019。
