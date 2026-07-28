# chaotang-os 当前架构事实

## 丞相咨询边界

`/study` 另有一条与 ADR 0028 下旨闭环平行的非业务咨询链路：浏览器通过受认证的同源
`POST /api/chat/chancellor-consult` BFF 调用 FastAPI
`POST /api/v1/chancellor-consult`。每次发送只调用一次 DeepSeek；会话历史仅保存在当前页面
React 内存中，不进入六部、军机处、锦衣卫或史馆，也不产生办理或归档事实。完整契约见 ADR 0030。

## 史馆边界

史馆属于后端域，以 `app/shiguan` 的 Pydantic 模型和 SQLite 存储为事实源。公开业务档案只
包含 `MEMORIAL`（奏折）与 `REPLY`（回奏）：真实上奏产生奏折，办理旨意或奏折产生回奏；
经验、教训、证据和复盘仍是档案属性，不是独立档案类型。旨意来源的回奏保存原文快照且不
制造假奏折，奏折来源的回奏必须且只能关联一条真实奏折。丞相图只消费每部门一次召回生成的
只读上下文；前端不推断复盘状态、匹配原因或归档成功。持久化基础见 ADR 0015，双文种契约
及显式确认、失败关闭的 v1 → v2 迁移边界见
`docs/decisions/0017-shiguan-memorial-reply-contract.md`。

## 锦衣卫证据边界

锦衣卫是独立的后端证据域（`backend/app/jinyiwei/`），使用
`backend/data/jinyiwei.sqlite3` 保存调查、冻结证据包、来源尝试、缓存和采用关系；不得与
史馆 `backend/data/shiguan.sqlite3` 共用路径。来源顺序固定为“史馆 → 管理员批准的只读 MCP →
代码登记的公开 API → Wikimedia 公开页面”：史馆满足时效和覆盖要求时不联网，外部来源只补
仍未解决的事实槽位。MCP 是外部业务系统、专业数据与公共信息服务的通用只读接入层，只允许
配置中已登记并通过发现 schema 指纹复核的工具；默认公开 API 只有 Wikidata，页面发现能力
明确限定为 `WIKIMEDIA_ONLY`，不是通用互联网搜索。

只有司级意见节点能发起调查，同一司最多调查并恢复一次；部级综合、军机处、丞相路由及最终
汇总从不调用锦衣卫。最终 `REPLY` 只归档恢复后司级响应显式选择的证据 ID 有序并集，证据
快照写入史馆 schema v3；未采用材料留在锦衣卫库，跨库采用关系以可对账的
PENDING/CONFIRMED 状态最终一致。系统拥有的事实字段不得由模型提供；证据支持的保底答复
必须只使用已冻结、已解析且当前有效的证据。真实外部网络由
`JINYIWEI_EXTERNAL_NETWORK_ENABLED` 控制且默认关闭，所有访问必须经过固定解析 IP、TLS
主机名/对端校验、逐跳重定向复核、HTTPS
公网地址和响应预算限制。Jinyiwei SQLite 当前为 schema v4；采用证据以不可变有序批次关联
史馆回奏，旧版本不覆盖。schema v4 另保存不含正文或秘密的逐 MCP 调用审计。MCP 限流是
进程内按 server/tool 隔离的原子滑动窗口；调用结果缓存 TTL 取管理员配置与事实 freshness
的最小值，且史馆解析始终先于整包缓存。首个 MCP 配置是经管理员显式启用的腾讯自选股来源，只批准
`data_search`/`data_minute`/`data_quote`；其中分钟行情优先，日期快照作为保守回退。它使用部署侧共享专用服务账号，配置文件不保存密钥。服务账号
首次授权采用管理员 OAuth 中心：首期由本机 CLI 启动 Authorization Code + PKCE 浏览器
流程，Windows 本机 CLI 只有显式选择 `--credential-source local` 时才读取当前用户范围
DPAPI 密文；业务运行时还必须显式设置 `JINYIWEI_MCP_CREDENTIAL_SOURCE=local` 才能使用
该凭据。运行时未设置凭据来源时默认 `env`；生产环境继续使用 Secret Manager 注入的
`env://` 凭据，且不得回退读取本机 DPAPI 文件。授权成功只建立凭据可用性，不自动启用服务
或工具；真实调用仍要求独立的外部网络
开关以及已登记 `westock` server 和 `data_search`/`data_minute`/`data_quote` 工具分别显式启用；这些
登记项已于 2026-07-23 经管理员确认和真实只读 smoke 验收后启用。仓库不
读取、解密、复制、代理或复用 WorkBuddy 私有凭据，也不在缺少管理员鉴权时暴露远程授权
API。通达信明确不接入。完整决策见
`docs/decisions/0018-central-jinyiwei-evidence-service.md` 和
`docs/decisions/0019-admin-oauth-for-mcp-service-accounts.md`。

