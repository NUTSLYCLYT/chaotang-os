# 下旨裸意见导致模型失败且离线验收假绿

## Summary

用户以“我要招两个人做量化炒股，然后让他们去开发”下旨时，真实模型链路在吏部招聘司返回
裸 `{"opinion": ...}` 后失败，页面显示 `model_unavailable`。此前只验证 JSON Output 参数和
注入假模型的合规响应，错误地把任务标记为已验收。

## Root Cause

DeepSeek JSON Output 只保证返回 JSON 对象，不保证遵守业务 schema。招聘司的真实响应是合法
JSON，但缺少证据会话要求的 `status/result/factual_claims/adopted_evidence_ids/fact_basis`
信封；`_parse_ready` 因此以 `uncited_fact_dependency` 失败。现有协议只对
`unsupported_factual_dependency` 提供一次纠正，没有处理模型忽略信封而返回精确裸 opinion
的常见漂移。第一轮补救又让信封纠正与事实纠正共享同一个全局预算，并且只在调查前解析
READY 时处理事实纠正；真实序列在调查后再次出现不支持事实依赖时已无恢复路径。离线测试
全部使用预制合规信封，未覆盖真实 provider 的连续 schema 与事实依赖漂移。
第二轮补齐独立预算和调查后纠正后，真实复验进一步证明纠正响应本身仍可能不合规；状态机
把最终的内容合规错误继续升级为整旨失败，而没有把不可信响应隔离在发生漂移的司级节点。
第三轮局部降级最初只实现了“调查后事实纠正耗尽”的分支，遗漏了设计中已经列明的“首次裸
opinion 信封纠正后仍不合规”分支。真实复验返回单一 `uncited_fact_dependency`，暴露了实施
计划没有逐条映射规格状态的覆盖缺口。
下一次真实复验进入工部后以 `unsupported_factual_dependency` 失败，证明 decree 级纠正预算
被前一个司消耗后，后续司的“无法领取预算”仍被实现为抛错，而不是规格规定的预算耗尽降级。

## Prevention

证据协议只在首个响应精确为单个非空 `opinion` 字段时，使用独立的原子信封纠正预算追加一次
静态、脱敏的信封纠正。事实依赖纠正使用另一个 decree 级一次预算，并同时覆盖调查前和调查后
READY；调查后的纠正可返回严格 READY，或返回 NEEDS_DATA 后按既有二次缺口规则安全降级。
原始裸意见不被接受、包装或回显；纠正结果仍必须通过完整信封、事实依据、证据绑定和不支持
事实依赖校验。其他非法 schema 继续失败关闭。

纠正耗尽后的明确内容合规错误现在丢弃响应、记录
`model_synthesis_degraded:<bureau-node-id>`，并复用既有确定性 evidence-limited fallback。
只有 `uncited_fact_dependency`、`unsupported_factual_dependency`、`response_invalid`、
`adoption_invalid` 和 `evidence_binding_invalid` 可以走该分支；模型网络、认证、配置、SDK
调用失败、身份错误和未知协议错误仍整旨失败。局部降级不读取或拼接被拒 payload。
相同的内容错误白名单同时包围裸 opinion 信封纠正后的最终解析与调查后事实纠正后的最终解析，
防止只修复某一个恢复阶段。
信封或事实纠正预算已被同旨意其他司消耗时，当前司不再尝试额外模型调用，直接记录局部
degradation 并返回 fallback；预算仍严格保持 decree 级最多一次。

## Detection

2026-07-28 17:34 的 `/study` 页面复发证明“单次直接图成功”不能作为稳定验收。运行态验收必须
覆盖真实浏览器/BFF/FastAPI/生命周期/归档链路，并至少连续验证不会因受支持的模型 schema
漂移而失败；若只授权一次付费调用，只能报告该次样本结果，不得据此宣称问题最终修复。案件
生命周期还必须记录或日志必须输出脱敏的失败阶段与稳定错误码，否则只有 `processing_failed`
无法区分司级、部级、会审或最终汇总失败。

