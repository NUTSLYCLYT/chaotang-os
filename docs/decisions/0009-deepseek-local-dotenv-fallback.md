# 决策 0009：DeepSeek 密钥解析新增本地 dotenv 兜底

## Status

Accepted — 2026-07-17

## Context

`docs/decisions/0008-deepseek-langgraph-integration.md` 确定了 DeepSeek 密钥只从进程
环境变量 `DEEPSEEK_API_KEY` 读取（`deepseek_config.resolve_deepseek_api_key`）。这在
CI 和显式 `export`/`monkeypatch.setenv` 场景下工作良好，但本机开发时，直接调用
`build_deepseek_graph()` 的 Python 进程（例如一次性脚本、REPL、未来的业务入口）如果没有
先手动 `export DEEPSEEK_API_KEY=...`，即使开发者本机已经维护了一份私有、被 Git 忽略的
`backend/.env.example`，运行时也不会自动使用它——这个文件此前只是人工参考，不被任何代码
读取。同时仓库缺少一个可提交的空环境模板（`backend/.env.example` 是私有文件，天然不能
提交），也缺少一个不联网、不消耗真实 API 用量的配置检查入口，无法快速确认"密钥解析链路
是否配置正确"而不需要真的调用模型。

产品任务 `docs/product/tasks/2026-07-17-complete-backend-environment-config.md` 要求：
进程环境变量继续优先；缺失/为空时安全读取本机私有 `backend/.env.example`；不覆盖或污染
全局 `os.environ`；新增可提交的空模板 `backend/.env.template`；新增零网络配置检查命令；
`backend/.env.example` 全程只允许用文件存在性检查确认其存在，不得被读取内容、修改或提交。

## Decision

### 为什么用 `dotenv_values()` 而不是 `load_dotenv()`

`python-dotenv` 提供两个层次的 API：`load_dotenv()` 会把解析结果写入进程级
`os.environ`（默认还会跳过已存在的键），而 `dotenv_values(path) -> dict` 只把解析结果
作为一次性的内存 `dict` 返回，完全不触碰 `os.environ`。本次验收标准明确要求"不覆盖或
污染全局 `os.environ`"，且要求同一进程内的自动化测试可以反复、并发地注入不同的临时
dotenv 路径而不互相污染——`load_dotenv()` 的全局写入语义与这两点直接冲突（尤其是"不跳过
已存在键"和"全局可变状态在测试间共享"两个副作用面）。`dotenv_values()` 让"优先级"完全
通过普通的函数参数传值实现：调用方（`resolve_deepseek_api_key_with_dotenv_fallback`）
自己决定先查进程变量、再按值查 dotenv dict，不需要任何全局状态的写入或事后回滚，因此本次
只使用 `dotenv_values()` 这一个 API。

### 为什么新增独立模块 `deepseek_env.py` 而不直接改 `resolve_deepseek_api_key`

`deepseek_config.py` 的既有设计（见 ADR 0008）把"YAML 配置校验"和"密钥解析"拆成两个
互不依赖、可独立测试的关注点，`resolve_deepseek_api_key` 的契约很窄：只读
`os.environ`，不碰文件系统。直接在这个函数内加 dotenv 兜底逻辑会：(a) 扩大一个原本很窄、
已经被多处测试直接依赖其"只读环境变量"行为的函数的职责边界，增大回归面；(b) 需要给
`deepseek_config.py` 新增一个 `python-dotenv` 依赖和一个新的默认路径概念，而
`deepseek_config.py` 目前是纯配置/环境读取层，不持有任何"仓库固定路径"的概念（唯一的固定
路径 `_DEFAULT_CONFIG_PATH` 是 YAML 配置，语义不同）。新增独立的
`deepseek_env.py::resolve_deepseek_api_key_with_dotenv_fallback(config, dotenv_path=None)`
作为组合层：内部直接调用未修改的 `resolve_deepseek_api_key(config)`，只在其失败时才追加
dotenv 兜底逻辑，让"进程变量优先"这一行为通过组合而非修改既有函数来保证，`deepseek_config.py`
零改动、其现有测试和契约完全不受影响。

