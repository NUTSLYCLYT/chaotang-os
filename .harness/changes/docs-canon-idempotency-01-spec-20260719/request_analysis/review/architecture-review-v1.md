# Architecture / Unit-of-Work adversarial review v1

> 历史审查记录：只绑定原本地草案，不是 P21 当前集成批准；最终状态以
> `packet_review/review-v1.md` 为准。

日期：2026-07-19

Reviewer：independent read-only architecture census agent

结论：`NO_GO / 7 MUST_FIX`

## Findings

| # | Finding | v2 closure |
| ---: | --- | --- |
| 1 | unique 含 key version，active/prior lookup 无法阻止 rolling deploy 新旧实例跨版本双写 | 引入 claim + retained-generation alias unique；new claim 同 UoW 插入全 retained aliases，并加 generation fence |
| 2 | `CLAIMED` 同 UoW 未提交却被描述为其他请求可读 | 冻结 transaction-local only；contender 等 unique 仲裁，超时只返回无持久状态 in-flight |
| 3 | scope/canonicalizer 可原地变化，历史 replay bytes 不可复算 | scope 改为 immutable version-qualified；冻结语言无关 byte contract、旧 vectors/entry retention |
| 4 | Request Idempotency owner 被赋予领域 material/result/retention 决策 | 拆为 registry mechanics owner；domain author；Security/Data Governance approval |
| 5 | unique violation 可能毒化整个 caller transaction | claim 作为第一项 mutation；native conflict/returning 或 nested SAVEPOINT；clean reread |
| 6 | 两态 state 与 tombstone 冲突 | 增加纯基础设施 `TOMBSTONED`，清 result ref、保留 replay guard、永不复活 |
| 7 | first surface 与全仓唯一 authority Exit 相互矛盾 | 分成 01B contract、01C first surface、01D-n migrations、final all-ingress zero-call |

## 保留边界

- ledger 不成为业务状态表；
- auth/data policy 在 claim 前；
- replay 当前鉴权；
- DB claim 不等于 external provider exactly-once；
- plaintext/full payload 不自动 backfill；
- accepted claim 后禁止 destructive downgrade。

v1 findings 已进入 draft v2，等待原 reviewer 独立复审后才可关闭。
