# 任务：下旨 BFF 与朝堂后端连通性恢复

> 本任务遵循 `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`，不改变下旨业务流。

## Status

Blocked

## Product Definition

- 用户确认：用户于 2026-07-28 以“请使用自动交付实现”并确认“继续”委托自动交付；按 product-flow 自动确认 Ready。
- 问题：上书房下旨持续提示“无法连接朝堂后端”，用户无法完成下旨。
- 目标用户：在上书房提交旨意的已登录用户。
- 目标：定位并修复开发环境中同源下旨 BFF 到 FastAPI 后端的实际连通性问题；保留清晰、真实的错误分类。
- 非目标：不改变 ADR 0028 业务链路、不发起真实下旨、不触发模型调用、不调整模型或 120 秒时限。

## Acceptance Criteria

- [ ] 在后端健康服务可用时，Next.js BFF 能使用有效的后端地址访问 FastAPI 下旨端点。
- [ ] 对无法访问后端的运行时配置，BFF 返回可操作且不泄露内部地址的错误。
- [ ] 自动化测试覆盖实际发现的地址解析或代理失败回归路径。
- [ ] 相关前端/后端测试、静态检查及健康链路验证均有新鲜证据；不发送真实下旨请求。

## Delivery Constraints

- 范围：下旨 BFF、后端地址配置/解析、相关测试及本任务记录。
- 兼容性：保持浏览器仅调用同源 BFF、FastAPI 仅由服务器端客户端访问，以及既有下旨成功契约。
- 风险与限制：现有工作区包含未提交的重叠改动；只在证据证明所需时修改允许路径，保留全部既有改动。
- 技能计划：`systematic-debugging`、`test-driven-development`、`verification-before-completion`、`product-flow`。
- Codex-only：否。

## Affected Modules

- 模块：跨进程集成校验（下旨 BFF → FastAPI 代理路径）。
- 允许路径：`scripts/verify_integration.mjs`、`scripts/verify_integration.test.mjs`（如需要）、`AGENTS.md`（登记新验证场景，若有必要）、本任务文件。若第三步实际复现出 `frontend/src/lib/backendClient.ts` 或 `frontend/src/app/api/decrees/chancellor/route.ts` 中的真实地址解析/代理缺陷，才追加这两个文件（不得改动其中已由
  `docs/product/tasks/2026-07-28-decree-submit-error-classification.md`（Accepted）验收覆盖的 `timeout` 分类逻辑）。
- 依赖模块：FastAPI 健康端点、`POST /api/v1/decrees/chancellor` 契约与会话认证（`app/api/auth.py`），只读依赖，不改动。

## Technical Plan

- 架构复核结论（solution-architect，只读）：静态审查未在 `getBackendBaseUrl()`（`backendClient.ts:28`）、`DEFAULT_BACKEND_BASE_URL`（同文件 `:21`，与 `.env.example` 默认值 `http://127.0.0.1:8000` 一致）、`route.ts` 的服务器端到服务器端调用中发现地址解析代码缺陷；BFF→FastAPI 走 Node 进程内 `fetch`，不经浏览器、不受 CORS 影响。真正的验证缺口：`scripts/verify_integration.mjs` 只覆盖 `GET /` 与 `GET /health` 两个公开端点的跨进程冒烟，从未端到端验证需要会话认证的
  `POST /api/decrees/chancellor → POST /api/v1/decrees/chancellor` 代理路径本身；因此该路径上的真实回归（例如地址解析、认证转发或错误映射代码变更引入的问题）不会被现有自动化捕获，这与用户报告的“健康检查正常但下旨报连不上后端”症状一致。
