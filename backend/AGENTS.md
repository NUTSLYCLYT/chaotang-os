# 后端 Agent 工作入口

## 史馆

- `app/shiguan/models.py` 是档案、复盘状态和 `RecallMatch` 的契约事实源。
- 丞相图每部门只召回一次；六部和军机处不得在已注入上下文时重查 SQLite。
- 业务档案只允许 `MEMORIAL`（奏折）与 `REPLY`（回奏）；经验、教训、证据和复盘是属性。
- 下旨只原子写入一条 `REPLY`，旨意原文进入 `source_text`，不得制造假 `MEMORIAL`；HTTP
  成功契约不暴露归档结果。
- `REPLY` 必须声明 `source_kind`。`DECREE` 来源不得关联档案；`MEMORIAL` 来源必须且只能
  关联一条真实奏折，且来源快照与奏折正文一致。
- v1 → v2 迁移只接受显式 `confirmed_pairs`；未确认、关系歧义或不支持的旧类型必须整体
  回滚。当前运行库的两对记录已由用户于 2026-07-20 确认，执行迁移前必须备份数据库。
- 完整契约与 ADR 0015 的保留/取代关系见
  `docs/decisions/0017-shiguan-memorial-reply-contract.md`。

## 锦衣卫证据服务

- `app/jinyiwei/` 是独立证据域，默认数据库为 `data/jinyiwei.sqlite3`，不得与史馆
  `data/shiguan.sqlite3` 共用路径；测试必须传入临时路径，不得读写运行库。
- 调查来源严格按“史馆 → 管理员批准的只读 MCP → 登记公开 API → Wikimedia 公开页面”
  执行；默认公开 API 只有 Wikidata entity search，页面发现只覆盖 `WIKIMEDIA_ONLY`，
  不接受用户或模型提供的任意 URL。史馆已满足时效和覆盖要求时不得联网，后续来源只补未解决
  事实槽位。
- MCP 只从 `config/jinyiwei_mcp.yaml` 加载管理员登记项，固定 endpoint、传输、事实范围、
  工具 schema、映射和审批指纹；发现结果漂移即失败关闭。只允许 `READ_ONLY` 查询工具，
  配置和 Python 代码不得保存密钥、动态增加 URL 或加入 provider 条件分支。腾讯自选股候选
  已由管理员在 2026-07-23 显式启用且只批准 `data_search`/`data_minute`/`data_quote`，凭据由部署侧
  `WESTOCK_MCP_CREDENTIAL` 注入共享专用服务账号；通达信/TDX 不接入。
- MCP 管理员限流按单进程内 `(server_id, tool_name)` 隔离并在线程锁内原子预占，失败调用
  同样计数；多进程不共享额度。具体工具调用结果的缓存 TTL 取服务配置与事实 freshness 的
  最小值，键绑定审批版本、确定性映射和严格参数哈希且不得含凭据；过期不命中，不能替代每次
  优先执行的史馆解析。Jinyiwei schema v4 只持久化逐调用的 server/tool、审批版本、耗时、
  参数哈希、响应字节数/哈希、映射结果与稳定错误，不保存请求/响应正文或秘密。
- 大陆 A 股规范身份使用 provider-neutral `InstrumentRef`，首阶段只覆盖 SSE、SZSE、BSE
  A 股。provider symbol 只允许由 MCP mapping/adapter 产生；禁止公司名称到代码的生产字面量
  映射，名称歧义必须失败关闭。身份缓存寿命独立于 quote freshness；短名到尚未验证的法定
  全称可做一次 original-only 安全复核。腾讯只批准已证明的 SSE/SZSE patterns，BSE 在另一
  provider 能力真实证明和登记前返回 `provider_capability_missing`。完整决策见 ADR 0024。
