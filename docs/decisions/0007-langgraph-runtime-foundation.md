# 决策 0007：后端 LangGraph 运行时基础

## Status

Accepted — 2026-07-16

## Context

`backend/` 此前只有一个最小 FastAPI 骨架，仅暴露 `GET /health`，不含任何业务代码、
状态模型或图/agent 运行时（见 `docs/decisions/0006-frontend-backend-foundation-stack.md`
`## 后端` 章节）。产品任务
`docs/product/tasks/2026-07-16-integrate-langgraph-backend.md` 要求为后续
agentic workflow 建立一个可导入、可编译、可重复调用、无外部服务依赖的最小确定性
图示例，避免后续业务模块各自零散引入 LangGraph，导致依赖范围、状态模型和图构建
方式失控。

本次交付范围明确排除模型供应商接入、聊天机器人、具体业务工作流、工具调用、RAG、
LangSmith 追踪、LangGraph Studio/CLI、持久化/checkpointer、数据库、流式接口、
human-in-the-loop、分布式执行和生产部署；也不新增公开 HTTP 业务接口，不改变现有
`GET /health` 契约。

## Decision

### 依赖选择

- 在 `backend/pyproject.toml` 的 `[project].dependencies`（主依赖，非 `dev`
  extra）新增 `"langgraph>=1.2,<2"`。选择声明为主依赖而非仅测试期依赖，理由：
  该模块（`app/langgraph_runtime/`）是可被后续业务模块直接导入调用的运行时能力，
  不是纯测试工具，放进主依赖才能保证 `pip install -e "."`（不带 `[dev]`）也能
  正确安装、导入。
- 未显式声明 `langchain-core`、`langgraph-checkpoint`、`langgraph-prebuilt`、
  `langgraph-sdk`、`langsmith`、`xxhash` 等——它们均作为 `langgraph` 的传递依赖
  自动装入，不单独声明版本约束，避免与官方包自身的版本矩阵冲突。
- 未新增任何模型供应商 SDK（如 `openai`、`anthropic`），也未新增
  `langchain`（高层 agent 抽象包）——本次只使用 `langgraph` 核心包提供的
  `StateGraph`/`START`/`END` 图 API。
- 实际安装并核实的版本：`langgraph 1.2.9`（满足 `>=1.2,<2` 约束），关键传递依赖
  `langchain-core 1.4.9`、`langgraph-checkpoint 4.1.1`、`langgraph-prebuilt 1.1.0`、
  `langgraph-sdk 0.4.2`、`langsmith 0.10.5`、`xxhash 3.8.1`；未出现任何模型供应商
  SDK。

### 模块边界

- 新增独立子包 `backend/app/langgraph_runtime/`，命名刻意避开与三方包 `langgraph`
  同名，避免 import 时产生认知/命名混淆。
- 对外只暴露两个符号（`__init__.py` 重新导出）：
  - `build_minimal_graph() -> CompiledStateGraph`（完整类路径
    `langgraph.graph.state.CompiledStateGraph`）：返回编译后的、可直接
    `.invoke(...)` 的图对象。调用方不需要了解节点/边的构建细节。
  - `GraphState`：`typing.TypedDict`，字段为 `input_text: str`、
    `steps: list[str]`、`output_text: str`。
- `backend/app/main.py`、`backend/app/health.py` 均未修改，也未 import
  `app.langgraph_runtime`；该模块与现有 `GET /health` 完全解耦。

### 最小图设计

- 图结构：`START -> normalize -> transform -> END`，两个真实节点（证明多节点
  遍历，而非单节点占位）。
- `normalize` 节点：对 `input_text` 做 `strip().lower()`，写入
  `output_text`，并把 `"normalize"` 追加进 `steps`。
- `transform` 节点：对当前 `output_text` 包一层 `f"processed:{output_text}"`
  前缀，并把 `"transform"` 追加进 `steps`。
- 每个节点函数都是纯函数：只读取传入的 `state`，返回一个新建的局部更新字典
  （partial state），从不原地修改传入的 `list`/`dict`。这是保证同一个编译后的
  图对象被重复 `.invoke()` 调用时，两次调用之间不会互相污染 `steps` 列表等可变
  状态的关键约束。

### 明确排除（非目标）

以下能力本次均未引入，未来若要接入需要新的产品任务和/或新的 ADR：

- 不接入任何模型供应商或 API Key（无 `openai`/`anthropic` 等 SDK，无相关环境
  变量）。
- 不实现聊天机器人、具体业务工作流、工具调用（tool calling）、RAG。
- 不接入 LangSmith：虽然 `langsmith` 作为 `langgraph` 的传递依赖被安装，但代码
  未设置 `LANGCHAIN_TRACING_V2`、`LANGSMITH_API_KEY` 等任何追踪相关环境变量，
  该依赖处于完全惰性、未被激活的状态。
