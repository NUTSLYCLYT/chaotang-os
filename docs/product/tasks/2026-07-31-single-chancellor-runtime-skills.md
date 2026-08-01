# 任务：单丞相多 Runtime Skill

> 所有任务必须阅读并遵守 `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`；若任务与该基线冲突，必须标记为 `Blocked`，不得自行变更流程。

## Status

In Progress

## Product Definition

- 用户确认：用户于 2026-07-31 在当前 Codex 任务中确认单丞相多 Runtime Skill 设计。
- 问题：咨询、拟旨和正式办理目前由三张独立图与 API seam 承载，安全隔离正确，但产品运行时把能力表达为不同丞相 Agent，导致身份、授权、上下文和审计语义存在漂移风险。
- 目标用户：在上书房中与同一丞相完成咨询、拟旨和正式下旨的已认证用户，以及维护该运行时的工程人员。
- 目标：在不改变前端和 HTTP 契约的前提下，将现有三个丞相图注册为同一运行时丞相的隔离 Skill。
- 非目标：follow_up 实现、前端改动、Graph 合并、MCP 直连丞相。

## Acceptance Criteria

- [ ] 代码和文档只将产品运行时的丞相定义为一个 Agent。
- [ ] 咨询、拟旨、正式办理表示为三个已启用 Runtime Skill；经营跟进为明确的后续扩展 Skill。
- [ ] Runtime Skill 与开发期 Codex/Claude Skill 在命名、目录和加载路径上明确隔离。
- [ ] 三个现有 API 和前端行为保持兼容。
- [ ] 正式办理仍只能由明确下旨入口和有效一次性拟旨授权触发。
- [ ] MCP 仍只能通过司级证据协议和锦衣卫间接使用。
- [ ] 现有三张 Graph 可以独立测试和演进，不因统一产品身份而被强制合并。
- [ ] 每次运行时调用可审计到 Skill ID、版本、入口、授权与副作用。
- [ ] 真实网页连续成功下旨至少 11 次；每次必须得到正式回奏，且当前用户史馆恰好新增一份 `REPLY`。失败重试不计入成功次数。

## Delivery Constraints

- 范围：只允许修改下列登记路径，不得修改前端、ADR 0028、MCP 配置或无关工作区文件。
- 兼容性：保持现有咨询、拟旨、正式下旨 API 请求/响应契约、三张 LangGraph 拓扑、拟旨一次性授权、六部/司级/军机处办理、锦衣卫证据和史馆归档语义不变。
- 风险与限制：入口必须确定性选择 Skill 并失败关闭；模型建议不得自动切换 Skill；`follow_up` 仅登记为禁用元数据；全部测试离线，不运行真实模型、MCP 或公网 smoke。
- 技能计划：`codex-engineering-workflow`、`executing-plans`、`test-driven-development`、`verification-before-completion`；架构记录使用 `record-decision`。
- Codex-only：是；禁止 Claude CLI、Claude runner 与 gstack-claude。

## Affected Modules

- 模块：产品运行时丞相统一身份、Runtime Skill 注册与调度，以及三个既有丞相 API 的内部调用 seam。
- 允许路径：
  - `backend/app/agents/chancellor_runtime/**`
  - `backend/app/agents/chancellor_draft/authority.py`
  - `backend/app/api/chancellor_consult.py`
  - `backend/app/api/chancellor_drafts.py`
- `backend/app/api/decrees.py`
  - `backend/app/agents/structured_invocation.py`
  - `backend/app/agents/chancellor_draft/graph.py`
  - `backend/app/langgraph_runtime/deepseek_client.py`
  - `backend/tests/test_chancellor_runtime_*.py`
  - `backend/tests/test_chancellor_consult_api.py`
  - `backend/tests/test_chancellor_drafts_api.py`
  - `backend/tests/test_decrees_api.py`
  - `backend/AGENTS.md`
  - `docs/decisions/0035-single-chancellor-runtime-skills.md`
  - `docs/product/tasks/2026-07-31-single-chancellor-runtime-skills.md`
- 依赖模块：现有 `chancellor_consult`、`chancellor_draft`、`chancellor` Graph，拟旨授权注册表，六部、司级、军机处、锦衣卫、史馆与会计报告现有服务。

## Technical Plan

