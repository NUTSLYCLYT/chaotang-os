# 决策 0008：为 LangGraph 接入 DeepSeek

## Status

Accepted — 2026-07-16

## Context

`backend/app/langgraph_runtime/` 此前只有一个完全确定性、无外部服务依赖的最小图示例
（`build_minimal_graph()`，见 `docs/decisions/0007-langgraph-runtime-foundation.md`），
明确排除任何模型供应商接入。产品任务
`docs/product/tasks/2026-07-16-connect-langgraph-deepseek.md` 要求把 `dev` 分支中已确认的
DeepSeek 声明式配置迁入当前重建分支，并提供一个独立的、可调用真实 DeepSeek 模型的
LangGraph 图工厂，供后续业务工作流复用同一套配置、密钥校验和模型调用入口。

`dev` 分支存在一套更大的 `provider.py`/`model_adapter.py` + LiteLLM 多供应商路由/兜底层，
覆盖 DeepSeek、Ollama、Claude、MiniMax 等多个 provider。本次任务的 Delivery Constraints
明确要求：只以 `dev:backend/config/providers.yaml` 的 DeepSeek 条目为字段事实来源，不
checkout/merge/cherry-pick `dev`，不迁入 `dev` 的 provider/model_adapter/LiteLLM/Ollama
兜底逻辑；只接入 DeepSeek，不迁移完整模型层。自动化验证必须完全离线，不得调用 DeepSeek
探活或消耗真实额度。

## Decision

### 为什么是"DeepSeek 专用配置 + 可注入聊天模型 + 独立图工厂"，而不是迁入 `dev` 的
LiteLLM/provider/fallback 层

- `dev` 的 `provider.py`/`model_adapter.py` + LiteLLM 是为多供应商路由和兜底设计的抽象层；
  本次范围只需要一个 provider，引入这层抽象会带来当前用不到的路由/兜底代码路径和额外的
  三方依赖（`litellm` 本身体积大、有自己的多供应商版本矩阵），且直接违反 Delivery
  Constraints 中"不得迁入 provider.py/model_adapter.py 或 LiteLLM/Ollama 兜底逻辑"的
  明确约束。
- 因此采用最小充分方案：一个只声明单一 `deepseek` provider 的声明式 YAML
  （`backend/config/providers.yaml`）+ 一个只读、可独立单测的配置加载模块
  （`deepseek_config.py`）+ 一个薄的生产模型客户端适配层（`deepseek_client.py`）+ 一个
  独立于 `build_minimal_graph()` 的图工厂（`deepseek_graph.py`），图工厂支持依赖注入
  （`chat_model` 参数），既能在生产环境调用真实 DeepSeek，又能在测试中注入假模型完全离线
  验证，不需要引入多供应商路由系统就能满足"可复用配置、密钥校验和模型调用入口"的产品目标。
- 这与 ADR 0007"运行时基础不预设业务架构"的既有克制风格一致：只解决当前明确需要的问题
  （接入 DeepSeek），不为假设中的未来多供应商需求预先构建抽象。

### `providers.yaml` schema

```yaml
active: deepseek
providers:
  deepseek:
    base_url: https://api.deepseek.com/v1
    api_key_env: DEEPSEEK_API_KEY
    default_model: openai/deepseek-chat
    models:
      - openai/deepseek-chat
      - openai/deepseek-reasoner
```

- 顶层 `active` 是必填字符串且固定为 `deepseek`，与
  `dev:backend/config/providers.yaml` 的激活语义和产品验收标准一致。加载器会在读取
  `providers.deepseek` 前拒绝缺失、非字符串或非 `deepseek` 的值；它不是运行时可写的
  provider 切换接口，也不引入多供应商路由。
- 只有一个 provider 键 `deepseek`，不额外引入 `enabled`、候选 provider 或 fallback。
- `api_key_env` 存的是环境变量名（`"DEEPSEEK_API_KEY"`），不是密钥值。
- `models` 是纯字符串列表，不用带元数据的对象列表——当前不需要为模型附加分层信息（上下文
  窗口等），加了会构成 Acceptance Criteria 明确禁止的"模型分层"。
- 不包含 Ollama/Claude/MiniMax、不包含 fallback/tier/version 等任何 AC 未要求的字段，不含
  真实密钥。
- 字段值（`base_url`/模型名）与 `dev:backend/config/providers.yaml` 的 DeepSeek 条目一致；
  字段名（`base_url`/`api_key_env`/`default_model`/`models`）由本次任务的 Technical Plan
  重新设计，服务于本模块自己的 schema，不强制照抄 `dev` 的字段命名。

### SDK 选型：官方 `openai` SDK，直连 DeepSeek 的 OpenAI 兼容端点

