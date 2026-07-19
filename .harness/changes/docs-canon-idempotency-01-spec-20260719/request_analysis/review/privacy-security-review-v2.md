# Privacy / security adversarial review v2

日期：2026-07-19

结论：`MUST_FIX / 4 OPEN`

v1 的 MAC keyset、wire redaction、external effect 与 aggregate privacy 四项已关闭；仍需：

1. 历史 payload generation compare 与 authoritative registry revision fence；
2. active-tenant purge 可执行模型与 field/layer scoped legal hold；
3. alias→claim tenant/scope 数据库强绑定；
4. canonical base64url decode/re-encode 与 MAC preimage。

v2 closure 已进入 draft v3：row-generation constant-time compare、transaction revision fence、scope-retire/domain-reuse policy、RetentionHold preservation class、composite FK invariant、安全 event、canonical decoded bytes MAC。等待 final gate。
