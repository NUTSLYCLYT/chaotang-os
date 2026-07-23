# ADR 0019：MCP 服务账号采用管理员 OAuth 授权中心

## Status

Accepted — 2026-07-23

## Context

ADR 0018 已决定锦衣卫可以通过管理员批准的 MCP 查询外部数据，并由部署侧服务账号提供
凭据。现有实现能够消费 bearer、API key 和带 refresh token 的 OAuth JSON，也能在进程内
刷新 access token，但没有首次 Authorization Code 流程、浏览器回调或本机安全持久化。

腾讯自选股 WorkBuddy 连接器使用 OAuth 动态客户端注册，并把 access token 与 refresh token
存入 WorkBuddy 私有加密凭据库。锦衣卫不能解密、复制或代理该凭据，必须拥有独立授权。

仓库当前没有后台管理员身份、会话和 CSRF 基础设施，因此直接增加公网授权页面会形成新的
高风险管理入口。与此同时，只做一次性脚本又无法安全处理 refresh token 轮换和未来部署。

## Decision

采用可复用的管理员 OAuth 授权服务，首期通过本机 CLI 启动浏览器授权：

- 使用 OAuth Authorization Code + PKCE S256、Protected Resource Metadata、
  Authorization Server Metadata 和需要时的动态客户端注册；
- loopback 回调只监听 `127.0.0.1` 随机端口和随机路径，校验一次性 state、超时和单次消费；
- 所有远端 OAuth URL 必须通过 MCP Registry 声明的 `oauth_allowed_origins` 和现有受限 HTTPS
  网络策略；不得接受命令行、用户、模型或远端响应提供的任意新 origin；
- Windows 本机使用当前用户范围 DPAPI 加密保存 OAuth JSON，且只在显式选择本机凭据来源
  时读取；部署环境继续通过 Secret Manager 和 `env://` 注入并保持优先级，不回退到本机
  DPAPI 文件；
- refresh token 轮换必须在向调用者发布新凭据前原子持久化；
- OAuth 成功只建立 credential availability，不自动启用 MCP 服务或工具；
- 首期不暴露远程授权 HTTP API；未来管理页面必须复用同一授权服务，并先具备管理员鉴权、
  CSRF 和审计基础设施；
- 不读取或复用 WorkBuddy 凭据，不接入通达信，不开放腾讯自选股写工具。

## Consequences

管理员只需在腾讯官方页面完成一次登录和同意，不需要复制敏感 Token。锦衣卫拥有独立、
可撤换的服务账号授权，真实只读 smoke 和运行时可以共享同一通用 Credential Provider。

代价是需要实现和维护 OAuth 标准发现、PKCE、loopback 回调、DPAPI 适配、原子凭据存储及
刷新持久化。Windows 本机和 Linux/容器部署使用不同存储后端，但共享相同凭据模型。腾讯
OAuth 元数据若存在非标准差异，只能通过受审查配置适配，不能在核心 Python 代码中加入
provider 条件分支。

`ARCHITECTURE.md`、`backend/AGENTS.md`、产品任务、设计规格和 MCP 配置必须保持这一边界。
常规 CI 继续完全离线；真实授权和 smoke 是管理员明确触发的独立验收。

## Verification

```powershell
backend\.venv\Scripts\python.exe -m pytest backend\tests\test_jinyiwei_mcp_oauth.py backend\tests\test_jinyiwei_mcp_oauth_store.py backend\tests\test_jinyiwei_mcp_oauth_cli.py -q
backend\.venv\Scripts\python.exe -m ruff check backend\app\jinyiwei\mcp backend\tests
node scripts\check_harness.mjs
node scripts\check_harness.mjs --self-test
```

常规验证完全离线，不设置 `JINYIWEI_EXTERNAL_NETWORK_ENABLED`，不读取真实凭据：

```powershell
cd backend
.venv\Scripts\python.exe -m pytest tests/test_jinyiwei_mcp_oauth.py tests/test_jinyiwei_mcp_oauth_callback.py tests/test_jinyiwei_mcp_oauth_store.py tests/test_jinyiwei_mcp_oauth_service.py tests/test_jinyiwei_mcp_oauth_cli.py tests/test_jinyiwei_mcp_credentials.py tests/test_jinyiwei_mcp_smoke.py -q
.venv\Scripts\python.exe -m pytest -q
.venv\Scripts\python.exe -m ruff check .
```

以下真实授权交接命令不属于常规验证。只有离线门禁全部通过、当前任务另行授权且管理员在场
时才运行；外部网络开关必须在 `finally` 中清除：

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

授权成功不会启用配置。真实 smoke 前，管理员还必须分别显式启用登记的 `westock` server 和
要调用的 `data_search`/`data_quote` tool。使用本机 DPAPI 凭据的只读示例为：

```powershell
cd backend
$env:JINYIWEI_EXTERNAL_NETWORK_ENABLED = "true"
try {
  .venv\Scripts\python.exe -m app.jinyiwei.mcp.smoke --server westock --tool data_quote --query 比亚迪 --credential-source local
} finally {
  Remove-Item Env:JINYIWEI_EXTERNAL_NETWORK_ENABLED -ErrorAction SilentlyContinue
}
```

只允许 `tools/list`、`data_search` 和 `data_quote`；不得调用 portfolio、alert、paper trade
或其他写工具。生产使用 Secret Manager 注入的 `env://WESTOCK_MCP_CREDENTIAL`，其优先级
高于本机 DPAPI，且不得读取或复用 WorkBuddy 凭据。2026-07-23 管理员已实际完成真实授权，
并按上述边界通过 `data_search` 与 `data_quote` 只读 smoke；生产 Secret Manager 路径仍需
在部署任务中独立验收。
