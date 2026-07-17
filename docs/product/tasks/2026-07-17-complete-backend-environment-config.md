# 任务：完成后端环境配置闭环

## Status

Accepted

## Product Definition

- 用户确认：用户于 2026-07-17 通过“自动交付：完成环境配置闭环”授权自动确认与交付；此前已明确选择将本机真实配置保存在被 Git 忽略的 `backend/.env.example`。
- 问题：DeepSeek 运行时目前只读取进程环境变量；本地私有配置文件虽然存在且被 Git 忽略，但不会被直接调用 `build_deepseek_graph()` 的 Python 进程自动使用。仓库同时失去了可提交的空环境模板，缺少一个不联网、不泄露密钥的配置检查入口。
- 目标用户：在本机开发和验证 chaotang-os 后端的开发者与自动化 agent。
- 目标：让 DeepSeek 运行时在进程环境缺少 Key 时安全读取本地私有 `backend/.env.example`，提供可提交的空模板和零网络配置检查命令，并保证测试、CI、文档与架构决策一致。
- 非目标：不调用真实 DeepSeek、不验证余额或网络连通性、不新增聊天 API、不修改前端、不引入多供应商/fallback、不提交或打印真实密钥，也不修改用户本地私有环境文件。

## Acceptance Criteria

- [x] `backend/.env.example` 继续被 Git 忽略、未跟踪，自动交付全过程不得读取、打印、复制、改写或删除其内容；新增受跟踪的 `backend/.env.template`，只包含空的 `DEEPSEEK_API_KEY=` 与必要说明，不含任何真实值。
- [x] 后端显式声明稳定的 dotenv 解析依赖，不依赖偶然存在的传递依赖；DeepSeek 配置入口在进程环境变量非空时优先使用进程值，只有缺失/空白时才读取默认私有文件，且不覆盖或污染全局 `os.environ`。
- [x] dotenv 文件缺失、无法解析、Key 缺失或空白时，在构造外部请求前抛出明确的 DeepSeek 配置错误；任何异常、日志、命令输出、图状态和测试失败信息都不得包含 Key 值。
- [x] `build_deepseek_graph()` 的生产路径可自动使用私有文件中的 Key；调用方可注入临时 dotenv 路径进行离线测试，原有 `chat_model` 假模型注入行为和进程环境变量用法保持兼容。
- [x] 提供一个仓库内、非交互的 DeepSeek 配置检查命令：验证 provider schema、Key 可解析、默认模型可规范化以及 SDK 客户端/图可构造，但绝不调用模型或访问网络；成功只输出脱敏状态，失败返回非零且不泄密。
- [x] 自动化测试使用 `tmp_path`/mock/假模型，绝不读取真实 `backend/.env.example`，覆盖进程环境优先、私有文件 fallback、空值、缺文件、解析失败、密钥不泄露、检查命令成功/失败和现有图回归。
- [x] 文档明确区分 `backend/.env.template`（可提交空模板）与 `backend/.env.example`（本机私有且忽略），给出复制、检查和调用命令，并说明配置检查不联网、真实 `.invoke()` 会产生 API 用量。
- [x] 新增 ADR 记录本地 dotenv fallback、进程环境优先、无全局环境污染和私有文件保护边界；长期必需的新模板、检查入口和 ADR 登记到 harness 基线。
- [x] backend ruff、全部 pytest、配置检查的离线测试、harness 及相关自测全部通过；禁止路径无改动。

## Delivery Constraints