- 接口与依赖：不改变 `POST /api/decrees/chancellor` → `POST /api/v1/decrees/chancellor` 契约、120 秒超时、下旨业务流（ADR 0028）。复用 `scripts/verify_integration.mjs` 现有的进程管理（`ManagedProcess`、端口分配、sentinel 不可用后端）模式，不引入 Playwright/Cypress（前端 AGENTS.md 边界）。
- 实施顺序：
  1. module-engineer 在 `scripts/verify_integration.mjs` 新增第三个场景：真实后端 + 真实前端运行时，先通过 `POST /api/v1/auth/register`（经前端 `/api/auth/register` BFF）注册一次性测试账号取得会话 cookie，再用该 cookie 调用 `POST /api/decrees/chancellor`（`decreeText: ""` 触发后端 Pydantic 校验 422，`get_chancellor_graph()` 保证不被调用，不产生模型调用），断言响应为 `{status:"error", reason:"validation"}` 而不是 `network`——这直接证明 BFF 在后端健康时确实能连通并转发到下旨端点（覆盖 AC1）。
  2. 复用现有失败场景（后端不可达 sentinel）新增同一 `decreeText` 请求断言，确认返回 `{reason:"network"}`、503，且响应体不包含 `BACKEND_BASE_URL`/内部地址字符串（覆盖 AC2）。
  3. 若步骤 1 实际运行时暴露出真实代码缺陷（而非环境未就绪），module-engineer 再最小化修复 `backendClient.ts`/`route.ts` 对应位置，并同步补充/调整现有单元测试。
  4. test-engineer 独立运行新增场景与既有前后端测试、lint、typecheck，产出新鲜证据。
- 验证计划：不发起真实下旨（`decreeText` 用空串仅触发 422 校验，不到达丞相图/模型）；运行 `node scripts/verify_integration.mjs`、`backend` `pytest`、`frontend` `npm test`/`lint`/`typecheck`，并单独确认前后端 `/health` 200。
- 技术风险：本沙箱环境对启动子进程（uvicorn/next/pytest）的 Bash 调用可能需要用户批准；若批准不可得，需要如实记录“未运行”而非伪造通过证据。

## Implementation Report

- 改动摘要：`solution-architect`（只读）复核 `frontend/src/lib/backendClient.ts` 的
  `getBackendBaseUrl()`/`DEFAULT_BACKEND_BASE_URL`、`frontend/src/app/api/decrees/chancellor/route.ts`
  与后端 `app/main.py`/`app/api/decrees.py` 后，未发现地址解析或代理代码缺陷（BFF→FastAPI 是同进程
  服务器端到服务器端 `fetch`，不经浏览器、不受 CORS 影响；默认值与 `.env.example` 一致）。唯一的真实
  缺口是跨进程集成校验脚本 `scripts/verify_integration.mjs` 此前只覆盖 `GET /` 与 `GET /health`，从未
  端到端验证需要会话认证的 `POST /api/decrees/chancellor → POST /api/v1/decrees/chancellor` 代理路径
  本身。`module-engineer` 据此在 `scripts/verify_integration.mjs` 新增第三个场景
  `runDecreeBffConnectivityScenario`：正向子场景启动真实前后端，通过 `POST /api/auth/register` 注册
  一次性测试账号取得真实 session cookie，用空 `decreeText` 调用 `POST /api/decrees/chancellor`（后端
  Pydantic 校验在 `get_chancellor_graph()` 之前即失败，不触发模型调用），断言返回
  `{status:"error",reason:"validation"}`/422（而非 `network`），直接证明后端健康时 BFF 确实转发到位；
  反向子场景复用既有 `createUnavailableBackendSentinel()`，断言返回 `{reason:"network"}`/503 且响应体
  不包含内部端口、`BACKEND_BASE_URL` 或 `127.0.0.1` 字符串。同步在 `scripts/verify_integration.test.mjs`
  补充两条静态源码守卫用例。未修改 `backendClient.ts`/`route.ts`/ADR 0028/120 秒超时/下旨成功契约，
  因为两轮独立静态审查（`solution-architect`、`test-engineer`）均未发现需要修改它们的真实代码缺陷。
- 自审：负责人复核了 `scripts/verify_integration.mjs`、`scripts/verify_integration.test.mjs` 的完整
  diff；新场景逻辑、断言字段名、HTTP 状态码与 `route.ts`/`decrees.py`/`auth.py` 的真实契约一致，未发现
  语法或逻辑错误。
- 实际使用的 skill：仓库要求的 `using-superpowers/SKILL.md` 及其映射的
  `systematic-debugging`/`test-driven-development`/`verification-before-completion` 等第三方 skill 在
  本工作区不存在（非本任务改动，属预置环境缺失）；按 `codex-engineering-workflow` 的"个人环境缺少第三方
  skill 时用同等原生能力继续"，改用等价的原生调查、只读架构分析、TDD 风格实现与验证前自审流程。
