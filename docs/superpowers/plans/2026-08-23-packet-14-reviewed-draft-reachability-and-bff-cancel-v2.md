# Packet 14 Reviewed Draft, Reachability and BFF Cancellation V2 — Plan

## Contract

- Task：`PACKET-14-REVIEWED-DRAFT-REACHABILITY-AND-BFF-CANCEL-V2-20260823`
- Base/tree：`49634a4a857e1c29ff1819ca0fd661f4ca5fa148` / `45c06766bddd2cc42faaf1679d839ba4f70dfe53`
- Proposed manifest digest：`sha256:263619f1325a6e13ff15b0ef509fcfcb2ddbc7a0892096ff53af857cab991476`
- Scope：V1 exact30 + work-product handler/test = exact32。
- Exit：完成 reviewed draft 与 final fingerprints；非可接受产品 candidate。

## Sequence

1. 三件套 closed schema、exact32、base/tree、canonical digest 独立复审；Owner 接受后才提交/推送。
2. 远端双读稳定，从新干净 worktree运行 exact Task ID；非 GO 停止。
3. byte-for-byte 重放 V1 exact30 draft，再以 RED 驱动 work-product handler `request.signal`、backend client deadline/cap/cancel。
4. 按 V1 完成 backend artifact safety、reachability amendment、REALSTACK/GENERATION/DELIVERY-BROWSER 三份独立证据。
5. backend full+Ruff、frontend full、release regressions、三证据与 code/Python/TypeScript/security review 全绿。
6. 只在最终字节稳定后冻结六部 two fingerprints；停止产品工作，不提交 candidate。
7. 独立 compatibility 治理包修改 readiness test + protected Root Harness；随后新立最终 exact32 P14 M0 重放并全绿。
8. Core RC 未形成唯一 clean SHA/tree 前，不进入军机处 Stage B。

## Added RED matrix

1. inbound request pre-aborted 时零上游 fetch；
2. client disconnect 在 never-headers、headers 后、body 中途均 abort 上游；
3. deadline 与 inbound abort 竞争只触发一次 cleanup，零 timer/rejection 残留；
4. declared/undeclared/chunked response cap+1 立即 cancel，成功 work-product `<=262144 bytes`；
5. upstream cancel/release 失败仍返回稳定脱敏 503；
6. artifact ID、work-product ID/version、receipt sequence splice 继续失败关闭。

## Non-goals

不新增 route/BFF/API/事实源，不修改 Harness/authority/ADR/CI，不调用真实模型/公网，不读取生产数据/secret，不执行未独立
授权的产品 commit/push/merge/release/deploy。
