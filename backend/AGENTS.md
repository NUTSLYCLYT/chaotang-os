# 后端 Agent 工作入口

作用域：`backend/`。已确定最小技术栈：Python + FastAPI + uvicorn，扁平 `app/` 包，
pytest 测试，ruff 静态检查，pip + venv 管理依赖。选型理由、取舍和验证证据见
`docs/decisions/0006-frontend-backend-foundation-stack.md`（`## 后端` 章节）。

## 边界

- 这里只放后端运行/评测工程及其验证，不实现前端内部功能。
- 当前保留 `GET /health` 业务无关入口，并新增唯一的本地业务接口
  `POST /api/v1/decrees/chancellor`，由 `app/api/decrees.py` 把旨意交给
  `app/agents/chancellor/` 的专用 LangGraph 丞相 Agent；该同步 MVP 仅支持
  `127.0.0.1`，不具备鉴权、限流、持久化或公开部署能力（见 ADR 0010）。该端点已升级为
  完整的丞相分流 + 六部办理 + 军机处会审闭环（见 ADR 0012）：丞相判断旨意是单部门
  （`single`）还是多部门（`multi`）路由；单部门旨意由 `app/agents/ministries/`
  （六部固定名录、单部门办理调用）处理；多部门旨意由 `app/agents/junjichu/`（军机处，
  按丞相给定顺序严格串行召集至少两个相关部门会审）处理；两者共用的图拓扑和状态形状
  （`ChancellorGraphState`）仍然只在 `app/agents/chancellor/graph.py` 一处定义。成功
  响应体不再是单段 `memorial_text`，而是 `route_type`/`rationale`/`processing_path`/
  `departments`/`ministry_opinions`/`final_verdict` 六个字段（`route_type` 与
  `ministry_opinions[].department` 均为 `str`，不是 `Literal`/`Enum`——六部范围与路由
  合法性只在图层的 `_decide_route` 节点做一次严格校验，响应模型不重复校验，避免把已经
  处理过的业务失败变成未捕获 500）。已引入最小、无外部服务依赖的
  LangGraph 运行时基础模块（`app/langgraph_runtime/`，决策见
  `docs/decisions/0007-langgraph-runtime-foundation.md`），仅提供一个可编译的
  确定性图工厂函数，不接入任何模型供应商、不做持久化/checkpointer、不新增任何
  HTTP 业务接口。除上述丞相端点外，后端仍不承载其它业务 API、鉴权、数据库模型或任务
  编排——这些超出当前范围，新增前先确认是否有对应产品任务。
- 不引入 `app/` 之外的多包结构、alembic、cli.py、多环境 docker-compose 或 `src/`
  布局，除非有新的 ADR 明确变更。

## 环境要求

- Python `>=3.11`（`pyproject.toml` 中 `requires-python` 为准）。
- 包管理器为 pip + 标准库 `venv`；不依赖 uv（原因见 ADR 0006）。

## Setup

```bash
cd backend
python -m venv .venv

# Windows（直接调用 venv 内可执行文件，不依赖 activate 脚本）
.venv\Scripts\python.exe -m pip install --upgrade pip
.venv\Scripts\python.exe -m pip install -e ".[dev]"

# Ubuntu / CI
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -e ".[dev]"
```

## Lint

```bash
# Windows
.venv\Scripts\python.exe -m ruff check .

# Ubuntu / CI
.venv/bin/python -m ruff check .
```

## Test

```bash
# Windows
.venv\Scripts\python.exe -m pytest

# Ubuntu / CI
.venv/bin/python -m pytest
```

## Run

```bash
# Windows
.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000

# Ubuntu / CI
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

启动后可用 `curl http://127.0.0.1:8000/health`（或等效工具）确认返回
`200 OK`、`application/json`、`{"status": "ok", "service": "chaotang-os-backend",
"version": "<pyproject.toml 中的 version>"}`。本次范围不包含 eval 命令。

## LangGraph 运行时基础

`app/langgraph_runtime/` 是一个最小、无外部服务依赖的 LangGraph 运行时基础模块，
决策与边界见 `docs/decisions/0007-langgraph-runtime-foundation.md`。

- 安装：不需要额外命令，`langgraph` 已是主依赖，随上面 `## Setup` 中的
  `pip install -e ".[dev]"` 一并安装。
- 核实实际安装版本：

  ```bash
  # Windows
  .venv\Scripts\python.exe -m pip show langgraph

  # Ubuntu / CI
  .venv/bin/python -m pip show langgraph
  ```

  已知交付时核实的版本为 `langgraph 1.2.9`（满足 `pyproject.toml` 中声明的
  `langgraph>=1.2,<2`）。