### 为什么只改 `deepseek_client.py` 一处调用点

`build_deepseek_graph()`（`deepseek_graph.py`）内部只有一处会解析密钥的路径：通过
`build_deepseek_chat_model(config)` 间接调用密钥解析。给 `build_deepseek_chat_model`
新增一个可选的 `dotenv_path: Path | None = None` 形参，并把其内部对
`resolve_deepseek_api_key(config)` 的调用换成
`resolve_deepseek_api_key_with_dotenv_fallback(config, dotenv_path)`，是能让
`build_deepseek_graph()` 自动获得 dotenv 兜底能力的最小改动点——因为
`deepseek_graph.py` 组合式地依赖 `deepseek_client.py`，新增能力通过参数默认值自然透传，
不需要同时改 `deepseek_graph.py` 的签名（`dotenv_path` 默认为 `None` 时退化为模块级默认
路径 `backend/.env.example`，与改动前的生产行为在"进程变量已设置"的场景下完全等价）。
`deepseek_config.py`/`deepseek_graph.py`/`graph.py`/`state.py`/`main.py`/`health.py`
零改动。

### CLI 检查命令为什么直接复用 `build_deepseek_graph()`

新增的 `python -m app.langgraph_runtime.deepseek_check` 不重新实现 provider schema
校验、密钥解析或模型名规范化逻辑，而是直接调用生产入口 `build_deepseek_graph()`（只构造，
不 `.invoke()`）。如果检查命令自己复刻一套校验逻辑，两套逻辑会随时间独立演化并产生"检查
命令说配置没问题，但生产路径实际会失败"的假绿风险；复用同一个函数保证检查结果与生产行为
在原理上不可能出现分歧，代价是检查命令的失败信息颗粒度较粗（只区分"配置/密钥类错误"和
"模型名错误"两类，不逐项列出具体校验失败原因）——这是刻意的取舍：可以通过其余单元测试
（`test_deepseek_config.py`、`test_deepseek_env.py`）获得更细粒度的失败原因定位，检查命令
本身只承担"零网络快速确认可用性"这一个职责。

### `.env.template`/`.env.example` 边界和 `.gitignore` 改动的必要性

`backend/.env.example` 是每个开发者本机各自维护、可能包含真实密钥的私有文件，`.gitignore`
中 `.env*` 规则已将其排除在 Git 之外（并有一条更早的显式 `backend/.env.example` 规则做
双重保险）。为了让新贡献者有一个可提交的起点，新增 `backend/.env.template`：只包含空的
`DEEPSEEK_API_KEY=` 和说明注释，不含任何真实值，需要被 Git 跟踪。但 `.gitignore` 现有的
`.env*` 通配规则会连带忽略这个新模板文件（`git check-ignore` 已验证），因此必须新增一行
否定规则 `!backend/.env.template`；这是本次对 `.gitignore` 的唯一必要改动，不改动
`!.env.example`（根级）或 `backend/.env.example`（显式忽略）相关的既有规则，两者的忽略
状态在改动前后都用 `git check-ignore -v`/`git status` 验证保持不变。

## Consequences

- 收益：本机开发者只需要维护一份 `backend/.env.example`（复制自可提交的
  `backend/.env.template`），`build_deepseek_graph()` 的生产路径即可在进程环境变量缺失时
  自动使用它，不需要每次手动 `export`；新增的零网络检查命令让"密钥解析链路配置是否正确"
  可以在几秒内确认，不需要真的消耗一次 DeepSeek API 调用。
- 代价：
  - 新增了一个显式主依赖 `python-dotenv`，进一步扩大后端依赖树；`python-dotenv` 是一个
    成熟、体积很小、无自身多供应商路由逻辑的库，风险面小。
  - 密钥解析路径现在有两级来源（进程变量、dotenv 文件），调用方和未来维护者需要始终记住
    "进程变量优先、dotenv 只是兜底"这一顺序约定，而不能假设看到密钥就一定来自进程环境。
  - `deepseek_check.py` 复用 `build_deepseek_graph()` 意味着它的失败信息颗粒度较粗，
    只能定位到"配置/密钥类错误"或"模型名错误"两个大类；如果未来需要更精细的检查命令输出，
    需要在不引入校验逻辑分叉的前提下单独设计。

