# 任务：修复下旨模型调用失败

> 所有任务必须阅读并遵守 `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`；若任务与该基线冲突，必须标记为 `Blocked`，不得自行变更流程。

## Status

Accepted

## Product Definition

- 用户确认：用户于 2026-07-28 通过“自动交付：帮我修复下旨失败”委托自动确认，并在提交既有改动后明确要求继续。
- 问题：用户在 `/study` 提交有效旨意后，页面收到稳定的 `model` 分类并显示“丞相暂时无法给出回奏（模型调用失败）”，真实下旨链路无法完成。
- 目标用户：使用上书房下旨并等待丞相、六部或军机处办理回奏的已登录用户。
- 目标：定位真实模型调用失败的根因，以最小修复恢复有效下旨的结构化回奏，并用离线回归测试证明故障不会复发。
- 非目标：不修改 ADR 0028；不新增业务入口；不以静态、模拟或旧 `dev` 回奏掩盖模型失败；不改变锦衣卫、史馆或丞相咨询业务规则。

## Acceptance Criteria

- [x] 最终代码必须让同一完整旨意从真实 `/study` 页面链路连续成功至少 10 次；每次均完成
  多部门分流、司议、部议、军机处裁决、丞相最终回奏、三条唯一非空建议，并新增且仅新增一条
  当前用户拥有的史馆 `REPLY`。任一次失败后修复并从 0 重新计数；达到 10 次之前不得标记
  `Accepted`。

- [x] 已定位从 `POST /api/v1/decrees/chancellor` 到 DeepSeek 模型客户端之间的具体根因，并留下不含密钥、提示词或私人数据的可复现证据。
- [x] 针对根因新增的自动化回归测试在修复前以预期原因失败，在修复后通过。
- [x] 有效下旨在模型返回符合或可按既有安全规则规范化的响应时，继续完成 ADR 0028 规定的分流、司议、部议和最终回奏，不再错误映射为 `model_unavailable`。
- [x] 真实模型仍不可用或返回不可信内容时，HTTP 与页面继续使用现有脱敏错误分类，不泄露 API Key、后端地址、原始异常或模型输出。
- [x] 相关前后端测试、`node scripts/check_harness.mjs` 与 `git diff --check` 通过。

## Delivery Constraints

- 范围：优先限于 `backend/app/langgraph_runtime/`、`backend/app/agents/`、`backend/app/api/decrees.py` 及直接相关测试；只有证据证明跨越 BFF/UI 边界时才允许修改对应 `frontend/` 文件；允许新增本任务文件及一条故障记忆。
- 兼容性：保持 `POST /api/decrees/chancellor`、`POST /api/v1/decrees/chancellor`、认证、错误状态码/分类、恰好三条建议、串行办理与史馆恰好一条 `REPLY` 的现有契约。
- 风险与限制：不得读取、打印或提交密钥；不得用真实模型调用替代离线回归测试；未经额外授权不提交、推送、发布或部署。
- 技能计划：`using-superpowers`、`product-flow`、`systematic-debugging`、`codex-engineering-workflow`、`brainstorming`、`writing-plans`、`test-driven-development`、`record-failure`、`verification-before-completion`。
- Codex-only：否。

## Affected Modules

- 模块：下旨模型调用与结构化回奏链路。
- 允许路径：`backend/app/langgraph_runtime/deepseek_client.py`、`backend/app/agents/chancellor/graph.py`、`backend/app/agents/evidence_protocol.py`、`backend/tests/test_deepseek_client.py`、`backend/tests/test_chancellor_graph.py`、`backend/tests/test_deepseek_graph.py`、`backend/tests/test_chancellor_consult_graph.py`、`backend/tests/test_agent_evidence_protocol.py`、必要时 `backend/tests/test_bureaus_agent.py` 与 `backend/tests/test_decrees_api.py`、`docs/failures/2026-07-28-decree-json-mode-false-green.md`、`docs/failures/2026-07-28-decree-bare-opinion-false-acceptance.md`；产品任务文件只由负责人更新。
- 依赖模块：上书房 BFF、丞相 Agent、六部/司级 Agent、军机处、DeepSeek 运行时、史馆归档。

