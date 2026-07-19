# Architecture / Unit-of-Work adversarial review v2

> 历史审查记录：只绑定原本地草案，不是 P21 当前集成批准；最终状态以
> `packet_review/review-v1.md` 为准。

日期：2026-07-19

结论：`MUST_FIX / 3 OPEN`

v1 七项均 `CLOSED`。新发现：

1. alias 找到旧 claim 后必须按 row 的 payload keyset generation 重算，否则 rotation 后 same payload 假 conflict；同时要阻断 alias divergence。
2. active tenant 的 fixed purge 与永久 replay guard 矛盾，必须选择 scope retirement、domain reuse proof 或诚实降低保证。
3. CANON README 仍冻结旧单行合同，与 claim+alias/TOMBSTONED 规格冲突。

v2 closure 已进入 draft v3：历史-generation constant-time compare、alias divergence、scope-retire/domain-reuse purge policy、README authoritative pointer；01C 也收窄为单一 canonical target。等待 final gate。
