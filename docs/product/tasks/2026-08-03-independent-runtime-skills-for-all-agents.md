# 任务：全部下游 Agent 独立运行时 Skill

> 所有任务必须阅读并遵循 `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`；若任务与该基线冲突，必须标记为 `Blocked`，不得自行变更流程。

## Status

Accepted

## Product Definition

- 用户确认：用户于 2026-08-03 明确批准 `docs/superpowers/specs/2026-08-03-independent-runtime-skills-for-all-agents-design.md` 书面规格。
- 问题：军机处和六部缺少统一的运行时 Skill 身份、版本、权限与报告契约；39 个司也尚未各自拥有可注册、可审计、可独立测试的专业 Runtime Skill。
- 目标用户：通过丞相正式下旨并查看办理结果的用户，以及维护和审计下游 Agent 能力的工程团队。
- 目标：为军机处 1 个、六部 6 个、司级 39 个下游 Agent 建立恰好 46 个一对一、启用、可版本化的独立 Runtime Skill，并由共享执行内核统一执行、校验、策略约束和审计。
- 非目标：不改变前端或 API；不改变现有 LangGraph 拓扑、丞相的 `consult`、`draft_decree`、`execute_decree`、下旨/会审/证据/史馆归档流程；不新增生产写入、MCP 数据源、外网访问或长期记忆；不复制 46 套通用执行代码。

## Acceptance Criteria

- [x] 注册表恰好包含 46 个新增下游 Runtime Skill：军机处 1 个、六部 6 个、司级 39 个；每个下游 Agent 恰好绑定一个启用 Skill，Skill ID 全局唯一、版本有效，未知 Agent、重复或跨部绑定、空专业方法、空报告契约和非法权限均在启动或调用前失败关闭。
- [x] 39 个司的职责注册表与 Skill 注册表一一对应；每个司具有独立的数据需求、分析步骤、必需发现、风险检查、报告契约、版本和测试，抽样报告不能只替换 Agent 名称即得到相同结果。
- [x] 共享执行内核只拥有身份解析、上下文裁剪、服务注入、公共安全指令、结构化调用、报告校验、稳定脱敏错误映射和审计；专业方法与业务判断留在各自不可变 Skill 定义中。
- [x] 司级、部级、军机处报告均通过公共信封和各层结构化契约校验，且能追溯 Agent、Skill ID、Skill 版本、输入引用、证据引用和结果状态；事实、假设和建议可区分。
- [x] 数据不足时返回列明缺口与补数建议的 `degraded` 报告，不编造数据；无相关性时返回受控“不适用”；单司或单部失败时上层报告披露缺失及影响，不伪造意见或把不完整会审标为完整成功。
- [x] 部级报告只引用真实司级报告并披露选择理由、共享发现、冲突、跨司影响和未决事项；军机处只按批准部门及顺序组织会审，保留共识、分歧、跨部依赖和待丞相裁决事项。
- [x] 只有司级 Skill 能通过 Evidence Protocol 产生受控证据请求；军机处和六部无法取得锦衣卫或 MCP 服务；任何未授权服务请求在执行前失败，外网默认关闭，凭证、敏感原文和底层异常不进入审计。
- [x] 未采纳证据不能附加到史馆 `REPLY`；报价、合同、付款、签署、发布、部署、招聘和外部承诺相关输出仍仅为分析或草案，不宣称已执行不可逆动作。
- [x] 现有 20 个 capability 的 purpose、deliverable 和 guardrail 完整迁入所属司 Skill，并保留旧 ID 到新 Skill ID 的内部兼容映射；同一次调用不叠加旧、新 Prompt；原无 capability 的 23 个司均能生成合规专业报告。
- [x] 丞相三个现有 Runtime Skill、单部与多部正式下旨路径、参与部门顺序、一次性拟旨授权、最终恰好三条建议、史馆恰好一条 `REPLY`、现有 API 和前端保持兼容；39 个司不改造成 39 个 LangGraph Node，ADR 0028 保持不变且 harness 通过。
- [x] 当前相关后端测试通过，并新增注册完整性、专业差异、权限、分层报告、降级、审计、capability 迁移和兼容回归测试。
- [x] 同一最终代码、配置和验收命令连续完整通过至少 10 轮；任一轮失败或代码、配置、验收流程发生实质变化后从第 1 轮重新计数，并逐轮记录命令、PASS/FAIL 与证据。
- [x] 真实模型、真实 MCP、生产数据库、生产写入和付费外部服务仅在另行明确授权后纳入验收。（本次未获授权，故均未运行。）

