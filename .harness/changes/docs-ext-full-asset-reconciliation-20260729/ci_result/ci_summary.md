# CI 摘要：docs-ext-full-asset-reconciliation-20260729

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `git worktree list --porcelain` | 0 | captured | worktree inventory | local / 2026-07-29 |
| `git for-each-ref --format=... refs/heads refs/remotes` | 0 | 206 refs | branch/ref inventory | local / 2026-07-29 |
| `find .harness/changes backend/harness/changes frontend/.harness/changes -maxdepth 2 -name summary.md` | 0 | 238 summaries | change record inventory | local / 2026-07-29 |
| `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08` | 0 | GO | current authority | local / 2026-07-29 |
| `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W09` | 0 | STOP / BLOCKED_DEPENDENCY | W09 boundary | local / 2026-07-29 |
| `git diff --name-status feature-chaotang-ext..task/backend-runtime-wiring-r1` | 0 | broad stale diff observed | asset direct-merge risk | local / 2026-07-30 |
| `git diff --name-status feature-chaotang-ext..dev-ext-test` | 0 | broad stale diff observed | asset direct-merge risk | local / 2026-07-30 |
| `git diff --name-status feature-chaotang-ext..codex/harness-only-worktree` | 0 | broad stale diff observed | asset direct-merge risk | local / 2026-07-30 |
| `git diff --name-status feature-chaotang-ext..origin/task/pkt-a1-jinyiwei-real-fetch` | 0 | broad stale diff observed | asset direct-merge risk | local / 2026-07-30 |
| `git diff --name-status feature-chaotang-ext..docs/temporal-decision-intelligence-design-20260727` | 0 | broad stale diff observed | asset direct-merge risk | local / 2026-07-30 |
| `git diff --name-status feature-chaotang-ext..docs/deep-module-projection-design-20260726` | 0 | broad stale diff observed | asset direct-merge risk | local / 2026-07-30 |
| `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08` | 0 | GO | current authority after matrix update | local / 2026-07-30 |
| `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W09` | 0 | STOP / BLOCKED_DEPENDENCY | W09 boundary after matrix update | local / 2026-07-30 |
| `node scripts/harness-doctor.mjs` | 0 | 0 errors, 0 warnings | root harness integrity | local / 2026-07-30 |
| `git diff --check` | 0 | clean | whitespace / patch hygiene | local / 2026-07-30 |

## 结果

`VERIFIED_PARTIAL / BATCH1_DECISION_MATRIX`.

EXT-A9 can proceed before W09 because it is docs-only asset reconciliation.
It does not close W08, activate W09, or integrate product code.

Batch 1 now has explicit decisions and next Packet names. Direct branch
integration is rejected for the inspected high-value branches because each
sampled branch is stale or broad enough to delete current EXT governance
records.

## 未验证项

- Final disposition for every asset family is not complete yet; Batch 1 is now covered.
- No first-batch product absorption has been attempted.
- No W09 activation has been attempted.

## Diff 与回滚复核

- changed files：
  - `.harness/changes/docs-ext-full-asset-reconciliation-20260729/summary.md`
  - `.harness/changes/docs-ext-full-asset-reconciliation-20260729/request_analysis/spec.md`
  - `.harness/changes/docs-ext-full-asset-reconciliation-20260729/request_analysis/tasks.md`
  - `.harness/changes/docs-ext-full-asset-reconciliation-20260729/ci_result/ci_summary.md`
  - `.harness/changes/docs-ext-full-asset-reconciliation-20260729/asset_reconciliation_ledger.md`
  - `.harness/changes/docs-ext-full-asset-reconciliation-20260729/asset_decision_matrix_batch1.md`
- diff review：docs-only baseline; no product code, no authority manifest change.
- 回滚是否演练：未演练；删除本 Packet 目录即可回滚。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| EXT-A9 不依赖 W09 | W08 GO, W09 STOP | PASS |
| Inventory baseline exists | counts captured in ledger | PASS |
| Disposition taxonomy exists | ledger taxonomy | PASS |
| First high-value batch identified | ledger first batch | PASS |
| First high-value batch decision matrix exists | `asset_decision_matrix_batch1.md` | PASS |
| Product code untouched | docs-only diff | PASS |

## 声明状态

- `VERIFIED_PARTIAL / BATCH1_DECISION_MATRIX`
