# 任务：确定性证据编排与行情降级

## Status

Implemented

## Product Definition

- 用户确认：用户于 2026-07-24 确认采用“确定性事实计划加证据保底答复”的最优方案。
- 问题：股票 MCP 已能取得真实行情，但多个模型严格 JSON 节点中的任一个格式漂移，仍会使整条下旨链路返回通用模型失败。
- 目标用户：通过 `/study` 查询大陆股票最新价的用户，以及维护证据链路的开发者。
- 目标：把大陆股票最新价的缺数判断和事实范围改为系统确定生成；证据取得后即使后续模型表达失败，也返回安全、可核验且采用真实证据的答复。
- 非目标：不迁移史馆旧库；不新增交易或其它写工具；不在本阶段实现新闻、统计、百科、监管文件的具体编译器；不扩大 BSE provider 能力。

## Acceptance Criteria

- [x] 明确的大陆股票最新价旨意生成唯一规范事实：`MARKET_QUOTE + LAST_PRICE + CN + CNY + number`，不依赖模型返回 `NEEDS_DATA`。
- [x] 公司名称和显式大陆证券代码均走 provider-neutral 身份解析，不存在公司到 provider code 的生产字面量映射。
- [x] 明确港股、美股、B 股和其它境外市场请求不被静默改写为大陆 A 股。
- [x] 史馆仍优先；资料缺失或过期时才调用管理员批准的只读 MCP。
- [x] 完整锁定的史馆行情证据确定性复用且不调用提取模型；锁定身份不匹配时失败关闭。
- [x] 调查成功后，司级、部级或丞相表达节点任一格式失败都可使用已验证证据降级，并返回 HTTP 200。
- [x] 调查失败时不生成价格；原因收敛为稳定错误且不泄露模型、MCP 或凭据正文。
- [x] 非行情旨意继续沿用现有证据协议，行为不变。
- [x] 离线聚焦测试、后端全量 pytest、Ruff、四组 harness、diff check 和敏感信息扫描通过。
- [x] 受支持 canonical Mainland `LAST_PRICE` 的结构合法模型输出只要改写价格、时间、
  来源、市场、指标或最终建议，就回退确定性权威输出并记录对应层降级。
- [x] adopted selection 与 renderer 对当前 pack 的实际选择完全一致；stale、
  `CONTRADICTS`、`UNVERIFIED` 或未批准来源条目不得因同 pack 另有合格条目而进入 adopted 状态。
- [x] 真实 `/study` 同一句比亚迪最新价旨意连续十次均取得非零证据，不出现通用 502，且不主动扩展港股或额外指标；缓存命中不得冒充新的外部调查。

## Delivery Constraints

- 范围：第一阶段只交付大陆股票 `LAST_PRICE` 端到端闭环和可复用事实计划接口。
- 兼容性：复用现有 `AgentEvidenceSession`、锦衣卫协调器、provider-neutral `InstrumentRef`、来源审批、证据验证和冻结契约。
- 风险与限制：不得读取或修改运行态数据库；离线测试不得使用真实网络或凭据；真实验收只允许既有只读模型/MCP 调用。
- 技能计划：`codex-engineering-workflow`、`brainstorming`、`writing-plans`、`test-driven-development`、`record-decision`、`subagent-driven-development`、`requesting-code-review`、`verification-before-completion`。
- Codex-only：是；禁止 Claude CLI、Claude runner 与 `gstack-claude`。

## Affected Modules

- 模块：事实计划编译、投资司证据编排、分层表达降级、稳定错误、测试与架构契约。
- 允许路径：`backend/app/agents/`、必要的 `backend/app/jinyiwei/` 接口适配、对应 `backend/tests/`、`docs/product/tasks/`、`docs/superpowers/specs/`、`docs/superpowers/plans/`、`docs/decisions/`、`ARCHITECTURE.md`、`backend/AGENTS.md`、`scripts/check_harness.mjs`。
- 依赖模块：既有行情意图、A 股身份解析、锦衣卫协调器、史馆来源、MCP 来源、证据验证与下旨 API。

## Technical Plan

