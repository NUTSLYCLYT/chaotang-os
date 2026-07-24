# 任务：股票行情旨意路由与证据协议恢复

## Status

Ready

## Product Definition

- 用户确认：用户于 2026-07-24 确认采用已批准设计中的“模型分流加窄范围确定性护栏，并允许一次协议纠正”方向。
- 问题：同一句“帮我看看比亚迪的股票价格”曾被模型误判到军机处或吏部；司级模型又可能在没有行情证据时直接返回 `READY`，证据协议失败关闭后由 HTTP 层显示通用不可用错误。
- 目标用户：通过本地下旨入口查询证券行情的用户，以及维护、审计路由和证据链路的开发者。
- 目标：保留模型通用路由能力，使明确证券行情查询稳定进入户部投资司，并在首次无证据 `READY` 时只纠正一次，经既有锦衣卫只读调查取得、引用并采用满足时效策略的行情证据。
- 非目标：不迁移史馆旧库，不建设通用规则引擎，不绑定行情提供方，不新增交易、持仓、自选股修改或其它写工具，不放宽网络、凭据、证据绑定或失败关闭边界。

## Acceptance Criteria

- [x] 明确行情意图才规范化为 `single + 户部`，普通产品价格、人员投资培训、公司新闻和年度预算不误命中。
- [x] 户部明确行情旨意优先且只出现一次投资司；非行情路由和司列表保持原值与顺序。
- [x] 第一次无证据 `READY` 仅因 `unsupported_factual_dependency` 被拒绝时纠正一次；其它错误、再次不合规和调查后第二次缺数继续失败关闭。
- [x] 离线端到端图回归覆盖错误有效丞相路由、投资司、协议纠正、`NEEDS_DATA`、调查、引用 `READY`、部级综合和丞相最终汇总，并采用 `MCP + MARKET_QUOTE` 证据。
- [x] 行情证据保留早于查询时间的真实 `as_of`，共享最新可得策略仍判定为新鲜；完整流转路径包含且只包含一次“锦衣卫（调查）”。
- [x] ADR、架构、后端操作规范和 harness 同步记录 provider-neutral 护栏、single 最坏 12 次模型调用及不变的安全边界。
- [x] 后端全量测试、Ruff、四组 harness、diff check 和 provider/secret 静态扫描全部离线通过。
- [x] 公司名称、法定全称和显式代码规范化为 SSE/SZSE/BSE A 股 `InstrumentRef`，不使用公司到 provider code 的生产字面量映射，歧义失败关闭。
- [x] 史馆仍优先；只有相关资料缺失或过旧时才进入已批准的只读 MCP，且身份缓存与行情 freshness 分离。
- [x] `LAST_PRICE` 旨意不因 PE/PB/市值等非必需指标缺失而失败；身份、市场范围和 provider 能力失败不生成伪证据，只保留稳定错误码。
- [x] 腾讯配置只声明已证明的 SSE/SZSE patterns；BSE 在另一 provider 能力单独证明和登记前失败关闭。
- [x] A 股聚焦测试、后端全量测试、Ruff、四组 harness 与 diff check 在当前改动后离线通过。
- [ ] 经单独授权的真实模型与只读 MCP 验收返回 HTTP 200、采用非零行情证据并保持日志脱敏。

## Delivery Constraints

- 范围：实现批准的行情路由恢复与大陆 A 股解析计划 Tasks 1–6；真实网络、OAuth、MCP 与 `/study` 验收仍须单独授权。
- 兼容性：既有严格 JSON/schema/部门校验先于行情规范化；未命中行情意图时公共返回边界保持不变。
- 安全：测试不得读取 `backend/data`、真实网络、真实凭据或私有 dotenv；通用策略和协议代码不得包含提供方、端点、OAuth 回调、Bearer/token 字面量或 provider 条件分支。
- 预算：单部门最坏同步模型调用上限由 11 增至 12；调查次数、恢复次数、30 秒外部工作和六次抽取预算不变。
- 技能计划：`codex-engineering-workflow`、`test-driven-development`、`record-decision`、`verification-before-completion`。
- Codex-only：是；禁止 Claude CLI、Claude runner 与 `gstack-claude`。

## Affected Modules

