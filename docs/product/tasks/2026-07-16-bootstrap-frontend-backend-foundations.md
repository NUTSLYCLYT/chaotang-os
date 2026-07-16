# 任务：搭建前后端基础框架

## Status

Accepted

## Product Definition

- 用户确认：2026-07-16 用户显式调用 `$product-flow`，要求实现前后端基础框架，并授权参考 `dev` 分支技术方案；按 product-flow 委托自动确认为 Ready
- 问题：仓库目前没有前后端业务代码，也没有已确定的运行平台、技术栈、工程命令或前后端契约，后续功能开发缺少可运行、可测试、可持续扩展的工程底座。
- 目标用户：项目开发者、负责后续交付与验证的 Agent；最终产品用户与具体产品形态待访谈确认。
- 目标：为前端和后端分别建立最小、可运行、可测试、可构建的工程骨架，并建立前后端最小联通验证、真实工程命令、CI 检查和必要的架构决策记录。
- 非目标：本次不实现登录、权限、业务页面、业务 API、agent runtime、任务编排、评测能力、数据库模型、正式 UI 设计、生产数据、监控告警、容器化交付或生产部署；不从 `dev` 分支搬运业务代码或历史运行数据。

## Acceptance Criteria

- [x] 开发者可依据仓库内文档，在受支持的本地环境中完成前端和后端依赖安装，并通过明确的命令分别启动两端。
- [x] 前端提供一个不承载具体业务的最小可运行入口，并能以自动化方式验证入口可用。
- [x] 后端提供一个不承载具体业务的最小可运行入口和 `GET /health` 健康检查，并能以自动化方式验证服务可用及响应契约。
- [x] 前端可通过已定义的跨端契约访问后端健康检查；成功路径和后端不可用时的失败路径均可重复验证。
- [x] 前后端分别具备真实可执行的 setup、lint、test、build/run 命令；本次后端不承担评测职责，因此不要求 eval 命令。
- [x] CI 会执行仓库级 harness 检查以及前后端与本次框架相关的安装、静态检查、测试和构建验证。
- [x] 技术栈、运行边界、依赖方向和跨端契约位置均经过最小原型验证，并记录为 ADR；相关 `ARCHITECTURE.md` 与 scoped `AGENTS.md` 同步更新。
- [x] 仓库不包含密钥、真实环境文件、私人数据或运行态数据；示例配置不依赖私密信息即可完成本地验证。

> 用户已通过 product-flow 授权在无阻塞时自动确认；以上标准为本次交付的最终验收口径。

## Delivery Constraints

- 范围：实现阶段的候选范围为 `frontend/`、`backend/`、前后端相关测试与配置、`.github/workflows/`、`docs/decisions/`、`ARCHITECTURE.md`、相关 scoped `AGENTS.md` 及必要的仓库级检查。确切允许路径由 Claude Code 负责人经架构分析后填写。
- 兼容性：保留现有 Codex/Claude Code 顺序交接与 harness 检查；仓库级工具继续支持 Node.js 22 或更高兼容版本，CI 当前使用 Node.js 24。实现应优先选择开发机与 CI 可稳定安装的依赖版本。
- 风险与限制：`dev` 仅作为技术栈与工程组织参考。允许参考其 Next.js/React/TypeScript 前端与 Python/FastAPI 后端，但必须建立最小、独立、无业务代码的骨架；包管理器、精确版本和契约实现由 Claude Code 经原型验证后确定。首次技术选型必须记录 ADR，并同步架构与 scoped 指引。

## Affected Modules