- 最小调用示例：

  ```python
  from app.langgraph_runtime import build_minimal_graph

  graph = build_minimal_graph()
  result = graph.invoke({"input_text": "  Hello World  ", "steps": [], "output_text": ""})
  # result["output_text"] == "processed:hello world"
  ```

- 当前能力边界：只提供一个可编译、确定性的两节点图（`START -> normalize ->
  transform -> END`）作为运行时基础的存在性证明；不接入任何模型供应商或
  API Key，不使用持久化/checkpointer，不接数据库，不提供流式接口，不做
  human-in-the-loop，未新增任何 HTTP 业务接口，`GET /health` 契约不变。完整
  排除清单见 ADR 0007。
- 未来若要接入真实模型、构建具体业务 agent/workflow 图，或引入持久化/
  checkpointer，需要新的产品任务并记录新的 ADR，不得直接在本模块基础上扩展。

## DeepSeek LangGraph 模块

`app/langgraph_runtime/deepseek_config.py`、`deepseek_client.py`、
`deepseek_graph.py` 在上述确定性运行时基础之上，新增一个独立的、可调用真实
DeepSeek 模型的图工厂，决策见 `docs/decisions/0008-*.md`。这是与
`build_minimal_graph()` 完全独立的能力：不修改、不复用 `graph.py`/`state.py`，
`build_minimal_graph()` 和 `GET /health` 的行为不受影响。

- 配置来源：`backend/config/providers.yaml`，顶层 `active` 必须为 `deepseek`，且只声明
  一个 `providers.deepseek` provider（`base_url`、`api_key_env`、`default_model`、`models`），不含真实
  密钥、不含 Ollama/Claude/MiniMax、不含模型分层或 fallback 字段。
- 密钥解析顺序（见 `app/langgraph_runtime/deepseek_env.py`、决策见
  `docs/decisions/0009-*.md`）：**进程环境变量 `DEEPSEEK_API_KEY` 优先**；只有进程变量
  缺失或为空时，才读取本机私有的固定路径 `backend/.env.example`（与当前工作目录无关）
  作为兜底。兜底读取只用 `dotenv_values()` 取内存 `dict`，取到的值按值传递给
  `openai.OpenAI(...)`，**从不写入/污染全局 `os.environ`**。配置文件
  `providers.yaml` 本身只存变量名，不存密钥值。缺文件、缺字段、缺 provider、缺少或非法的
  `active`、`default_model` 不在 `models` 中、`DEEPSEEK_API_KEY` 在进程环境和
  `backend/.env.example` 中都缺失/为空、或 `backend/.env.example` 不存在/无法解析，都会
  在发起任何网络请求之前抛出不泄露密钥的明确错误（错误信息只引用变量名和文件路径）。
- `backend/.env.template`（受 Git 跟踪的空模板，只含 `DEEPSEEK_API_KEY=`）与
  `backend/.env.example`（本机私有、被 Git 忽略、可能包含真实密钥）的区别：前者是可提交
  的起点，后者是每个开发者本机各自维护、绝不提交的真实配置。首次配置时复制模板并填入真实
  key：

  ```bash
  # Windows
  copy backend\.env.template backend\.env.example

  # Ubuntu / CI
  cp backend/.env.template backend/.env.example
  ```

  复制后编辑 `backend/.env.example`，把 `DEEPSEEK_API_KEY=` 填成真实、有效的密钥。
- 零网络配置检查命令：验证 provider schema、Key 可解析（进程变量或指定的 dotenv 文件
  兜底）、默认模型可规范化、以及真实 `openai.OpenAI` 客户端/图可构造，但绝不调用模型、
  不访问网络；成功打印一句脱敏状态并返回 0，失败打印一句不含密钥的错误描述并返回非零。
  `--dotenv-path` 是**必填**参数——这是刻意的安全门禁：缺少该参数时命令在读取任何 dotenv
  文件之前就以退出码 `2` 拒绝执行（历史事故与设计动机见
  `docs/failures/2026-07-17-product-flow-read-private-dotenv.md` 与
  `docs/decisions/0009-*.md` 的"第二轮修订"小节）。自动化/CI 只应传临时路径；本机开发者
  可以按自己的知情选择传入真实的 `backend/.env.example` 路径：

  ```bash
  # Windows
  .venv\Scripts\python.exe -m app.langgraph_runtime.deepseek_check --dotenv-path <临时或私有 dotenv 路径>

  # Ubuntu / CI
  .venv/bin/python -m app.langgraph_runtime.deepseek_check --dotenv-path <临时或私有 dotenv 路径>
  ```

  该命令与下方"本地调用示例"不同：它只构造图（`build_deepseek_graph()`），不调用
  `.invoke()`，因此不产生任何真实 API 用量；真正调用 `.invoke()`（如下方示例）仍会
  产生真实 DeepSeek API 用量。
