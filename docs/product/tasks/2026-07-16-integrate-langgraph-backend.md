# 任务：后端集成 LangGraph 运行时基础

## Status

Accepted

## Product Definition

- 用户确认：2026-07-16 用户通过“自动交付：后端集成LangGraph”明确提出需求，并授权 product-flow 在无阻塞时自动确认 Ready、实现和验收。
- 问题：现有后端只有 FastAPI 健康检查骨架，没有可供后续 agentic workflow 使用、可编译和可测试的图运行时边界；后续若直接在业务代码中零散引入 LangGraph，会造成状态模型、图构建方式和依赖范围失控。
- 目标用户：后续实现后端 agent/workflow 模块的开发者和交付 Agent。
- 目标：在现有 Python/FastAPI 后端中引入 LangGraph 核心运行时，建立一个可导入、可编译、可重复调用、无外部服务依赖的最小确定性图示例和稳定测试入口，并同步架构文档、后端指引、CI 验证与 ADR。
- 非目标：本次不接入 OpenAI、Anthropic 或其他模型供应商，不增加 API Key；不实现聊天机器人、具体业务工作流、工具调用、RAG、LangSmith、LangGraph Studio/CLI、持久化/checkpointer、数据库、流式接口、human-in-the-loop、分布式执行或生产部署；不新增公开 HTTP 业务接口，也不改变现有 `GET /health` 契约和前端页面。

## Acceptance Criteria

- [x] 现有后端 setup 命令可以安装与 Python `>=3.11` 兼容的 LangGraph 核心依赖，开发者可在后端环境中成功导入并确认实际安装版本。
- [x] 后端提供清晰隔离的 LangGraph 运行时模块，使用官方 `StateGraph`/`START`/`END` 图 API 和显式状态类型构建、编译最小确定性图；调用方不需要了解图构建细节即可获得可调用图对象。
- [x] 最小图可以在没有网络、密钥、LLM、LangSmith 和数据库的环境中，用确定性输入完成至少一次状态转换并返回可断言的最终状态。
- [x] 自动化测试覆盖图结构可编译、正常调用结果、输入状态隔离/重复调用等关键基础行为；测试不得通过 mock 掉 LangGraph 本身来伪造集成成功。
- [x] 现有 FastAPI 应用仍只公开 `GET /health`，其状态码和响应契约保持不变；现有后端与共享契约测试继续通过，前端无需修改。
- [x] 后端文档提供准确的安装、测试和最小调用示例，明确当前 LangGraph 能力边界及未来接入模型、持久化或业务图时需要新任务/决策。
- [x] 新增 ADR `0007`，按 `record-decision` 要求记录依赖选择、模块边界、未引入的 LangChain/模型供应商/checkpointer、收益与代价以及真实验证命令；`ARCHITECTURE.md` 与 `backend/AGENTS.md` 同步更新。
- [x] 后端 lint、全部后端测试、仓库 harness 及其自测均通过；CI 的现有后端安装和测试流程能够覆盖 LangGraph 依赖及新增测试，仓库不包含密钥或运行态数据。

## Delivery Constraints

- 范围：候选修改范围为 `backend/**`、`ARCHITECTURE.md`、`backend/AGENTS.md`、`.github/workflows/harness.yml`（仅在现有流程无法覆盖时调整）、新建 `docs/decisions/0007-*.md`、本任务文件及必要的仓库级检查；确切允许路径由 Claude Code 负责人经架构分析后填写。不得修改 `frontend/**` 或现有健康契约语义。
- 兼容性：保留 Python `>=3.11`、pip + venv、FastAPI/uvicorn、Ruff/Pytest 与现有 CI 命令；优先直接使用 `langgraph` 核心包和官方 Graph API，不把 LangChain 高层 agent 抽象或模型供应商 SDK 作为顶层依赖。
- 风险与限制：LangGraph 是快速演进的核心运行时依赖，必须核对当前官方文档与实际安装 API，采用有意图的兼容版本范围并通过真实原型验证；示例图只证明运行时集成，不得被描述为已完成生产 agent 架构。现有未提交的 product-flow 可靠性修复不属于本任务允许路径，必须保留且不得覆盖。

## Affected Modules