- 新增显式主依赖 `openai>=1.40,<2`（实测安装版本 `openai 1.109.1`），`OpenAI(base_url=,
  api_key=)` 参数完全显式传入，没有内置的隐式环境变量名默认值，与"密钥只能来自
  `DEEPSEEK_API_KEY`"的约束没有额外的隐式行为面需要覆盖。
- 不用 `litellm`：其 provider/model 前缀路由、多 provider 兜底正是 `dev` 分支
  `provider.py`/`model_adapter.py` 那套逻辑的等价物，引入它等于变相违反"不迁入 LiteLLM/
  Ollama 兜底逻辑"的约束；本次只服务单一 DeepSeek provider，没有多 provider 路由需求。
- 不用 `langchain-openai`/`ChatOpenAI`：`langgraph 1.2.9` 已传递依赖 `langchain-core`，
  `langchain-openai` 对 `langchain-core` 有自己的版本兼容矩阵，新增显式依赖有和已固定的
  传递依赖版本冲突的真实风险；`ChatOpenAI` 还会读取自己内置的默认环境变量名（如
  `OPENAI_API_KEY`），需要额外小心覆盖每个默认值才能保证密钥只来自
  `DEEPSEEK_API_KEY`，而 `openai.OpenAI(base_url=, api_key=)` 没有这个问题。这与 ADR
  0007 中"未新增 `langchain` 高层抽象包"的既有取舍一致。
- 新增显式主依赖 `pyyaml>=6.0,<7`（实测安装版本 `PyYAML 6.0.3`）：此前 `pyyaml` 只是
  `langgraph`/`langchain-core` 生态的传递依赖，未被显式声明；`providers.yaml` 的解析是本
  模块的核心功能而非偶然行为，提升为显式依赖避免未来因传递依赖变化而意外消失。

### 模型名规范化边界

- `providers.yaml`、`DeepSeekProviderConfig` 中全程保留原始 `openai/` 前缀模型名（对齐
  `dev` 分支的历史命名习惯），DeepSeek 的 OpenAI 兼容端点只接受不带前缀的原生模型名（如
  `deepseek-chat`）。
- 规范化（`normalize_deepseek_model_name`）是一个独立、可单测的纯函数，只在生产客户端
  适配层（`deepseek_client.py`）内、调用 SDK 前的最后一步执行；缺少 `openai/` 前缀会显式
  报错而不是静默直接透传，避免配置笔误被无声接受。
- 未选择反过来的设计（配置存裸模型名，适配层加前缀）：保留原始前缀名能让配置文件继续
  和 `dev` 分支的历史记录对照，规范化只解决"SDK 调用边界"这一个具体问题，不引入额外的
  加前缀分支逻辑。

### 快速失败与依赖注入设计

- `build_deepseek_graph(chat_model=None)`：未注入 `chat_model` 时，函数在**返回编译好的
  图之前**（而不是等到 `.invoke()`）就完成配置加载、`DEEPSEEK_API_KEY` 校验、真实
  `openai.OpenAI` 客户端构造，任何配置或密钥问题都在此处抛出，不会等到发起请求或
  `.invoke()` 时才暴露。
- 注入 `chat_model`（签名：接收消息列表、返回字符串文本，用于离线测试）时，图工厂完全不碰
  环境变量、配置文件之外的任何网络客户端，保证测试路径天然离线、不需要真实密钥。
- `DeepSeekGraphState`（`input_text`/`response_text`）刻意独立于 `graph.py`/`state.py`
  现有的 `GraphState`，不新增 `error` 占位字段——节点函数捕获底层模型调用异常后统一包装为
  `DeepSeekGraphInvocationError` 并 `raise ... from exc` 重新抛出，异常必须冒泡出
  `.invoke()`，不允许被静默写入状态字段代替真正报错。异常消息本身不拼接第三方 SDK 异常的
  `str()` 原文，只描述失败的模型名，避免第三方错误正文意外回显敏感内容；原始异常始终可通过
  `__cause__` 访问，供本地调试。
- 已用真实 LangGraph `.invoke()` 调用实测确认：节点函数内部抛出的异常确实会同步冒泡给
  `.invoke()` 的调用者（`backend/tests/test_deepseek_graph.py` 中的
  `test_node_exception_propagates_synchronously_out_of_invoke`），这是本设计成立的关键
  运行时前提，不是未经验证的假设。

### 密钥保护

- 密钥只允许从进程环境变量 `DEEPSEEK_API_KEY` 读取（`resolve_deepseek_api_key` 只读
  `os.environ`，与 YAML 解析完全分离成独立函数，便于分别测试"配置文件问题"与"密钥缺失"两类
  失败）。
- 所有配置/密钥相关异常消息只允许引用字段名、环境变量名、文件路径，绝不拼接已读取到的
  密钥值；`backend/tests/test_deepseek_config.py` 中有专门的回归测试，用一个可识别的假密钥
  字符串触发配置错误，断言异常文本不包含该假密钥。