- 范围：只允许修改 `backend/pyproject.toml`、`backend/app/langgraph_runtime/**`、`backend/tests/**`、`backend/AGENTS.md`、`backend/.env.template`、`.gitignore`（仅在确有必要时）、`ARCHITECTURE.md`、`docs/decisions/0009-*.md`、`scripts/check_harness.mjs` 和本任务文件。
- 兼容性：保持 `GET /health`、`build_minimal_graph()`、现有 `build_deepseek_graph(chat_model=...)`、DeepSeek provider schema、前端和 CI 行为不变；默认私有路径固定为仓库 `backend/.env.example`，不依赖当前工作目录。
- 风险与限制：`backend/.env.example` 是用户私有数据，属于禁止读取和禁止修改路径；不得用 `Get-Content`、`Read`、`cat`、dotenv parser、测试或任何其它方式检查其真实内容。只允许用 `Test-Path`/文件存在性 API 确认它存在，且不得把它加入 Git。自动测试必须通过临时路径覆盖默认路径，禁止真实网络与真实 API 用量。
- 禁止修改：`backend/.env.example`、`backend/app/main.py`、`backend/app/health.py`、`backend/app/langgraph_runtime/graph.py`、`backend/app/langgraph_runtime/state.py`、`frontend/**`、`docs/contracts/**`、`.github/**`、任何真实环境文件、密钥、日志、缓存或范围外文件。
- 交付过程不得提交、推送、部署或创建外部资源。

## Affected Modules