- 不使用 LangGraph Studio 或 LangGraph CLI。
- 不使用持久化/checkpointer：虽然 `langgraph-checkpoint` 同样作为传递依赖被
  安装，但 `build_minimal_graph()` 中的 `builder.compile()` 调用未传入任何
  `checkpointer` 参数，图对象不具备跨调用的状态持久化能力。
- 不接数据库。
- 不做流式接口（未使用 `.stream()`/`.astream()` 等流式调用方式）。
- 不做 human-in-the-loop（无中断/`interrupt` 机制）。
- 不做分布式执行。
- 不做生产部署配置。
- 不新增任何公开 HTTP 业务接口；`GET /health` 的状态码和响应体契约保持不变。

## Consequences

- 收益：后续实现真实业务 agent/workflow 的模块，有一个已验证可编译、边界清晰、
  无外部服务依赖的运行时基础可以直接依赖和扩展，不需要每个业务模块各自重新决定
  依赖版本、状态类型定义方式和图构建风格，降低了未来集成的不一致风险。
- 代价：
  - 新增了 `xxhash`（编译型二进制依赖）——这是本仓库后端目前引入的第一个真正
    的编译型三方依赖，需要在本机与 CI 两侧确认 wheel 均可正常获取安装。
  - 传递依赖 `langsmith`、`langgraph-checkpoint`、`langgraph-prebuilt`、
    `langgraph-sdk` 增加了依赖树体积和潜在的供应链面，即使当前代码未激活它们
    的能力。
  - `langgraph` 是快速演进的核心运行时依赖；`>=1.2,<2` 的版本范围只锁定主版本，
    未来在 1.x 内部的次要版本升级仍可能带来 API 细节变化，需要在升级时重新用
    真实原型验证；跨主版本升级（如 2.x）必须重新验证并更新本决策或新建 ADR。
  - 本次交付的最小图仅用于证明运行时集成本身可用，不构成、也不得被误读为已经
    确定的业务 agent 架构；具体业务图结构、模型接入方式、持久化方案仍是未决问题。

## Verification

依赖安装与最小图行为核实（「后端 LangGraph 运行时基础」模块交付阶段，
`backend/tests/test_langgraph_runtime.py` 尚未创建，用未提交的临时脚本原型
验证）：

- `pip install -e ".[dev]"`：成功解析并安装 `langgraph 1.2.9`（满足
  `>=1.2,<2` 约束），关键传递依赖版本 `langchain-core 1.4.9`、
  `langgraph-checkpoint 4.1.1`、`langgraph-prebuilt 1.1.0`、
  `langgraph-sdk 0.4.2`、`langsmith 0.10.5`、`xxhash 3.8.1`；未出现任何模型
  供应商 SDK。
- 手动版本核实：`pip show langgraph` 输出 `Version: 1.2.9`。
- 临时原型脚本确认：`build_minimal_graph()` 返回
  `langgraph.graph.state.CompiledStateGraph` 实例，`get_graph().nodes` 的
  key 集合为 `{'__start__', 'normalize', 'transform', '__end__'}`，连续两次
  `.invoke()` 不同输入互不污染。
- `ruff check .`：后端静态检查通过。

正式自动化测试与仓库级检查（「工程治理与架构记录」模块交付阶段执行，此时本
ADR、`ARCHITECTURE.md`、`backend/AGENTS.md` 已同步更新）：

- `node scripts/check_harness.mjs`：`agentic-check: 通过 (36 个基线文件)`。
- `node scripts/check_harness.mjs --self-test`：`agentic-check self-test: 通过
  (17 项)`。

`test-engineer` 角色随后新增 `backend/tests/test_langgraph_runtime.py`
（7 个测试，覆盖图可编译且为真实 `CompiledStateGraph` 对象、图结构节点集合、
确定性调用的精确断言、重复调用/输入隔离、节点函数不原地修改传入
`steps` 列表、无 LangSmith/模型供应商相关环境变量、`langgraph` 版本可见性），
并执行了最终端到端回归，全部实测通过：

- `pytest -v`：**16 passed**（既有 `test_health.py`/`test_contract_health.py`
  9 个 + 新增 `test_langgraph_runtime.py` 7 个）。
- `ruff check .`：`All checks passed!`。
- `node scripts/check_harness.mjs` 与 `--self-test`：均再次通过；
  `node .agents/hooks/check-harness.mjs --self-test`：`Stop hook self-test:
  通过 (3 项)`。
- `GET /health` 契约未受影响：`backend/app/main.py`、`backend/app/health.py`
  均未修改，既有健康检查与契约测试全部通过。

结果详见任务文件 `docs/product/tasks/2026-07-16-integrate-langgraph-backend.md`
的 `Implementation Report`。