来源接入必须先通过审查才能加入默认注册表：代码注册项需固定发布者、免费合法且无需订阅、付费 API、
登录、私钥、付费墙或验证码的公开访问依据、实际地域/市场覆盖、事实类别、时效语义、质量上限、
许可证与再分发限制，以及固定 HTTPS origin、允许参数和确定性解析器。缺项、需凭据、任意 URL、
非 HTTPS、类别越界或未通过固定解析器校验的来源必须在注册期失败关闭；未审查来源不得注册，也不得
以通用网页搜索替代。全球覆盖仅表示多个已审查来源的实际覆盖组合，不表示任何单一来源天然全球覆盖。
来源接入和安全回归必须离线执行，使用假客户端与 synthetic fixture，不设置公网开关、不使用
密钥或真实外网数据。真实 MCP smoke 不是常规验收：只有另行获得授权、管理员启用登记配置、
显式打开外部网络门禁并选择有效的部署 `env` 或本机 `local` 凭据来源后，才能通过脱敏只读
CLI 运行；CLI 只允许 `tools/list`、`data_search`、`data_minute` 和 `data_quote`，不得调用任何写工具。
工具结果的严格文本 JSON 提升、按已验证证券代码选择记录、管理员来源属性、日期精度和分钟序列语义
见 ADR 0020；核心 Python 仍不得增加 provider 条件分支。时效判断区分查询时间
`retrieved_at` 与真实市场观测时间 `as_of`：只有 `MARKET_QUOTE` 且来源为 `MCP` 或
`PUBLIC_API` 时，刚执行的查询可采用仍在 14 天硬上限内的最新可得行情，并继续如实保留
`as_of`；史馆行情、其它事实和 `not_before` 仍严格按观测时间判断。运行时只向运维暴露
`credential_unavailable`、`credential_source_invalid`、`external_network_disabled`
等稳定安全错误码，未知上游错误收敛为 `fact_unavailable`。完整决策见 ADR 0022。

大陆 A 股身份统一由 provider-neutral `InstrumentRef` 表达，首阶段市场范围为
SSE、SZSE、BSE A 股；provider symbol 只存在于 MCP 配置映射与 adapter 结果中，生产代码
不得保存公司名称到证券代码的字面量表。名称歧义失败关闭；身份缓存寿命独立于行情
freshness，短名到尚未验证的法定全称允许一次 original-only 安全复核。腾讯自选股当前只
批准真实证明过的 SSE、SZSE patterns，BSE 在单独证明 provider 能力前返回
`provider_capability_missing`。所有 MCP 工具继续只读，完整边界见 ADR 0024。

## 当前状态