- 顶层 `active` 与 provider 字段同样在构造客户端前完成 schema 校验；错误只说明
  `active` 必须选择 `deepseek`，不回显非法值，避免误将敏感内容带入异常文本。
- 解析出的密钥值只存在于 `build_deepseek_chat_model` 函数的局部作用域，直接传给
  `openai.OpenAI(...)` 构造函数，不被本模块自建的任何会被日志/异常/图状态序列化的对象持有。

### 明确排除（非目标，延续并收窄 ADR 0007 的排除清单）

以下能力本次仍未引入，未来若要接入需要新的产品任务和/或新的 ADR：

- 不新增聊天 HTTP API 或 provider 管理 API；`backend/app/main.py`、`backend/app/health.py`
  均未修改，`GET /health` 契约不变。
- 不迁移 `dev` 的完整模型层：不引入多 provider 注册表、模型分层、路由/兜底逻辑，不接入
  Ollama/Claude/MiniMax。
- 不做流式输出、工具调用（tool calling）、RAG、human-in-the-loop。
- 不使用持久化/checkpointer、不接数据库、不做分布式执行、不做生产部署配置。
- 不接入 LangSmith 追踪、不使用 LangGraph Studio/CLI（与 ADR 0007 相同的传递依赖惰性
  状态，未设置任何追踪相关环境变量）。
- 不做真实网络连通性的自动化验证：Delivery Constraints 要求自动验证完全离线，不得调用
  DeepSeek 探活或消耗真实额度；测试只验证适配层参数传递、异常包装和状态读写是否正确，不
  验证"能否真的连通 DeepSeek"，这一点只能由使用者按 `backend/AGENTS.md` 中标注为"会产生
  真实 API 用量"的本地调用示例手动验证。

## Consequences

- 收益：后续业务工作流可以直接复用同一套 DeepSeek 配置加载、密钥校验和模型调用入口
  （`load_deepseek_provider_config`/`build_deepseek_chat_model`/`build_deepseek_graph`），
  不需要各自重新决定配置 schema、密钥读取方式和错误处理风格；依赖注入设计使得依赖此模块的
  未来业务图也能沿用同一套离线测试模式。
- 代价：
  - 新增了两个显式主依赖（`openai`、`pyyaml`），扩大了后端的依赖树和潜在供应链面；
    `openai` 是本仓库后端目前引入的第一个模型供应商 SDK。
  - 当前只支持单一 provider（DeepSeek），如果未来产品需要真正的多供应商路由，本次的
    schema 和模块结构需要重新设计，不能直接线性扩展成多 provider 注册表——这是本次为了
    满足"不迁入 dev 兜底层"约束而做出的有意收窄，代价是未来多供应商需求需要一次新的架构
    决策，而不是渐进式扩展。
  - `DeepSeekGraphState` 没有 `error` 字段，意味着调用方必须自己处理 `.invoke()`
    抛出的异常（`DeepSeekApiKeyError`/`DeepSeekConfigSchemaError`/
    `DeepSeekGraphInvocationError` 等），而不能依赖检查返回状态里的错误字段——这是有意的
    设计取舍（避免错误被静默吞掉），但要求所有未来调用方都遵守"异常优先"的调用约定。

## Verification

依赖安装与实现验证（「后端 DeepSeek provider 配置、LangGraph 模型调用运行时」模块交付
阶段，`module-engineer` 角色实测）：

- `pip install -e ".[dev]"` 后核实实际安装版本：`pip show openai` → `Version: 1.109.1`
  （满足 `openai>=1.40,<2`）；`pip show pyyaml` → `Version: 6.0.3`（满足
  `pyyaml>=6.0,<7`）。
- `.venv\Scripts\python.exe -m ruff check .` → `All checks passed!`。
- `.venv\Scripts\python.exe -m pytest -v` → **43 passed**；其中
  `test_deepseek_config.py` 覆盖真实配置 `active: deepseek` 正向路径，以及 `active` 缺失、
  非字符串、非 `deepseek` 三类失败。全部离线运行，无真实网络请求、无真实
  `DEEPSEEK_API_KEY`。
- 用真实 LangGraph `.invoke()` 实测确认节点异常同步冒泡出调用者
  （`test_node_exception_propagates_synchronously_out_of_invoke`）。
- 生产客户端构造路径通过 mock 掉 `openai.OpenAI` 类验证参数传递（`base_url`/`api_key`）
  正确，全程未发起真实网络请求。

`test-engineer` 角色的独立验证结果、`node scripts/check_harness.mjs` 与
`node scripts/check_harness.mjs --self-test` 的最终执行结果见任务文件
`docs/product/tasks/2026-07-16-connect-langgraph-deepseek.md` 的 `Implementation Report`。