## Delivery Constraints

- 范围：仅后端运行时 Skill 定义、共享执行内核、现有下游 Agent 接线与 capability 迁移，以及相应测试和文档；不得修改前端或 API 契约。
- 兼容性：保持现有 LangGraph 拓扑、丞相 Runtime Skill、ADR 0028 业务流、单部/多部调用顺序、证据权限和史馆归档语义。
- 风险与限制：必须分阶段保持主流程可运行，不得先删除旧 capability 再等待新 Skill；真实外部服务、凭证、生产写入和不可逆操作均不在默认授权内。
- 技能计划：实施时使用 `codex-engineering-workflow`、`brainstorming`、`test-driven-development` 和 `verification-before-completion`；按阶段选择最小必要 skill。
- Codex-only：执行时由用户选择；若用户选择“是”，则禁止 Claude CLI、Claude runner 与 `gstack-claude`，改用项目级 Codex 专业角色链。

## Affected Modules

- 模块：候选模块：下游 Agent Runtime Skills；候选模块：分层专业报告与审计；候选模块：旧 capability 兼容迁移。
- 允许路径：`backend/app/agents/runtime_skills/**`、接入与迁移所必需的 `backend/app/agents/**`、`backend/tests/**`、`docs/**`；明确排除 `frontend/**` 和 API 路由/契约变更。
- 依赖模块：现有丞相执行路径、军机处与六部/司级 Agent 注册、Evidence Protocol、史馆 `REPLY` 归档、现有 capability 注册表。

## Technical Plan

- 架构边界：每个下游 Agent 一对一绑定一个不可变 Runtime Skill 定义；共享 executor 负责通用调用、校验、策略和审计；现有丞相 LangGraph 拓扑与 ADR 0028 不变。
- 接口与依赖：新增公共 Skill/调用/审计模型、注册表、共享 executor 与司/部/军机处三层报告契约；保持现有 API 和前端契约，旧 capability ID 暂经内部映射兼容。
- 实施顺序：先建公共契约、注册表、executor 和报告模型；再接入军机处与六部 7 个 Skill；随后按六部逐批接入 39 个司并迁移 20 个 capability；最后完成端到端兼容、审计、文档和 10 轮验收。
- 验证计划：逐阶段运行新增与现有后端单元/集成测试、lint 和 harness；最终以完全相同版本和命令连续完整执行 10 轮并留存逐轮证据。
- 技术风险：Skill/Agent 错绑、专业定义同质化、旧新 Prompt 双重执行、权限扩大、报告伪造与兼容回归；通过启动期完整性校验、失败关闭、差异性测试、服务白名单和分阶段迁移控制。

## Implementation Report

- 改动摘要：完成 46 个下游 Runtime Skill、共享 executor、三层报告契约、生产接线、兼容映射及可审计验收 runner。
- 自审：无 frontend/API schema/ADR 0028/凭证/外网变更；manifest 纳入 573 个冻结文件并明确排除运行证据与验收后状态文档。
- 验证：fresh preflight PASS；同一指纹连续 10/10 轮 PASS；90 条命令 exit 0，起止指纹全部一致。
- 实际使用的 skill：`using-superpowers`、`brainstorming`、`test-driven-development`、`codex-engineering-workflow`、`verification-before-completion`。
- 验证命令与结果：每轮 focused 235、existing 532、Ruff PASS、backend 2382 + 1 skipped、四 harness PASS、diff exit 0；详见 manifest/summary/raw logs。
- 未运行项与原因：真实模型、真实 MCP、生产数据库/写入、付费服务、凭证和外网均需另行授权，本次未运行。
- 剩余风险：保留已知 warning；真实外部集成仍未验证，不能由离线结果外推。

## Acceptance Review

