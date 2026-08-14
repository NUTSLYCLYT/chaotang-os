# 任务：真实性与决策质量门

> 所有任务必须阅读并遵循 `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`；若任务与该基线冲突，必须标记为 `Blocked`，不得自行变更流程。

## Status

Accepted

## Product Definition

- 用户确认：用户于 2026-08-13 要求继续实施已批准的 EXT 能力蒸馏下一步。
- 问题：跨层决策输出可能把无证据主张、DEMO/FALLBACK、已知冲突、阻断或高风险动作包装成完成态。
- 目标用户：工程测试角色、Harness 维护者和产品 Runtime Skill 负责人。
- 目标：提供无模型、无网络、失败关闭的结构化决策质量 evaluator，并用正例和欺骗/缺证案例证明门禁。
- 非目标：不修改产品 Runtime、不调用模型、不判断自然语言事实真伪、不授予人工确认或工具权限。

## Acceptance Criteria

- [x] 关键主张必须绑定存在的证据引用，缺证不能进入完成态。
- [x] LIVE/DEMO/FALLBACK/LOCAL 来源必须明确标识，不能由文案冒充。
- [x] 已知冲突、阻断、数据缺口、失败和降级必须结构化披露。
- [x] 高风险完成态必须有服务端可信上下文绑定的人工批准引用。
- [x] 每个输出必须给出明确下一步，稳定错误码可供 Harness 和 UI 使用。
- [x] 至少 20 个正常案例与 20 个欺骗/缺证案例通过离线测试。
- [x] evaluator 接入根 Harness，保持 ADR 0028 和 Runtime Skill 权威不变。

## Delivery Constraints

- 范围：根级结构化契约、离线 evaluator、fixtures、测试、Harness 接线和本任务文档。
- 兼容性：复用现有 EvidenceSufficiency/ReportStatus 语义，不改变 Python 模型或 API。
- 风险与限制：模型输出只允许进入 `packet`；证据验证、高风险分类和人工批准只能由服务端 authority adapter 注入 `trusted_context`，并绑定同一 `decision_id` 与 `action_digest`。当前实现是结构与语义门禁，不提供签名或审批真实性证明。
- 技能计划：`codex-engineering-workflow` + `test-driven-development`。
- Codex-only：是；禁止 Claude CLI、Claude runner 与 gstack-claude。

## Affected Modules

- 模块：根级真实性与决策质量门
- 允许路径：`docs/contracts/decision-quality-gate.schema.json`、`docs/product/tasks/2026-08-13-decision-quality-gate.md`、`scripts/decision_quality_gate.mjs`、`scripts/decision_quality_gate.test.mjs`、`scripts/fixtures/decision-quality-gate.cases.json`、`scripts/check_harness.mjs`
- 依赖模块：现有根 Harness 与 ADR 0028

## Technical Plan

- 架构边界：evaluator 分开接收不可信 `packet` 与服务端 `trusted_context`，不解析 Prompt，不执行动作；CLI 仅用于离线 fixture，不应被当成生产 authority adapter。
- 接口与依赖：Node.js 标准库；输入和输出均为 JSON；无新增依赖。
- 实施顺序：契约与失败样例 → RED → evaluator → Harness 接线 → 独立复审 → 十轮验收。
- 验证计划：Node 单测、fixture suite、Harness/self-test、Git diff 检查。
- 技术风险：若未来直接把模型输出当权威结构字段，会形成 authority laundering；接入 Runtime 时必须由服务端投影系统字段。

## Implementation Report

- 改动摘要：新增 Schema 驱动的结构化决策门、46 个离线案例，并接入根 Harness。模型 `packet` 与服务端 `trusted_context` 分离；证据验证、高风险分类与人工批准不能从模型字段取得。
- 自审：修复了类型混淆 fail-open、模型自报批准、空 fixture 假绿、错误码子集假绿、输入尺寸无上限与 patch 非白名单合并问题。
- 验证：离线 Node 单测、46/46 fixture、根 Harness 与 Harness self-test 通过；最终连续验收与复审已纳入六部收口候选。
- 实际使用的 skill：`codex-engineering-workflow`、`test-driven-development`。
- 验证命令与结果：`node --test scripts/decision_quality_gate.test.mjs` PASS；`node scripts/decision_quality_gate.mjs scripts/fixtures/decision-quality-gate.cases.json` PASS；`node scripts/check_harness.mjs` PASS；`node scripts/check_harness.mjs --self-test` PASS。
- 未运行项与原因：未接 Runtime 或真实审批服务；本阶段仅构建候选控制面的离线结构门。
- 剩余风险：生产接入仍必须由服务端 authority adapter 构造可信上下文并校验审批记录/证据 registry；本地 CLI 文件本身不构成可信来源。

## Acceptance Review

- 验收结果：PASS（仅限离线结构与语义门禁，不构成 Runtime authority adapter）。
- 验收证据：正常与欺骗/缺证 fixture、类型混淆、模型自报批准、trusted-context 绑定、输入大小限制和稳定错误集合均由离线测试覆盖；根 Harness、复审与六部最终候选验收通过。
- 未通过项：无本任务范围内未通过项；生产接入仍须由服务端 authority adapter 重载审批和证据权威。