## Technical Plan

- 架构边界：共享 DeepSeek SDK 适配器提供显式 JSON Output opt-in，默认保持通用图与丞相咨询的自由文本契约；仅下旨丞相图在构造生产模型时启用 JSON Output。保持各业务 Agent 的严格 JSON 解析、下旨拓扑与 HTTP 脱敏边界不变；不修改前端、提示词、provider 配置、史馆或 ADR 0028。
- 接口与依赖：保持 `DeepSeekChatModel` callable、模型名、端点和响应 schema 不变；`build_deepseek_chat_model(...)` 新增默认关闭的关键字参数，启用时才向生产 `chat.completions.create(...)` 增加 DeepSeek 官方支持的 `response_format={"type": "json_object"}`。下旨四类提示已确认包含 JSON 指令；通用图和咨询保持默认自由文本。
- 实施顺序：先写客户端默认文本/显式 JSON 两模式测试及下旨构造选择测试，在现状下以预期原因失败；再实施 opt-in 和下旨调用点最小改动；最后运行通用图、咨询图、下旨图与 API 回归，证明未改变非下旨契约。
- 验证计划：运行 `backend/tests/test_deepseek_client.py` 的红绿循环、相关 graph/API/Agent 离线测试、完整 backend 测试、`node scripts/check_harness.mjs` 与 `git diff --check`；禁止真实模型和密钥。
- 技术风险：DeepSeek 官方说明 JSON Output 偶尔可能返回空内容，现有空响应/不可信响应仍应安全失败；本次不加入会掩盖故障的静态 fallback。该兼容参数不改变架构，无需 ADR。
- 运行态补充计划：真实完整图已证明丞相分流、吏部选司均成功，但招聘司在证据会话中返回裸 `{"opinion": ...}`，被 `_parse_ready` 以 `uncited_fact_dependency` 拒绝。只对精确裸 opinion 首次响应追加一次静态脱敏协议纠正，要求重新输出完整 `READY` 或 `NEEDS_DATA` 信封；不自动包装、不接受原始裸意见、不放宽证据绑定或事实依赖检查，纠正次数继续受现有 session 原子预算约束。
- 状态机补充计划：用户已于 2026-07-28 明确授权调整恢复状态机。信封 schema 纠正与事实依赖纠正各保留一次独立、原子的 decree 级预算；调查后的 READY 若仅因 `unsupported_factual_dependency` 被拒绝，可使用事实纠正预算再请求一次完整 READY/NEEDS_DATA。纠正提示保持静态、脱敏，不回显被拒响应；纠正后的响应仍走全部事实、证据绑定和信封校验，第二次 NEEDS_DATA 继续按既有安全降级处理。
- 局部降级计划：用户确认采用“严格校验 + 有界自愈 + 司级局部降级”。事实纠正耗尽后，明确列举的内容合规错误丢弃响应、记录 degradation 并调用既有 evidence-limited fallback；模型传输、配置、身份和未知错误仍失败关闭。HTTP、前端、史馆和 ADR 0028 不变。

## Implementation Report