- 模块：后端 LangGraph 运行时基础（`backend/app/langgraph_runtime/`）；工程治理与架构记录（ADR/文档/harness 检查清单）
- 允许路径：
  - 新增 `backend/app/langgraph_runtime/__init__.py`
  - 新增 `backend/app/langgraph_runtime/state.py`
  - 新增 `backend/app/langgraph_runtime/graph.py`
  - 新增 `backend/tests/test_langgraph_runtime.py`
  - 修改 `backend/pyproject.toml`（新增 `langgraph>=1.2,<2` 主依赖）
  - 修改 `backend/AGENTS.md`（边界段落收窄 + 新增使用/版本核实小节）
  - 修改 `ARCHITECTURE.md`（当前状态、所有权表、当前边界三处）
  - 新增 `docs/decisions/0007-langgraph-runtime-foundation.md`（五节 ADR）
  - 修改 `scripts/check_harness.mjs`（将新 ADR 路径登记进 `REQUIRED_FILES`）
  - 本任务文件 `docs/product/tasks/2026-07-16-integrate-langgraph-backend.md`
  - 不修改 `.github/workflows/harness.yml`（现有 `pip install -e ".[dev]"` → ruff → pytest 流程已自动覆盖新依赖与新测试，见下方 CI 结论）；不修改 `frontend/**`、`backend/app/main.py`、`backend/app/health.py`
- 依赖模块：现有 `backend/app/` FastAPI 骨架、`backend/pyproject.toml`、后端测试与 CI；官方 LangGraph Python 核心包（PyPI 核实当前最新 1.2.9，传递依赖含 `langchain-core`、`langgraph-checkpoint`、`langgraph-prebuilt`、`langgraph-sdk`、`pydantic`、`xxhash`，均不含模型供应商 SDK）

## Technical Plan

- 架构边界：新增独立子包 `backend/app/langgraph_runtime/`（刻意不叫 `langgraph` 以避免与三方包同名造成认知/import 混淆），仅对外暴露 `build_minimal_graph()` 工厂函数与 `GraphState` 状态类型（`__init__.py` 重新导出）；调用方无需了解节点/图构建细节。`state.py` 用 `typing.TypedDict` 定义 `GraphState`（`input_text: str`、`steps: list[str]`、`output_text: str`）。`graph.py` 用官方 `StateGraph`/`START`/`END` 构建 `START -> normalize -> transform -> END` 线性图（2 个节点，证明真实多节点遍历），每个节点函数只读输入、返回新建的局部更新字典（不得原地修改传入的 list/dict，这是满足“重复调用不互相污染”验收标准的关键约束）。`app/main.py`/`app/health.py` 不 import 该模块，与现有 `GET /health` 完全解耦。
- 接口与依赖：保持 `GET /health` 与 `docs/contracts/health.schema.json` 不变。`backend/pyproject.toml` 的 `[project].dependencies`（非 `dev` extra）新增 `"langgraph>=1.2,<2"`；不显式声明 `langchain-core`（作为必需传递依赖自动装入）；不新增模型供应商 SDK。实现前先用最小原型（`python -c "..."`）核实真实安装后 `StateGraph.compile()` 返回类型的导入路径与 `get_graph().nodes` API，再据此写测试断言，避免断言基于猜测。
- 实施顺序：
  1. 架构分析（已完成，见上）；
  2. module-engineer 实现运行时模块：先真实 `pip install -e ".[dev]"` 装 LangGraph 并原型验证 API，再写 `state.py`/`graph.py`/`__init__.py`、更新 `pyproject.toml`；
  3. module-engineer（同一模块允许路径内）补充测试 `test_langgraph_runtime.py`（图可编译且为真实 LangGraph 对象、正常调用可断言结果、重复调用/输入隔离、版本可见性）并更新 `backend/AGENTS.md`、`ARCHITECTURE.md`、新建 ADR 0007、登记 `scripts/check_harness.mjs`；
  4. test-engineer 独立验证测试是否真实覆盖验收标准、是否存在假绿（例如 mock 掉 LangGraph 本身）、执行后端回归与 harness 自测；
  5. 负责人最终自审，填写 Implementation Report，状态改 Implemented。
- 返工范围（本轮，solution-architect 复核确认）：唯一未通过项是 ADR 0007 未按 `record-decision` 第 4 步登记进 `scripts/check_harness.mjs` 的 `REQUIRED_FILES`。本轮只做三处最小改动，不触碰 LangGraph 运行时/依赖/测试断言：
  1. `scripts/check_harness.mjs`：在 `REQUIRED_FILES` 数组中紧跟 `0005-...md` 之后新增一行 `"docs/decisions/0007-langgraph-runtime-foundation.md"`；`main()` 打印的基线文件数取自 `REQUIRED_FILES.length`（动态），无需改代码，登记后预期从 35 变为 36。不额外补登 0006（超出本次 Acceptance Review 范围，不登记不会导致自相矛盾）。
  2. `docs/decisions/0007-langgraph-runtime-foundation.md` 的 `Verification` 章节：把 `agentic-check: 通过 (35 个基线文件)` 同步改为实测新值（预期 36）。
  3. 本任务文件：改写 Implementation Report 中"登记 0007 会破坏既有先例，故不做此项改动"的错误结论，并同步 `35 个基线文件` 为实测新值。
  - 必须重跑：`node scripts/check_harness.mjs`、`node scripts/check_harness.mjs --self-test`（预期仍 17 项）、`node .agents/hooks/check-harness.mjs --self-test`、`node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test`。无需重跑 backend pytest/ruff/pip（未触碰运行时、依赖或测试逻辑）。