- MCP 服务账号首次 OAuth 只能由管理员通过受控 CLI 发起 Authorization Code + PKCE；
  loopback 回调只监听 `127.0.0.1`。Windows 本机凭据使用当前用户范围 DPAPI 加密并写入
  `data/credentials/`；业务运行时仅在精确设置 `JINYIWEI_MCP_CREDENTIAL_SOURCE=local`
  时读取它。未设置时默认 `env`，部署通过 Secret Manager 注入 `env://` 凭据且不得回退
  本机文件。授权成功不得自动开启独立的公网门禁或启用服务/工具，不得读取或复用 WorkBuddy
  私有凭据；管理员身份与 CSRF 基础设施完成前不得新增远程授权 API。完整决策见 ADR 0019
  和 ADR 0022。
- 只有 `app/agents/bureaus/` 的司级意见节点可以发起调查并最多恢复一次。同一旨意最多三次
  调查/恢复、30 秒外部工作和六次抽取；部级路由/综合、军机处、丞相路由/最终汇总只传递
  会话并消费司级意见，从不调用锦衣卫。真实非缓存调查首次成功后，流转路径只在对应首个司
  之后增加一次“锦衣卫（调查）”；缓存命中和失败不算实际调查。
- 最终 `REPLY` 只保存恢复后司级响应显式选择的证据 ID 有序并集。史馆保存不可变引用快照，
  锦衣卫保存未采用材料及 PENDING/CONFIRMED 采用状态；跨库确认失败不得撤销回奏，可按
  `reply_id` 对账。
- 模型继续负责通用丞相和部内路由。只有同时包含证券市场词与报价查询词的明确行情旨意，
  才在既有严格路由校验后规范化为 `single + 户部`，并在户部有效司列表中把投资司置于首位
  且去重；策略必须保持无供应商依赖，非行情路由与顺序不变。司级模型第一次无证据
  `READY` 仅因 `unsupported_factual_dependency` 被拒绝时，只允许追加一次不含原响应、
  异常或证据正文的静态纠正并要求 `NEEDS_DATA`；其它失败和再次不合规保持失败关闭。完整
  决策见 ADR 0023。
- 系统拥有的事实字段不得由模型提供；证据支持的保底答复必须只使用已冻结、已解析且当前
  有效的证据。
- 公网开关 `JINYIWEI_EXTERNAL_NETWORK_ENABLED` 默认关闭，只接受 `1`、`true`、`yes`、
  `on`。所有外部访问必须经过 `PinnedHTTPSClient` 的 HTTPS、公网 DNS 全量校验、固定 IP
  连接、TLS 主机名/对端校验、逐跳重定向复核、敏感头剥离和超时/体积/MIME 上限。
- freshness 必须统一经过共享策略：普通事实和史馆证据按 `as_of` 严格判断；只有
  `MARKET_QUOTE` 且来源类型为 `MCP` 或 `PUBLIC_API` 时，才可用新鲜的 `retrieved_at`
  表示“刚查询的最新可得行情”，同时保留真实市场 `as_of`，并拒绝未来时间、
  `not_before` 违规和超过 14 天的观测。不得把最近收盘价表述为实时成交价。
- 凭据和网络门禁只允许暴露 `credential_unavailable`、`credential_source_invalid`、
  `external_network_disabled` 等稳定安全错误码；未知客户端或上游错误必须收敛为
  `fact_unavailable`，不得携带凭据、请求头、端点细节或响应正文。
- 只读 API 只有 `GET /api/v1/jinyiwei/summary`、`GET /api/v1/jinyiwei/investigations`
  和 `GET /api/v1/jinyiwei/investigations/{investigation_id}`；不得新增网络触发、任意 URL、
  修改或删除入口。完整边界见 ADR 0018。

作用域：`backend/`。已确定最小技术栈：Python + FastAPI + uvicorn，扁平 `app/` 包，
pytest 测试，ruff 静态检查，pip + venv 管理依赖。选型理由、取舍和验证证据见
`docs/decisions/0006-frontend-backend-foundation-stack.md`（`## 后端` 章节）。

## 边界

