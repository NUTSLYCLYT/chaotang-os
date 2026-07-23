# 锦衣卫腾讯自选股管理员 OAuth 授权设计

## 决策状态

用户于 2026-07-23 选择方案 B：建设管理员 OAuth 授权中心。首期交付本机命令行入口和
可复用授权服务，不在缺少管理员身份系统的情况下暴露公网管理页面。未来管理页面复用同一
授权服务，不改变凭据和 MCP Client 契约。

本设计扩展
`docs/superpowers/specs/2026-07-22-jinyiwei-approved-mcp-query-routing-design.md`
中的 Credential Provider，不改变史馆优先、外部补缺、工具白名单和只读证据边界。

## 目标与边界

管理员为腾讯自选股 MCP 建立锦衣卫专用服务账号授权。普通用户不登录腾讯、不看到授权
页面、不提供个人 Cookie 或 Token。授权成功只解决来源身份，不表示自动启用服务，也不
扩大工具权限。

明确排除：

- 解密、复制或代理 WorkBuddy 的 OAuth 凭据；
- 把 access token、refresh token 或 authorization code 放进聊天、配置、日志或数据库；
- 普通用户自行连接任意 MCP；
- 自选股管理、提醒、模拟交易及任何远端写操作；
- 在缺少后台管理员鉴权时开放远程授权 API；
- 接入通达信。

## 方案比较

### 方案 A：本机一次性脚本

只获得 Token 并写入私有环境文件。实现较快，但无法安全处理 refresh token 轮换，未来
部署和管理页面必须重写。

### 方案 B：管理员授权服务

把发现、PKCE、回调、令牌交换和凭据存储实现为可测试服务，命令行只是首个适配器。当前
电脑使用 Windows DPAPI，部署环境使用 Secret Manager。该方案被采用。

### 方案 C：复用 WorkBuddy

读取 WorkBuddy 加密凭据或以 WorkBuddy 作为调用代理。该方案违反凭据所有权边界，并让
锦衣卫依赖另一个桌面客户端的内部实现，因此拒绝。

## 总体架构

授权能力划分为六个边界：

1. `OAuthMetadataResolver`：从已登记 MCP 来源开始，按 OAuth Protected Resource Metadata
   和 Authorization Server Metadata 发现端点。
2. `OAuthEndpointPolicy`：校验发现、注册、授权和令牌端点，仅允许 HTTPS、已批准公共
   origin、固定端口与固定路径规则，拒绝私网、回环、链路本地和云元数据目标。
3. `PkceTransaction`：生成高熵 `state`、`code_verifier` 和 S256 `code_challenge`，只在
   当前授权进程内保存，设定短超时且只消费一次。
4. `LoopbackCallbackReceiver`：仅监听 `127.0.0.1` 随机高端口和不可猜测路径，只接受一次
   GET 回调，并限制查询长度和字段集合。
5. `OAuthAuthorizationService`：动态注册公共客户端，生成授权 URL，打开浏览器，接收
   authorization code，换取 Token，并把标准凭据交给存储。
6. `OAuthCredentialStore`：本机 DPAPI 加密存储和部署 Secret Manager 适配层；为现有
   `CredentialProvider` 提供可刷新凭据并持久化 refresh token 轮换。

MCP Client 不感知浏览器、回调或存储实现，只请求服务对应的敏感请求头。OAuth 模块不调用
任何 MCP 业务工具；真实 smoke 由现有受限 smoke 入口在授权完成后单独执行。

## OAuth 数据流

1. 管理员运行 `python -m app.jinyiwei.mcp.oauth authorize --server westock`。
2. CLI 从 MCP Registry 读取固定服务 ID、固定 endpoint 和 OAuth 允许 origin；不接受任意
   URL 参数。
3. Metadata Resolver 通过受限 HTTPS 获取资源和授权服务器元数据。所有元数据均按严格
   schema 解析；未知字段忽略，缺少必需字段失败关闭。
4. 若服务需要动态客户端注册，系统以 loopback redirect URI 注册 public client；不生成
   或保存 client secret。返回的 `client_id` 与 redirect URI 必须匹配当前事务。