- **验证：被环境权限结构性阻止，未能产生任何真实运行证据（不伪造 PASS）。** 本工作区
  （`chaotang-os-harness-only`）当前 Bash/PowerShell 权限只放行只读与版本探测类命令（`git status`、
  `ls`、`node --version` 均可直接执行），但任何实际执行代码的命令一律被要求 approval 且在当前无人值守
  会话中无法获批。负责人与 `module-engineer`、`test-engineer` 三方各自独立尝试后结论一致：`node
  scripts/verify_integration.mjs`、`node -e "..."`、`npm test`/`lint`/`typecheck`、
  `pytest`（含绝对路径调用 `.venv` 内可执行文件、纯版本探测 `--version`）全部被拒绝；只有
  `node --version` 这类不执行用户代码的探测命令能跑通。因此验收标准第四条要求的"新鲜验证证据"
  （pytest、npm test/lint/typecheck、前后端健康链路 curl）**均无法在本环境产出**。
- 未运行项与原因：`node scripts/verify_integration.mjs`（新场景本身）、`backend` `pytest`、`frontend`
  `npm test`/`npm run lint`/`npm run typecheck`/`npm run build`、`GET /health` 前后端健康链路人工验证——
  均因上述环境权限限制未运行，非精力或范围原因。作为替代，改为两轮独立静态审查
  （`solution-architect` 只读架构复核 + `test-engineer` 逐行核对新增代码与
  `session.ts`/`route.ts`/`decrees.py`/`auth.py`/`storage.py` 真实契约的一致性），均未发现假绿风险或
  运行时崩溃风险，但静态审查不能替代真实执行。
- 剩余风险：(1) 新场景从未真正跑过一次，可能存在静态审查未覆盖的运行期问题（端口竞争、Windows 下
  `next start` 就绪时序、cookie 解析边界）。(2) 正向子场景通过真实后端 `POST /api/v1/auth/register`
  注册的一次性测试账号会写入本地 `backend/data/shiguan.sqlite3`（该库已 gitignore、非生产库），脚本本身
  不清理，多次运行会累积孤立测试账号，属已知、不阻断验收的行为。(3) 用户报告的"无法连接朝堂后端"是否
  确有一个尚未被两轮静态审查发现的真实代码缺陷，仍无法排除——只有在具备命令执行权限的环境里实际跑一次
  新场景（成功/失败两个方向）才能确认。

## 阻塞问题（写给用户/Codex）

本工作区（`chaotang-os-harness-only`）的命令执行权限只允许只读/版本探测，无法运行
`node`/`npm`/`pytest` 等实际验证命令；而本任务验收标准第 3、4 条明确要求"自动化测试覆盖...回归路径"
与"相关测试、静态检查及健康链路验证均有新鲜证据"。在无法执行任何验证命令的前提下，负责人不能诚实地把
状态改为 `Implemented`。请选择以下之一后指示如何继续：

1. 在具备真实命令执行权限的 `chaotang-os` 工作环境（非 harness-only）中重新运行本任务已完成的实现，
   执行 `node scripts/verify_integration.mjs`、`backend` 的 `pytest`、`frontend` 的
   `npm test`/`npm run lint`/`npm run typecheck` 与前后端 `/health` 检查，把真实输出补进本报告后再转
   `Implemented`；或
2. 明确授权在当前工作区放行上述具体命令的一次性执行；或
3. 接受当前的两轮独立静态审查作为本次验收证据（与验收标准第 4 条"新鲜验证证据"的字面要求存在冲突，
   需要用户/Codex 明确豁免）。

## Acceptance Review

- 验收结果：Pending
- 验收证据：待 Codex 验收；见上方"阻塞问题"，当前无法产出运行时验证证据。
- 未通过项：验收标准第 3、4 条（自动化回归覆盖的运行时证据、新鲜测试/静态检查/健康链路验证）因环境
  命令执行权限限制暂无法核实；第 1、2 条已有实现与两轮独立静态审查支持，但同样缺少真实运行证据。
