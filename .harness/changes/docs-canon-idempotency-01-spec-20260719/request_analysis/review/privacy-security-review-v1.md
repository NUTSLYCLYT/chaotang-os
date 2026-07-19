# Privacy / security adversarial review v1

> 历史审查记录：只绑定原本地草案，不是 P21 当前集成批准；最终状态以
> `packet_review/review-v1.md` 为准。

日期：2026-07-19

Reviewer：independent read-only UoW/privacy agent

结论：`MUST_FIX / 6 BLOCKERS`

## Findings

| # | Finding | v2 closure |
| ---: | --- | --- |
| 1 | rolling rotation 可跨 version 双写 | retained-generation alias unique + server generation fence + stale writer reject |
| 2 | 单一 key version 未说明 key/payload 两类 MAC | `key_version` 冻结为不可拆分 keyset generation，原子引用两把独立逻辑 key/subkey；KMS MAC boundary |
| 3 | row 无 policy version/tombstone/purge/erasure/legal-hold 语义 | 增加 policy ref/tombstone/purge times、TOMBSTONED、result-ref clearance、tenant decommission deny 与传播边界 |
| 4 | opaque raw key 无机器可执行 wire/redaction contract | dedicated sensitive header、base64url 16-byte minimum、22—128、no trim/Unicode、edge/WAF/APM/dump redact |
| 5 | external effect 缺 persisted lease/fence/ambiguous semantics | 明确 Receipt owner 的 lease owner、monotonic fencing、late-worker write=0、AMBIGUOUS/no-blind-retry/provider restrictions |
| 6 | “payload 不进业务表/持久化”会误伤合法 aggregate | 改为 replay/aux/observability 禁止；aggregate 仅按独立 PRIV/source/purpose 批准保存最小字段 |

## 补强项

v2 同时限定 server-only random result ref、authoritative object tenant lookup、统一不可枚举错误、actor/purpose materiality 与 claim ID 的受限审计用途。

越权检查通过：本 change 仍未批准 schema、migration、KMS、provider、真实数据或 backfill。

v1 findings 已进入 draft v2，等待原 reviewer独立复审后才可关闭。