- 模块：候选模块：前端应用基础；候选模块：后端服务基础；候选模块：前后端联通契约；候选模块：工程质量与持续集成
- 允许路径：Module 1（后端服务基础）`backend/**`、`ARCHITECTURE.md`、新建 `docs/decisions/0006-frontend-backend-foundation-stack.md`；Module 2（前端应用基础）`frontend/**`、`ARCHITECTURE.md`、`docs/decisions/0006-frontend-backend-foundation-stack.md`（追加前端章节）；Module 3（前后端联通契约）新建 `docs/contracts/**`、`backend/**`（契约测试）、`frontend/**`（backendClient 与成功/失败路径测试）、`docs/decisions/0006-frontend-backend-foundation-stack.md`（追加契约章节）；Module 4（工程质量与持续集成）`.github/workflows/**`、根级 `scripts/**`（新增集成校验脚本，不改动 `scripts/check_harness.mjs` 本体逻辑）、`ARCHITECTURE.md`、根 `AGENTS.md`、`frontend/AGENTS.md`、`backend/AGENTS.md` 的收尾核对
- 依赖模块：现有仓库级 harness 与产品交接机制（`scripts/check_harness.mjs`、`.github/workflows/harness.yml`）；关键依赖事实：`scripts/check_harness.mjs` 456-468 行有硬门禁——只要 `ARCHITECTURE.md` 仍含字符串「没有业务代码」，`frontend/`、`backend/` 目录下只允许存在 `AGENTS.md`/`CLAUDE.md`，否则 CI 直接失败；Module 1 必须同步改写 `ARCHITECTURE.md` 「当前状态」表述，移除该字符串，其余模块不得使该门禁重新触发。

## Product Assumptions

- 前端首期形态为浏览器 Web 应用；最低行为验证覆盖最小入口与后端健康状态展示。
- 后端首期仅提供通用服务入口与健康检查，不承载 AI agent runtime、任务编排、评测或数据库。
- 本次交付目标为本地开发与 CI；容器化和生产部署不在范围内。
- 跨端契约至少对 `GET /health` 的路径、状态码和响应结构提供可自动验证的单一事实来源；具体采用 OpenAPI 还是共享类型由技术原型决定。
- 以 `dev` 分支的 Next.js/React/TypeScript 与 Python/FastAPI 组合为优先参考，但只引入满足验收标准的最小依赖。

## Technical Plan

- 架构边界：
  - `backend/`：扁平 `app/` 包（`app/main.py` 挂载 FastAPI 实例与 `GET /health`，`app/health.py` 定义 Pydantic 响应模型），`tests/` 用 pytest 覆盖；不引入 `dev` 分支的 `src/`、alembic、cli.py、多环境 docker-compose 等业务/运行时结构。
  - `frontend/`：Next.js 最小入口（`src/app/page.tsx` 只渲染健康检查展示，不含业务 UI），`src/lib/backendClient.ts` 封装对后端的调用并与 UI 解耦，便于用 `node:test` 直接对成功/失败两条路径做单测；不引入状态管理、UI 组件库、鉴权等超范围内容。
  - 跨端契约文件放在根级 `docs/contracts/`，因为它既不属于 `frontend/` 也不属于 `backend/` 的内部实现边界，符合 `ARCHITECTURE.md` 中「根目录拥有跨线约定、共享文档」的既有所有权划分。
- 接口与依赖：
  - 契约落地方式：新增 `docs/contracts/health.schema.json`，手写 JSON Schema 片段（path、method、成功状态码、响应体字段与类型），作为 `GET /health` 路径、状态码、响应结构的单一事实来源；后端测试用 FastAPI 自动生成的 `app.openapi()` 与该文件比对，前端测试用同一文件对 `fetchHealth()` 返回值做字段校验，避免任一侧硬编码副本导致契约漂移。
  - `GET /health` 响应：`200 OK`，`application/json`，`{"status": "ok", "service": "chaotang-os-backend", "version": "<从 pyproject.toml 读取>"}`；本次不做依赖探活，不设计非 200 分支。
  - 前端调用后端的路径：浏览器 → Next.js 服务端（Route Handler / Server Component）→ FastAPI，避免最小骨架阶段引入 CORS 配置；后端地址通过服务端专用环境变量 `BACKEND_BASE_URL`（默认 `.env.example` 示例值 `http://127.0.0.1:8000`）配置，不使用 `NEXT_PUBLIC_` 前缀。
  - 成功路径验证：测试中用本地 stub/真实后端进程返回契约合规响应，断言前端报告健康。失败路径验证：`BACKEND_BASE_URL` 指向未监听端口，断言前端优雅降级为「后端不可用」而不抛未捕获异常，且状态可断言；两条路径均可在无浏览器、无常驻服务的 CI 环境中重复运行。