- 这里只放后端运行/评测工程及其验证，不实现前端内部功能。
- 当前保留 `GET /health` 业务无关入口，并提供本地下旨写入口
  `POST /api/v1/decrees/chancellor`，由 `app/api/decrees.py` 把旨意交给
  `app/agents/chancellor/` 的专用 LangGraph 丞相 Agent；该同步 MVP 仅支持
  `127.0.0.1`，不具备鉴权、限流或公开部署能力（见 ADR 0010）。该端点已升级为
  完整的丞相分流 + 六部办理 + 军机处会审闭环（见 ADR 0012）：丞相判断旨意是单部门
  （`single`）还是多部门（`multi`）路由；单部门旨意由 `app/agents/ministries/`
  （六部固定名录、单部门办理调用）处理；多部门旨意由 `app/agents/junjichu/`（军机处，
  按丞相给定顺序严格串行召集至少两个相关部门会审）处理；两者共用的图拓扑和状态形状
  （`ChancellorGraphState`）仍然只在 `app/agents/chancellor/graph.py` 一处定义。成功
  响应体不再是单段 `memorial_text`，原有 `route_type`/`rationale`/`processing_path`/
  `departments`/`ministry_opinions`/`final_verdict` 六个字段继续保留（`route_type` 与
  `ministry_opinions[].department` 均为 `str`，不是 `Literal`/`Enum`——六部范围与路由
  合法性只在图层的 `_decide_route` 节点做一次严格校验，响应模型不重复校验，避免把已经
  处理过的业务失败变成未捕获 500）。六部内部已增加全部开放的 39 司数据驱动层（见 ADR
  0013）：`app/agents/bureaus/` 以 `(department, bureau)` 复合身份注册不可变 profile，
  礼部六司无 1.0 门禁。每个部先严格选择本部一个或多个司，按选择顺序同步调用同一个通用司级
  Agent，再把全部有序司议交给一次独立模型调用形成部级补充；`invoke_ministry_agent(...)`
  的参数不变，返回值升级为同时包含 `department`、`bureau_opinions` 和 `opinion` 的结构化
  `MinistryOpinion`。single 依次执行“丞相首次分流 → 部内选司 → 逐司意见 → 部级补充 →
  丞相最终汇总”；multi 则先由军机处召集，按丞相给定顺序串行完成各部司议和部议，军机处
  再读取全部分层结果形成 `council_verdict`，最后交给丞相。两条路径共用严格 finalizer，
  生成非空 `final_verdict` 和恰好三项非空、去空白后互不重复的 `recommendations`；成功响应
  增量增加 `ministry_opinions[].bureau_opinions`、条件式 `council_verdict`（single 为
  `null`，multi 为非空字符串）和 `recommendations`。`processing_path` 按实际调用顺序记录
  司、部、军机处与最终丞相，不把未执行的现实动作写成已完成。模型编排不并发且不使用
  LangGraph checkpointer，最坏 single 为 12 次、全六部 multi 为 54 次基础同步模型调用；
  司级缺数可按 ADR 0018 追加最多一次调查与恢复，整体可能超过现有前端 120 秒超时；完整
  决策及对 ADR 0013 局部兼容结论的覆盖见 ADR 0014。已引入最小、无外部服务依赖的
  LangGraph 运行时基础模块（`app/langgraph_runtime/`，决策见
  `docs/decisions/0007-langgraph-runtime-foundation.md`），仅提供一个可编译的
  确定性图工厂函数，不接入任何模型供应商、不做持久化/checkpointer、不新增任何
  HTTP 业务接口。后端另承载 ADR 0018 定义的锦衣卫独立证据数据库和三个只读 GET API；
  除此之外仍不承载鉴权、通用数据库模型或任务编排，新增前先确认是否有对应产品任务。
- 不引入 `app/` 之外的多包结构、alembic、cli.py、多环境 docker-compose 或 `src/`
  布局，除非有新的 ADR 明确变更。

- 新增来源必须先通过接入审查才能加入 `build_default_public_api_registry()`：注册项必须声明发布者、
  免费合法且无需订阅、付费 API、登录、私钥、付费墙或验证码的公开访问依据、实际地域/市场覆盖、
  事实类别、时效语义、质量上限、许可证说明、再分发限制、固定 HTTPS origin、允许参数与确定性
  解析器。未审查、字段不全、需凭据、任意 URL、非 HTTPS、类别为空或未通过固定解析器校验时必须
  注册失败并保持不可用；不得用通用网页搜索规避审查，单一来源也不得声称未经核实的全球覆盖。