- 验证计划：`pip install -e ".[dev]"` 并记录真实解析到的 `langgraph` 及关键传递依赖版本号；`ruff check .`；`pytest`（含既有全部测试 + 新增测试）；`uvicorn` 烟雾检查 `GET /health` 契约未变；`node scripts/check_harness.mjs` 与 `--self-test`；确认测试环境无网络/无 LangSmith 相关环境变量下仍全部通过。
- 技术风险：LangGraph 编译后对象确切类型/`get_graph()` API 需实现阶段真实原型验证，不得凭猜测写断言；`xxhash` 是本次新增的首个真正编译型三方依赖，需在本机与 CI 双侧确认 wheel 可用；`langgraph-checkpoint`/`langsmith` 会作为传递依赖自动安装但不得被激活（不显式传 checkpointer、不设置 LangSmith 相关环境变量/追踪开关）；不得把最小示例图扩展成业务工作流或暗示已确定 agent 架构。

## Implementation Report

- 改动摘要：
  - 新增 `backend/app/langgraph_runtime/`（`__init__.py`、`state.py`、`graph.py`）：用官方 `StateGraph`/`START`/`END` 构建 `START -> normalize -> transform -> END` 两节点线性图；`GraphState`（`TypedDict`：`input_text`/`steps`/`output_text`）显式状态类型；对外只暴露 `build_minimal_graph()` 与 `GraphState`；节点函数均为纯函数，不原地修改传入 `list`/`dict`。
  - `backend/pyproject.toml`：`[project].dependencies` 新增主依赖 `"langgraph>=1.2,<2"`（实际安装解析到 `langgraph 1.2.9`）。
  - 新增 `backend/tests/test_langgraph_runtime.py`（7 个测试）：图为真实 `CompiledStateGraph`、图结构节点集合、确定性调用精确断言、重复调用/输入隔离、节点函数不原地修改传入列表、无 LangSmith/模型供应商环境变量、`langgraph` 版本可见性；均针对真实 LangGraph API，未 mock 任何 LangGraph 内部行为。
  - `backend/AGENTS.md`：边界段落收窄为已引入的最小 LangGraph 运行时基础，并新增使用/版本核实/调用示例/能力边界小节。
  - `ARCHITECTURE.md`：当前状态、所有权表、当前边界三处补充 LangGraph 运行时基础的确定范围与仍然排除的能力清单。
  - 新增 `docs/decisions/0007-langgraph-runtime-foundation.md`（五节 ADR：Status/Context/Decision/Consequences/Verification），记录依赖选择、模块边界、最小图设计、明确排除清单、收益代价及真实验证命令与结果。
  - `scripts/check_harness.mjs`：本轮按 `.agents/skills/record-decision/SKILL.md` 第 4 步要求，已把 `docs/decisions/0007-langgraph-runtime-foundation.md` 登记进 `scripts/check_harness.mjs` 的 `REQUIRED_FILES`；不补登历史遗留的 0006（超出本次返工范围）。
  - 未改动 `backend/app/main.py`、`backend/app/health.py`、`frontend/**`、`.github/workflows/harness.yml`——`GET /health` 契约与前端均未受影响。
- 自审：
  - 逐条核对 Acceptance Criteria 8 条，均有对应实现和自动化证据（详见 test-engineer 报告，已在本任务交付链路中独立验证）。
  - 修正了 ADR 0007 `Verification` 章节的时序措辞（原文在测试文件实际创建前就以完成时态描述 pytest 结果），改为准确区分"运行时模块交付阶段的临时原型验证"与"test-engineer 阶段的正式自动化测试与最终回归"两个真实发生的阶段，避免记录失实。
  - 确认所有改动均在架构分析阶段登记的允许路径内，`git status --porcelain` 核对无越界改动（预先存在的 `.agents/skills/product-flow/*`、`docs/failures/*` 改动与本任务无关，保持原样未覆盖）。
