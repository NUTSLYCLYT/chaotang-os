# 任务：为 LangGraph 接入 DeepSeek

## Status

Accepted

## Product Definition

当前后端只有一个完全确定性的 LangGraph 存在性示例，无法调用真实模型。将 `dev` 分支中已经确认的
DeepSeek 声明式配置迁入当前重建分支，并提供一个独立的、可调用 DeepSeek 的 LangGraph 图工厂，让后续
业务工作流可以复用同一套配置、密钥校验和模型调用入口。

本次只接入 DeepSeek，不迁移 `dev` 的完整模型层。保留现有 `build_minimal_graph()` 和 `GET /health`
行为；不增加业务 HTTP API，不接入数据库、checkpointer、LangSmith、流式输出、工具调用或
human-in-the-loop。

## Acceptance Criteria

- [x] `backend/config/providers.yaml` 只声明一个激活的 `deepseek` provider，保留 `dev` 中的
  `https://api.deepseek.com/v1`、`DEEPSEEK_API_KEY`、`openai/deepseek-chat`、
  `openai/deepseek-reasoner` 和默认 `openai/deepseek-chat`；不得包含真实密钥、Ollama、Claude、
  MiniMax、模型分层或悬空的 fallback。
- [x] 后端提供只读、可验证的 DeepSeek 配置加载入口；缺少文件、字段、provider、模型或
  `DEEPSEEK_API_KEY` 时，在任何外部请求发生前抛出不泄露密钥的明确配置错误。
- [x] 后端提供独立于现有确定性图的 DeepSeek LangGraph 图工厂：图接收文本消息，调用配置中的默认
  DeepSeek 模型，并把模型文本响应写回显式状态；调用链可由调用方注入兼容的假聊天模型，以便离线测试。
- [x] 默认生产模型客户端使用 DeepSeek 的 OpenAI 兼容地址和环境变量密钥，依赖必须显式声明，不能依赖
  偶然存在的传递依赖；不得把 key 写入日志、异常或图状态。
- [x] `backend/.env.example` 增加空的 `DEEPSEEK_API_KEY=` 及用途说明，真实 `.env` 继续被忽略；文档给出
  明确的本地调用示例并说明该示例会访问 DeepSeek、产生真实 API 用量。
- [x] 自动化测试覆盖配置解析、默认模型选择、缺 key 快速失败、假模型成功响应、模型异常传播/包装和连续
  调用不串状态；测试不得访问真实网络或要求真实密钥。
- [x] 现有 `build_minimal_graph()` 的确定性行为、`GET /health` 契约和前端保持不变。
- [x] 新增 ADR 记录为什么采用“DeepSeek 专用配置 + 可注入聊天模型 + 独立图工厂”，以及未采用旧
  LiteLLM/provider/fallback 层的取舍；长期必需的新配置和 ADR 登记到 harness 基线。
- [x] `ruff`、全部后端 `pytest`、harness 检查及相关自测全部通过。

## Delivery Constraints

- 以 `dev:backend/config/providers.yaml` 的 DeepSeek 条目为事实来源，但只复制 DeepSeek 所需字段；不得
  checkout、merge 或 cherry-pick `dev`，不得迁入 `dev:backend/src/provider.py`、
  `dev:backend/src/model_adapter.py` 或 LiteLLM/Ollama 兜底逻辑。
- 密钥仅允许从进程环境变量 `DEEPSEEK_API_KEY` 读取。不得提交真实环境文件、密钥、网络响应、运行日志或
  缓存数据。
- 自动验证必须完全离线；不得调用 DeepSeek 探活，不得消耗用户额度。
- 保持现有 FastAPI 对外契约不变；本次不新增聊天 API、provider 管理 API 或启动时强制联网。
- 如果所选 SDK 对模型名要求与配置中的 `openai/` 前缀不兼容，必须在适配边界进行明确、可测试的规范化，
  配置文件仍保留来自 `dev` 的原始模型名。
- 允许修改路径：`backend/config/providers.yaml`、`backend/app/langgraph_runtime/**`、
  `backend/tests/**`、`backend/pyproject.toml`、`backend/.env.example`、`backend/AGENTS.md`、
  `ARCHITECTURE.md`、`docs/decisions/0008-*.md`、`scripts/check_harness.mjs`、本任务文件。
- 禁止修改路径：`frontend/**`、`backend/app/main.py`、`backend/app/health.py`、
  `docs/contracts/**`、`.github/**`、`.env` 及所有范围外文件。

## Affected Modules