5. 系统生成 PKCE S256 和一次性 `state`，启动 loopback receiver，再打开腾讯官方授权页。
6. 管理员在浏览器登录腾讯并确认授权。取消、超时、state 不匹配或 OAuth error 都终止
   事务且不写入凭据。
7. 系统用 authorization code、原始 `code_verifier`、`client_id` 和完全一致的 redirect URI
   调用固定 token endpoint。
8. 系统验证 token type、access token、refresh token 和过期时间，将最小 OAuth 凭据写入
   加密存储；授权码、verifier 和 state 随进程退出丢弃。
9. CLI 输出不含秘密的成功摘要。管理员可选择立即运行只读 smoke。
10. 运行时读取凭据。刷新发生时，新的 access token 和轮换后的 refresh token 原子写回；
    写回失败则本次调用失败关闭，不继续使用无法持久化的轮换凭据。

## 元数据和网络安全

OAuth 元数据属于不可信远端输入。任何 discovered URL 都不能绕过现有固定来源规则。

- 初始 MCP endpoint 必须来自 Registry，命令行不接受 URL。
- Registry 为每个服务声明 `oauth_allowed_origins`。发现得到的资源、授权、注册和 token
  endpoint 必须落在该集合；腾讯特例只存在于配置，不进入 Python 条件分支。
- 所有端点必须为 HTTPS；唯一 HTTP 例外是当前进程创建的 `127.0.0.1` loopback 回调。
- DNS 解析和连接继续拒绝私网、回环、链路本地、保留地址和云元数据地址。
- 不跟随跨 origin 重定向；OAuth 授权页面由浏览器处理，但生成前仍校验其 origin。
- 元数据、注册和 token 响应设置独立超时、最大字节数、JSON 类型和嵌套深度限制。
- 错误信息仅使用稳定错误码，例如 `oauth_metadata_invalid`、`oauth_state_mismatch`、
  `oauth_denied`、`oauth_timeout`、`oauth_token_invalid` 和 `credential_store_failed`。

## 本机回调安全

- 只绑定 `127.0.0.1`，不绑定 `0.0.0.0`、局域网地址或 IPv6 通配地址。
- 操作系统分配随机高端口；路径包含独立随机片段。
- receiver 在打开浏览器前完成监听，最多等待五分钟。
- 只接受一次 GET；拒绝 Host 不匹配、路径不匹配、重复参数、超长查询、未知关键字段和
  state 不匹配。
- 成功或失败页面只显示静态状态，不回显 code、state、错误详情或查询字符串。
- 首次终态后立即关闭监听；重复回调返回通用失败。

## 凭据模型与存储

标准 OAuth 凭据包含：

- `access_token`
- `refresh_token`
- `expires_at`
- `client_id`
- `token_endpoint`

本机附加非敏感元数据包括格式版本、服务 ID、授权服务器 origin、创建时间和更新时间。

Windows 本机存储使用当前用户范围 DPAPI。磁盘文件只包含 DPAPI 密文、格式版本、服务 ID
和时间戳，固定写入 `backend/data/credentials/<server>.oauth.json`。写入采用同目录临时文件、
flush、关闭和原子替换；文件名由已登记 server ID 派生，不接受路径输入。解密失败、用户
不匹配、格式版本未知或原子替换失败均失败关闭。

Linux 和容器不读取 DPAPI 文件。部署环境通过 Secret Manager 把同一标准 OAuth JSON 注入
`WESTOCK_MCP_CREDENTIAL`。现有 `env://` 路径和 smoke 默认的 `--credential-source env`
保持生产优先级；生产环境不得回退读取本机存储。Windows 本机 smoke 只有显式传入
`--credential-source local` 才读取当前用户的 DPAPI 文件。两种环境都不得读取、解密、
复制、代理或复用 WorkBuddy 私有凭据。

## 刷新与并发

现有 single-flight 刷新行为保留。持久化存储参与刷新后遵循：