仓库处于重建阶段。`backend/` 已完成最小工程骨架的技术选型（Python + FastAPI +
uvicorn + pip/venv，扁平 `app/` 包；选型与验证证据见
`docs/decisions/0006-frontend-backend-foundation-stack.md`），并在保持 `GET /health`
契约不变的前提下新增本地下旨入口 `POST /api/v1/decrees/chancellor` 和专用丞相 Agent，
并新增锦衣卫三个只读调查入口。当前持久化仅包含彼此隔离的史馆档案 SQLite 与锦衣卫证据
SQLite；仍不含通用数据库模型、持久化任务编排、鉴权或生产部署能力。ADR 0029 仅为军机处多部门会审引入按认证所有者隔离的窄域案卷台账；它不是通用任务编排，实施前必须完成对应的数据库、认证与跨端契约验证。
`frontend/` 已完成最小工程骨架的技术选型（Next.js App Router + React/react-dom +
TypeScript，npm 管理依赖，扁平 `src/app/`、`src/lib/` 结构，根路径 `page.tsx` 提供
登录前欢迎引导，`/health` 提供后端健康检查展示，`backendClient.ts` 封装对后端的服务端调用；选型与验证证据见同一
决策记录的 `## 前端` 章节）。生产部署方式和业务数据模型仍未确定；`GET /health`
跨端契约已确定为根级 `docs/contracts/health.schema.json`，调用路径为浏览器 →
Next.js 服务端 → FastAPI。`backend/` 已新增最小、无外部服务依赖的 LangGraph
运行时基础（`app/langgraph_runtime/`，仅暴露 `build_minimal_graph()` 与
`GraphState`），仅用于证明运行时可编译、可调用，不接入模型供应商或持久化，也
不构成已确定的业务 agent 架构；决策见
`docs/decisions/0007-langgraph-runtime-foundation.md`。在此基础之上，`backend/`
已接入唯一的 DeepSeek provider：声明式配置 `backend/config/providers.yaml`（顶层
`active: deepseek`，且只声明 `providers.deepseek`）+
只读配置加载校验 + 独立的 `build_deepseek_graph()` 图工厂（可注入假聊天模型用于
离线测试，默认走 `openai` SDK 调用 DeepSeek 的 OpenAI 兼容端点，密钥仅来自
`DEEPSEEK_API_KEY` 环境变量）；不迁移 `dev` 分支的完整多供应商模型层，不新增
聊天 HTTP API，`build_minimal_graph()` 与 `GET /health` 契约不受影响；决策见
`docs/decisions/0008-deepseek-langgraph-integration.md`。DeepSeek 密钥解析进一步新增
本地 dotenv 兜底能力：进程环境变量仍然优先，只有缺失/为空时才读取固定的私有路径
`backend/.env.example`，且不写入全局 `os.environ`；决策见
`docs/decisions/0009-deepseek-local-dotenv-fallback.md`。在此基础之上，仓库已交付第一个
端到端业务闭环："上书房"下旨到"丞相"Agent：前端新增 `/study` 页面和服务端专用的
`src/app/api/decrees/chancellor/route.ts`（Next.js Route Handler），`backendClient.ts`
新增 `submitDecree()`；后端新增独立的业务子包 `backend/app/agents/chancellor/`
（专用 LangGraph 丞相图，`build_chancellor_graph()`，只读复用 DeepSeek 配置加载和客户端
构建，不调用 `build_deepseek_graph()`）和 `backend/app/api/decrees.py`
（`POST /api/v1/decrees/chancellor`，同步返回丞相回奏或脱敏
503/502/4xx 错误）。`langgraph_runtime/graph.py`、`state.py`、`deepseek_graph.py` 与
`GET /health` 契约零改动；本地 MVP 只支持 `127.0.0.1`，不支持鉴权/限流/公开部署；决策见
`docs/decisions/0010-shangshufang-chancellor-agent.md`。在此基础之上，丞相 Agent 已升级为
完整的六部/军机处分流会审闭环：丞相判断旨意是 `single`（单部门）还是 `multi`（多部门）
路由，单部门旨意进入吏、户、礼、兵、刑、工六部之一（`backend/app/agents/ministries/`）
形成办理意见，多部门旨意进入军机处（`backend/app/agents/junjichu/`）并按丞相给定顺序
串行召集至少两个相关部门会审后形成结论；`POST /api/v1/decrees/chancellor` 的成功响应体
删除了旧的单段 `memorial_text`，改为返回 `route_type`、丞相判断说明 `rationale`、有序
流转路径 `processing_path`、参与部门 `departments`、各部门意见 `ministry_opinions` 和
最终结论 `final_verdict`；`/study` 页面同步展示这条完整流转链路，费用提示文案反映"一次
下旨可能触发多次模型调用"；前端 `submitDecree()` 的超时常量从 45000ms 上调至
120000ms（对应最坏情况 8 次串行 DeepSeek 调用）。决策见
`docs/decisions/0012-decree-six-ministries-joint-review.md`。六部现已进一步增加数据驱动的
司级 Agent 层：`backend/app/agents/bureaus/` 用不可变 profile 注册表按
`(department, bureau)` 复合身份定义六部共 39 司，礼部六司与其余各司全部开放；每个部先
严格选择本部一个或多个司，再按选择顺序同步调用统一的通用司级 Agent（见 ADR 0013）。在此
基础上，部级会读取全部有序司级意见，通过一次独立模型调用形成补充和综合；
`invoke_ministry_agent` 返回结构化 `MinistryOpinion`，同时保存 `bureau_opinions` 与部级
`opinion`。single 路径把该部的分层结果直接交给丞相最终汇总；multi 路径按序完成各部司议和
部议，再交军机处形成 `council_verdict`，最后交给丞相。两条路径共用严格输出非空
`summary` 与恰好三个非空、互不重复 `recommendations` 的 finalizer；`final_verdict` 映射
`summary`，`processing_path` 记录真实调用顺序并以最终丞相结束。模型继续负责通用路由；
只有同时包含证券市场词与报价查询词的明确行情旨意，才在既有严格校验之后规范化为
`single + 户部`，并在户部有效司列表中把投资司置于首位且去重。该窄范围策略不绑定行情
提供方，非行情旨意保持既有路由与顺序。司级模型第一次无证据返回 `READY` 且仅因
`unsupported_factual_dependency` 被拒绝时，协议只追加一次不含原响应或证据正文的静态
纠正，要求返回既有 `NEEDS_DATA` schema；其它错误和再次不合规均继续失败关闭（ADR 0023）。