- 验收结果：Accepted（可复算同一冻结版本连续 `10/10` 轮）。
- 验收证据：`.superpowers/sdd/independent-runtime-skills-task-9-evidence/fingerprint-manifest.json`、`acceptance-summary.json`、逐命令 raw logs、`post-doc/summary.json` 与产品 ledger；指纹 `d27350c798ea70eaab7d3d5e18ebef5ccd3d44edba0eca6a531f41266a3bb99e`。
- 未通过项：无离线授权范围内未通过项；真实外部项未授权、未运行。

### Historical invalid attempts — Task 9 (non-counting)

- Status: `Blocked`; mandatory pre-acceptance backend-wide suite failed, so the 10-round ledger was not started (`0/10`).
- Self-review: inspected `git diff --stat`, `git diff --check`, and `git diff -- backend/app/agents backend/tests docs`. No frontend, API route/schema, ADR 0028, credential-handling, or new-network-access change was found. ADR 0028 SHA-256: `4F5F8C4ECD98F475EDD2F9A74A8844CCA91C892CAA673FDCA360FB58018AFFD2`.
- Actual skills: `using-superpowers`, `codex-engineering-workflow`, `verification-before-completion`.
- Evidence: focused `215 passed`; existing regression `532 passed, 1 warning`; Ruff passed; complete backend suite `1 failed, 2357 passed, 1 skipped, 3 warnings`.
- Blocker: `backend/tests/test_shiguan_migrations.py::test_maintenance_check_emits_desensitized_json`; subprocess stdout was empty and JSON decoding failed.
- Fail-fast: four harness commands and the final round `git diff --check` were not run. No formal acceptance round counted.
- Ten-round evidence: `.superpowers/sdd/independent-runtime-skills-task-9-acceptance.log` is intentionally absent until a complete round passes; blocking evidence is in `.superpowers/sdd/independent-runtime-skills-task-9-report.md`.
- Unrun: real models, real MCP, production DB, production writes, paid services, credentials, and external network.
- Residual risk: the full backend regression gate is red; Task 9 cannot waive or classify the failure without separate diagnosis and fresh unchanged-command acceptance.

### Task 9 current acceptance review (2026-08-03)

- Acceptance result: `Blocked (0/10)`.
- Passed before stop: focused tests, existing regressions, backend-wide Ruff.
- Failed: complete backend suite.
- Not reached: four harness checks, final round diff check, and ten consecutive rounds.
- Fresh restart preflight at `2026-08-03T13:50:17+08:00` reproduced the same full-suite blocker after focused `215 passed`, existing regression `532 passed, 1 warning`, and Ruff PASS. Full backend result: `1 failed, 2357 passed, 1 skipped, 3 warnings`; code/config fingerprint before the run was `2B7C815BF6D056B986A4BD7EB37123934C305D817B3AFEECE9817A60A7E64F40`. Round 1 was not started.
- Final-state preflight at `2026-08-03T14:13:56+08:00` remained blocked: focused `215 passed`, existing regression `532 passed, 1 warning`, Ruff PASS, full backend `1 failed, 2361 passed, 1 skipped, 3 warnings`. Hardened oracle evidence identifies maintenance subprocess `returncode=1` and `ModuleNotFoundError: No module named 'app'` (`stderr` SHA-256 `707d649ede4c503723e4666d9b34d2ecd2194a7be6330cc149bdca702f437699`). Fingerprint: `844AB1B9BED9CCA77A75B900E463A74AD063BD03B64BF2A596C09CF158B54FFD`. Fixed commands were not altered; Round 1 was not started.
- Frozen-state preflight at `2026-08-03T14:25:21+08:00`: focused `215 passed`, existing `532 passed, 1 warning`, Ruff PASS, backend `2362 passed, 1 skipped, 3 warnings`, and all four harness commands PASS. Starting fingerprint: `5F5DA12C78203B321C2FADAFC7C4D1BBF6150C5EEBEB71030061C295588B4F65`. The final `git diff --check` wrapper stopped on an existing LF-to-CRLF stderr warning promoted by PowerShell to `NativeCommandError`, so a complete preflight PASS and ending fingerprint were not established. Under the no-retry rule, Round 1 was not started and acceptance remains `0/10`.
- Final acceptance supersedes the earlier blocked attempts: authorized wrapper `cmd /d /c "git diff --check 2>&1"` preserved warning text and verified exit `0`. Fresh preflight and Round 1–10 all passed with identical fingerprint `5F5DA12C78203B321C2FADAFC7C4D1BBF6150C5EEBEB71030061C295588B4F65`. Each round: focused `215 passed`; existing `532 passed, 1 warning`; Ruff PASS; backend `2362 passed, 1 skipped, 3 warnings`; four harnesses PASS; diff exit `0`. Full ledger: `.superpowers/sdd/independent-runtime-skills-task-9-acceptance.log`.