- 架构边界：新增 `app.agents.chancellor_runtime` 作为唯一产品运行时身份和调度边界；既有三张图保持相互隔离，并通过惰性适配器作为 Skill handler。
- 接口与依赖：以不可变契约定义 Skill ID、版本、入口、上下文、授权、服务白名单、禁止动作和审计；注册表及调度器对未知或不匹配输入失败关闭；API 外部契约不变。
- 实施顺序：先登记 ADR 与 Ready 任务，再以测试驱动实现 Skill 契约/注册表、统一调度器与惰性适配器，随后依次替换咨询、拟旨、正式办理的内部调用 seam，最后执行完整回归与验收。
- 验证计划：运行相关 pytest 与 Ruff、仓库 harness、`git diff --check`，并在最终验收时以 11 个独立进程连续运行关键回归套件。
- 技术风险：统一身份可能意外扩大上下文、服务或副作用权限；通过入口固定选择、每 Skill 最小上下文与 handler 隔离、现有授权先于构图、脱敏错误映射和离线回归控制。

## Implementation Report

- 改动摘要：新增 `backend/app/agents/chancellor_runtime/` 的不可变 Runtime Skill 契约、四项注册表、失败关闭调度器和惰性 Graph 适配器；三个既有 API 在请求及一次性拟旨授权校验后确定性选择 `consult`、`draft_decree` 或 `execute_decree`；`follow_up` 仅登记为禁用元数据。补充运行时、API、授权先于副作用、异常语义和兼容回归测试，并更新 `backend/AGENTS.md`、ADR 0035 与本任务。现有三张 Graph、前端、HTTP 请求/响应契约、ADR 0028、MCP 配置和 `.gitignore` 未由本任务改变。
- 实际改动文件：`backend/app/agents/chancellor_runtime/{__init__,adapters,agent,models,registry,skills}.py`、`backend/app/api/{chancellor_consult,chancellor_drafts,decrees}.py`、`backend/tests/test_chancellor_runtime_{agent,registry}.py`、`backend/tests/{test_chancellor_consult_api,test_chancellor_drafts_api,test_decree_draft_gate,test_decrees_api}.py`、`backend/AGENTS.md`、`docs/decisions/0035-single-chancellor-runtime-skills.md`、本任务文件。工作区中预先存在的 `.gitignore` 以及计划/设计文档保持未提交并被保留。
- 自审：统一运行时只包裹现有 handler Graph，没有合并或复制 Graph 拓扑；三个入口固定选择唯一 Skill；正式下旨仍在构建报告会话、observer、运行时 Agent 或 Graph 前消费并校验当前 owner 的一次性拟旨授权；执行 handler 仍经原六部/司级/军机处、Evidence Protocol、锦衣卫和史馆路径，调度器不接触 MCP 或凭据；调用结果包含 owner、request ID、入口、Skill ID、版本和输出，API 继续使用既有响应模型及脱敏错误映射。
- 实际使用的 skill：`using-superpowers`、`brainstorming`、`test-driven-development`、`executing-plans`、`codex-engineering-workflow`、`record-decision`、`systematic-debugging`、`verification-before-completion`。
- 首次 Task 6 验证（阻塞证据，修复前）：
  - `backend/.venv/Scripts/python.exe -m ruff check .`：PASS，退出码 0，耗时 0.131 秒。
  - `backend/.venv/Scripts/python.exe -m pytest`：FAIL，退出码 1，命令耗时 79.745 秒；pytest 报告 `2082 passed, 1 skipped, 3 failed`（77.53 秒）。失败为 `test_junjichu_case_lifecycle.py` 的未分类 Graph 异常传播及两个 `provider_unavailable` 案件失败码回归，因此当时未更新状态。
  - 四个 harness 命令与 `git diff --check` 均 PASS、退出码 0；耗时依次为 0.182、0.099、0.085、0.135、0.095 秒。
  - 当时关键套件 11 个独立进程均为 `194 passed`、退出码 0，耗时依次为 23.385、23.681、23.740、23.277、23.109、23.049、22.380、22.635、23.150、22.294、22.440 秒；该结果不能覆盖全量 pytest 失败，修复后已从第 1 轮重新计数。