`POST /api/v1/decrees/chancellor` 的路径、请求体及原字段保持不变，成功响应增量增加
`ministry_opinions[].bureau_opinions`、条件式 `council_verdict`（single 为 `null`，multi 为
非空字符串）和 `recommendations`；FastAPI、BFF 与 UI 同批严格校验和展示分层结果。模型、
结构或响应构造失败继续通过脱敏异常链失败关闭并映射 502，既有错误分类和 `GET /health`
不变。模型编排不并发且不使用 LangGraph checkpointer，最坏 single 为 12 次、全六部
multi 为 54 次基础模型调用；司级缺数可按 ADR 0018 追加最多一次调查与恢复，整体可能超过
现有 120 秒前端超时。ADR 0013 中扁平字符串返回和不扩成功字段的局部结论由
`docs/decisions/0014-layered-memorial-three-recommendations.md` 覆盖。

## 所有权

| 区域 | 当前确认的归属 | 当前不作出的假设 |
| --- | --- | --- |
| 根目录 | 跨线约定、共享文档、CI、仓库级工具 | 具体业务实现 |
| `docs/product/tasks/` | Codex 与 Claude Code 的顺序交接契约和验收证据 | 运行态队列、自动编排服务 |
| `.agents/skills/product-flow/` | Codex 桌面任务内的一键产品交付编排 | 定时/CI 常驻服务、Claude 自主编排入口 |
| `.claude/agents/` | Claude Code 的架构、模块交付、测试专业角色 | 跨客户端通用角色、并行写入隔离 |
| `frontend/` | 前端工程及其验证；已确定 Next.js + React + TypeScript + npm 最小骨架；`/study` 承载上书房下旨与分层会审结果；`/jinyiwei` 通过三个 GET-only BFF 展示只读调查汇总、列表和详情，后端地址不进入浏览器，见 ADR 0018 | 其它业务页面、状态管理、UI 组件库、鉴权、任意 URL 或调查变更 UI |
| `backend/` | 后端运行/评测工程及其验证；已确定 Python + FastAPI + uvicorn 最小骨架、DeepSeek provider 与分层会审 Agent；史馆和锦衣卫分别以独立 SQLite 保存档案及证据调查。锦衣卫只接入司级节点，提供安全的史馆/登记公网来源编排、回奏采用证据快照和三个只读 GET API，见 ADR 0018 | 其它业务 agent/workflow、DeepSeek 之外的模型供应商、LangGraph checkpointer、通用数据库/任务编排、公开部署 |

`AGENTS.md` 只提供经常需要的操作指引；本文件只记录已确认架构事实。重要选择在
`docs/decisions/` 记录原因，不能把尚未决定的方案写成现状。

## 当前边界

- 前端实现只放在 `frontend/`；后端实现只放在 `backend/`。
- 根级工具可以检查两个工程，但不承接任何一侧的具体业务实现。
- Codex 默认拥有产品定义、任务就绪和验收结论；Claude Code 默认拥有实现、测试和交付报告。
  两者通过 `docs/product/tasks/` 顺序交接，不假设客户端之间能够自动调用或并行写入。
- Claude Code 主会话是交付负责人；架构角色只读，模块角色按任务允许路径端到端修改相关
  前后端代码，测试角色最后验证。业务模块是交付所有权边界，`frontend/`、`backend/` 仍是
  代码治理边界。有写权限的角色顺序运行，除非未来另行确定 worktree 隔离方案。
- `product-flow` 由当前 Codex 桌面任务担任总编排器，通过非交互 Claude CLI 启动交付团队，
  再由同一 Codex 任务验收。它不启动第二个 Codex，也不把产品验收权交给 Claude。