- `build_deepseek_graph(chat_model=None)`：
  - 传入兼容的假聊天模型（签名：接收消息列表、返回字符串）时，图完全离线
    运行，不读取任何环境变量、不构造真实客户端，用于测试。
  - 不传入时，函数在**返回编译好的图之前**就完成配置加载、环境变量校验、
    真实 `openai.OpenAI` 客户端构造，从而在 `DEEPSEEK_API_KEY` 缺失时于
    `build_deepseek_graph()` 这一步就快速失败，而不是等到 `.invoke()`。
  - 图节点捕获模型调用异常并包装后重新抛出（不吞掉、不写入状态）；每次
    `.invoke()` 独立处理，连续调用不共享可变状态。
- 依赖：`openai`、`pyyaml` 已在 `backend/pyproject.toml` 主依赖中显式声明
  （核实安装版本见 `docs/decisions/0008-*.md`）；`python-dotenv` 是本地 dotenv 兜底新增的
  显式主依赖（版本范围与理由见 `docs/decisions/0009-*.md`），随 `## Setup` 的
  `pip install -e ".[dev]"` 一并安装。
- 当前能力边界：仅提供图工厂和配置加载入口，不新增聊天 HTTP API 或
  provider 管理 API，不做流式输出、工具调用、human-in-the-loop、
  checkpointer 或数据库持久化。这些若要接入，需要新的产品任务和新的 ADR。

本地调用示例（**会真实访问 DeepSeek API、产生真实 API 用量**；运行前需要设置真实、有效的
`DEEPSEEK_API_KEY`——可以是进程环境变量，也可以是复制 `backend/.env.template` 得到的
`backend/.env.example` 中的值（见上文密钥解析顺序），且需要在已激活 `.venv` 的
`backend/` 目录下运行）：

```python
from app.langgraph_runtime import build_deepseek_graph

# 未传入 chat_model：会立即加载配置、校验 DEEPSEEK_API_KEY、构造真实
# openai.OpenAI 客户端；缺 key 时在这一行就抛出，不会等到 invoke()。
graph = build_deepseek_graph()

# 这一步会对 DeepSeek 发起真实请求，消耗真实 API 额度。
result = graph.invoke({"input_text": "用一句话介绍你自己", "response_text": ""})
print(result["response_text"])
```

离线测试可注入假聊天模型，完全不访问网络、不需要真实 key：

```python
from app.langgraph_runtime import build_deepseek_graph


def fake_chat_model(messages: list[dict[str, str]]) -> str:
    return f"echo:{messages[0]['content']}"


graph = build_deepseek_graph(chat_model=fake_chat_model)
result = graph.invoke({"input_text": "hello", "response_text": ""})
# result["response_text"] == "echo:hello"
```

## 业务 Agent 与 HTTP 契约子包

`app/agents/`（业务专用 LangGraph agent，例如 `app/agents/chancellor/`，独立于
`app/langgraph_runtime/` 基础设施，只读复用其配置/客户端构造辅助函数）与 `app/api/`
（业务 HTTP 契约层，例如 `app/api/decrees.py`，把某个业务 agent 通过
`APIRouter`/`app.include_router(...)` 挂到 `app/main.py` 的既有 `app` 实例上）是两个
职责边界清晰、彼此独立的子包：`app/agents/**` 不涉及 HTTP，`app/api/**` 不实现 agent
的图逻辑，只做请求/响应契约（Pydantic 模型 + 校验）、错误脱敏映射与路由注册。
`app/main.py` 中 `GET /health` 的既有代码路径不受这两个子包影响。`app/agents/` 目前含
三个业务子包：`app/agents/chancellor/`（丞相分流图，唯一定义 `ChancellorGraphState` 和
拓扑的地方）、`app/agents/ministries/`（六部固定名录 `MINISTRIES`、单部门/军机处共用的
`invoke_ministry_agent`）、`app/agents/junjichu/`（军机处多部门会审，严格串行、不并发调用
六部）；三者的结构化 JSON 解析共用 `app/agents/structured_output.py` 里的唯一函数。具体
接口、错误映射和验证证据见对应产品任务与其 Implementation Report（例如
`docs/product/tasks/2026-07-17-shangshufang-chancellor-agent.md`、
`docs/product/tasks/2026-07-17-decree-six-ministries-joint-review.md`）。

## 后续变更要求

再次改变语言、运行方式、包管理器或评测方式时，在同一变更中：

1. 用最小原型验证关键假设。
2. 在 `docs/decisions/` 记录选择和取舍。
3. 更新本文件，登记准确的 setup、lint、test、run/eval 命令，并接入 CI。
4. 让 agent 能直接读取测试、日志和必要的本地运行状态；工具优先提供非交互接口、
   可操作错误信息和安全的 dry-run。
