# 任务：锦衣卫腾讯自选股管理员 OAuth 授权

## Status

Accepted

## Product Definition

- 用户确认：2026-07-23，用户在对话中选择方案 B，同意建设管理员 OAuth 授权中心；
  首期通过本机命令行和浏览器完成授权，正式管理页面以后复用同一服务接口。
- 问题：锦衣卫已经能够消费和刷新 OAuth 凭据，但没有首次授权入口，因而无法让管理员
  安全地为腾讯自选股 MCP 建立独立服务账号授权，也无法执行真实认证 smoke。
- 目标用户：负责配置锦衣卫外部数据源的系统管理员；普通 `/study` 用户不参与授权。
- 目标：管理员可从受控命令启动腾讯官方 OAuth 页面，完成 Authorization Code + PKCE
  授权；本机令牌加密保存，部署环境继续使用 Secret Manager 注入；授权后可执行受限只读
  smoke，并能为锦衣卫运行时提供可刷新的凭据。
- 非目标：复用或解密 WorkBuddy 私有令牌；普通用户登录腾讯账号；建设通用 MCP 商店；
  开放自选股修改、提醒、模拟交易或其他写工具；在尚无后台管理员身份系统时暴露公网授权
  HTTP API。

## Acceptance Criteria

- [x] 管理员运行授权命令后，浏览器只打开从腾讯 MCP 标准元数据发现且通过固定来源策略
  校验的 HTTPS 授权地址。
- [x] 授权采用 Authorization Code + PKCE S256，并校验一次性 `state`、回调地址、超时、
  授权码单次消费和响应大小。
- [x] 动态客户端注册、授权和换取令牌均使用受限 HTTPS 传输；不得跟随未批准重定向或访问
  本机、私网和云元数据地址。
- [x] 本机 Windows 凭据使用当前用户范围 DPAPI 加密，文件只保存密文和非敏感元数据，
  位于被 Git 忽略的 `backend/data/credentials/`。
- [x] 正式部署可以继续通过 `WESTOCK_MCP_CREDENTIAL` 或 Secret Manager 注入等价 OAuth
  凭据，不依赖 Windows DPAPI。
- [x] access token 过期时自动刷新；refresh token 轮换后，本机加密存储原子更新，进程重启
  后不会退回旧 refresh token。
- [x] 日志、CLI 输出、异常、测试快照和审计记录均不包含 access token、refresh token、
  authorization code、Cookie、完整授权头或客户端私密值。
- [x] 授权成功不会自动扩大 MCP 工具权限；真实 smoke 仅允许 `tools/list`、`data_search`、
  `data_minute` 和 `data_quote`，运行态仍需管理员显式启用已登记服务和工具。
- [x] 所有常规测试完全离线，覆盖成功流程、拒绝流程、回调攻击、元数据污染、令牌刷新、
  DPAPI 失败、原子存储和脱敏。
- [x] 管理员实际完成腾讯官方授权后，只读真实 smoke 能返回成功状态且不输出行情正文或
  任何凭据。

## Delivery Constraints

- 范围：`backend/app/jinyiwei/mcp/oauth/`、`backend/app/jinyiwei/mcp/client.py`、
  `backend/app/jinyiwei/mcp/contracts.py`、`backend/app/jinyiwei/mcp/mapping.py`、
  `backend/app/jinyiwei/mcp/credentials.py`、`backend/app/jinyiwei/mcp/smoke.py`、
  `backend/config/jinyiwei_mcp.yaml`、对应测试、
  `ARCHITECTURE.md`、`backend/AGENTS.md`、ADR、规格和计划文档、基线检查脚本。
- 兼容性：Python `>=3.11`；常规测试与 CI 不访问公网、不打开浏览器、不读取真实凭据；
  现有纯环境变量 bearer/API key/OAuth 凭据继续可用。
- 风险与限制：仓库目前没有管理员身份与会话系统，因此首期不暴露可远程调用的授权 API；
  Windows 本机仅在显式选择 `local` 时使用 DPAPI；Linux/容器部署由平台 Secret Manager
  注入 `env://` 凭据并保持优先级，不回退读取本机凭据。
- 技能计划：`codex-engineering-workflow`、`brainstorming`、`record-decision`、
  `writing-plans`、`test-driven-development`、`verification-before-completion`、
  `requesting-code-review`。
- Codex-only：是；禁止 Claude CLI、Claude runner 与 `gstack-claude`。

## Affected Modules

- 模块：锦衣卫 MCP OAuth 授权与凭据管理。
- 允许路径：见 Delivery Constraints 的范围。
- 依赖模块：现有 MCP Registry、受限 HTTPS 传输、凭据刷新、只读 smoke。

## Technical Plan

- 架构边界：OAuth 授权编排、标准元数据发现、PKCE、本机回调、令牌交换和凭据存储均通过
  小型接口解耦；MCP Client 只消费 `CredentialProvider`，不负责登录。
- 接口与依赖：使用标准库生成 PKCE、打开浏览器和承载单次 loopback 回调；Windows DPAPI
  通过窄接口封装并可在测试中替换；部署环境保留 `env://` 凭据来源。
- 实施顺序：协议与安全策略测试 → OAuth 元数据和 PKCE → 回调与令牌交换 → DPAPI 原子
  存储 → 可持久化刷新 → 管理员 CLI → 只读 smoke 集成 → 文档和全量验证。