- 来源接入、路由、解析及网络安全测试必须离线，使用临时 SQLite、假客户端、fixture、假 DNS/套接字；
  不设置 `JINYIWEI_EXTERNAL_NETWORK_ENABLED`，不使用密钥、真实公网或真实下旨，也不得把 fixture
  当作真实外网证据。离线验证失败不得以公网冒烟替代。

## 账户、会话与所有者

FastAPI 是账户、可撤销会话和数据 owner 过滤的唯一权威。公开路由只包括 `GET /health` 及注册/登录；上书和史馆的每个受保护路由必须声明 `CurrentUser`（即 `require_current_user`）。客户端不得提供 owner ID；存储层必须从已认证用户传入 owner ID，无归属的旧 SQLite 数据保留但对所有用户不可见。

认证路由发放随机不透明会话 ID，由 BFF 通过 `Authorization: Bearer` 转发。退出必须废止服务端会话；已废止或过期的会话必须返回 401。本地双账号验证应注入假丞相图响应，不得发起真实模型请求。见 `docs/decisions/0027-authenticated-user-isolation.md`。

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

## 锦衣卫离线验证与公网冒烟

常规 lint/test 必须保持离线，测试通过依赖注入使用临时 SQLite、假 DNS/套接字和本地
fixture，不应设置 `JINYIWEI_EXTERNAL_NETWORK_ENABLED`。运行服务时未设置该变量即为
失败关闭；锦衣卫本地运行数据写入 `backend/data/jinyiwei.sqlite3`，该文件不得提交。

只有在任务明确授权无副作用公网验收且离线安全测试已通过后，才允许从 `backend/` 运行以下
Windows PowerShell 冒烟。它只经安全传输读取登记来源使用的 Wikidata 无登录 JSON API，
只输出状态、最终 URL 与响应字节数，不触发下旨、模型或数据库写入，并在结束后清除开关：

```powershell
$env:JINYIWEI_EXTERNAL_NETWORK_ENABLED = "true"
try {
  .venv\Scripts\python.exe -c 'from app.jinyiwei.network import PinnedHTTPSClient; r=PinnedHTTPSClient().fetch("https://www.wikidata.org/w/api.php?action=wbsearchentities&search=Beijing&language=en&format=json&limit=1", max_bytes=262144); print({"status": r.status, "final_url": r.final_url, "bytes": len(r.body)})'
} finally {
  Remove-Item Env:JINYIWEI_EXTERNAL_NETWORK_ENABLED -ErrorAction SilentlyContinue
}
```

不得把 stub 或 synthetic fixture 结果记作真实公网冒烟；日志不得包含响应正文、请求头、密钥
或业务提示词。公开
页面验收同样只能使用 Wikimedia 提供器发现的 URL，并必须经过 robots 与相同的安全传输。

首次本机 OAuth 和真实 MCP smoke 都是外部动作：必须先通过全部离线门禁，再获得当前任务的
单独授权，并由管理员在场。不得在常规测试、CI 或无人值守任务中设置外部网络开关。管理员
本机授权使用以下固定命令；CLI 只接受 Registry 中的 server ID，不接受 URL、Token 或账号
参数，`status` 只读取当前用户的本机 DPAPI 状态：

```powershell
cd backend
$env:JINYIWEI_EXTERNAL_NETWORK_ENABLED = "true"
try {
  .venv\Scripts\python.exe -m app.jinyiwei.mcp.oauth authorize --server westock
  .venv\Scripts\python.exe -m app.jinyiwei.mcp.oauth status --server westock
} finally {
  Remove-Item Env:JINYIWEI_EXTERNAL_NETWORK_ENABLED -ErrorAction SilentlyContinue
}
```