## Verification

2026-07-17 第二轮安全返工后，Claude Code 测试角色与 Codex 分别独立执行并确认：

- `backend/.venv/Scripts/python.exe -m ruff check .`：通过；
- `backend/.venv/Scripts/python.exe -m pytest -q`：`63 passed, 1 warning`；
- `node scripts/check_harness.mjs`：40 个基线文件通过；
- `node scripts/check_harness.mjs --self-test`：17 项通过；
- `node .agents/hooks/check-harness.mjs --self-test`：3 项通过；
- `node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test`：18 项通过；
- CLI 不传 `--dotenv-path` 时由 argparse 以退出码 2 拒绝，测试断言 dotenv parser 与 OpenAI
  客户端均未调用；显式临时路径的成功、缺文件、目录路径和含空格路径分支均通过；
- `backend/.env.example` 未被 Git 跟踪并继续命中显式忽略规则，禁止路径零改动。

## 第二轮修订：CLI 默认拒绝私有 fallback

第一轮实现的 `deepseek_check.py::main()` 没有任何 CLI 参数门禁，直接调用无参数的
`build_deepseek_graph()`。当进程环境变量 `DEEPSEEK_API_KEY` 缺失时，这会静默触发上文
"为什么只改 `deepseek_client.py` 一处调用点"一节描述的 dotenv 兜底路径，读取开发者本机
私有、被 Git 忽略的 `backend/.env.example`。在一次自动交付验收中，模块角色在自审阶段
运行了不带任何路径覆盖的默认命令，实际触发了这条兜底路径，构成对"自动交付全过程不得读取
该文件"这条硬约束的违反，完整事故记录见
`docs/failures/2026-07-17-product-flow-read-private-dotenv.md`。

本轮修订推翻上文"为什么只改 `deepseek_client.py` 一处调用点"一节中的结论
"不需要同时改 `deepseek_graph.py` 的签名"：`deepseek_graph.py::build_deepseek_graph`
现在也新增了可选形参 `dotenv_path: Path | None = None`（默认值 `None`，不改变现有调用点
`build_deepseek_graph()`、`build_deepseek_graph(chat_model=...)` 的行为），并把它透传给
`build_deepseek_chat_model(config, dotenv_path)`，从而让 CLI 能够在调用图工厂时显式指定
一个非默认的 dotenv 路径。

配套地，`deepseek_check.py::main()` 改为使用标准库 `argparse` 解析**必填**的
`--dotenv-path PATH` 参数（`required=True`）。这个改动的核心安全属性不是"我们记得要传参数
运行"，而是"物理上不可能在缺少该参数的情况下走到任何 dotenv 读取代码"：参数解析发生在
本模块导入/调用 `build_deepseek_graph()`、`dotenv_values()` 或任何密钥解析函数之前，
argparse 自身在必填参数缺失时会调用 `sys.exit(2)` 并终止进程——这意味着即使有人像上一轮
事故那样直接运行不带任何覆盖的默认命令（`python -m app.langgraph_runtime.deepseek_check`，
不带 `--dotenv-path`），命令也只会以退出码 `2` 失败，不会读取任何 dotenv 文件、不会走到
`resolve_deepseek_api_key_with_dotenv_fallback`。提供了合法路径之后，`main()` 才调用
`build_deepseek_graph(dotenv_path=Path(args.dotenv_path))`，其余成功/失败（0/1）逻辑与
第一轮完全一致。

`backend/AGENTS.md`"零网络配置检查命令"一节的调用示例已同步更新为必须携带
`--dotenv-path <临时或私有 dotenv 路径>`；自动化/CI 只应传临时路径，本机开发者可以按
自己的知情选择传入真实的 `backend/.env.example` 路径——那是开发者本人对自己私有文件的
访问，不受"自动交付不得读取"这条约束限制，该约束只约束自动交付流程本身。