- 验证计划：逐任务红绿测试、后端全量 pytest、Ruff、harness 基线与自检、脱敏扫描；
  真实 smoke 仅在用户完成官方浏览器授权后单独执行。
- 技术风险：腾讯 OAuth 元数据或动态注册契约可能与标准存在差异；实现必须失败关闭并通过
  注册配置适配，不得在核心模块写腾讯条件分支。
- 真实交接门禁：授权与 smoke 都要求当前任务另行授权、管理员在场并显式设置外部网络开关；
  smoke 还要求登记的 `westock` server 和所选 `data_search`/`data_minute`/`data_quote` tool 分别启用，
  本机凭据必须显式使用 `--credential-source local`。不得读取或复用 WorkBuddy 凭据。

## Implementation Report

- 改动摘要：Task 1–6 已实现固定 Registry OAuth origin、受限 form POST、严格元数据与
  PKCE、单次 loopback 回调、当前用户 DPAPI 原子存储、授权服务、刷新持久化、管理员 CLI
  和显式本机凭据 smoke。真实验收阶段补充了供应商无关的标准 text JSON 提升、按已解析
  subject 选择行情记录、管理员来源 literal、地域/币种推导和当日快照精度标记；契约见
  ADR 0020。
- 自审：确认 OAuth 成功不修改 server/tool enablement 或审批版本；smoke 只允许
  `tools/list`、`data_search`、`data_minute`、`data_quote`；核心 Python 无 provider 条件分支；生产
  `env://`/Secret Manager 优先且不回退本机 DPAPI；不读取或复用 WorkBuddy 凭据。
- 验证：2026-07-23 离线聚焦、后端全量、Ruff、四个 harness、敏感字段/provider 扫描和
  whitespace 检查全部通过；独立完整 diff 复审在修复 refresh 表单、OAuth 扩展字段兼容、
  DPAPI 输入缓冲清零和 refresh 响应严格解析后给出 `Ready to merge: Yes`。完整证据见
  `.superpowers/sdd/oauth-task-7-report.md`。
- 实际使用的 skill：`codex-engineering-workflow`、`verification-before-completion`；
  Task 1–6 的 TDD 与 review 证据见各 task report。
- 验证命令与结果：
  - OAuth、MCP 映射、网络与 Registry 聚焦 pytest：`421 passed in 8.98s`。
  - 后端全量 pytest：`1323 passed, 1 warning in 39.46s`；唯一警告为既有
    Starlette/httpx 弃用警告。
  - `ruff check .`：`All checks passed!`；另有一条遍历既有不可访问 pytest 临时目录的
    `os error 5` 警告，退出码为 0。
  - harness：基线 `56` 文件、自测 `22` 项、stop hook `3` 项、product-flow runner
    自测 `25` 项，均退出 0。
  - 敏感字段与 provider 分支扫描均 0 匹配；`git diff --check` 退出 0，仅报告 LF→CRLF
    工作树提示。
- 真实验收：管理员已通过腾讯官方页面完成 OAuth；本机凭据状态为 `valid`。在显式网络开关
  和已启用的只读登记项下，真实 `data_search` 返回 `ok`（716 bytes），真实
  `data_search → data_quote` 返回 `ok`、解析证券代码 `sz002594`（合计 2470 bytes）。
  输出未包含价格、正文、token、授权头或账号信息，也未调用任何写工具。
- 分钟行情扩展验收：在全量离线门禁通过后，真实
  `data_search → data_minute` 返回 `ok`，解析证券代码 `sz002594`、市场时间
  `2026-07-23T07:30:00Z`，合计 22226 bytes。输出未包含价格、正文、token、授权头或
  账号信息。真实序列通过全部行严格递增、固定四 token、日期/分钟和有限十进制映射校验；
  当前休市时它会按 freshness 保持过期，不能被请求时间冒充为实时数据。
- 分钟行情扩展的离线验证：后端全量 `1351 passed, 1 warning`；最终独立复审定向回归
  `92 passed`；Ruff、四组 harness、provider 分支扫描、敏感字面量扫描和
  `git diff --check` 均通过。唯一 warning 仍是既有 Starlette/httpx 弃用提示。
- 未运行项与原因：生产 Secret Manager 注入和实际部署运行未执行；本次只验收管理员本机
  DPAPI 路径。
- 剩余风险：腾讯远端 schema、OAuth metadata 和工具行为仍可能未来漂移；审批指纹、固定
  origin 和失败关闭会阻止静默接纳，届时需重新审查并批准配置。`data_quote` 仍只返回
  交易日；新增批准的 `data_minute` 使用固定四 token 分时序列组合交易日与 `HHMM`，
  可提供分钟精度市场时间。是否满足“当前价格”仍由请求 freshness 判断，过期或休市行情不会
  被请求时刻冒充为新鲜数据。

## Acceptance Review

- 验收结果：Accepted。离线门禁、腾讯官方浏览器 OAuth、本机凭据状态、日期快照和分钟行情
  的只读真实 smoke 均通过。
- 验收证据：Task 1–6 reports、`.superpowers/sdd/oauth-task-7-report.md`、ADR 0020，
  以及本任务记录的脱敏真实输出。
- 未通过项：无；生产 Secret Manager/部署验收不属于本机管理员 OAuth 任务范围。
