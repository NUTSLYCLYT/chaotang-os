# Packet 14 — Reviewed Draft, Reachability and BFF Cancellation V2

> 状态：`GOVERNANCE_LANDED / SUPERSEDES_V1 / APPROVED_FOR_ONE_CHILD / PRODUCT_NOT_ACCEPTED`
>
> Task ID：`PACKET-14-REVIEWED-DRAFT-REACHABILITY-AND-BFF-CANCEL-V2-20260823`
>
> Proposed manifest digest：`sha256:263619f1325a6e13ff15b0ef509fcfcb2ddbc7a0892096ff53af857cab991476`

## Frozen identity

- Repository/target：`gitee.com/msxn/chaotang-os` / `origin/ext-dev`
- Base commit/tree：`49634a4a857e1c29ff1819ca0fd661f4ca5fa148` /
  `45c06766bddd2cc42faaf1679d839ba4f70dfe53`
- Inherited task：`PACKET-14-REVIEWED-DRAFT-AND-REACHABILITY-REMEDIATION-V1-20260823`
- Inherited reachability amendment SHA-256：`d3b6671b3a7601fc6ed7fc0771dfef00bb57d5fdc03f52467cecbabab7d82b6a`
- Scope：V1 exact30，加现有 work-product BFF handler/test 两条，严格等于 manifest 的 exact32。

## Why V1 stopped

V1 获得 machine GO 并在隔离产品工作树重放 exact30 后，TDD 前置检查证明完整取消传播不可达：

- `frontend/src/app/api/report-artifacts/[id]/work-product/handler.ts` 已接收入站 `Request`，但调用 backend client 时只传
  `{sessionId}`，无法把 `request.signal` 传给真实上游 fetch；
- 该 handler 及其 `route.test.ts` 不在 V1 exact30；只给 backend client 设置固定超时不能证明客户端断连立即释放上游资源；
- 继续施工将违反 V1 的“需要第31路径立即停止”条件。因此 V1 产品工作树保持未提交，未越界修改。

## Exact delta over V1

本 V2 完整继承 V1 的 artifact safety、REALSTACK/GENERATION/DELIVERY-BROWSER 三证据、reachability v2 wire、独立复审、
六部 successor compatibility 和最终 P14 M0 顺序，只增加两个现有路径：

1. `frontend/src/app/api/report-artifacts/[id]/work-product/handler.ts`
2. `frontend/src/app/api/report-artifacts/[id]/work-product/route.test.ts`

两路径只允许闭合以下行为：

- handler 必须把入站 `request.signal` 传给 `fetchReportArtifactWorkProduct`；客户端断连立即 abort 上游；
- backend client 同时保留 bounded connect/header/body/total deadline 与 262144-byte success cap；signal 与 deadline 任一先触发
  都幂等取消 reader/fetch，不泄漏 timer 或未处理 rejection；
- 负测覆盖 pre-aborted、never-headers、headers 后断连、slow/cap+1 body、cancel rejection 与成功完成后的 timer 清理；
- 401/404/503 继续保持同形、脱敏、`private,no-store`，不新增 route、API namespace 或事实源。

## Acceptance and governance

1. Owner 精确接受本三件套 canonical digest、三文件 approval commit 成为稳定远端头、exact Task ID 机器返回 GO 前，
   product work 保持 STOP。
2. GO 后只可在 exact32 内从头重放 V1 draft，并先补 RED；不得在当前 V1 dirty worktree直接越权追加两路径。
3. V1 task/plan 的全部安全、reachability、三证据、测试、review、fingerprint freeze 与 compatibility 要求原样继承。
4. reviewed draft 阶段仍不可形成可接受产品 candidate；Root Harness 只允许最终两组 fingerprint 未登记这一精确失败。
5. 复审 P0–P3=0 后先完成独立两路径六部 successor compatibility，再新立最终 P14 M0 byte-for-byte 重放 exact32。
6. 未独立授权 product candidate commit/push、merge、release、deploy、真实模型、公网业务调用或生产副作用。

## Stop conditions

- remote/base/tree/digest/exact32/authority 不符，或还需要第33路径；
- 通过固定超时、忽略断连、吞掉 cancel rejection 或放宽响应 cap 来冒充完整取消传播；
- V1 任一安全、三证据、reachability、privacy、cleanup、review 或 Harness 要求被删减；
- 新建 BFF、route、状态系统、事实源或其它无关重构。

