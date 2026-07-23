# 决策 0018：中央锦衣卫证据服务

## Status

Accepted — 2026-07-20

## Context

既有丞相、六部、军机处和司级 Agent 在资料不足时，只能依赖模型既有知识继续推演或在
意见中描述缺口。系统没有统一的缺数契约、可审计的来源顺序、安全的公网访问边界，也无法
证明最终回奏采用了哪些证据。史馆保存业务公文及历史召回结果，但不适合保存调查尝试、缓存、
冲突材料和未采用证据；把这些数据混入史馆还会破坏 ADR 0017 确立的奏折/回奏双文种边界。

本地 MVP 同时缺少公网访问的安全闸门。直接让模型提供 URL 或让各司自行抓取，会引入 SSRF、
DNS 重绑定、危险重定向、敏感请求头泄漏、超大响应和网页提示注入风险。调查能力也不能扩散到
部级综合、军机处或丞相，否则会形成不可控的重复调查和图循环。

## Decision

新增独立后端域 `backend/app/jinyiwei/`。它以严格的 `DataGapRequest`、`EvidenceItem` 和
冻结 `EvidencePack` 为契约，负责来源编排、抽取、规则核验、缓存、调查审计与采用状态。锦衣卫
使用独立 SQLite 文件 `backend/data/jinyiwei.sqlite3`；它不得与史馆
`backend/data/shiguan.sqlite3` 共用路径，也不新增史馆档案类型。调查、事实槽位、来源尝试、
证据包、缓存和 PENDING/CONFIRMED 采用关系留在锦衣卫库，测试必须注入临时数据库路径。

调查固定按 `史馆 → 管理员批准的只读 MCP → 登记公开 API → Wikimedia 公开页面` 执行。
史馆结果满足时效和覆盖要求时不访问外部服务；否则只扩展仍未解决的事实槽位。MCP 是历史业务
系统之外的业务系统、专业数据和公共信息服务的通用补证层，不在核心 Python 中写 provider
分支。公开 API 必须来自代码内不可变注册表，首版默认只有无登录 Wikidata entity search。
公开页面只能由固定的 Wikimedia 搜索提供器发现，并明确
标记为 `WIKIMEDIA_ONLY`，不得宣传成通用互联网搜索，也不得接受用户或模型提供的任意 URL。
证据是否解决事实槽位由确定性覆盖率、质量、独立性和冲突规则决定；冲突或不足必须保持
`PARTIAL`、`BLOCKED` 或 `UNAVAILABLE`，不得由模型补全为已解决。

公网访问由 `JINYIWEI_EXTERNAL_NETWORK_ENABLED` 控制，默认关闭；仅 `1`、`true`、`yes`、
`on` 开启。所有外部读取必须经过 `PinnedHTTPSClient`：只接受 HTTPS 和显式允许端口，DNS
答案必须全部为公网地址，连接到已校验并固定的 IP，同时验证 TLS 主机名和实际对端地址；每次
重定向重新执行同样校验。客户端拒绝本机、私网、链路本地、云元数据、DNS 重绑定和代理，剥离
Cookie/Authorization 等敏感头，并限制总时限、连接/读取时限、响应大小、MIME、编码和重定向
次数。网页正文始终是不可信数据，只保存最小摘录、元数据和内容哈希。

MCP 注册表由管理员控制并固定 server ID、HTTPS endpoint、访问策略、事实类别、地域、只读
工具 schema、确定性映射和审批指纹。运行时先执行 `initialize`/`tools/list` 并复核指纹；
未登记、disabled、schema 漂移、非 `READ_ONLY`、任意 URL 或写工具全部失败关闭。认证只使用
部署侧 `env://` 引用，配置与日志不得包含凭据。首个候选为腾讯自选股 MCP，只批准
`data_search` 与 `data_quote`，使用共享专用服务账号；2026-07-23 经管理员确认、真实 OAuth
和只读 smoke 验收后，这三个登记项已显式启用。通达信/TDX 明确不接入。真实工具结果的严格
文本 JSON 提升、动态记录选择及管理员来源属性契约见 ADR 0020。

只有 `backend/app/agents/bureaus/` 的司级意见节点可以提交缺数单。共享适配器最多调查一次并
只恢复原司级节点一次；同一旨意全局最多三次调查/恢复、30 秒外部工作和六次抽取。部级路由及
综合、军机处会审、丞相路由和最终汇总从不调用锦衣卫，只向下传递同一个会话并消费司级意见。
缓存命中和协调器失败不算真实调查；发生首次成功的非缓存调查时，`processing_path` 只在首个
对应司之后、部级综合或军机处之前加入一次“锦衣卫（调查）”。