- access token 在安全提前量内过期时只允许一个刷新请求；
- 等待者共享刷新结果，不重复请求；
- 服务端返回新 refresh token 时必须替换旧值；
- 新凭据持久化成功后才向等待者发布；
- 持久化失败时所有等待者收到同一脱敏失败，旧凭据不再用于新调用；
- 不在日志、异常 repr、缓存键、调查审计或证据包中写入令牌。

## 管理员入口

首期只提供本机 CLI，因为仓库没有管理员身份、权限和 CSRF 基础设施。CLI 提供：

- `authorize --server <registered-id>`：执行完整 OAuth；
- `status --server <registered-id>`：只显示是否已授权、是否临近过期，不显示账号或 Token；
- `revoke-local --server <registered-id>`：只移除锦衣卫本机凭据，不声称已撤销腾讯服务器
  授权；该动作必须显式确认；
- 授权与 smoke 是两个独立动作；授权命令不自动运行 smoke，也不启用 server/tool。

未来管理页面只能调用相同 `OAuthAuthorizationService`，并必须先建立管理员身份、CSRF、
审计和安全回调 origin；不得复制一套 OAuth 实现。

管理员在场且另行授权真实外部动作后，从 `backend/` 使用固定交接命令：

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

## 与 MCP Registry 和运行时的关系

腾讯配置继续默认 `enabled: false`。OAuth 成功只把凭据状态变为 available：

- 不自动启用 server；
- 不自动启用任何 tool；
- 不改变 `approval_version`；
- 不绕过 `JINYIWEI_EXTERNAL_NETWORK_ENABLED`；
- 不允许远端新工具自动获得权限。

管理员仍需显式启用 `westock` server，以及实际要调用的 `data_search` 或 `data_quote`
tool。使用本机凭据的 smoke 必须同时显式打开外部网络门禁并选择 `local`：

```powershell
cd backend
$env:JINYIWEI_EXTERNAL_NETWORK_ENABLED = "true"
try {
  .venv\Scripts\python.exe -m app.jinyiwei.mcp.smoke --server westock --tool data_quote --query 比亚迪 --credential-source local
} finally {
  Remove-Item Env:JINYIWEI_EXTERNAL_NETWORK_ENABLED -ErrorAction SilentlyContinue
}
```

smoke 只允许 `tools/list`、`data_search` 和 `data_quote`，不得调用 portfolio、alert、
paper trade 或其他写工具。锦衣卫核心继续通过通用 Credential Provider 和 MCP Registry
调用，不增加 `if westock` 分支。

## 测试策略

常规测试全部离线：

- PKCE verifier/challenge、state 熵和单次消费；
- protected-resource、authorization-server 和 dynamic-registration 元数据解析；
- URL origin、DNS、重定向、响应大小和 schema 失败关闭；
- loopback receiver 的正确回调、错误、取消、超时、重复、Host/path/state 攻击；
- token 交换字段、过期时间和响应类型校验；
- DPAPI 接口成功、解密失败、跨用户失败、路径注入和原子替换失败；
- refresh token 轮换持久化、single-flight、重启后读取和失败关闭；
- CLI 输出与异常脱敏；
- 授权成功仍不启用未批准工具；
- smoke 仍只接受 `data_search` 和 `data_quote`。

真实验收不纳入 CI。代码和离线安全测试通过后，由管理员在当前电脑完成腾讯官方授权，再
运行一次脱敏只读 smoke。输出只包含 server、tool、证券代码、行情时间、状态和响应字节数，
不包含价格正文、Token、账号信息或完整 MCP 响应。

## 验收标准

- 用户能够在腾讯官方页面完成一次授权，不需要复制 Token。
- WorkBuddy 凭据从未被读取、解密或复用。
- 授权取消、超时和攻击输入不会产生凭据文件。
- 本机磁盘不存在明文 OAuth Token。
- refresh token 轮换跨进程重启仍然有效。
- 腾讯配置仍默认关闭，工具白名单仍只有当前批准的只读工具。
- 普通 `/study` 用户不接触 OAuth。
- 离线全量测试、Ruff、harness 检查通过。
- 管理员授权后的真实只读 smoke 成功且输出脱敏。