- 回归修复后的最终验证：
  - `backend/.venv/Scripts/python.exe -m ruff check .`：PASS，退出码 0，耗时 0.133 秒。
  - `backend/.venv/Scripts/python.exe -m pytest`：PASS，退出码 0，命令耗时 74.291 秒；pytest 报告 `2091 passed, 1 skipped, 3 warnings`（72.11 秒）。
  - `node scripts/check_harness.mjs`：PASS，退出码 0，耗时 0.184 秒，输出 `agentic-check: 通过 (72 个基线文件)`。
  - `node scripts/check_harness.mjs --self-test`：PASS，退出码 0，耗时 0.116 秒，输出 `agentic-check self-test: 通过 (44 项)`。
  - `node .agents/hooks/check-harness.mjs --self-test`：PASS，退出码 0，耗时 0.138 秒，输出 `Stop hook self-test: 通过 (3 项)`。
  - `node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test`：PASS，退出码 0，耗时 0.103 秒，输出 `product-flow Claude runner self-test: 通过 (25 项)`；只运行自测，没有启动交付模式或 Claude。
  - `git diff --check`：PASS，退出码 0，耗时 0.103 秒；仅有工作区 LF 将在 Git 后续处理时转换为 CRLF 的警告。
  - 关键验收套件在 11 个全新、相互独立的 pytest 进程中连续 PASS；每轮均为 `200 passed, 2 warnings`、退出码 0。第 1–11 轮耗时依次为 23.131、23.329、23.961、24.050、24.770、25.611、26.467、23.770、23.836、23.421、23.668 秒。
- 未运行项与原因：未访问公网、真实模型、真实 MCP、私有 dotenv、生产数据库或生产写入；这些不属于离线验收且未获授权。未提交、推送、合并或部署。
- 剩余警告与风险：pytest 仍报告 Starlette `TestClient`/`httpx` 弃用警告，以及刻意构造无效批准路由的 Pydantic 序列化警告；关键套件每轮各出现同类 2 条警告。它们未导致失败，但依赖升级或测试夹具清理时应另行处理。当前工作区改动保持未提交。

## Acceptance Review

### Final-review audit rework (2026-07-31)

- RED: runtime metadata test failed because `ChancellorInvocationResult` had no
  structured audit; consult/draft API tests failed because no injectable audit
  emission boundary existed; failure-audit test rejected the missing
  `audit_sink` constructor argument.
- GREEN: every successful invocation now yields a sanitized immutable audit
  containing request/owner, entrypoint, Skill ID/version, authorization
  policy/check/result, result and actual side effects. Handler failures emit a
  stable failure code without payloads, graph output, credentials, MCP details
  or exception strings. Consult emits no side effects; draft emits
  `authority_registered` or `authority_revoked` after the action. Formal
  execution passes its pre-archive audit snapshot into the existing Shiguan
  `audited_result` and emits final archive/publication effects after outcome.
- Fresh verification: focused runtime/API/lifecycle suite `146 passed`; Task 5
  formal-flow suite `153 passed, 2 warnings`; focused Ruff checks passed.
- Design boundary: preserving the mandated archive-before-publish order means
  the snapshot passed into Shiguan can contain only effects already completed
  before archive (`authority_consumed`, optional `case_created` and
  `report_prepared`). The final emitted snapshot additionally records
  `reply_archived` and `report_published` after those outcomes; it does not
  pretend those future operations had already succeeded.
- Not run: public network, real model, real MCP, private dotenv, production
  database or production writes. No commit, push, merge or deployment.

### Final-review audit hardening (2026-07-31)

- RED: throwing runtime/API sinks replaced intended results; registry rejection
  produced no audit; `DraftAuthorityRegistry.revoke()` could not distinguish an
  actual removal from a no-op.
- GREEN: all audit emission is best-effort and cannot alter success or intended
  errors. Registry/authorization rejection emits safe resolved metadata (or
  explicit `unresolved` metadata), never calls a handler, and contains no
  payload. Each API emits in success/failure finalization after handler return,
  retaining incrementally completed side effects. Draft revoke now returns a
  backward-compatible boolean and records `authority_revoked` only after a real
  deletion.
- Fresh verification: focused runtime/API/authority/lifecycle suite
  `156 passed, 3 warnings`; Task 5 formal-flow suite `158 passed, 2 warnings`;
  full backend Ruff passed.