恢复后的司级响应只能从其冻结证据包中显式选择 `adopted_evidence_ids`。最终 `REPLY` 以司级
选择顺序的稳定并集写入史馆 schema v3 的 `archive_evidence_references`，保存不可变证据快照；
未采用材料继续只留在锦衣卫库。史馆事务提交后，锦衣卫采用批次以 PENDING → CONFIRMED
幂等更新；跨库确认失败不撤销已经形成的回奏，并可仅凭 `reply_id` 对账恢复。公开下旨成功
响应不暴露内部调查对象。锦衣卫数据库为 schema v4：每个回奏绑定一个不可变、有序、带指纹
的采用批次；v1/v2/v3 严格迁移到 v4，旧证据与旧回奏从不覆盖。schema v4 的逐 MCP 调用审计
只保存 server/tool、审批版本、耗时、参数哈希、响应字节数/哈希与映射结果，不保存请求或响应
正文、凭据。管理员限流在单进程内按 server/tool 线程安全隔离，失败调用计数；多进程不共享
额度。逐调用缓存键不含秘密，TTL 取服务配置与事实 freshness 的最小值，且不得代替每次优先
执行的史馆解析。

后端仅新增三个只读入口：`GET /api/v1/jinyiwei/summary`、
`GET /api/v1/jinyiwei/investigations` 和
`GET /api/v1/jinyiwei/investigations/{investigation_id}`。Next.js 通过同源 GET-only BFF
提供 `/jinyiwei` 调查台，后端地址只在服务端读取。浏览器不得获得任意 URL、发起调查、重试
采集、编辑或删除能力。

### 来源接入审查与离线验收

后续连接器在加入 `build_default_public_api_registry()` 前必须完成审查，并在不可变代码注册项中记录：
发布者、免费且合法的公开访问依据（不得需要订阅、付费 API、登录、私钥、付费墙或验证码）、实际
地域/市场覆盖、事实类别、时效语义、质量上限、许可证说明、再分发限制、固定 HTTPS origin、允许的
参数及确定性解析器。不得使用任意 URL、运行时可替换端点或通用网页搜索。任何字段缺失、声称需要
凭据、非 HTTPS、类别为空或未通过固定解析器校验的来源必须在注册期失败关闭；未审查来源不得进入
默认注册表。全球覆盖只能由多个来源的实际已审查覆盖组合而成，不能用单一来源替代未核实市场范围。

连接器注册、路由、解析及网络安全回归必须离线运行，使用本地假客户端、fixture、假 DNS/套接字和
临时 SQLite；不得设置 `JINYIWEI_EXTERNAL_NETWORK_ENABLED`、使用密钥、读取真实公网或执行真实下旨，
也不得把 fixture 说明成真实外网证据。离线验证失败时，不得用公网冒烟替代或绕过。

MCP fixture 是 synthetic、sanitized JSON-RPC 契约样本，不是腾讯响应或厂商保证。真实只读
smoke 必须另行获得用户授权，同时具备显式外网开关、管理员启用配置和合法部署凭据；仅可运行
`tools/list`、`data_search`、`data_quote`。脱敏 CLI 只输出服务、工具、证券代码、行情时间、
状态和响应字节数，禁止输出价格、响应正文、token、请求头、账号信息或完整 MCP 响应。

## Consequences

- 收益：缺数、调查、证据、冲突和最终采用形成可追溯链路，上级 Agent 不再获得隐式调查权。
- 收益：史馆优先、未解决槽位扩展和缓存减少不必要公网访问；冻结证据包避免恢复过程中证据漂移。
- 收益：固定 IP 的 HTTPS 边界和默认关闭开关使真实联网失败关闭，离线测试无需公网或真实模型。
- 收益：史馆仍只有 `MEMORIAL` 与 `REPLY`，同时可审计回奏明确采用的证据快照。
- 代价：同步调查和最多一次司级恢复会增加受影响路径的延迟与模型调用；达到预算后只能明确降级。
- 代价：史馆与锦衣卫是两个 SQLite 事务，采用关系只能最终一致，必须保留 PENDING 对账流程。
- 限制：首版公开网页覆盖仅为 Wikimedia，默认 API 仅为 Wikidata；MCP 是可扩展的只读注册
  机制而不是任意工具代理。当前仅启用经管理员批准的腾讯行情查询，没有新闻等其它真实
  provider、通用搜索、多用户隔离、后台任务、删除能力或公开部署保证。
- 运维：运行库不得提交 Git；测试使用临时路径。真实公网冒烟必须显式、短时开启开关，只访问
  固定登记资源，不运行真实下旨，并记录经过脱敏的结果后关闭开关和进程凭据。

## Verification

- `backend/.venv/Scripts/python.exe -m ruff check .`
- `backend/.venv/Scripts/python.exe -m pytest -q`
- `npm test`（在 `frontend/`）
- `npm run lint`（在 `frontend/`）
- `npm run typecheck`（在 `frontend/`）
- `npm run build`（在 `frontend/`）
- `node scripts/check_harness.mjs`
- `node scripts/check_harness.mjs --self-test`
- `node .agents/hooks/check-harness.mjs --self-test`
- `git diff --check`
