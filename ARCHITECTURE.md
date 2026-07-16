# chaotang-os 当前架构事实

## 当前状态

仓库处于重建阶段。`backend/` 已完成最小工程骨架的技术选型（Python + FastAPI +
uvicorn + pip/venv，扁平 `app/` 包，仅暴露 `GET /health`，不含业务 API、数据库模型
或 agent runtime；选型与验证证据见 `docs/decisions/0006-frontend-backend-foundation-stack.md`）。
`frontend/` 已完成最小工程骨架的技术选型（Next.js App Router + React/react-dom +
TypeScript，npm 管理依赖，扁平 `src/app/`、`src/lib/` 结构，`page.tsx` 只做后端
健康检查展示，`backendClient.ts` 封装对后端的服务端调用；选型与验证证据见同一
决策记录的 `## 前端` 章节）。生产部署方式和业务数据模型仍未确定；`GET /health`
跨端契约已确定为根级 `docs/contracts/health.schema.json`，调用路径为浏览器 →
Next.js 服务端 → FastAPI。`backend/` 已新增最小、无外部服务依赖的 LangGraph
运行时基础（`app/langgraph_runtime/`，仅暴露 `build_minimal_graph()` 与
`GraphState`），仅用于证明运行时可编译、可调用，不接入模型供应商或持久化，也
不构成已确定的业务 agent 架构；决策见
`docs/decisions/0007-langgraph-runtime-foundation.md`。

## 所有权

| 区域 | 当前确认的归属 | 当前不作出的假设 |
| --- | --- | --- |
| 根目录 | 跨线约定、共享文档、CI、仓库级工具 | 具体业务实现 |
| `docs/product/tasks/` | Codex 与 Claude Code 的顺序交接契约和验收证据 | 运行态队列、自动编排服务 |
| `.agents/skills/product-flow/` | Codex 桌面任务内的一键产品交付编排 | 定时/CI 常驻服务、Claude 自主编排入口 |
| `.claude/agents/` | Claude Code 的架构、模块交付、测试专业角色 | 跨客户端通用角色、并行写入隔离 |
| `frontend/` | 前端工程及其验证；已确定 Next.js + React + TypeScript + npm 最小骨架 | 业务页面、状态管理、UI 组件库、鉴权 |
| `backend/` | 后端运行/评测工程及其验证；已确定 Python + FastAPI + uvicorn 最小骨架；已确定最小 LangGraph 运行时基础（依赖版本范围、`app/langgraph_runtime/` 模块边界、`GraphState` 状态类型，见 ADR 0007） | 业务服务、存储和评测方式；具体业务 agent/workflow 图结构、模型供应商接入、持久化/checkpointer 方案仍未确定 |

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
- `backend/app/langgraph_runtime/` 只是一个最小、无外部服务依赖的 LangGraph
  运行时基础，不是已确定的业务 agent 架构；不得据此推断已可以随意接入模型
  供应商、扩展成业务工作流或启用持久化。当前仍明确排除：模型供应商/API Key
  接入、聊天机器人、具体业务工作流、工具调用、RAG、LangSmith 追踪、LangGraph
  Studio/CLI、持久化/checkpointer、数据库、流式接口、human-in-the-loop、分布式
  执行、生产部署，以及任何新增的公开 HTTP 业务接口；`GET /health` 契约不变。
  完整清单与理由见 `docs/decisions/0007-langgraph-runtime-foundation.md`。

## 结构变化门禁

新增顶层工程、改变所有权边界、确定技术栈或改变跨线契约时，必须：

1. 先验证关键假设，再新建或更新 `docs/decisions/` 中的简短记录。
2. 更新本文件及受影响的 scoped `AGENTS.md`。
3. 把可机械判断的约束加入 `scripts/check_harness.mjs` 或所属工程测试。
4. 运行本地验证，并确保 `.github/workflows/harness.yml` 执行仓库级检查。