- 模块：后端本地环境配置加载、DeepSeek 配置自检与架构治理
- 允许路径：backend/pyproject.toml, backend/app/langgraph_runtime/**, backend/tests/**, backend/AGENTS.md, backend/.env.template, .gitignore（仅必要时）, ARCHITECTURE.md, docs/decisions/0009-*.md, scripts/check_harness.mjs, docs/product/tasks/2026-07-17-complete-backend-environment-config.md
- 依赖模块：现有 DeepSeek provider 配置与 LangGraph 图工厂

## Technical Plan

- 架构边界确认：Delivery Constraints 的“禁止修改”清单只列出
  `backend/app/main.py`、`backend/app/health.py`、
  `backend/app/langgraph_runtime/graph.py`、`backend/app/langgraph_runtime/state.py`；
  `deepseek_config.py`/`deepseek_client.py`/`deepseek_graph.py` 不在禁止清单内，且落在允许路径
  `backend/app/langgraph_runtime/**`，可以做最小改动。
- 依赖：新增显式主依赖 `python-dotenv>=1.0,<2`（写入 `backend/pyproject.toml`
  `dependencies`）。只使用 `dotenv_values(path) -> dict`，不用 `load_dotenv()`——前者
  只返回内存 dict，不写 `os.environ`，天然满足“不覆盖/不污染全局环境变量”；
  “优先级”通过“先查进程变量、再按值传递 dotenv dict 中的值”实现，不涉及任何全局状态
  写入或回滚。
- 新增模块 `backend/app/langgraph_runtime/deepseek_env.py`：
  `resolve_deepseek_api_key_with_dotenv_fallback(config, dotenv_path=None)`——先调用现有
  `resolve_deepseek_api_key(config)`（进程环境变量优先，行为完全不变，不改
  `deepseek_config.py`）；失败时读取 `dotenv_path`（默认仓库固定路径
  `backend/.env.example`，与当前工作目录无关，不存在则用不存在的临时路径以便测试隔离），
  用 `dotenv_values()` 解析并取 `config.api_key_env` 对应值；文件缺失/解析失败/值缺失或
  为空都抛 `DeepSeekApiKeyError`，异常信息只含变量名和文件路径，不含任何取到的值。
- 唯一改动的既有生产文件：`deepseek_client.py`——`build_deepseek_chat_model` 新增可选形参
  `dotenv_path: Path | None = None`，内部把 `resolve_deepseek_api_key(config)` 换成
  `resolve_deepseek_api_key_with_dotenv_fallback(config, dotenv_path)`；其余逻辑不变。
  `deepseek_graph.py`/`deepseek_config.py`/`graph.py`/`state.py`/`main.py`/`health.py`
  零改动，`build_deepseek_graph()` 因组合关系自动获得 dotenv 兜底能力。
- CLI 检查入口：新增 `backend/app/langgraph_runtime/deepseek_check.py::main() -> int`，
  调用方式 `python -m app.langgraph_runtime.deepseek_check`（不新增
  `[project.scripts]`、不新增顶层 CLI 结构）。内部直接调用
  `build_deepseek_graph()`（只构造不 `invoke()`），捕获
  `DeepSeekConfigError`/模型名错误后打印脱敏信息并返回非零，成功打印通用状态文本并返回 0；
  不重新实现校验逻辑，避免检查命令与生产路径逻辑漂移导致假绿。
- 模板与忽略规则：新增可跟踪的 `backend/.env.template`（只含
  `DEEPSEEK_API_KEY=` 和说明注释）；`.gitignore` 当前 `.env*` 规则会连带忽略它，需要新增
  一行否定规则 `!backend/.env.template`，这是本次唯一必要的 `.gitignore` 改动。
- 测试策略（均在 `backend/tests/**`，只用 `tmp_path`/`monkeypatch`）：
  新增 `conftest.py` 的 autouse fixture，把 `deepseek_env._DEFAULT_DOTENV_PATH` 默认
  monkeypatch 到一个保证不存在的临时路径，避免任何测试受开发者本机真实
  `backend/.env.example` 内容影响；新增 `test_deepseek_env.py`
  覆盖进程优先、文件 fallback、缺文件、值缺失/为空、解析失败（用非 UTF-8 字节触发
  `UnicodeDecodeError`）、异常不泄密、以及 `os.environ` 前后快照不变；
  `test_deepseek_client.py` 新增 `dotenv_path` 注入场景；`test_deepseek_graph.py` 现有
  “缺 key 快速失败”用例改为显式注入不存在的 dotenv 路径，与本机环境解耦；新增
  `test_deepseek_check.py` 覆盖 CLI 成功/失败路径且全程 mock `openai.OpenAI`。
- 文档与 ADR：`backend/AGENTS.md` 补充密钥解析顺序、模板与私有文件区别、复制命令、检查命令
  用法（不联网）；`ARCHITECTURE.md` 补一句指向 ADR 0009；新增
  `docs/decisions/0009-deepseek-local-dotenv-fallback.md` 记录选型理由
  （`dotenv_values` vs `load_dotenv`、新模块而非改 `resolve_deepseek_api_key`、只改
  `deepseek_client.py` 一处调用点、CLI 复用图工厂）。
- harness 基线：`scripts/check_harness.mjs` 新增登记 ADR 0009 与
  `backend/.env.template` 到必需文件列表；断言模板内容为空值、不含真实密钥特征；断言
  `pyproject.toml` 声明 `python-dotenv`；断言 `deepseek_check.py` 存在且含 `def main(`；
  断言 `.gitignore` 中存在 `!backend/.env.template` 否定规则。
- 实施顺序：依赖声明 → `deepseek_env.py` + 单测 → `deepseek_client.py` 改动 + 单测 →
  `deepseek_graph.py` 测试解耦 + conftest fixture → `deepseek_check.py` + 单测 →
  `.env.template` + `.gitignore` → 文档 + ADR → `check_harness.mjs` → 全量 ruff/pytest/harness
  自测，并用 `git status` 核对 `.env.example` 全程未读取、未暂存，禁止路径零改动。
- 验证计划：全部离线（`tmp_path`/mock/假模型），不得读取真实 `backend/.env.example`
  内容；只能用文件存在性 API 确认其存在；`ruff check .`、`pytest`、
  `python -m app.langgraph_runtime.deepseek_check`（进程变量场景）、
  `node scripts/check_harness.mjs`、`node scripts/check_harness.mjs --self-test`、
  `node .agents/hooks/check-harness.mjs --self-test`、
  `node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test` 全部通过。
- 技术风险：私有密钥泄露、默认路径导致测试误读本地文件（已用 autouse fixture 机械规避）、
  环境变量全局污染（已用 `dotenv_values` 按值传递规避）、CLI 假绿（已用复用
  `build_deepseek_graph()` 规避）、`.gitignore` 否定规则被后续变更遗漏（已登记进
  harness 基线）。

### 第二轮返工补充（针对 Acceptance Review 的 Rework Requested）

- 问题：第一轮 `deepseek_check.py` 无 CLI 参数解析，直接调用无参数的
  `build_deepseek_graph()`；进程环境变量缺失时会静默回退读取默认私有路径
  `backend/.env.example`，被返工授权判定为违反“自动交付全过程不得读取该文件”的硬约束
  （证据：`docs/failures/2026-07-17-product-flow-read-private-dotenv.md`）。
- solution-architect 只读分析确认：`build_deepseek_graph()`（`deepseek_graph.py`）不在
  Delivery Constraints 的“禁止修改”清单内（清单列的是 `graph.py`/`state.py`，是另一个不同的
  文件），落在允许路径 `backend/app/langgraph_runtime/**`，可以做最小改动。
- 修订方案（推翻 ADR 0009 原文“不需要同时改 `deepseek_graph.py` 签名”一句，以追加小节方式
  留痕，不删除原文）：
  1. `deepseek_graph.py::build_deepseek_graph` 新增可选 `dotenv_path: Path | None = None`
     形参，`chat_model is None` 分支改为
     `build_deepseek_chat_model(config, dotenv_path)`；默认值 `None` 保证现有调用点
     （`build_deepseek_graph()`、`build_deepseek_graph(chat_model=...)`）行为不变。
  2. `deepseek_check.py::main()` 改为用标准库 `argparse` 解析必填 `--dotenv-path PATH`；
     缺失该参数时，在**导入/调用任何 `build_deepseek_graph()`/`dotenv_values()` 之前**打印
     stderr 说明并返回退出码 `2`，无论进程环境变量是否已设置都拒绝执行；提供路径时才调用
     `build_deepseek_graph(dotenv_path=Path(args.dotenv_path))`，成功/失败 0/1 逻辑不变。
  3. `backend/tests/test_deepseek_check.py` 重写：覆盖“无 `--dotenv-path`（含进程 env 已设置
     子场景）→ 返回 2 且 mock 断言 `dotenv_values`/`openai.OpenAI` 均未被调用”“tmp_path 有效
     临时文件 → 0”“tmp_path 缺失/无效 → 1”。
  4. `test_deepseek_graph.py`/`test_deepseek_client.py`/`test_deepseek_env.py`/`conftest.py`
     经确认无需联动改动（新形参默认值向后兼容，现有测试不受影响）。
  5. `scripts/check_harness.mjs` 在现有 `deepseekCheckPath` 断言块追加：源码必须包含
     `"--dotenv-path"` 与退出码 `2` 的拒绝分支特征字符串，防止后续删除这道防线。
  6. `docs/decisions/0009-*.md` 追加“第二轮修订”小节，记录 CLI 默认拒绝设计动机（引用失败
     记忆文档）和 `build_deepseek_graph()` 签名变化对原有结论的修订，不静默删除原文。
  7. `backend/AGENTS.md` 的“零网络配置检查命令”调用示例改为必须携带
     `--dotenv-path <path>`，说明缺参数返回码 2、自动化只能传临时路径、本机开发者可传自己的
     真实私有路径。
  8. `ARCHITECTURE.md`、`backend/pyproject.toml`、`backend/.env.template`、`.gitignore` 本轮
     不需要改动（无新依赖，模板/忽略规则不受影响）。
- 本轮验证重点：`test_deepseek_check.py` 新增的 mock 断言 + module-engineer/test-engineer
  必须只用 `tmp_path` 路径运行 `python -m app.langgraph_runtime.deepseek_check`，禁止运行不带
  `--dotenv-path` 或指向真实 `backend/.env.example` 的调用；`git status`/`git diff` 核对
  `backend/.env.example` 全程未被读取、暂存或修改。

## Implementation Report

- 改动摘要：第一轮（dotenv 兜底能力本身）此前已完成，未改动。本轮只针对 Acceptance Review
  的返工授权修复 `deepseek_check.py` 的隐私门禁：
  - `backend/app/langgraph_runtime/deepseek_graph.py::build_deepseek_graph` 新增可选形参
    `dotenv_path: Path | None = None`（默认 `None`，向后兼容），仅在 `chat_model is None`
    分支透传给 `build_deepseek_chat_model(config, dotenv_path)`。
  - `backend/app/langgraph_runtime/deepseek_check.py::main()` 改为 `argparse` 解析必填的
    `--dotenv-path`；参数解析发生在导入/调用 `build_deepseek_graph()`/`dotenv_values()` 之前，
    缺参数时 argparse 自身以退出码 `2` 拒绝，物理上不存在缺参数时读取任何 dotenv 文件（含
    `backend/.env.example`）的代码路径。`main(argv=None)` 支持测试注入参数列表。
  - `backend/tests/test_deepseek_check.py` 重写：覆盖"进程 env 已设置/未设置"两种缺参数子
    场景（均断言 `SystemExit(2)` 且 `dotenv_values`/`openai.OpenAI` 从未被调用）、tmp_path 有效
    路径成功（0）、tmp_path 无效路径失败（1），测试环节新增目录路径、含空格路径两个边界用例。
  - `scripts/check_harness.mjs` 在 `deepseekCheckPath` 断言块追加：源码必须包含
    `"--dotenv-path"` 与 `"required=True"`，防止后续删除这道防线。
  - `docs/decisions/0009-deepseek-local-dotenv-fallback.md` 追加"第二轮修订：CLI 默认拒绝私有
    fallback"小节（未删除/静默重写原文），记录本次事故动机与 `build_deepseek_graph()` 签名变化
    对原有"不需要同时改 `deepseek_graph.py` 签名"结论的修订。
  - `backend/AGENTS.md` 更新"零网络配置检查命令"调用示例为必须携带
    `--dotenv-path <临时或私有 dotenv 路径>`，说明退出码 2 语义与自动化/本机开发者的使用边界。
- 自审：
  - 通读 `deepseek_check.py` 全文确认执行顺序——`parser.parse_args(argv)` 是 `main()` 内第一个
    可能失败的调用，模块顶层只 `import` 了函数对象，未在导入期执行任何 DeepSeek 逻辑；缺参数时
    argparse 在到达 `build_deepseek_graph(...)` 之前就已 `sys.exit(2)`，这条路径上没有任何机会
    触碰 `dotenv_values`/`resolve_deepseek_api_key_with_dotenv_fallback`/`openai.OpenAI`。
  - 确认 `dotenv_path` 默认值 `None` 不改变 `build_deepseek_graph(chat_model=...)` 注入路径与既有
    调用点行为，`test_deepseek_graph.py`/`test_deepseek_client.py`/`test_deepseek_env.py`/
    `conftest.py` 均无需联动改动。
  - 用 `git status --porcelain` 核对 `backend/.env.example` 全程未出现在任何 diff/staged 区域；
    只用文件存在性检查（`Test-Path`/`test -f`）确认其存在，本次交付全程（module-engineer、
    test-engineer、负责人自审）均未读取、打印、复制或修改其内容，也未运行过不带
    `--dotenv-path` 且会实际读取 dotenv 的调用（唯一一次不带参数的调用仅用于验证退出码 2，
    argparse 在读取任何文件之前即拒绝）。
  - 改动文件清单核对：均落在 Delivery Constraints 登记的允许路径内；禁止修改清单
    （`backend/app/main.py`、`backend/app/health.py`、`backend/app/langgraph_runtime/graph.py`、
    `backend/app/langgraph_runtime/state.py`、`frontend/**`、`docs/contracts/**`、`.github/**`）
    零改动。
- 验证（均在仓库根目录/`backend/` 下实测，全部离线，全部使用 tmp_path/临时文件）：
  - `backend/.venv/Scripts/python.exe -m ruff check .` → `All checks passed!`
  - `backend/.venv/Scripts/python.exe -m pytest -q` → `63 passed, 1 warning`
  - `node scripts/check_harness.mjs` → `agentic-check: 通过 (40 个基线文件)`
  - `node scripts/check_harness.mjs --self-test` → `agentic-check self-test: 通过 (17 项)`
  - `node .agents/hooks/check-harness.mjs --self-test` → `Stop hook self-test: 通过 (3 项)`
  - `node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test` →
    `product-flow Claude runner self-test: 通过 (18 项)`
  - 手动验证：无 `--dotenv-path` → 退出码 `2`，仅 argparse 用法提示，无密钥/私有文件相关输出；
    临时文件含假 key → 退出码 `0`；不存在的临时路径 → 退出码 `1`；全程未涉及
    `backend/.env.example`。
- 剩余风险：无本模块范围内的已知残留风险。密钥解析仍是"进程变量优先、dotenv 兜底"的两级来源，
  这是既有设计（ADR 0009 第一部分）而非本轮新增风险；真实联网 `.invoke()` demo 按返工授权明确
  不在本次 Claude 交付范围内，留给 Codex 在离线验收通过后基于用户授权单独执行。

## Acceptance Review

- 验收结果：Accepted
- 验收证据：模块实现的 ruff 与 59 个 pytest 均通过，且命令没有调用模型或访问网络；但模块角色
  随后运行了未带临时路径覆盖的默认 `python -m app.langgraph_runtime.deepseek_check`，该命令
  成功走到真实 `backend/.env.example` fallback。脱敏审计确认仓库候选文件和本次 Claude JSONL
  均无真实 Key 形态，当前进程环境未被污染，私有文件未被 Git 跟踪。
- 未通过项：第一条与第六条 Acceptance Criteria 以及 Delivery Constraints 的隐私硬约束不满足——
  自动交付过程已经读取私有文件。需要先把检查 CLI 改成默认拒绝私有 fallback、只有显式传入
  dotenv 路径/本地用户确认时才读取，并用临时文件完成全部自动验证；在用户确认密钥已轮换或
  授权安全临时隔离之前不得继续自动交付。
- 返工授权：用户已确认密钥轮换，并于 2026-07-17 授权在不读取私有环境文件的前提下由 Codex
  完成安全返工；本次再次通过“自动交付”授权继续。返工必须让 CLI 在缺少显式
  `--dotenv-path` 时以退出码 2 拒绝执行且不调用 dotenv parser；自动测试与 smoke 只能使用
  `tmp_path`/临时假值，不得读取 `backend/.env.example`。真实联网 demo 不属于本任务的 Claude
  交付范围，由 Codex 在本任务离线验收通过后，基于用户本次明确授权单独执行。
- 最终验收证据：第二轮返工后，CLI 的 `--dotenv-path` 为 argparse 必填参数；两个缺参数测试分别
  覆盖进程环境已设置/未设置场景，并断言 `dotenv_values` 与 `openai.OpenAI` 均未调用。Codex
  独立复跑得到 ruff 通过、pytest `63 passed, 1 warning`、harness `40` 个基线文件、`17` 项自测、
  Stop hook `3` 项、product-flow runner `18` 项全部通过；`backend/.env.example` 未被 Git 跟踪且
  命中显式忽略规则，禁止路径改动数为 0，候选文件中的真实十六进制 Key 形态命中数为 0。
- 历史说明：第一轮自动交付曾误读私有 dotenv，该事实仍保留在本节与失败记忆中，不能被第二轮
  绿色结果追溯性抹除。用户已完成密钥轮换；本次 `Accepted` 表示当前实现和第二轮返工过程满足
  安全边界，不表示首次违规从未发生。
- 验收后联网联调：在任务离线验收为 `Accepted` 后，Codex 根据用户“key 已配置好、跑一下 demo”
  的单独明确授权，显式传入本机私有 `.env.example`。零网络构造检查返回 0；随后仅执行一次真实
  LangGraph `.invoke()`，进程返回 `DEMO_OK`，模型回复“DeepSeek LangGraph demo 正常”。命令未
  输出密钥，异常路径被限制为只输出异常类型；此次调用产生一次真实 DeepSeek API 用量。
- 未通过项：无。