## Rollback and current decision

Owner 已精确接受本任务 canonical digest，三件套已作为提交
`a923805f8de2a2da9866b24ec6d2f27add113b19` 落地主线。当前为
`GOVERNANCE_LANDED / PRODUCT_IMPLEMENTATION_NOT_ACCEPTED`：既有 exact32 隔离产品草稿未提交、未推送、未发布，也未形成
可接受 candidate。任何 successor、产品提交、推送、合并、release 或 deploy 仍需独立机器决定与 Owner 精确授权。

## Status

Blocked

`GOVERNANCE_LANDED / APPROVED_FOR_ONE_CHILD / PRODUCT_IMPLEMENTATION_INCOMPLETE`。本节只修复任务模板完整性，不把治理批准、
局部测试或隔离草稿写成产品完成。

## Product Definition

V2 产品定义严格等于 V1 的 P14 artifact safety、三份真实证明和诚实证据合同，加两个既有 work-product BFF 路径以传播
入站 `request.signal`，形成 exact32。不得新增 route、BFF、数据库结构、事实源、生产开关或第33条产品路径。

## Acceptance Criteria

- [ ] exact32 全部 RED/GREEN、安全不变量、focused/full tests、Ruff、前端 test/typecheck/lint/build 通过。
- [ ] 同一 candidate-bound 的 `P14-REALSTACK`、`P14-GENERATION`、`P14-DELIVERY-BROWSER` 由真实 runner 生成并独立复核。
- [ ] Root Harness、doctor、successor fingerprints、机器 candidate verification 与 Owner candidate 决策完成。
- [x] 当前如实标记为未完成；delivery fixture/browser evidence wire 尚未形成可接受的最终真实证明。

## Delivery Constraints

- 产品范围严格等于 V2 approval manifest 的 exact32；需要第33路径立即停止。
- 不得把 fixture、DEMO、fallback、客户端自报或静态数据漂白为 generation/release PASS。
- 本次模板修复只改治理文档，不授权产品代码，也不修改 V2 approval manifest 的历史内容。
- 若本修复作为新提交落地主线，旧 V2 one-child approval 的远端头约束将失效；后续必须生成新的 successor
  task/plan/approval，重新获得 Owner 精确 digest 确认后才能恢复产品施工。

## Affected Modules

- 模块：V1 全部 P14 safety/release 能力，以及 work-product BFF cancellation 传播。
- 允许路径：严格等于 V2 approval manifest `request.productPaths` 的 exact32。
- 依赖模块：Root Harness、product authority、真实浏览器 runner、六部 successor compatibility。

历史产品影响面严格等于
`.harness/approvals/PACKET-14-REVIEWED-DRAFT-REACHABILITY-AND-BFF-CANCEL-V2-20260823.json` 的 exact32。
本次 Phase 1 只修改本任务文档，不修改任何产品模块、approval、Harness、authority、ADR 或 CI。

## Technical Plan

保持既有顺序：先补 cancellation 与所有 safety RED，再完成 exact32 最小实现；随后执行 backend/frontend/release 验证和三份
真实证据，进行 code/Python/TypeScript/security 独立复审，冻结 fingerprints，另立 compatibility 与最终 P14 M0。
证据协议或范围不足时必须先走 successor governance，不得在旧 GO 下硬做。

## Implementation Report

- V2 治理三件套已落地主线，远端产品代码仍未包含本任务实现。
- 隔离产品草稿已完成部分 frontend/backend safety 修复并通过相应精准测试，但没有提交、推送或发布。
- 独立复审证明旧 delivery fixture/browser wire 信息不足，三份真实证明尚未全部验收；补充治理草稿保持未提交。
- 因此当前只能报告“局部实现草稿存在”，不能报告 P14 产品完成。

## Acceptance Review

结论：`INCOMPLETE / NOT_ACCEPTED`。当前没有最终 candidate、完整真实浏览器证据、冻结 fingerprints 或 Owner candidate确认；
旧 V2 approval 不能替代 successor 治理和最终验收。Phase 1 仅恢复 Harness 任务模板合法性，不继续任何 P14 产品代码。
