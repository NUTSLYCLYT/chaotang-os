# 任务：锦衣卫通用公共证据路由

## Status

Implemented

## Product Definition

- 用户确认：2026-07-22，用户选择方案 C：统一缺数协议与按事实类别路由的可信公共数据源；确认仅使用免费、合法、公开可访问的来源，全球覆盖，新闻在质量门槛内优先最新发布内容；确认设计规格可以进入实现计划。
- 问题：当前锦衣卫仅有 Wikidata 与 Wikimedia 来源，且是否发起调查完全依赖司级 Agent 自主判断；涉及实时行情、新闻或社会公开事实的旨意可能不请求证据。
- 目标用户：需要基于可核验公共事实获得回奏的上书房用户。
- 目标：当司级结论依赖缺失、过期或未被现有证据可靠覆盖的外部事实时，系统必须发起 `NEEDS_DATA`；锦衣卫按事实类别从经批准的来源获取、冻结并返回带出处的事实，由原司级 Agent 形成意见。
- 非目标：让锦衣卫形成业务结论；接受任意用户或模型提供的 URL；使用个人账号、绕过付费墙或验证码；执行交易、购买、申请或持续监控。

## Acceptance Criteria

- [x] 司级 Agent 的结论若依赖缺失、过期或未覆盖的外部事实，必须以结构化 `NEEDS_DATA` 请求补证，不能以泛化建议替代事实结论。
- [x] 已有史馆证据在时效和覆盖上足够时，不发起外部读取。
- [x] 锦衣卫只返回可追溯事实、来源、获取时间、适用时效、质量等级与限制；原司级 Agent 是唯一形成业务意见的节点。
- [x] 证据来源按事实类型从不可变注册表选择；请求不得接受任意 URL。
- [x] 通用 MCP 审批契约可登记行情、公司披露/监管、新闻、社会公开数据与百科/实体消歧能力；首个配置候选仅为默认 disabled 的腾讯行情查询。
- [x] 官方、监管、交易所和原始公告优先；新闻只可作为事件线索或交叉确认；百科不得单独支撑时效性或高风险结论。
- [x] 查不到、证据冲突、来源不可用或证据不足时，回奏明确说明限制与已查来源，不编造且不把未证实内容作为结论依据。
- [x] 所有新增外部读取受 HTTPS、域名、参数、重定向、响应大小、速率与超时控制，并保留调查审计记录。

## Delivery Constraints

- 范围：锦衣卫证据协议、司级缺数判定、来源注册与编排、调查审计、回奏证据引用及相关测试和文档。
- 兼容性：保留锦衣卫仅由司级发起、每司最多一次恢复、同一旨意全局调查预算、史馆与锦衣卫分库、只读调查 API 的既有边界。
- 风险与限制：只可使用免费且合法的数据源，不使用付费订阅、付费 API 或个人凭据；经管理员
  批准的 MCP 可使用部署侧共享专用服务账号执行只读查询。来源覆盖不限制地域。新闻优先使用
  最新的可验证发布内容，但仍须满足来源质量与安全限制；外部网络默认必须继续失败关闭。
- 技能计划：`brainstorming`（已使用）；进入实现前按仓库工程规范补充最小必需设计、计划、测试与验证流程。
- Codex-only：否。

## Affected Modules

- 模块：候选模块“司级缺数判定”；候选模块“锦衣卫事实类型与来源注册”；候选模块“调查编排与证据质量”；候选模块“回奏证据与调查台”。
- 允许路径：`backend/app/agents/bureaus/`、`backend/app/agents/evidence_protocol.py`、
  `backend/app/jinyiwei/`、`backend/app/shiguan/`、`backend/config/jinyiwei_mcp.yaml`、
  对应 backend/frontend 测试、`ARCHITECTURE.md`、`backend/AGENTS.md`、ADR 0018 与本任务。
- 依赖模块：现有 `backend/app/agents/evidence_protocol.py`、`backend/app/jinyiwei/`、史馆证据引用、`frontend/src/app/jinyiwei/`。

## Technical Plan

- 架构边界：司级显式缺数；锦衣卫史馆优先，只对缺失/过期事实槽位调用管理员批准的只读 MCP，
  再降级到登记公开 API/Wikimedia；原司级形成结论，采用证据随回奏版本化归档。
- 接口与依赖：`DataScope`、`SourceType.MCP`、`McpToolApproval`、
  `historical_evidence_by_fact` 与 schema v3 有序采用批次；MCP 使用固定 Streamable HTTP
  客户端、部署侧凭据和确定性实体/字段映射。
- 实施顺序：严格缺数契约 → schema v2/v3 → 史馆优先 → MCP 注册/凭据/客户端/映射 →
  腾讯候选离线 E2E → 已采用归档 → 脱敏 smoke 与全量验证。
- 验证计划：全部常规测试离线；backend pytest/Ruff、frontend test/lint/typecheck/build、
  harness 自检、安全扫描及 diff check。真实 smoke 必须另行授权且不作为离线通过的替代品。
- 技术风险：真实服务 schema、条款、稳定性、可再分发性及共享账号生命周期仍需部署前验证；
  synthetic fixture 不构成厂商保证，不能以通用网页抓取替代来源注册。

## Implementation Report

- 改动摘要：Task 1–9 已完成代码与离线验证阶段。严格事实依赖把缺失、过期或未覆盖的事实路由
  到 `NEEDS_DATA`；锦衣卫按史馆优先、MCP/公开来源补缺执行，保存当前与历史证据；腾讯自选股
  仅作为默认 disabled 的配置候选。采用证据按原司级选择顺序写入史馆不可变快照，锦衣卫
  schema v3 保存精确有序采用批次并支持 PENDING/CONFIRMED 对账。