真实 smoke 还必须由管理员先把登记的 `westock` server 以及要调用的 `data_search`、
`data_minute` 或 `data_quote` tool 分别显式设为 enabled；OAuth 成功不会替管理员完成启用。使用刚才授权的
Windows 本机凭据时，必须显式选择 `local`，不得依赖隐式回退：

```powershell
cd backend
$env:JINYIWEI_EXTERNAL_NETWORK_ENABLED = "true"
try {
  .venv\Scripts\python.exe -m app.jinyiwei.mcp.smoke --server westock --tool data_quote --query 比亚迪 --credential-source local
  .venv\Scripts\python.exe -m app.jinyiwei.mcp.smoke --server westock --tool data_minute --query 比亚迪 --credential-source local
} finally {
  Remove-Item Env:JINYIWEI_EXTERNAL_NETWORK_ENABLED -ErrorAction SilentlyContinue
}
```

smoke 只允许 `tools/list`、`data_search`、`data_minute` 和 `data_quote`。CLI 不得输出价格、响应正文、token、
请求头、账号信息或完整 MCP 响应，也不得调用 portfolio、alert、paper trade 或任何写工具。
当前仓库配置是管理员显式批准后的 enabled 状态；网络显式开关和有效凭据任一门禁未完成时
仍必须拒绝。授权本身不得改变配置启用状态。

要让本机 `/study` 业务运行时复用管理员已授权的 DPAPI 凭据，启动后端时必须同时显式设置
凭据来源和独立公网门禁：

```powershell
cd backend
$env:JINYIWEI_EXTERNAL_NETWORK_ENABLED = "true"
$env:JINYIWEI_MCP_CREDENTIAL_SOURCE = "local"
.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

生产环境不使用上述本机 DPAPI 流程。Secret Manager 把 OAuth JSON 注入
`WESTOCK_MCP_CREDENTIAL`，Registry 的 `env://WESTOCK_MCP_CREDENTIAL` 路径和 smoke 默认的
`--credential-source env` 保持生产优先级；生产不得回退读取 `backend/data/credentials/`。
本机和生产都不得读取、解密、复制、代理或复用 WorkBuddy 的私有凭据。

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
四个业务子包：`app/agents/chancellor/`（丞相首次分流与最终汇总图，唯一定义
`ChancellorGraphState` 和拓扑的地方）、`app/agents/ministries/`（六部固定名录
`MINISTRIES`、single/军机处共用的 `invoke_ministry_agent`，负责严格选司、顺序调用司级
Agent，并通过独立模型调用生成结构化部级补充）、
`app/agents/bureaus/`（39 司不可变复合注册表与统一通用司级 Agent，礼部六司全部开放）、
`app/agents/junjichu/`（军机处多部门会审，严格串行、不并发调用六部，并在各部完成分层
意见后形成非空会审结论）；这些子包的结构化 JSON 解析共用
`app/agents/structured_output.py` 里的唯一函数。具体
接口、错误映射和验证证据见对应产品任务与其 Implementation Report（例如
`docs/product/tasks/2026-07-17-shangshufang-chancellor-agent.md`、
`docs/product/tasks/2026-07-17-decree-six-ministries-joint-review.md`、
`docs/product/tasks/2026-07-17-bureau-level-agents.md`、
`docs/product/tasks/2026-07-17-memorial-three-recommendations.md`）。

## 后续变更要求

再次改变语言、运行方式、包管理器或评测方式时，在同一变更中：

`app/agents/chancellor_consult/` 是 ADR 0030 定义的独立非业务咨询包，只可复用
`app/langgraph_runtime` 的 DeepSeek 配置与客户端辅助函数；禁止导入下旨、六部、军机处、
锦衣卫、史馆或案卷模块。其受认证 HTTP 入口为 `POST /api/v1/chancellor-consult`，
每个合法请求恰好调用一次模型且不持久化。

1. 用最小原型验证关键假设。
2. 在 `docs/decisions/` 记录选择和取舍。
3. 更新本文件，登记准确的 setup、lint、test、run/eval 命令，并接入 CI。
4. 让 agent 能直接读取测试、日志和必要的本地运行状态；工具优先提供非交互接口、
   可操作错误信息和安全的 dry-run。