- Not run: public network, real model, real MCP, private dotenv, production
  database or production writes. No commit, push, merge or deployment.

### Final P1 failure-audit recovery (2026-07-31)

- RED: `ChancellorSkillInvocationError` exposed no audit snapshot, so execute
  restored the original handler exception while its API-final audit remained
  absent both before and after a lifecycle case was created.
- GREEN: the invocation error now carries the same immutable sanitized failure
  snapshot emitted by the Agent. Execute recovers it before preserving the
  exact original exception propagation, and its best-effort finally emission
  records `authority_consumed` plus `case_created` only when the observer's new
  public read-only property confirms a real case. It never claims report,
  reply-archive or publication effects on these failures.
- Fresh verification: focused runtime/API/lifecycle suite
  `158 passed, 3 warnings`; Task 5 formal-flow suite `160 passed, 2 warnings`;
  full backend Ruff and `git diff --check` passed.
- Not run: public network, real model, real MCP, private dotenv, production
  database or production writes. No commit, push, merge or deployment.

### Uniform audited-failure contract (2026-07-31)

- RED: missing handler, handler-raised runtime errors, Agent/GraphSkillHandler
  invalid results and registry rejection did not all expose the same immutable
  audit attribute; execute recovered the audit but overwrote its precise stable
  code with `execution_failed`.
- GREEN: every exception leaving `ChancellorAgent.invoke()` now exposes a
  sanitized immutable audit. Runtime-owned and registry failures retain their
  sanitized propagation; generic handler failures remain
  `ChancellorSkillInvocationError` and execute may transparently rethrow the
  original cause. All three APIs extract the common audit before mapping.
  Execute finalization preserves the precise stable code and enriches only
  actual `authority_consumed`/`case_created` effects.
- Enumerated coverage: registry/authorization rejection, disabled Skill,
  missing handler, handler-raised `ChancellorRuntimeError`, Agent and
  `GraphSkillHandler` non-dict results, and generic handler exceptions. The
  execute boundary also parameterizes registry, missing-handler, runtime-owned,
  invalid-result and transparent generic failures after authority consumption.
- Fresh verification: focused runtime/API/lifecycle suite
  `169 passed, 3 warnings`; Task 5 formal-flow suite `171 passed, 2 warnings`;
  full backend Ruff and `git diff --check` passed.
- Not run: public network, real model, real MCP, private dotenv, production
  database or production writes. No commit, push, merge or deployment.

### Consult/draft registry failure parity (2026-07-31)

- RED: both APIs caught `ChancellorRuntimeError` but not its registry-error
  sibling, allowing registry rejection to bypass final audit re-emission and
  the existing sanitized graph-error HTTP contract.
- GREEN: consult and draft now catch both failure families, extract the common
  immutable audit, best-effort re-emit a zero-side-effect final failure audit,
  and use their unchanged sanitized runtime/graph error mapping.
- Parameterized coverage for each API includes registry rejection, missing
  handler, handler-raised runtime-owned failure and invalid result, with
  assertions against prompt, output and exception-detail leakage.
- Fresh verification: focused runtime/API/lifecycle suite
  `177 passed, 3 warnings`; Task 5 formal-flow suite `171 passed, 2 warnings`;
  full backend Ruff and `git diff --check` passed.
- Not run: public network, real model, real MCP, private dotenv, production
  database or production writes. No commit, push, merge or deployment.

### Single authoritative audit emission owner (2026-07-31)

- RED: `ChancellorAgent` still accepted a default `audit_sink` and emitted
  failure snapshots before the HTTP boundary knew the final outcome, while
  each API emitted its endpoint-final snapshot again.
- GREEN: the Agent now only constructs and attaches immutable sanitized audit
  snapshots to invocation results and propagated errors. It has no sink
  parameter or emission call. Consult, draft and execute remain the sole
  best-effort emitters and each emits exactly once per invocation attempt
  after its final handler/post-processing outcome is known. The execute
  pre-archive snapshot remains separately embedded as `runtime_audit` archive
  data and is not an additional logger emission.
- Coverage asserts an exact emission count of one for API success, registry
  rejection, missing handler, runtime-owned failure, invalid handler result,
  transparent generic failure and endpoint post-processing/archive failure.