- 模块：行情意图策略、丞相图、六部/司级 Agent、证据协议、离线测试与操作契约。
- 允许路径：`backend/app/agents/market_intent.py`、`backend/app/agents/chancellor/graph.py`、`backend/app/agents/ministries/agent.py`、`backend/app/agents/bureaus/profiles.py`、`backend/app/agents/evidence_protocol.py`、相关测试文件、`docs/decisions/0023-market-decree-routing-and-bounded-protocol-correction.md`、`ARCHITECTURE.md`、`backend/AGENTS.md`、`scripts/check_harness.mjs` 与本任务文件。
- 行情意图纯策略：`backend/app/agents/market_intent.py`。
- 丞相路由、户部选司和投资司能力：`backend/app/agents/chancellor/graph.py`、`backend/app/agents/ministries/agent.py`、`backend/app/agents/bureaus/profiles.py`。
- 有界证据协议纠正：`backend/app/agents/evidence_protocol.py`。
- 离线测试：对应策略、丞相图、六部、司级和证据协议测试。
- 操作契约：ADR 0023、`ARCHITECTURE.md`、`backend/AGENTS.md` 与 `scripts/check_harness.mjs`。
- 大陆 A 股身份与 adapter：`backend/app/jinyiwei/instruments.py`、`backend/app/jinyiwei/mcp/contracts.py`、`backend/app/jinyiwei/mcp/mapping.py`、`backend/app/jinyiwei/sources/mcp.py`、`backend/app/jinyiwei/coordinator.py`、`backend/config/jinyiwei_mcp.yaml` 及对应测试。
- 大陆 A 股操作契约：ADR 0024、批准的 design/plan、`ARCHITECTURE.md`、`backend/AGENTS.md`、本任务与 `scripts/check_harness.mjs`。

## Technical Plan

- 先以纯函数判定“证券市场词 + 报价查询词”，只在既有严格校验之后规范化丞相路由和户部司列表。
- 只捕获第一次 `_parse_ready(...)` 的 `unsupported_factual_dependency`，追加静态 `NEEDS_DATA` 纠正消息一次，不携带被拒模型响应。
- 用 fake coordinator/session 与真实 `AgentEvidenceSession` 完成离线全图回归；证据 fixture 使用 `SourceType.MCP`、`FactCategory.MARKET_QUOTE` 和 `as_of < retrieved_at`，并经过共享 freshness 函数。
- 更新 ADR 与操作文档后执行聚焦测试、全量 pytest、Ruff、四组 harness、diff check 与静态敏感信息扫描；离线门禁通过前不执行真实验收。
- 用 provider-neutral `InstrumentRef` 与 metric-aware MCP approval 解析大陆 A 股；显式代码优先，名称检索有界，歧义和未证明的 BSE provider 能力失败关闭。
- 同一调查内隔离并复用已验证身份；短名到尚未见过的法定全称做一次 original-only 安全复核，行情仍按事实 freshness 单独判定。
- 增加协调器级 price-only 与稳定失败语义回归，并由 harness 检查设计/计划/ADR、核心类型、公司硬编码映射和腾讯 BSE 越权声明。

## Implementation Report

- 改动摘要：Tasks 1–4 已在工作树中接入 provider-neutral 行情策略、丞相/户部边界护栏与一次协议纠正；Task 5 新增完整离线图回归、ADR 0023、架构/后端操作契约和 harness 必需文件。
- 自审：Task 5 未修改生产逻辑；新增回归使用 fake coordinator 和不可变 evidence pack，且断言纠正消息不包含被拒 `READY` 正文。尚未发现 Tasks 1–4 的真实集成缺口。
- TDD RED：`.venv\Scripts\python.exe -m pytest tests/test_chancellor_graph.py::test_market_quote_graph_corrects_ready_then_adopts_latest_available_evidence -q` 返回 `1 failed`；缺失 `_resolved_market_pack` 被协调器边界收敛为 `evidence_unavailable`，恢复未发生，后续响应在部级 schema 校验失败。
- TDD GREEN：补齐最小测试 fixture 后同一命令返回 `1 passed`。
- 实际使用的 skill：`codex-engineering-workflow`、`test-driven-development`、`record-decision`、`verification-before-completion`。
- 验证命令与结果：
  - 指定四文件 pytest：`308 passed in 19.78s`；`ruff check tests/test_chancellor_graph.py`：PASS。
  - 后端全量 pytest：`1406 passed, 1 warning in 104.51s`；警告为现有 Starlette/httpx 弃用提示。`ruff check .`：PASS。
  - `node scripts/check_harness.mjs`：PASS（63 个基线文件）；`--self-test`：PASS（22 项）；stop-hook self-test：PASS（3 项）；product-flow runner self-test：PASS（25 项）。
  - `git diff --check`：PASS，仅输出工作树 LF→CRLF 提示。
  - 通用策略/协议新增行 provider、endpoint、OAuth、Bearer/token 和 provider 分支扫描：零匹配；显式排除 `backend/data` 的 Git 新增行及未跟踪文件疑似真实凭据/回调值扫描：零匹配。