### Auditable revalidation ledger contract

The preceding historical attempts are retained only as failure history and count as `0/10`. The current acceptance must be generated by `scripts/run_task9_acceptance.ps1`. For every formal round, the product acceptance record must include: round number; PASS/FAIL; start and end timestamps; complete start and end SHA-256 fingerprints; every exact command; every exit code; test counts; stdout/stderr byte counts; and the raw sanitized stdout/stderr evidence paths. The reproducible manifest must list the fingerprint algorithm, canonical aggregation format, every included file and hash, every excluded mutable evidence/status path, and the exact command matrix. Any command failure or start/end fingerprint mismatch resets the accepted count to zero and stops immediately.

### Authoritative auditable rounds (2026-08-03)

All historical rows above are non-counting failure history. The only accepted sequence is summary schema v1 at `.superpowers/sdd/independent-runtime-skills-task-9-evidence/acceptance-summary.json`; algorithm/include/exclude list and every exact command are at `fingerprint-manifest.json`. Each raw path below expands to nine `.stdout.log` and nine `.stderr.log` files; the summary records each exact path, start/end time, exit code and byte count.

| Round | Result | Start–End (+08:00) | Complete start/end fingerprint | Test counts | Exact commands | Raw evidence |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | PASS | 15:36:36–15:40:27 | `54eeb231...e7bb` / identical | 222 / 532 / 2369 + 1 skipped | manifest `commands[0..8]` | `round-1-*` |
| 2 | PASS | 15:40:29–15:43:12 | `54eeb231...e7bb` / identical | 222 / 532 / 2369 + 1 skipped | manifest `commands[0..8]` | `round-2-*` |
| 3 | PASS | 15:43:14–15:46:12 | `54eeb231...e7bb` / identical | 222 / 532 / 2369 + 1 skipped | manifest `commands[0..8]` | `round-3-*` |
| 4 | PASS | 15:46:14–15:48:44 | `54eeb231...e7bb` / identical | 222 / 532 / 2369 + 1 skipped | manifest `commands[0..8]` | `round-4-*` |
| 5 | PASS | 15:48:45–15:50:32 | `54eeb231...e7bb` / identical | 222 / 532 / 2369 + 1 skipped | manifest `commands[0..8]` | `round-5-*` |
| 6 | PASS | 15:50:33–15:52:15 | `54eeb231...e7bb` / identical | 222 / 532 / 2369 + 1 skipped | manifest `commands[0..8]` | `round-6-*` |
| 7 | PASS | 15:52:16–15:54:02 | `54eeb231...e7bb` / identical | 222 / 532 / 2369 + 1 skipped | manifest `commands[0..8]` | `round-7-*` |
| 8 | PASS | 15:54:02–15:55:44 | `54eeb231...e7bb` / identical | 222 / 532 / 2369 + 1 skipped | manifest `commands[0..8]` | `round-8-*` |
| 9 | PASS | 15:55:45–15:57:27 | `54eeb231...e7bb` / identical | 222 / 532 / 2369 + 1 skipped | manifest `commands[0..8]` | `round-9-*` |
| 10 | PASS | 15:57:28–15:59:10 | `54eeb231...e7bb` / identical | 222 / 532 / 2369 + 1 skipped | manifest `commands[0..8]` | `round-10-*` |

All 90 command records have exit `0`; there are zero fingerprint mismatches. Ruff and all four harness commands passed in every round. The product-facing ledger links the same raw evidence and complete per-command metadata.