- Fresh verification: focused runtime/API/authority/lifecycle suite
  `177 passed, 3 warnings`; Task 5 formal-flow suite `171 passed, 2 warnings`;
  full backend Ruff and `git diff --check` passed.
- Not run: public network, real model, real MCP, private dotenv, production
  database or production writes. No commit, push, merge or deployment.

### Post-audit final verification (2026-07-31)

- 本节是当前审计后代码的最终新鲜验证证据，并取代此前所有 11 次连续验收序列作为最终门禁依据；早先序列仅保留为实施历史。
- `backend/.venv/Scripts/python.exe -m ruff check .`：PASS，退出码 0，耗时 0.134 秒。
- `backend/.venv/Scripts/python.exe -m pytest`：PASS，退出码 0，命令耗时 87.688 秒；pytest 报告 `2127 passed, 1 skipped, 3 warnings`（85.43 秒）。
- `node scripts/check_harness.mjs`：PASS，退出码 0，耗时 0.190 秒，输出 `agentic-check: 通过 (72 个基线文件)`。
- `node scripts/check_harness.mjs --self-test`：PASS，退出码 0，耗时 0.103 秒，输出 `agentic-check self-test: 通过 (44 项)`。
- `node .agents/hooks/check-harness.mjs --self-test`：PASS，退出码 0，耗时 0.126 秒，输出 `Stop hook self-test: 通过 (3 项)`。
- `node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test`：PASS，退出码 0，耗时 0.107 秒，输出 `product-flow Claude runner self-test: 通过 (25 项)`；仅运行离线自测，没有启动 Claude 交付模式。
- `git diff --check`：PASS，退出码 0，耗时 0.105 秒；仅报告既有工作区 LF/CRLF 转换警告。
- 最终固定关键套件包含 13 个文件：`test_chancellor_runtime_registry.py`、`test_chancellor_runtime_agent.py`、`test_chancellor_consult_graph.py`、`test_chancellor_consult_api.py`、`test_chancellor_draft_graph.py`、`test_chancellor_drafts_api.py`、`test_chancellor_draft_authority.py`、`test_decrees_api.py`、`test_decree_draft_gate.py`、`test_chancellor_graph.py`、`test_junjichu_case_lifecycle.py`、`test_shiguan_archive_decree.py`、`test_accounting_report_cross_layer.py`。全部 11 轮使用完全相同的路径集合和顺序，并在 11 个独立 pytest 进程中运行。
- 最终关键套件第 1–11 轮均为 `297 passed, 3 warnings`、退出码 0；命令耗时依次为 31.122、32.540、33.814、30.726、30.355、31.000、30.824、30.908、29.896、30.806、30.080 秒。
- 警告仍为 Starlette `TestClient`/`httpx` 弃用警告和两个刻意无效批准路由产生的 Pydantic 序列化警告；未造成测试失败。
- 本轮未访问公网、真实模型、真实 MCP、私有 dotenv、生产数据库或生产写入；未提交、推送、合并或部署。

- 验收结果：此前离线验收结论已被 2026-07-31 新增的真实模型门禁取代；当前为 In Progress。
- 验收证据：Codex 已逐条核对验收标准。产品运行时由一个 `ChancellorAgent` 与三个启用、一个禁用的 Runtime Skill 表达；三个现有入口保持确定性选择与 HTTP 兼容；正式下旨继续受一次性拟旨授权和批准路由约束；MCP 仍只能经司级证据协议与锦衣卫间接使用；每次调用均以单一最终审计事件记录 Skill、版本、入口、授权结果和实际副作用，正式下旨另保留归档前审计快照。主代理最终新鲜验证为后端 Ruff PASS、全量 `2127 passed, 1 skipped, 3 warnings`、四条 harness PASS、`git diff --check` PASS，以及固定 13 文件关键套件在 11 个独立进程中连续 11 轮均 `297 passed, 3 warnings`、退出码 0。
- 未通过项：真实网页门禁当前仅有 3/11 个成功样本，未达到用户要求。第 1–3 个成功样本均得到正式回奏；史馆总 `REPLY` 数逐次新增且第 3 次核验为 13。其间出现真实拟旨 `502`、供应商读取超时和连续结构化输出无效；这些失败均未计数。真实 MCP、生产数据库和生产写入未运行。