- 实施顺序（4 个模块，按依赖关系顺序调用 module-engineer，一次一个）：
  1. 后端服务基础：`pyproject.toml`（`requires-python = ">=3.11"`）+ FastAPI（`>=0.111`，宽松范围）+ uvicorn（`>=0.29`）+ `GET /health` + pytest 测试；包管理器优先原型验证 uv（`uv sync`/`uv run`，产出真实 `uv.lock`），若 Windows/CI 任一侧安装失败则退回 pip + 手动锁定并在 ADR 中记录原因；同步改写 `ARCHITECTURE.md` 移除「没有业务代码」表述并更新 `backend/AGENTS.md` 真实命令；新建 ADR `0006-frontend-backend-foundation-stack.md` 记录后端选型与验证证据。
  2. 前端应用基础：Next.js（`^16`）+ React/react-dom（`^19`）+ TypeScript（`^5`），包管理器优先用 npm（`npm ci` + `package-lock.json`，跨 Windows/Ubuntu 摩擦最小，且当前是单包不需要 pnpm workspace 能力）；最小入口页面；测试用 Node 内置 `node:test`（按需 `tsx` 转译），不引入 Playwright/浏览器自动化；更新 `frontend/AGENTS.md` 真实命令；在同一 ADR 追加前端选型章节。
  3. 前后端联通契约：落地 `docs/contracts/health.schema.json`；补充后端契约断言测试与前端 `backendClient` 成功/失败路径测试；在同一 ADR 追加契约格式与位置的决策记录。
  4. 工程质量与持续集成：`.github/workflows/harness.yml` 新增 `frontend` job（setup-node、安装、lint、typecheck、test、build、entry 烟雾脚本）与 `backend` job（setup-python、安装、ruff、pytest、uvicorn 启动+健康检查烟雾）；新增跨进程集成校验脚本（先起后端、起前端指向它验证成功路径，再关后端验证失败路径，端口用系统随机可用端口避免冲突）；保留现有 `validate` job 不变；最终核对 `ARCHITECTURE.md`/根 `AGENTS.md`/`frontend/AGENTS.md`/`backend/AGENTS.md` 命令准确性。
- 验证计划：
  - 后端：`uv sync`（或 `pip install -e ".[dev]"`）→ `ruff check backend` → `pytest backend/tests` → 启动 `uvicorn app.main:app`，脚本化探测 `/health` 后关闭进程。
  - 前端：`npm ci` → `npm run lint`（next lint）+ `tsc --noEmit` → `node --test`（含 backendClient 成功/失败路径）→ `npm run build` + entry 烟雾脚本（`next start` 后探测 `/`）。
  - 集成：新增脚本编排「后端起 + 前端起并指向它（成功路径）」与「后端关 + 前端保持运行（失败路径）」两个场景，可在本地和 CI 重复运行。
  - 仓库级：`node scripts/check_harness.mjs`、`node scripts/check_harness.mjs --self-test`、`node .agents/hooks/check-harness.mjs --self-test`、`node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test` 必须在骨架落地后继续通过。
- 技术风险：
  - `ARCHITECTURE.md` 门禁触发风险（高）：Module 1 若遗漏同步改写「当前状态」表述，CI 会在骨架代码落地当天挂红；已在 Affected Modules 中登记为强制项。
  - 包管理器锁文件风险：前端提交 `package-lock.json` 并用 `npm ci` 保证可复现；后端 pip 默认无锁文件，需原型验证 uv 在 Windows 开发机与 Ubuntu CI 上均可安装，失败则退回 pip + 手动锁定。
  - 跨平台风险（Windows 开发机 + Ubuntu CI）：避免选用需要 `corepack enable` 的 pnpm；venv 激活路径两端不同，命令文档直接调用 venv 内可执行文件路径；新增校验脚本用 Node/Python 编写而非 bash，保持跨平台一致；新增锁文件/脚本建议 `.gitattributes` 强制 LF（是否必要以首次 CI 运行结果为准）。
  - 契约漂移风险：必须确保前后端测试都实际读取 `docs/contracts/health.schema.json`，而非各自维护硬编码副本。
  - 精确依赖版本以及包管理器最终选择（npm 确定；uv vs pip 待 Module 1 原型结果）在 Implementation Report 中如实记录，若与本计划推荐不同需说明原因。
  - 是否需要新增 ADR：需要，属本仓库首次前后端技术选型，记录于 `docs/decisions/0006-frontend-backend-foundation-stack.md`。