- 架构边界：通用 `FactPlanCompiler` 只产生 provider-neutral 事实需求；具体 MCP symbol 只允许由来源 adapter 产生。
- 接口与依赖：计划结果区分 `NOT_APPLICABLE`、`PLANNED`、`REJECTED`；行情计划固定规范字段；已验证证据可生成不引入新事实的保底意见。
- 实施顺序：先建立计划类型与失败测试，再接入投资司预调查，然后补司级、部级和丞相降级，最后同步 ADR、操作文档和 harness。
- 验证计划：每个模块遵循 RED→GREEN→REFACTOR；最后执行全量离线门禁，再在已有明确授权范围内执行十次真实只读验收。
- 技术风险：实体提取必须失败关闭；降级答复只能使用验证后的证据；不得因降级隐藏调查失败或伪造“实时”语义。

## Implementation Report

- 改动摘要：Tasks 1–3 已交付规范事实计划、预编译史馆优先调查、确定性行情 renderer、
  支持路径静态路由，以及司级、部级和丞相最终汇总的分层降级。Task 4 完成端到端矩阵审计，
  接受 ADR 0025，并把规范事实、renderer 证据门禁、公司到 provider code 映射禁令和必需
  交付文件固化到 repository harness。Task 5 把 renderer 设为三层事实正文的权威来源，
  并要求节点采用的证据 ID 精确等于 renderer 从合格证据中选出的 ID，关闭格式正确但语义
  篡改和“其它证据解析成功、选中证据不合格”两类信任边界漏洞。
- 自审：成功路径与 bureau/ministry/finalizer 三个降级路径均只调查一次，采用同一条当前
  有效行情证据并产生精确 node-specific degradation；通用 Agent 不绑定具体 provider，
  不读 `backend/data`，未扩大或声称 BSE provider 覆盖。
- 验证：离线端到端四格矩阵、语义篡改和不合格选中证据用例均通过；后端全量
  `1677 passed, 1 warning`；Ruff、
  production harness、harness self-test、共享 Stop hook self-test、product-flow runner
  self-test、diff check 和静态安全扫描通过。唯一 warning 是已知的 FastAPI TestClient
  `StarletteDeprecationWarning`。
- 实际使用的 skill：`codex-engineering-workflow`、`test-driven-development`、
  `verification-before-completion`。
- 验证命令与结果：精确命令、harness RED→GREEN 和输出计数记录在
  `.superpowers/sdd/deterministic-task-4-report.md`。
- Task 5 语义边界：renderer 在投资司、户部、丞相三层均为事实权威；模型只有逐字复述
  权威 opinion 与 IDs 时才可采用，最终建议固定为三条安全建议。adopted gate 复用
  renderer eligibility/selection，拒绝在 resolved pack 中选中的不合格证据。
- Task 5 验证：focused RED 曾为 `7 failed, 1 passed`，修正投资司 fixture 后隔离 RED
  为 `1 failed`；实现后 focused 为 `8 passed`，相关 agent broad suite 为
  `424 passed, 1 warning`，最终 targeted broad suite 为 `445 passed, 1 warning`，
  Ruff 与 diff check 通过。完整记录见
  `.superpowers/sdd/deterministic-task-5-report.md`。
- 真实验收：重启本地后端并保留显式公网与本机只读凭据开关后，以明确 UTF-8 解码连续
  调用 `/api/v1/decrees/chancellor` 十次。十次均为 HTTP 200、经过 `户部·投资司`，
  司级/部级/丞相事实正文完全一致，包含 CNY、行情时间和来源，使用固定三条安全建议，
  未扩展港股或额外指标。十次均复用缓存，因此路径均没有伪称新的 `锦衣卫（调查）`。
  公共响应不暴露证据 ID；非零采用由已独立审查并覆盖测试的 canonical renderer/adoption
  服务器门禁强制保证。最初另有一批 HTTP 200 诊断请求因 PowerShell 默认错误解码中文而
  作废，未计入上述十次结果。
- 剩余风险：运行态史馆旧库仍未迁移；验收日志中的 traceback 均为
  `ShiguanStorageError`（召回/归档失败关闭），未出现 `model_unavailable`、凭据标记或原始
  MCP payload 标记。该迁移仍是独立运维事项，不影响本次行情成功响应。

## Acceptance Review

- 验收结果：通过。离线门禁、独立最终复审和真实只读十次 `/study` 均满足本任务标准。
- 验收证据：`.superpowers/sdd/deterministic-task-1-report.md`、
  `.superpowers/sdd/deterministic-task-2-report.md`、
  `.superpowers/sdd/deterministic-task-3-report.md` 和
  `.superpowers/sdd/deterministic-task-4-report.md`、
  `.superpowers/sdd/deterministic-task-5-report.md`。
- 未通过项：无。史馆旧库迁移作为已知独立运维风险保留，不纳入本任务范围。
