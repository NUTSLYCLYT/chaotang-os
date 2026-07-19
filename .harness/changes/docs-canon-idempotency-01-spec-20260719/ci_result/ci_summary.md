# CI 摘要：docs-canon-idempotency-01-spec-20260719

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| focused 现有事实 pytest（11 files） | 0 | `72 passed, 4 skipped in 6.86s` | 原本地草案的 facts regression | pre-integration local stdout / 2026-07-19 |
| `node scripts/harness-doctor.mjs` | 0 | `0 errors, 0 warnings` | 原本地草案根项目边界 | pre-integration local stdout / 2026-07-19 |
| `cd backend && python3 scripts/harness_doctor.py` | 0 | `0 errors, 0 warnings` | 原本地草案 backend harness | pre-integration local stdout / 2026-07-19 |
| 架构/UoW 对抗复审 v1→v3 | 0 | `v1 NO_GO / v2 MUST_FIX / v3 GO, 0 OPEN` | rotation、transaction state、scope、race、retention、Exit、SSOT | `request_analysis/review/architecture-review-v*.md` |
| 隐私/安全对抗复审 v1→v3 | 0 | `v1 MUST_FIX / v2 MUST_FIX / v3 GO` | HMAC/keyset、raw key、redaction、purge/hold、alias binding、provider boundary | `request_analysis/review/privacy-security-review-v*.md` |
| diff/whitespace/status consistency | 0 | PASS | 原本地 17 文件草案 | pre-integration local stdout / 2026-07-19 |
| 当前 11 文件 facts regression | 0 | `131 passed, 3 skipped in 8.24s` | routing/decree/Court/launch/evidence/outbox/formal/memory/migration/engine | P21 worktree / 2026-07-19 |
| 当前三层 doctor | 0 | `0 errors, 0 warnings` | root/frontend/backend harness | P21 worktree / 2026-07-19 |
| 当前 D6 回归 | 0 | `42 passed, 0 failed` | 历史审查治理与本地反馈门 | P21 worktree / 2026-07-19 |
| migration revision 图静态解析 | 0 | head=`016_schema_literal_contract_guard` | 不执行 migration、不预占未来编号 | P21 worktree / 2026-07-19 |
| 14 路径 + 退役 SSOT 零恢复 | 0 | PASS | 仅本 change Markdown | P21 worktree / 2026-07-19 |

## 结果

CANON-IDEMPOTENCY-01 原本地 atomic spec 完成并获双复审 `GO`。P21 保留其单一 Backend Request Idempotency authority、claim + retained-generation alias index、immutable versioned scope、KMS keyset rotation、同 Unit of Work、TOMBSTONED/purge、result-ref replay authorization 与 external Receipt/fencing 设计作为历史证据。

这些历史验证只支持“该草案曾完成双审”，不建立当前产品 `SPEC_READY`；更不支持
`IMPLEMENTED` 或 `TENANT_SCOPE_FAIL_CLOSED`。

P21 已在 `475763a` 基线上复跑 facts、三层 doctor、D6 与路径一致性；当前只等待固定
SHA Claude 审查和 D6 发布，不宣称中央集成已经完成。

## 未验证项

- 没有 request idempotency service/model/migration/KMS/scope registry 或生产 adapter。
- 没有 SQLite/Postgres真实并发、migration upgrade/downgrade/upgrade、rotation、stale writer、tombstone/purge/hold 行为测试。
- 没有读取/迁移/清理 plaintext key、payload、JSONL/file store 或真实数据库。
- 没有 provider/tool receipt、lease/fencing、AMBIGUOUS reconciliation L3。
- 当前发布基线=`475763a2d24308ca793b44914c8d4f38be651a05`；P21 固定 H、Claude 与 D6 发布尚待执行。
- 远端已删除原 CANON index/parent/catalog；P21 不恢复这些路径，只归档本 change 证据。

## Diff 与回滚复核

- changed files：本 change 目录内 14 个 Markdown；无产品 SSOT、Python/TypeScript/schema/migration/data。
- diff review：历史架构与隐私双审结论/正文保留并增加历史标识；当前固定 SHA 复审待执行。
- 回滚是否演练：完成 docs-only 反向可读性复核；未执行破坏性删除。未来 production claim 采用 fail-closed/forward-fix，不允许 destructive downgrade。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| current facts 与机制分类 | `idempotency-census.md` + 当前 131/3 facts regression | PASS |
| 自包含 atomic spec 历史证据 | `atomic-spec.md` | PASS |
| 架构/UoW 独立复审 | architecture v3 | GO |
| privacy/security 独立复审 | privacy-security v3 | GO |
| 当前 facts regression | 131 passed / 3 skipped | PASS |
| 当前三层 doctor + D6 | 0/0 + 42 passed | PASS |
| 已退役 index/blueprint/catalog 零恢复 | 14 路径一致性 | PASS |
| runtime/schema/data 不越权 | status/diff + reviewer permission checks | PASS |
| 历史治理估算留证 | `governance-progress-assessment.md` | HISTORICAL_ONLY |

## 声明状态

- `VERIFIED_PARTIAL`：历史草案与双审已留证，当前基线复验完成；Claude/D6 发布未完成。
- Runtime：`ABSENT / NOT_IMPLEMENTED / NOT_AUTHORIZED`。