## Implementation Report

- 改动摘要：完成 `backend/` 的 Python + FastAPI + uvicorn 最小服务骨架与
  `GET /health`，完成 `frontend/` 的 Next.js App Router + React + TypeScript 最小
  页面和服务端健康检查客户端；新增根级 `docs/contracts/health.schema.json` 作为
  跨端契约单一事实来源，并由两端测试实际读取校验；补齐前后端 setup/lint/test/
  typecheck/build/run 文档、CI jobs、入口烟雾检查、跨进程成功/失败路径集成脚本和
  ADR 0006。后端最终采用 pip + venv，前端采用 npm + `package-lock.json`。
- 自审：改动保持在任务允许路径内，未引入业务页面、业务 API、鉴权、数据库、agent
  runtime、容器化或生产部署；后端仅暴露 `/health`，前端后端地址仅由服务端环境变量
  `BACKEND_BASE_URL` 读取；契约、OpenAPI、实际响应及前端消费路径均有自动化约束，
  集成脚本会清理启动的进程。架构、scoped `AGENTS.md`、ADR 与 CI 命令已对齐现状。
- 验证：既有交付证据显示后端 Ruff、入口烟雾，前端 lint/typecheck/build/入口烟雾，
  `node scripts/verify_integration.mjs`，仓库 harness 及相关 self-test 均通过。Codex
  `module-engineer` 于 2026-07-16 再次执行后端 `.venv\Scripts\python.exe -m pytest`
  得到 `9 passed, 1 warning`，执行前端 `npm test` 得到 `7 passed`；新增版本防假绿和
  schema 关键字守护测试均已纳入最终复跑。独立 Codex `test-engineer` 随后完整复跑
  后端 Ruff/Pytest、前端 lint/typecheck/test/build、跨进程集成与四项仓库门禁，全部
  通过；临时把共享契约成功状态从 200 改为 201 后，后端契约测试 3 项、前端测试 1 项
  按预期失败，恢复为 200 后分别 4/4、7/7 重新通过，证明两端确实读取同一契约。
- 剩余风险：`npm audit` 仍报告 Next 间接依赖 PostCSS 的 2 个 moderate，未使用可能
  造成破坏性降级的 `npm audit fix --force`；后端测试仍有 Starlette 建议迁移
  `httpx2` 的弃用警告；后端宽松依赖范围尚无锁文件；CI jobs 已配置但远端 Ubuntu
  首次运行结果需在变更推送后观察。这些均不阻塞本地最小骨架实现，需后续持续复核。

## Acceptance Review

- 验收结果：Accepted（2026-07-16，由 Codex 原生架构师、模块工程师、测试工程师顺序接力完成 Claude 配额中断后的收尾）
- 验收证据：后端 Ruff 通过、Pytest 9/9 通过；前端 lint、typecheck、build 通过，Node 测试 7/7 通过；真实前后端成功路径和后端不可用降级路径均通过；仓库门禁 35/17/3/9 项全部通过；`git diff --check` 通过。契约变异为 201 后后端 3 项和前端 1 项按预期失败，恢复 200 后全部重回通过。3000/8000 无监听，无临时备份或残留服务进程。逐条核对本节八项 Acceptance Criteria，均有实现、文档或自动化验证证据。
- 未通过项：无。非阻塞跟踪项为 npm audit 的 2 个 moderate、Starlette/httpx2 弃用警告、后端依赖尚无锁文件，以及远端 Ubuntu CI 需在推送后观察首次结果。