- 未运行项与原因：真实 Step 6 未运行；按任务分工由 root 在离线门禁之后执行，且需要真实网络、模型和本机凭据的单独授权。
- 剩余风险：真实模型可用性、HTTP 结果与已批准只读 MCP 运行态只能由 Step 6 验收；本离线任务不对此作通过声明。
- 大陆 A 股 Task 6 离线实现：已用失败回归证明协调器会把
  `instrument_not_found`、`instrument_ambiguous`、`provider_capability_missing` 和
  `market_out_of_scope` 错误折叠为 `source_unavailable`；最小白名单修复后协调器测试通过。
  ADR 0024 与 harness 静态边界已补齐；下列新鲜门禁证明离线范围完成，但不据此宣称真实
  外部验收完成。
- 大陆 A 股 Task 6 新鲜离线证据：
  - TDD RED：协调器文件首次运行 `4 failed, 38 passed`，四个新身份/能力错误被折叠为
    `source_unavailable`；harness 自测首次因缺少 `mainlandSharePolicyErrors` 以
    `ReferenceError` 失败。
  - TDD GREEN：协调器 `42 passed in 3.59s`；harness 主检查与自测通过。
  - MCP 契约聚焦命令使用其实际契约覆盖文件 registry/mapping/source 等七个测试文件，
    结果 `336 passed in 9.71s`。
  - 后端全量：`1520 passed, 1 warning in 68.33s`；警告是现有
    Starlette/httpx 弃用提示。`ruff check .`：PASS。
  - 四组 harness：主检查 67 个基线文件、自测 30 项、stop-hook 3 项、product-flow runner
    25 项，全部 PASS。`git diff --check`：退出 0，仅有工作树 LF→CRLF 提示。
  - provider 分支、公司→代码字面量和腾讯 BSE pattern 静态扫描：零匹配。
- Task 6 未运行项：真实 OAuth/MCP/BSE capability probe、真实模型与 `/study` 均未运行；
  它们需要当前任务外的单独授权，离线 fixture 不构成这些项目的通过证据。

## Final Cross-task Review Evidence

- Explicit HK/US/B-share requests now fail closed before discovery, and Tencent
  quote/minute approvals are CN-only with SSE/SZSE patterns.
- Fresh Shiguan evidence matches the same mainland security by short name, legal
  name, or explicit ticker and prevents an external MCP call.
- Discovery, resolver, and quote/minute calls receive the remaining absolute
  deadline budget; invalid resolved quotes and stale-only evidence use the safe
  `quote_unavailable` and `stale_evidence_only` reasons.
- Natural `多少钱`/`多少` price requests select exactly `LAST_PRICE`; strict
  `InstrumentRef` name/ticker invariants and executable-plan test paths are covered.
- Final-review TDD: scope/invariants/price `22 failed, 42 passed` to `64 passed`;
  Tencent approval `1 failed` to `1 passed`; stable errors `2 failed` to `2 passed`;
  deadline `2 failed` to `2 passed`; Shiguan identity `3 failed` to `3 passed`.
- Fresh offline gates: focused `477 passed`; backend full `1550 passed, 1 warning`;
  Ruff PASS; harness `67/30/3/25` PASS; `git diff --check` exit 0.
- Real OAuth/MCP/model/`/study` and BSE capability validation were not run. The task
  therefore remains `Ready` with its live acceptance item pending.

## Acceptance Review

- 验收结果：行情路由恢复与大陆 A 股 Tasks 1–6 的离线门禁 PASS；真实 OAuth/MCP、BSE
  capability、真实模型与 `/study` 验收 Pending，因此任务仍保持 `Ready`。
- 验收证据：既有端到端 RED/GREEN，加上大陆 A 股协调器 RED/GREEN、336 项聚焦测试、
  1520 项后端全量测试、Ruff、四组 harness、diff check 与三项边界扫描。
- 未通过项：没有离线未通过项；所有真实外部验证均未运行，不能据离线 fixture 推断结果。