- 模块：后端 DeepSeek provider 配置、LangGraph 模型调用运行时、离线测试与架构治理
- 允许路径：backend/config/providers.yaml, backend/app/langgraph_runtime/**, backend/tests/**, backend/pyproject.toml, backend/.env.example, backend/AGENTS.md, ARCHITECTURE.md, docs/decisions/0008-*.md, scripts/check_harness.mjs, docs/product/tasks/2026-07-16-connect-langgraph-deepseek.md

## Technical Plan

（由 Claude Code 程序团队负责人在审查 solution-architect 只读分析结果后撰写。注：
solution-architect 在本次调用中曾通过其只读工具集里的 Bash 直接向本任务文件写入了一版
未经负责人审查的技术方案草稿——这不符合"专业角色不得修改任务文件"的协作协议；负责人已
弃用该次未授权写入的内容，改为基于该 agent 通过正常结果通道返回的分析文本重新审查并
撰写以下计划。）

- SDK 选型：官方 `openai` SDK 直连 DeepSeek 的 OpenAI 兼容端点
  （`base_url="https://api.deepseek.com/v1"`），不引入 `litellm`（其 provider 路由/兜底
  正是 Delivery Constraints 禁止迁入的 `dev` provider/model_adapter 逻辑的等价物）、也不引入
  `langchain-openai`/`ChatOpenAI`（会与 `langgraph` 已传递依赖的 `langchain-core`
  产生额外版本耦合面，且自带隐式 env 变量名默认值，与"密钥只能来自 `DEEPSEEK_API_KEY`"的
  约束叠加不必要的隐式行为）。`openai`、`pyyaml` 均需在 `backend/pyproject.toml` 主依赖
  （非 dev extra）中显式声明（建议 `openai>=1.40,<2`、`pyyaml>=6.0,<7`），实现阶段用
  `pip show openai`/`pip show pyyaml` 核实真实安装版本并记录进 ADR 0008。
- `providers.yaml` schema（`backend/config/providers.yaml`，需新建 `backend/config/` 目录）：
  顶层 `active` 必须是字符串且精确为 `deepseek`，加载器在读取 provider 前校验；单一
  `providers.deepseek` 键，不增加其它候选 provider、运行时切换或 fallback。provider 字段为
  `base_url`、`api_key_env`（存环境变量名，
  不存密钥值）、`default_model`、`models`（原始字符串列表，保留 `openai/deepseek-chat`、
  `openai/deepseek-reasoner` 前缀形式，不做模型分层）。
- `openai/` 前缀规范化：DeepSeek 兼容端点只接受不带前缀的原生模型名；规范化只在生产模型
  客户端适配层（`deepseek_client.py`）内、调用 SDK 前的最后一步执行，是一个可独立单测的
  纯函数；配置文件与 `DeepSeekProviderConfig` 中全程保留原始 `openai/` 前缀名。
- 模块结构（`backend/app/langgraph_runtime/` 下新增，扁平文件，不新建子包）：
  - `deepseek_config.py`：只读配置数据类 + `load_deepseek_provider_config(path=None)`
    （默认路径锚定到 `backend/config/providers.yaml`，测试可传入临时路径覆盖）+
    `resolve_deepseek_api_key(config)`（只读 `os.environ`，与 yaml 解析分离，便于分别测试
    两类失败原因）。异常层级需覆盖：文件不存在、YAML 解析失败、`active` 缺失/非字符串/
    非 `deepseek`、缺 `providers`/`deepseek` 键、缺必填字段、`models` 为空、
    `default_model` 不在 `models` 中、环境变量缺失或为空。
    所有异常消息只允许引用字段名/环境变量名/路径，禁止拼接任何已读取的密钥值。
  - `deepseek_client.py`：模型名前缀规范化纯函数 + 生产聊天模型构造函数（内部读取解析后的
    api key 并直接传给 `openai.OpenAI(base_url=, api_key=)`，密钥只存在于该函数的局部作用域，
    不经过任何会被日志/异常/图状态序列化的中间对象）+ 统一的模型调用异常类型（包裹底层
    任意异常，`raise ... from exc` 保留 traceback 供本地调试，但异常消息本身不做
    `str(exc)` 无条件拼接，避免第三方异常正文携带敏感信息）。
  - `deepseek_graph.py`：独立的 `DeepSeekGraphState`（不复用、不修改现有 `state.py` 的
    `GraphState`；不设 `error` 占位字段——失败必须以异常冒泡，不允许被静默写入状态）+
    `build_deepseek_graph(chat_model=None)`：调用方可注入兼容的假聊天模型用于离线测试；
    未注入时，图工厂在返回前即完成配置加载、环境变量校验、生产客户端构造，从而在任何
    外部请求发生前快速失败；每次 `.invoke()` 内部独立解析模型输出，不共享可变闭包状态，
    保证连续调用不串状态。节点函数捕获模型调用异常并包装后重新抛出，不吞掉。
  - `__init__.py`：只做追加式导出（新增图工厂、配置加载函数、异常类型），不改动、不重排
    现有 `GraphState`/`build_minimal_graph` 导出。
  - 现有 `graph.py`/`state.py` 不做任何修改。
- 测试（`backend/tests/`，全部用 `tmp_path` 临时 yaml + `monkeypatch` 环境变量 +
  mock/假模型，零网络、零真实密钥）：真实配置的 `active: deepseek` 正向校验，配置解析成功与
  `active` 缺失/非字符串/非 `deepseek`、各类缺失字段/文件/provider/模型/
  环境变量场景、密钥不泄露进异常文本的回归断言、模型名前缀规范化、生产客户端构造参数
  断言（mock 掉 `OpenAI` 类本身，不发起真实请求）、假模型成功响应写回状态、模型调用异常
  的传播与包装、同一 compiled graph 连续 `.invoke()` 两次不同输入互不串状态。现有
  `test_langgraph_runtime.py` 保持不动、全绿，作为"现有确定性图行为不变"的回归证据。
- 文档与治理：新增 `docs/decisions/0008-*.md`（覆盖 provider schema 收窄、SDK 选型取舍、
  前缀规范化边界、显式依赖提升的理由、DI + 快速失败设计、异常与密钥保护机制、记录实测
  依赖版本、明确排除清单延续 ADR 0007 中仍成立的部分，并补充"本次不做真实网络连通性的
  自动化验证"）；更新 `backend/AGENTS.md` 登记新模块边界，并以 Markdown 代码块形式给出
  本地调用示例（明确注明该示例会访问 DeepSeek、产生真实 API 用量，不新增可执行 example
  脚本以避免超出允许路径）；更新 `ARCHITECTURE.md` 反映 DeepSeek 图工厂已成为确认能力；
  `scripts/check_harness.mjs` 的 `REQUIRED_FILES`（或等效校验）追加
  `backend/config/providers.yaml` 与新 ADR 路径。
- 验证命令：`ruff check .`、`pytest -v`（在 `backend/` 下用 `.venv` 内解释器）、
  `node scripts/check_harness.mjs`、`node scripts/check_harness.mjs --self-test`、
  `node .agents/hooks/check-harness.mjs --self-test`；不得用真实 API Key 或真实网络证明交付。
- 已知风险/留待实现阶段核实（非产品歧义，不阻塞）：LangGraph 1.2.x 节点异常同步冒泡给
  `.invoke()` 调用者是本方案假设，需要 module-engineer/test-engineer 用真实调用实测确认；
  "本地调用示例产生真实 API 用量"这一事实本身无法被离线自动化验证，只能验证适配层参数
  传递正确，Implementation Report 中需明确该边界，避免造成已端到端验证真实调用的误解。

## Implementation Report

### 治理说明（先于交付内容）

本次交付过程中发生了一起需要如实记录的协作偏差：`solution-architect`（只读架构角色，
工具集只含 Read/Grep/Glob/Bash，无 Edit/Write）在其调用期间通过其可用的 Bash 工具直接向
本任务文件写入了一版未经负责人审查的 `Technical Plan` 草稿，这不符合"专业角色不得修改
任务文件"的协作协议。负责人在下一步发现该写入后，弃用了那次未授权写入的内容，改为基于
该 agent 通过正常结果通道返回的分析文本重新审查、撰写了当前的 `Technical Plan`，随后流程
按协议正常推进（module-engineer 只在自己被分配的允许路径内写入，未再出现越权写入）。此项
未导致产品范围或验收标准被篡改，记录在此供后续 harness 治理参考（是否需要收紧只读角色的
工具授权以物理禁止此类写入，是一个值得负责人后续评估的仓库治理问题，不属于本次产品任务的
范围）。

### 交付内容

模块：后端 DeepSeek provider 配置、LangGraph 模型调用运行时、离线测试与架构治理。

新增文件：
- `backend/config/providers.yaml` — 通过顶层 `active: deepseek` 激活唯一的 `deepseek`
  provider 声明（`base_url`/
  `api_key_env`/`default_model`/`models`），不含真实密钥、Ollama/Claude/MiniMax、模型分层
  或悬空 fallback。
- `backend/app/langgraph_runtime/deepseek_config.py` — 只读配置加载 + 校验
  （`load_deepseek_provider_config`/`resolve_deepseek_api_key`），覆盖文件缺失、YAML 解析
  失败、`active` 缺失/非字符串/非 `deepseek`、缺 `providers`/`deepseek` 键、缺必填字段、
  `models` 非法、`default_model` 不在 `models` 中、环境变量缺失/为空，均在外部请求前抛出，
  异常消息不泄露密钥值。
- `backend/app/langgraph_runtime/deepseek_client.py` — `openai/` 前缀规范化纯函数 +
  生产聊天模型构造（`openai.OpenAI(base_url=, api_key=)`），密钥只存在于函数局部作用域；
  模型调用异常统一包装为 `DeepSeekModelInvocationError`，`raise ... from exc` 保留原始链。
- `backend/app/langgraph_runtime/deepseek_graph.py` — 独立 `DeepSeekGraphState`
  （`input_text`/`response_text`，无 `error` 占位字段）+ `build_deepseek_graph(chat_model=None)`：
  支持注入假聊天模型完全离线测试；未注入时在返回编译图之前完成配置加载/密钥校验/客户端
  构造，实现"缺 key 快速失败"；节点异常包装为 `DeepSeekGraphInvocationError` 后重新抛出，
  已用真实 `.invoke()` 实测确认异常同步冒泡出调用者。
- `backend/tests/test_deepseek_config.py`、`test_deepseek_client.py`、`test_deepseek_graph.py` —
  覆盖真实配置 `active: deepseek` 正向校验、`active` 三类错误、配置解析其余失败路径、
  密钥不泄露回归、前缀规范化、生产客户端参数断言（mock 掉
  `openai.OpenAI`，零网络）、模型异常传播/包装、假模型成功响应、连续调用不串状态；
  test-engineer 独立验证阶段额外补强了"客户端异常包装层"与"图节点异常包装层"在密钥真实
  存在时的显式不泄露断言。
- `docs/decisions/0008-deepseek-langgraph-integration.md` — 记录"DeepSeek 专用配置 + 可
  注入聊天模型 + 独立图工厂"的取舍，以及不采用 `dev` 分支 LiteLLM/provider/fallback 层、
  不采用 `langchain-openai` 的具体理由，并登记实测依赖版本。

修改（追加式，均在允许路径内）：
- `backend/app/langgraph_runtime/__init__.py` — 追加导出新增符号，`GraphState`/
  `build_minimal_graph` 原有导出未改动。
- `backend/pyproject.toml` — 主依赖新增 `openai>=1.40,<2`、`pyyaml>=6.0,<7`（实测安装版本
  `openai 1.109.1`、`PyYAML 6.0.3`）。
- `backend/.env.example` — 追加空的 `DEEPSEEK_API_KEY=` 及用途说明。
- `backend/AGENTS.md` — 新增"DeepSeek LangGraph 模块"一节，说明 `active: deepseek` 的
  固定激活约束，并含真实调用示例（明确标注会
  访问 DeepSeek、产生真实 API 用量）与离线假模型示例。
- `ARCHITECTURE.md` — 更新"当前状态"、所有权表和边界条款，登记以 `active: deepseek`
  激活的 DeepSeek 为已确认接入的唯一模型供应商，其余供应商/能力仍明确排除。
- `scripts/check_harness.mjs` — `REQUIRED_FILES` 新增
  `docs/decisions/0008-deepseek-langgraph-integration.md`、`backend/config/providers.yaml`。

未修改（确认零改动，`GET /health` 契约与现有确定性图不受影响）：`backend/app/main.py`、
`backend/app/health.py`、`backend/app/langgraph_runtime/graph.py`、
`backend/app/langgraph_runtime/state.py`、`backend/tests/test_langgraph_runtime.py`、
`backend/tests/test_health.py`、`backend/tests/test_contract_health.py`、`frontend/**`、
`docs/contracts/**`、`.github/**`、`.env`。

### 自审与验证证据

首轮负责人独立重跑（而非仅信任子角色报告）：

- `backend/.venv/Scripts/python.exe -m ruff check .` → `All checks passed!`
- `backend/.venv/Scripts/python.exe -m pytest -v` → `40 passed, 1 warning`（既有 20 个 +
  新增/强化 20 个，含 test-engineer 补强的对抗性密钥不泄露测试）。
- `backend/.venv/Scripts/python.exe -m pip show openai` → `Version: 1.109.1`；
  `pip show pyyaml` → `Version: 6.0.3`。
- `node scripts/check_harness.mjs` → `agentic-check: 通过 (38 个基线文件)`。
- `node scripts/check_harness.mjs --self-test` → `agentic-check self-test: 通过 (17 项)`。
- `node .agents/hooks/check-harness.mjs --self-test`（test-engineer 独立执行）→
  `Stop hook self-test: 通过 (3 项)`。

test-engineer 首轮独立核对了全部 9 条 Acceptance Criteria，逐条给出文件行号/测试名证据，
当时报告全部满足；后续 Codex 验收发现该报告漏掉了 `active`，属于第一条标准的假绿。

Codex 首轮验收指出 `active` 遗漏后，唯一返工已补齐：配置以 `active: deepseek` 明确激活
DeepSeek，加载器在读取 `providers.deepseek` 前拒绝缺失、非字符串或非 `deepseek` 的
`active`，且错误不回显非法值或密钥。module-engineer 返工后重新运行
`backend/.venv/Scripts/python.exe -m ruff check .`（通过）、
`backend/.venv/Scripts/python.exe -m pytest -v`（`43 passed, 1 warning`）、仓库 harness
（38 个基线文件）、harness self-test（17 项）、Stop hook self-test（3 项）和 product-flow
runner self-test（18 项），结果均通过；未新增 provider 切换、多供应商注册或 fallback。

### 已知边界（非缺陷，供 Codex 验收时知悉）

- Delivery Constraints 要求自动验证完全离线，因此"本地调用示例会真实访问 DeepSeek、产生
  真实 API 用量"这一事实本身未被、也不能被本次自动化验证覆盖——只验证了适配层参数传递、
  异常包装和状态读写正确；真实连通性需要使用者按 `backend/AGENTS.md` 中的示例自行手动
  验证（需要真实 `DEEPSEEK_API_KEY`）。
- 本次只支持单一 DeepSeek provider，未构建可扩展的多供应商注册表；若未来需要接入其它
  供应商，需要新的产品任务和新的 ADR，不应直接在本模块基础上线性扩展（ADR 0008 已记录
  该取舍的代价）。

## Acceptance Review

首轮 Codex 验收不通过，退回一次最小返工。

- 失败标准：第一条 Acceptance Criteria 要求 `backend/config/providers.yaml` 声明一个
  **激活的** `deepseek` provider，且事实来源 `dev:backend/config/providers.yaml` 明确包含
  顶层 `active: deepseek`。当前文件没有 `active` 字段；Technical Plan 中“不额外加
  `active`”的技术选择与已经确认的产品标准冲突，不能覆盖 Acceptance Criteria。
- 影响：当前加载器只要存在 `providers.deepseek` 就接受配置，无法拒绝缺失、非字符串、未知或
  非 `deepseek` 的 active provider；现有测试因此对错误配置产生假绿。
- 最小返工：在 YAML 中增加 `active: deepseek`；配置加载器在读取 provider 前校验顶层
  `active` 必须是字符串且精确等于 `deepseek`，否则抛出不泄露密钥的配置错误；补真实配置断言
  和缺失/非法/非 deepseek 的离线回归测试；同步修正 Technical Plan、ADR、ARCHITECTURE、
  `backend/AGENTS.md` 及 Implementation Report 中所有“省略 active”或相关 schema 描述。
- 保持不变：不得扩大到 provider 切换 API、多供应商注册、fallback 或运行时写配置；其余已通过的
  40 个测试、密钥不泄露边界、FastAPI/确定性图兼容性和禁止路径必须继续通过。

### 最终验收

唯一返工已完成，Codex 主验收与独立测试角色均确认通过：

- `providers.yaml` 解析后顶层精确为 `active`/`providers`，`active == "deepseek"`，且只存在
  `providers.deepseek`；没有其它供应商、fallback、模型分层或真实密钥。
- 配置加载器在读取 provider 前拒绝 `active` 缺失、非字符串或非 `deepseek`，对应离线测试和
  旧 fixture 均已修正，未出现错误分支假绿。
- `backend/.venv/Scripts/python.exe -m ruff check backend` 通过；全量 pytest 为
  `43 passed`，配置专项为 `17 passed`。唯一警告是既有 Starlette TestClient/httpx 弃用提示，
  不影响本次功能。
- harness 基线、自测、Stop hook 自测和 product-flow runner 自测分别为 `38/17/3/18` 全部通过；
  `git diff --check` 通过，禁止路径无 tracked 或 untracked 改动。
- 自动验证未访问 DeepSeek，也未使用或泄露真实 API Key。

结论：九项 Acceptance Criteria 全部满足，状态改为 `Accepted`。