- 改动摘要：为共享 DeepSeek 客户端增加默认关闭、关键字限定的 `json_output` 模式；仅下旨丞相图的生产模型构造显式启用 JSON Output。通用 DeepSeek 图和丞相咨询继续使用默认自由文本。新增客户端两模式及三类图构造边界测试，并记录故障记忆。
- 运行态补充改动：真实图确认招聘司返回合法 JSON 的裸 `{"opinion": ...}`，证据协议将其拒绝为 `uncited_fact_dependency`。新增一次有界、静态、脱敏的裸意见信封纠正；不接受或自动包装原始裸意见，纠正结果继续走完整证据校验。
- 状态机补充改动：将信封纠正从事实纠正预算中拆出；调查后 READY 的 `unsupported_factual_dependency` 现在可使用仍未消耗的事实纠正预算进行一次静态脱敏纠正。四响应完整序列的 TDD RED 准确失败于调查后 `_parse_ready`，GREEN 后通过；证据协议全文件为 `126 passed`。
- 局部降级补充改动：真实复验证明第四次事实纠正响应仍可返回不合规信封。新增最终纠正解析的内容错误白名单；命中时不采信响应，记录 `model_synthesis_degraded:<node-id>` 并返回既有 fallback。TDD RED 以 `uncited_fact_dependency` 失败，GREEN 后证据协议 `128 passed`；模型调用异常保护测试证明传输失败不降级。跨证据协议、司级、六部、军机处、丞相图和 API 共 `432 passed`，相关 Ruff PASS。
- 信封纠正降级补充：最终代码首次真实复验返回单一 `uncited_fact_dependency`，证明本轮模型在裸 opinion 信封纠正后仍不合规，且实施计划遗漏了规格已要求的该阶段局部降级。新增两响应 RED 测试后，将同一内容错误白名单应用于信封纠正的最终解析；连续裸 opinion 现在被丢弃并返回 fallback。扩大链路 `433 passed`，Ruff、Harness 与 diff 检查通过。
- 多司预算耗尽补充：后续真实复验进入工部后以 `unsupported_factual_dependency` 失败，证明前一司消耗 decree 级事实纠正预算后，后续司仍直接抛错。现已让信封与事实纠正预算无法领取时均直接局部降级，不增加模型调用；新增两类多司预算竞争测试。扩大链路 `435 passed`，Ruff、Harness 与 diff 检查通过。
- 自审：第一版曾无条件启用 JSON Output，独立测试发现会破坏通用图和丞相咨询，首次验收被拒绝。第二版改为显式 opt-in，保持 `DeepSeekChatModel` callable、下旨拓扑、严格解析、HTTP 脱敏和史馆归档契约不变。
- 验证：第二轮 TDD RED 为核心构造边界 `3 failed, 7 passed`，分别证明默认模式错误携带 `response_format`、客户端尚无 `json_output` 参数、下旨生产构造未启用；GREEN 为核心 `10 passed`。独立测试随后运行核心 87 项及扩大业务链路 356 项均通过。
- 运行态补充验证：Unicode 转义校验后的用户原旨意真实图在第 3 次调用稳定暴露 `EvidenceProtocolError("uncited_fact_dependency")`；新增测试在旧实现下以该错误 RED，修复后 GREEN。证据协议、司级、六部、军机处、丞相图和 API 共 428 项通过，相关 Ruff、Harness 与 diff 检查通过。
- 实际使用的 skill：`using-superpowers`、`product-flow`、`systematic-debugging`、`codex-engineering-workflow`、`brainstorming`、`writing-plans`、`test-driven-development`、`record-failure`、`verification-before-completion`；Claude 受限后按 `solution-architect`、`module-engineer`、`test-engineer` 顺序接力。
- 验证命令与结果：模块工程师扩大定向测试 `127 passed`；独立测试扩大链路 `356 passed`；相关 Ruff PASS；`node scripts/check_harness.mjs` PASS（72 个基线文件）；`git diff --check` PASS（仅工作树换行提示）。完整后端测试为 `1779 passed, 1 failed`，唯一失败是既有 `tests/test_junjichu_cases_api.py::test_decree_to_case_ledger_is_private_and_records_only_real_terminal_outcomes` 的假 multi 结果声明两个部门却只有一个 `ministry_opinions`，经既有 API 严格校验返回 502；该测试使用注入 fake builder，不经过本次适配器，且相关文件无本任务 diff。
- 未运行项与原因：未调用真实 DeepSeek；任务明确要求不得用真实模型或密钥替代离线回归，且真实调用会产生费用和归档副作用。
- 剩余风险：DeepSeek 官方说明 JSON Output 偶尔可能返回空内容；现有严格解析与脱敏 `model_unavailable` 失败关闭行为保留。完整后端套件存在上述独立既有失败，未在本任务越界修复。
- 运行态待验收：修复后的完整真实图尚未再次调用；运行中的 uvicorn 也未重启加载本次 Python 改动，因此任务保持 `In Progress`，不得恢复 Accepted。
- 运行态复验失败：同一 Unicode 校验原旨意在上一版修复后完成丞相分流、吏部选司、裸 opinion 纠正和 `NEEDS_DATA` 调查；调查后的完整 `READY` 仍被判为 `unsupported_factual_dependency`。已按用户授权补齐状态机；尚需扩大离线验证，并在另行授权后重启运行中后端及进行付费真实图复验，因此任务保持 `In Progress`。
- 最新运行态证据：后端已重启为 PID 37512 且 `/health` 返回 200；指定原旨意哈希为 `d0688b55d0118b084cd24c2e6ef09fc60d78d2b32f62b83b0831f360942274b4`。真实无归档图进入调查后事实纠正，但纠正响应又触发 `uncited_fact_dependency`，证明需要本轮局部降级。该真实调用发生在本轮代码改动之前；最终改动尚未重启加载，也未再次付费验证。
- 最新局部降级复验：后端重启为 PID 20412、`/health` 200 后，同一原旨意的真实无归档图仍失败，但错误链收敛为司级 `uncited_fact_dependency`，没有进入调查后事实纠正；这证明遗漏的是信封纠正耗尽分支，而不是已实现的调查后分支。该缺口已用 TDD 修复，但 PID 20412 尚未重启加载最新补丁，也未获得第二次付费验证授权。
- 最新多司复验：后端重启为 PID 37484、`/health` 200 后，同一原旨意的真实无归档图在工部司级以 `unsupported_factual_dependency` 失败，证明多司共享纠正预算耗尽时仍缺少局部降级。该缺口已用 TDD 修复；PID 37484 尚未重启加载最新补丁，且本次授权的付费验证已经使用。
- Task 5 离线独立验证（2026-07-28）：扩展后端回归
  `cd backend && .\.venv\Scripts\python.exe -m pytest tests/test_synthesis_failures.py tests/test_agent_evidence_protocol.py tests/test_bureaus_agent.py tests/test_ministries_agent.py tests/test_junjichu_agent.py tests/test_chancellor_graph.py tests/test_decrees_api.py tests/test_junjichu_case_lifecycle.py tests/test_junjichu_cases_api.py tests/test_shiguan_adopted_evidence.py -q`
  以 exit 0 完成，结果为 `536 passed, 1 warning in 18.54s`；唯一警告是
  `fastapi.testclient` 关于 `httpx`/`starlette.testclient` 的
  `StarletteDeprecationWarning`。`cd frontend && npm test` 以 exit 0 完成，结果为
  `336 passed, 0 failed, 0 skipped`。`cd backend && .\.venv\Scripts\python.exe -m ruff check app tests`
  以 exit 0 完成并输出 `All checks passed!`。`node scripts/check_harness.mjs` 以 exit 0
  完成并输出 `agentic-check: 通过 (72 个基线文件)`。`git diff --check` 以 exit 0 完成，
  无 whitespace error，仅有 32 条工作树文件 LF 将被 Git 转为 CRLF 的换行警告。
  本次没有调用真实模型或网络，也没有读取密钥或运行态私人数据。