- 验证（本次自审阶段重新实测，均通过）：
  - `node scripts/check_harness.mjs` → `agentic-check: 通过 (36 个基线文件)`
  - `node scripts/check_harness.mjs --self-test` → `agentic-check self-test: 通过 (17 项)`
  - `backend`：`python -m pytest -q` → `16 passed`（既有 9 个 health/contract 测试 + 新增 7 个 langgraph_runtime 测试）
  - `backend`：`python -m ruff check .` → `All checks passed!`
  - 依赖安装版本核实：`pip show langgraph` → `Version: 1.2.9`（满足 `>=1.2,<2`），关键传递依赖 `langchain-core 1.4.9`、`langgraph-checkpoint 4.1.1`、`langgraph-prebuilt 1.1.0`、`langgraph-sdk 0.4.2`、`langsmith 0.10.5`、`xxhash 3.8.1`，无模型供应商 SDK。
- 剩余风险：
  - `langgraph` 是快速演进的核心依赖，`>=1.2,<2` 仅锁定主版本；未来 1.x 次版本升级仍可能有 API 细节变化，需要升级时重新用真实原型验证（已记录于 ADR 0007 Consequences）。
  - `xxhash` 是后端首个真正编译型三方依赖，本次仅在本机（Windows）验证 wheel 可用；Ubuntu CI 侧首次真实安装结果尚未观察到，需要在后续 CI 运行中确认（预期现有 `pip install -e ".[dev]"` 流程可自动覆盖，但未实际触发远端 CI）。
  - `langgraph-checkpoint`、`langsmith` 作为传递依赖已安装但保持惰性（未激活），此约束依赖"代码不新增 checkpointer/追踪配置"这一实现纪律，未来业务模块扩展时需持续注意，避免无意中激活。
- 第二轮返工（针对下方 Acceptance Review 的首轮未通过项）：
  - solution-architect 复核确认唯一缺口是 ADR 0007 未按 `.agents/skills/record-decision/SKILL.md` 第 4 步登记进 `scripts/check_harness.mjs` 的 `REQUIRED_FILES`，且不涉及 LangGraph 运行时/依赖/测试逻辑改动（见上方 Technical Plan"返工范围"小节）。
  - module-engineer 完成三处最小改动：`scripts/check_harness.mjs` 的 `REQUIRED_FILES` 新增 `docs/decisions/0007-langgraph-runtime-foundation.md`；`docs/decisions/0007-langgraph-runtime-foundation.md` 的 `Verification` 章节基线文件计数由 35 同步为实测的 36；本文件此前"登记会破坏既有先例，故不做此项改动"的错误结论已改写为准确描述。
  - test-engineer 独立复跑（未复用之前汇报的数字，重新实测）：`node scripts/check_harness.mjs` → `agentic-check: 通过 (36 个基线文件)`；`node scripts/check_harness.mjs --self-test` → `通过 (17 项)`；`node .agents/hooks/check-harness.mjs --self-test` → `通过 (3 项)`；`node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test` → `通过 (9 项)`；backend `pip install -e ".[dev]"` 成功解析 `langgraph 1.2.9` 等依赖；`python -m pytest -q` → `16 passed, 1 warning`（仅 httpx 弃用警告，与业务逻辑无关）；`python -m ruff check .` → `All checks passed!`；并逐条核对全部 8 条 Acceptance Criteria 均有真实证据，确认 `test_langgraph_runtime.py` 未 mock/monkeypatch LangGraph 本身；`git status --porcelain` 核对无越界改动。
  - 负责人最终自审：本轮改动范围与任务文件 Affected Modules 登记的允许路径一致，未触碰 `backend/app/langgraph_runtime/**`、`backend/tests/test_langgraph_runtime.py`、`backend/pyproject.toml`、`frontend/**`；`GET /health` 契约未受影响。

## Acceptance Review

- 验收结果：Accepted（2026-07-16；首轮发现 ADR 持久门禁缺失，经一次有限返工后通过）
- 验收证据：Codex 最终独立执行 `pip check`、禁用相关密钥/追踪变量并阻断 socket 连接的真实 LangGraph 1.2.9 图调用、Ruff、Pytest（16 passed）、四项仓库门禁（36/17/3/9）及 `git diff --check`，全部通过。`scripts/check_harness.mjs` 已把 ADR 0007 登记为必需文件；`backend/app/main.py`、`backend/app/health.py`、共享健康契约、`frontend/**` 和 CI 文件均未修改。八项 Acceptance Criteria 已逐条核对并具备实现、文档或自动化证据。
- 未通过项：无。非阻塞风险为 LangGraph 1.x 次版本演进、`xxhash` 尚待远端 Ubuntu CI 首次安装验证，以及 `langsmith`/`langgraph-checkpoint` 传递依赖需继续保持未激活；现有 FastAPI 测试仍有 Starlette/httpx2 弃用警告。