- 安全边界：MCP 只允许管理员登记、发现 schema 指纹复核的 `READ_ONLY` 工具；共享专用服务
  账号凭据只从部署环境读取。核心 Python 没有腾讯/StockBuddy/provider 分支；通达信/TDX
  明确不接。smoke CLI 默认拒绝，只接受登记 server ID 与 `data_search`/`data_quote`，输出
  固定脱敏元数据。
- 验证：常规测试全部离线。腾讯 fixture 是基于本机已安装 WorkBuddy
  `connector-westock-mcp/SKILL.md` 的工具名观察形成的 synthetic、sanitized JSON-RPC
  契约样本，不是认证后的 `tools/list`、真实行情证据或厂商保证。
- 实际使用的 skill：`brainstorming`、`writing-plans`、`test-driven-development`、
  `subagent-driven-development`、`codex-engineering-workflow`。
- 验证命令与结果：Task 1–8 的逐项实现与独立审查证据见 `.superpowers/sdd/`；Task 9 的
  backend、frontend、harness、安全扫描与 diff check 结果见
  `.superpowers/sdd/archive-first-task-9-impl-report.md`。
- 未运行项与原因：认证后的腾讯 MCP 真实只读 smoke 未运行。当前没有针对真实网络和凭据读取
  的单独授权，仓库候选配置也保持 disabled；本次没有读取真实凭据、账号、私人日志或公网响应。
- 剩余风险：真实服务 schema、服务条款、稳定性与再分发限制仍需在合法共享专用服务账号配置
  完成后另行验证；未完成真实验证前不得把腾讯候选宣称为可用生产数据源。
- Task 9 独立审查返工：已把产品状态修正为仓库合法的 `Implemented`；smoke 对
  `data_quote` 的隐式 resolver 重复执行窄 allowlist，强制精确 `data_search` 且 enabled /
  `READ_ONLY`，恶意 `portfolio` resolver 在 discovery 前失败关闭。前端畸形成功响应测试改为
  注入内存 `Response` 与确定性调度/取消函数，目标组连续 20 轮及全量 105 项通过；保留审查
  首轮 104/105 失败记录，不以重试覆盖。
- Task 9 完成前复验继续发现同类锦衣卫 flaky：纯详情契约拒绝用例为 12 个 body 反复启动本地
  HTTP stub，隔离 30 轮复现 1 次 `network` 抢先于 `unknown`（1120ms）。RED 证明锦衣卫
  读客户端忽略注入；GREEN 为 `JinyiweiReadOptions` 增加生产默认值不变的
  `fetchImpl`/`scheduleTimeout`/`cancelTimeout`，纯解析用例改为内存响应，保留专门的真实
  HTTP URL/查询/ID 编码测试。原失败目标连续 20 轮通过；修复后首轮前端全量 106 项通过。
  随后的完成门禁全量分别为 103/106、104/106、105/106，失败漂移到仍依赖真实本地 HTTP
  的既有用例；原生 loopback 探针 300 轮复现 1 次 `ETIMEDOUT`。本轮不提高生产超时、不重试
  网络错误，也不把这些失败重分类为通过；完整证据见 Task 9 implementation report。

### 2026-07-23 backend final-review remediation

- 整包缓存改为史馆解析之后才可命中，且只缓存 `RESOLVED`；`PARTIAL` 会在下一次调查重新查询史馆和已恢复来源。
- MCP 管理员配置的逐分钟限流与逐调用 TTL 已进入运行策略。限流按进程内 server/tool 隔离、线程安全原子预占，失败调用计数；多进程不宣称共享额度。
- MCP 调用缓存键绑定 server/tool、approval version、确定性 mapping 与严格参数规范化哈希，不含凭据；TTL 取服务配置与事实 freshness 的最小值，过期不命中。
- 错误保留为稳定脱敏分类；schema v4 持久化逐调用审计，仅记录审批版本、耗时、参数哈希、响应字节数/哈希、映射结果和缓存命中，不保存请求/响应正文或秘密。
- 新鲜验证：锦衣卫相关 `506 passed`；后端全量 `1137 passed`；Ruff `All checks passed`。全程离线，未读取凭据或运行库，未提交。

### 2026-07-23 frontend final stability remediation

- 前端测试中的最后一个本地 HTTP server 已移除；锦衣卫 URL、查询与 ID 编码改由注入
  `fetchImpl` 观察请求，史馆纯解析用例直接使用内存响应，Abort 超时由注入调度器与
  `AbortSignal` 验证。`frontend/src/**/*.test.ts` 的 `createServer` 为零。
- 最终 backend schema v4 `model_dump(mode=json)` fixture 跨端确认
  `DataScope`、`SourceType.MCP`、当前/历史证据、访问溯源、`call_audits`，并确认史馆
  pack/investigation/evidence 不可变引用绑定；锦衣卫与史馆页面源码守卫覆盖对应展示字段。
- 首次前端全量为 `113 passed, 0 failed`；随后 PowerShell `1..20` 每轮完整执行
  `npm test`，20/20 均为 `113 passed, 0 failed`。完整证据见 Task 9 implementation
  report 与 final remediation 记录。

## Acceptance Review

- 验收结果：Pending（等待最终独立审查；真实 MCP smoke 不属于本轮离线验收）
- 验收证据：Task 1–9 离线实现、逐项审查与全量命令记录；真实 MCP 认证响应尚未验证，不能把
  synthetic fixture 当作外网验收证据。
- 未通过项：尚未确认真实腾讯服务 schema、条款、稳定性与再分发边界。