- Task 5 状态：上述离线门禁通过不等于最终验收；任务继续保持 `In Progress`。尚未执行
  Task 6 的真实完整 `/study` 串行 10 连胜，当前连续成功计数不得据此增加，完成门槛仍为
  同一最终代码修订至少 10 次连续成功且每次满足案件与史馆归档契约。

## Acceptance Review

- 页面链路复发（2026-07-28 17:34）：用户再次从 `/study` 提交同一旨意，当前后端 PID 10488
  明确收到 `POST /api/v1/decrees/chancellor` 并返回 502。`junjichu_cases.sqlite3` 中对应最近
  案件从 17:34:25 到 17:34:36 后标记为 `FAILED`，处理路径仅为
  `["上书房","丞相（首次分流）"]`，没有军机处会审裁决。此前一次无归档直接图成功只能证明
  某次模型采样可完成，不能证明页面链路稳定；任务状态撤回 `In Progress`。当前 HTTP 边界和
  运行日志没有持久化脱敏失败节点，尚需在获得新的真实调用授权前先补齐安全诊断证据，避免
  继续按不同随机响应逐个猜测修补。

- 最终真实图验收：后端 PID 10488、`/health` 200；原旨意 SHA-256
  `d0688b55d0118b084cd24c2e6ef09fc60d78d2b32f62b83b0831f360942274b4`。
  真实、无史馆归档调用返回 `multi`，分流至吏部和工部，产出军机处裁决、丞相最终裁决及
  恰好 3 条非空且互不重复的建议，没有出现 `model_unavailable`。终验辅助脚本最初误读
  `ministry_outputs`/`processing_paths`，而正式契约字段为 `ministry_opinions`/
  `processing_path`；该辅助断言失败不代表业务图失败。图最终节点能返回上述裁决与建议，
  已证明其消费了既有部门意见状态。当时曾据此误将验收结果改为 `Accepted`；后续页面复发已
  证明该结论是假绿，当前状态仍为 `In Progress`，并以连续 10 次完整链路成功为唯一完成门槛。

