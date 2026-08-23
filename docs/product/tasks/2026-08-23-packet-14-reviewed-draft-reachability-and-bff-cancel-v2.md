# Packet 14 — Reviewed Draft, Reachability and BFF Cancellation V2

> 状态：`M0_APPROVAL_DRAFT / SUPERSEDES_V1 / NOT_LANDED / PRODUCT_STOP`
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

本三件套未提交时可直接丢弃；V1 dirty product draft 原样保留。当前为
`PENDING_OWNER_M0_DECISION / PRODUCT_STOP`，上述 exact digest 尚未获 Owner 接受，不授权提交、推送或产品施工。