`backend/tests/test_agent_evidence_protocol.py::test_bare_opinion_gets_one_sanitized_protocol_correction`
必须先证明旧实现因 `uncited_fact_dependency` 失败，再证明纠正消息不包含原响应且纠正后的完整
信封通过。相关证据协议、司级、六部、军机处、丞相图和 API 回归必须共同运行；仅验证
`response_format` 或注入始终合规的假模型不能作为真实下旨成功证据。最终验收还必须使用用户
原旨意完成一次经授权、无史馆归档的真实图验证。
`test_bare_opinion_then_investigation_can_correct_resumed_factual_dependency` 必须覆盖裸 opinion、
NEEDS_DATA、调查后违规 READY、纠正后合规 READY 的完整四响应序列；并发测试必须证明信封与
事实纠正预算分别只能领取一次且互不占用。
`test_resumed_correction_invalid_envelope_degrades_without_adopting_output` 必须证明最终裸响应不会
被采用或泄漏，并只记录一次 degradation；`test_resumed_correction_model_failure_does_not_degrade`
必须证明第四次模型调用的传输异常仍映射为 `model_unavailable`，不能伪装成成功。
`test_bare_opinion_invalid_correction_degrades_without_using_output` 必须覆盖未进入调查的两响应
序列，并证明第二次裸 opinion 被丢弃、零调查、零采用且只记录一次 degradation。
`test_unsupported_dependency_with_consumed_budget_degrades_locally` 与
`test_bare_opinion_with_consumed_envelope_budget_degrades_locally` 必须覆盖多个司竞争 decree 级
预算的情形，证明后续司零纠正调用、局部降级且不突破预算。

## Evidence

最终真实图在 PID 10488 上完成多部门分流（吏部、工部）、军机处裁决、丞相最终裁决和三条
唯一非空建议，未再抛出模型调用失败。终验脚本曾因使用不存在的
`ministry_outputs`/`processing_paths` 字段给出 `contract_ok: false`；正式图与 API 契约字段
实际是 `ministry_opinions`/`processing_path`。以后运行态验收脚本必须直接复用正式响应模型
或至少从图状态类型生成字段检查，禁止手写另一套字段名造成验收假红。

2026-07-28 的后续真实图复验进一步发现：首次司级响应也可能是带 `status/result` 但缺少完整
`fact_basis` 或事实声明的畸形 READY，而不只是精确裸 `opinion`。该响应同样属于可安全隔离的
`uncited_fact_dependency` 内容漂移；若直接上抛，会再次把单司合成错误误报为整旨模型调用失败。
首次解析现在只对精确裸 `opinion` 消耗一次信封纠正预算；其他畸形 READY 不增加模型调用，直接
丢弃响应、记录局部 degradation 并使用确定性 fallback。检测项
`test_initial_malformed_ready_degrades_without_adopting_output` 必须验证拒绝内容不泄漏、零证据采用
和单次 degradation。

- 业务基线：`docs/decisions/0028-decree-evidence-flow-governance-baseline.md`
- 协议修复：`backend/app/agents/evidence_protocol.py`
- 回归测试：`backend/tests/test_agent_evidence_protocol.py`
- 产品任务：`docs/product/tasks/2026-07-28-fix-decree-model-invocation.md`
- 设计规格：`docs/superpowers/specs/2026-07-28-bounded-bureau-evidence-degradation-design.md`
- 实施计划：`docs/superpowers/plans/2026-07-28-bounded-bureau-evidence-degradation.md`

### 2026-07-28 Task 5 离线独立验证

- 扩展后端回归：
  `cd backend && .\.venv\Scripts\python.exe -m pytest tests/test_synthesis_failures.py tests/test_agent_evidence_protocol.py tests/test_bureaus_agent.py tests/test_ministries_agent.py tests/test_junjichu_agent.py tests/test_chancellor_graph.py tests/test_decrees_api.py tests/test_junjichu_case_lifecycle.py tests/test_junjichu_cases_api.py tests/test_shiguan_adopted_evidence.py -q`
  — exit 0，`536 passed, 1 warning in 18.54s`。警告为 `fastapi.testclient` 关于
  `httpx`/`starlette.testclient` 的 `StarletteDeprecationWarning`。
- 前端离线测试：`cd frontend && npm test` — exit 0，`336 passed, 0 failed, 0 skipped`。
- 后端静态检查：
  `cd backend && .\.venv\Scripts\python.exe -m ruff check app tests` — exit 0，
  `All checks passed!`。
- 根 harness：`node scripts/check_harness.mjs` — exit 0，
  `agentic-check: 通过 (72 个基线文件)`。
- whitespace 门禁：`git diff --check` — exit 0，无 whitespace error；出现 32 条
  工作树文件 LF 将被 Git 转为 CRLF 的换行警告。
- 安全边界：本轮未调用真实模型或网络，未读取密钥或运行态私人数据。
- 结论边界：这批离线结果只完成 Task 5，不构成真实链路稳定性证据。产品任务仍为
  `In Progress`；Task 6 要求同一最终代码修订通过真实 `/study` 完整链路至少连续 10 次，
  任一次失败后从 0 重新计数。