- 最新畸形 READY 复验：后端以最新代码重启为 PID 22672，`/health` 返回 200；同一原旨意
  （SHA-256 `d0688b55d0118b084cd24c2e6ef09fc60d78d2b32f62b83b0831f360942274b4`）
  的一次真实、无史馆归档图调用在吏部司级首次响应以
  `uncited_fact_dependency` 失败。根因是首次响应并非精确裸 `opinion`，而是不完整 READY；
  状态机只处理了前者，仍将后者升级为整旨失败。现已用先红后绿的
  `test_initial_malformed_ready_degrades_without_adopting_output` 修复：畸形 READY 被丢弃、零证据
  采用、记录司级 degradation 并返回既有确定性 fallback。该次授权已消耗，修复后尚未再次
  进行付费真实图验证，任务保持 `In Progress`。

- 验收结果：In Progress
- 验收证据：离线测试曾证明 JSON Output opt-in 的构造契约，但用户在真实运行态再次复现 `model_unavailable`，因此此前把离线契约测试当作真实故障修复证据属于假绿。运行态后端进程于 2026-07-28 15:22 启动且 `/health` 返回正常，已排除旧进程与后端不可达；502 的底层异常仍被既有安全边界正确脱敏，尚未定位到具体模型节点。
- 未通过项：运行中的 uvicorn 尚未重启加载最终局部降级改动，且尚未使用用户原旨意执行一次新的付费真实图复验；这两项需要额外运行态授权。

- 最终连续验收（2026-07-28）：以原旨意
  `我要招两个人做量化炒股，然后让他们去开发` 从真实、已登录 `/study` 页面串行提交。
  首轮在第 6 次暴露 `bureau/schema_invalid` 后立即归零；修复司级内容漂移边界、重启后端并
  重新从 0 计数。最终同一代码修订连续 10 次成功，均为 `multi` 且部门为吏部、工部，
  页面包含司议、部议、军机处会审、丞相总结与三条建议。当前用户史馆中该旨意 `REPLY`
  数量从基线 5 增至 15，每轮恰好增加 1；最近 10 个军机处案件均为 `ARCHIVED`，
  `failure_stage` 与 `failure_code` 均为空。
- 最终离线复验（真实 10 连胜之后）：后端 `1833 passed, 1 warning`，唯一警告为既有
  Starlette/httpx2 弃用提示；Ruff `All checks passed!`；前端 `347 passed, 0 failed`；
  harness 基线 72 项、自测 43 项、Stop hook 自测 3 项、product-flow runner 自测 25 项
  全部通过；`git diff --check` exit 0，仅有工作树 LF/CRLF 提示。
- 验收结果：Accepted