- 当前最小骨架的运行时依赖方向为浏览器 → Next.js 服务端 → FastAPI，共享契约位于
  根级 `docs/contracts/`；改变这些依赖方向、契约位置或运行时边界时，必须用可运行
  原型或测试验证，并记录决策。
- `backend/app/langgraph_runtime/` 的确定性运行时基础（`build_minimal_graph()`）
  不是已确定的业务 agent 架构；不得据此推断已可以随意扩展成业务工作流或启用
  持久化。同一目录下已额外接入唯一的 DeepSeek provider（`build_deepseek_graph()`
  及配套配置加载/客户端模块；配置要求 `active: deepseek`，见
  `docs/decisions/0008-deepseek-langgraph-integration.md`），
  这是本次范围内唯一确定的模型供应商接入；除 DeepSeek 外，当前仍明确排除：其它
  模型供应商接入、通用聊天 HTTP API、provider 管理 API、工具调用、
  RAG、LangSmith 追踪、LangGraph Studio/CLI、LangGraph 持久化/checkpointer、通用数据库、
  流式接口、human-in-the-loop、分布式执行、生产部署；`GET /health` 契约不变。完整清单与
  理由见 `docs/decisions/0007-langgraph-runtime-foundation.md` 与
  `docs/decisions/0008-deepseek-langgraph-integration.md`。仓库已确定的写业务 HTTP
  接口和业务 Agent 主入口是 `POST /api/v1/decrees/chancellor` 与 `app/agents/chancellor/`
  （上书房下旨到丞相，同步、无 LangGraph checkpointer、仅 `127.0.0.1` 本地 MVP；成功后
  由史馆以单条 `REPLY` 原子归档），见
  `docs/decisions/0010-shangshufang-chancellor-agent.md`；该闭环已升级为丞相分流 +
  六部办理（`app/agents/ministries/`）+ 军机处多部门会审（`app/agents/junjichu/`），
  HTTP 响应契约相应扩展，仍然同步、无 LangGraph checkpointer、仅 `127.0.0.1` 本地 MVP，见
  `docs/decisions/0012-decree-six-ministries-joint-review.md`；六部内部已新增
  `app/agents/bureaus/` 的 39 司数据驱动层，部级严格路由后按顺序同步调用相关司，礼部没有
  1.0 门禁，见 `docs/decisions/0013-data-driven-bureau-agents.md`。分层回奏进一步要求每个
  部独立补充司议，single 直接回丞相，multi 经军机处会审后回丞相，两路共用严格三建议的
  finalizer；成功契约增量保存司议、军机处结论与建议，见
  `docs/decisions/0014-layered-memorial-three-recommendations.md`。模型编排仍不并发且不使用
  LangGraph checkpointer；明确行情旨意经窄范围、无供应商依赖的护栏规范化到户部并优先
  投资司，首次无证据 `READY` 仅可静态纠正一次，最坏 single/multi 基础同步模型调用数为
  12/54（ADR 0023）；司级节点可按 ADR 0018 在缺数时追加最多一次调查与恢复。锦衣卫另提供三个 GET-only 审计 API 和
  `/jinyiwei` 只读页面，不得据此推断可以随意新增其它业务工作流、任意 URL、变更接口或
  通用派发/持久化能力。

## 结构变化门禁

新增顶层工程、改变所有权边界、确定技术栈或改变跨线契约时，必须：

1. 先验证关键假设，再新建或更新 `docs/decisions/` 中的简短记录。
2. 更新本文件及受影响的 scoped `AGENTS.md`。
3. 把可机械判断的约束加入 `scripts/check_harness.mjs` 或所属工程测试。
4. 运行本地验证，并确保 `.github/workflows/harness.yml` 执行仓库级检查。

## 账户与所有者边界

本地账户体系以 FastAPI 为唯一身份、会话和数据所有者权威；Next.js 仅作为同源 BFF。浏览器仅保留 `HttpOnly` 、`SameSite=Lax`
cookie（生产环境加 `Secure`），BFF 仅在服务端将其转为后端认证请求。令牌、后端地址和密码哈希不得暴露给浏览器。
受保护的上书和史馆端点从 `require_current_user` 解析会话，并仅以该用户 ID 作为 owner 进行读写与过滤；客户端不可选择或传入 owner。
无 owner 的旧 SQLite 行保留但对所有账户不可见，不在此次变更中猜测归属。`GET /health` 、欢迎页、注册与登录保持公开；`/study`、`/shiguan` 及受保护 BFF 路由必须登录。详见 ADR 0027。
