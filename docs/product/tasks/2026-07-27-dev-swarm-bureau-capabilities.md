# 任务：将 dev 蜂群能力下沉为司级能力包

> 本任务遵循 `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`；不得改变下旨、证据、回奏和归档主流程。

## Status

Accepted

## Product Definition

- 用户确认：用户于 2026-07-27 确认采用“蜂群下沉为司级能力包”的方案，并明确要求能力包按业务意图自动触发、不得改变既有主流程。
- 问题：`dev` 分支沉淀了多种业务蜂群能力，但直接迁入会重复丞相、军机处、锦衣卫和史馆的控制权。
- 目标用户：通过上书房下达经营、研发、交付、人才或内容旨意的企业决策者。
- 目标：将可复用的 `dev` 专业能力接入当前六部的司级选择与办理过程；部门能按旨意自动选择本部相关能力，最终仍由既有部级综合、军机处会审、丞相回奏和史馆归档完成。
- 非目标：不迁移 `dev` 的 `court`、旧事件编排器、旧 Web API、SQLAlchemy 数据层、旧锦衣卫、旧史馆或旧 IMA 数据层；不新增业务入口；不将当前同步主链改为异步办件；不触发现实世界动作。

## Acceptance Criteria

- [x] 六部只能从本部已注册的司级能力中按业务意图选择；跨部、未知或重复选择必须失败关闭。
- [x] 可复用的 dev 能力以司级能力包接入：兵部（获客、项目方案）、户部（财务、报价）、刑部（法务合规）、工部（产品、供应链、研发、制造、交付/售后）、礼部（品牌、内容、运营）、吏部（人才），以及受控的工具/参谋能力。
- [x] 每个能力包只接收本部上下文与已采纳证据，只返回结构化专业意见、产物、风险和证据引用；不得自行跨部、归档、调查或执行现实动作。
- [x] 单部门、跨部门军机处会审、锦衣卫证据边界、史馆单条 `REPLY` 归档和既有 HTTP/BFF/UI 契约保持不变。
- [x] 旧 dev 运行框架未被引入；新增能力均有离线测试，且既有回归通过。

## Delivery Constraints

- 范围：`backend/app/agents/bureaus/`、`backend/app/agents/ministries/`、相关后端测试、任务与设计文档；最终允许路径由实施负责人复核。
- 兼容性：保留丞相选部、部选司、单部办理/多部军机处串行会审、丞相回奏和史馆归档顺序；不改 ADR 0028。
- 风险与限制：能力包会增加同步模型调用与延迟；本任务不以新增异步入口绕过该限制。涉及合同、报价、发布、付款、签约等不可逆事项仅输出建议或草案。
- 技能计划：`brainstorming`、`test-driven-development`、`writing-plans`、`verification-before-completion`、`codex-engineering-workflow`。
- Codex-only：否。

## Affected Modules

- 模块：司级能力注册与执行契约；依赖：现有六部司级 Agent。
- 允许路径：`backend/app/agents/bureaus/**`、`backend/app/agents/ministries/**`、`backend/tests/**`、`docs/product/tasks/2026-07-27-dev-swarm-bureau-capabilities.md`、`docs/superpowers/specs/2026-07-27-dev-swarm-bureau-capabilities-design.md`。
- 模块：六部意图选择与部级综合；依赖：丞相和军机处既有调用链。
- 模块：测试与架构文档；依赖：ADR 0028 不可变主流程。

## Technical Plan

- 架构边界：只把 `dev` 蜂群语义下沉为现有六部司级能力包，不恢复旧 swarm 控制面、事件总线、API、队列或持久化。
- 接口与依赖：能力注册表与司级提示接入既有六部调用链；六部仍通过现有部门代理完成选司、逐司咨询和部级综合。
- 验证顺序：军机处定向回归 → 蜂群专项 → 完整后端 Ruff/pytest → 仓库 harness 与 self-test。

## Implementation Report

- 当前实现包含静态司级能力包、提示注入、六部选司完整性校验及对应离线测试；旧 swarm 运行框架未引入。
- 军机处多部门测试夹具已按 `departments` 顺序生成等长部议，生产 API 的失败关闭契约保持不变。
- ADR 0028 完整性校验在计算 SHA-256 前统一 CRLF、CR 为 LF；业务基线正文未修改。
- 实际使用技能：`using-superpowers`、`using-git-worktrees`、`executing-plans`、`test-driven-development`、`record-failure`、`codex-engineering-workflow`、`verification-before-completion`。
- 未运行真实 DeepSeek、外部网络或 MCP smoke；本次迁移仅做离线验证。

## Acceptance Review

- 验收结果：Accepted
- 验收证据：
  - 军机处案件 API：`8 passed, 1 warning`。
  - 蜂群专项：`328 passed, 1 warning`。
  - 完整后端：Ruff `All checks passed!`；pytest `1833 passed, 1 warning`。
  - 仓库门禁：`node scripts/check_harness.mjs` 通过（72 个基线文件）；harness self-test 通过（44 项）；Stop hook self-test 通过（3 项）；product-flow runner self-test 通过（25 项）；`git diff --check` 通过。
- 未通过项：无。
- 剩余风险：测试仍报告一条既有 `StarletteDeprecationWarning`，属于依赖升级维护项；真实模型与外部集成未在本次离线迁移中执行。
