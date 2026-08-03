# CI 摘要：chore-ext-99-branch-convergence-k0-20260803

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `node scripts/harness-doctor.mjs`（实现前） | 0 | `0 errors, 0 warnings` | clean committed baseline Harness | isolated worktree / 2026-08-03 |
| `node scripts/execution-authority.mjs --check` | 0 | `VALID_INACTIVE_GUARD` | v1 fail-closed integrity | isolated worktree / 2026-08-03 |
| `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08` | 0 | `GO / APPROVED_WORK_PACKAGE` | Task 1 docs/governance scope | isolated worktree / 2026-08-03 |
| `node --test scripts/ext-branch-convergence.nodetest.mjs`（RED） | 1 | `0 passed, 9 failed` because registration/schema/manifest/CLI were absent | proves missing behavior before implementation | isolated worktree / 2026-08-03 |
| same专项 test（first GREEN attempt） | 1 | `8 passed, 1 failed`; direct enum contract mismatch | schema readability regression caught | isolated worktree / 2026-08-03 |
| same专项 test（GREEN） | 0 | `10 passed, 0 failed` | schema, manifest, strict field validation, ref resolver, CLI read-only | isolated worktree / 2026-08-03 |
| `node scripts/ext-branch-convergence.mjs --check` | 0 | PASS; `99 refs / 47 families / 0 errors` | live full-tip reconciliation | isolated worktree / 2026-08-03 |
| `--status` and `--family W08_FULL_CONTRACT_LOOP` | 0 | PASS; 99 open refs, W08 9 refs/1 canonical donor | deterministic read projections | isolated worktree / 2026-08-03 |
| focused root regression（pre-commit） | 1 | `107 passed, 3 failed`; all three fail closed because the modified `project-harness.json` is not yet at a committed exact-H | proves authority refuses a mutable control-plane candidate | isolated worktree / 2026-08-03 |
| candidate identity after local commit | 0 | H `51868739857276de2c16c80c8a2cfd4e8b5cd0ef`; tree `0c70cd9f1918882348d4f2d13be37ad1ca17a131`; EXT remained `b78a4f8f...` | exact isolated candidate identity before evidence amendment | isolated worktree / 2026-08-03 |
| exact-H convergence test and CLI | 0 | `10 passed, 0 failed`; `99 refs / 47 families / 0 errors` | Packet behavior and live frozen-ref proof | isolated worktree / 2026-08-03 |
| Git-relation hardening RED | 1 | `10 passed, 2 failed`; `verifyConvergenceGitRelations` absent | proves candidate reachability and rebased-duplicate proof were not previously enforced | isolated worktree / 2026-08-03 |
| Git-relation hardening GREEN | 0 | `12 passed, 0 failed`; live `--check` PASS | all 59 candidate-commit relations and 8 duplicate relations; `p18-v4-rebased` accepted only by all-minus `git cherry` proof | isolated worktree / 2026-08-03 |
| Round 1 multi-Agent independent review | n/a | aggregate `NO_GO`; Critical 0, blocking root causes 6 | schema parity, canonical duplicate target, amendment/Task 2/CI/status consistency | `codex_review/round1-multi-agent-independent-review.md` |
| Round 1 validator remediation RED | 1 | canonical-donor and unknown-root-field cases failed before remediation | proves both reviewer findings were executable defects | isolated worktree / 2026-08-03 |
| Round 1 validator remediation GREEN | 0 | `14 passed, 0 failed`; live `--check` PASS | runtime/schema constraint classes, direct canonical duplicate target, calendar date, fixture cleanup | isolated worktree / 2026-08-03 |
| focused root regression after remediation | 0 | `30 passed, 0 failed` | convergence plus repository structure, knowledge rubric, and capability-entry governance | isolated worktree / 2026-08-03 |
| Round 2 multi-Agent independent review | n/a | aggregate `NO_GO`; Critical 0, Important 2, Minor 0 | malformed container projection could throw or conceal invalid state as `NOT_FOUND` | `codex_review/round2-multi-agent-independent-review.md` |
| Round 2 malformed-container RED | 1 | `branches:null --check` threw `manifest.branches is not iterable` | executable proof of fail-closed projection defect | isolated temporary fixture / 2026-08-03 |
| Round 2 malformed-container GREEN | 0 | `15 passed, 0 failed`; focused root regression `31 passed, 0 failed` | all modes return structured `FAIL` before projection; valid unknown family remains `NOT_FOUND` | isolated worktree / 2026-08-03 |
| exact-H authority v2 / root doctor | 1 | sole error `active-packet EXT ref must equal pinned HEAD` | expected pre-integration fail-closed boundary; contradicts the original plan's pre-review doctor-PASS expectation | isolated worktree / 2026-08-03 |
| full root Node suite | interrupted | passed through 293 tests; two unchanged baseline service-contract failures, then an unchanged `resource-lock` test hung with a `tail -f` child for more than five minutes; test process was stopped and its child exited | broad regression attempt; not claimed PASS | isolated worktree / 2026-08-03 |
| baseline blob comparison for broad-suite failures | 0 | `b78a4f8f...` already contains `/usr/bin/env FENGQUN_SCHEMA_MODE=strict` in both service files; relevant Packet diff is empty | proves the two failures and resource-lock test surface were not changed by this Packet | Git object database / 2026-08-03 |

## 结果

The TDD slice is locally implemented. The frozen inventory contains 14
`ABSORB_ADAPT`, 15 `REBUILD`, 31 `SUPERSEDED_VERIFY`, 25 `ARCHIVE`, 2 `REJECT`,
8 `DUPLICATE`, and 4 `BLOCKED_WIP` records. No source ref or external state was
changed.

## 未验证项

- Independent read-only review has not yet been recorded.
- Pre-integration root doctor cannot pass under the existing W08 authority identity contract; Scope Amendment 01 now records the expected sole STOP and reserves PASS for separately authorized post-integration proof.
- The full root Node suite has two pre-existing failures and one pre-existing hang; no broad-suite PASS is claimed.
- No family capability has been implemented or integrated by this K0 ledger.

## Diff 与回滚复核

- changed files：root Harness schema/manifest/CLI/test/wiki/doctor/records plus the approved convergence plan and ledger link; exact list to be frozen after final verification.
- diff review：self-review in progress; independent review pending.
- 回滚是否演练：未执行 destructive rollback；所有变更均为隔离分支内版本化文件，无数据库/ref/Runtime side effect。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| exactly 99 unique refs | manifest literal set + CLI full-tip check | PASS |
| one family and disposition per ref | validator + 15 Node tests | PASS |
| candidate reachability and duplicate relation | Git relation verifier + live CLI | PASS |
| read-only CLI | SHA-256 before/after + invalid write flag rejection | PASS |
| root Harness registration | pre-integration expected sole STOP; post-integration doctor final pass | PRE_INTEGRATION_EXPECTED_STOP / POST_INTEGRATION_NOT_AUTHORIZED |
| independent review | Rounds 1 and 2 are exact `NO_GO` receipts; latest remediation exact-H requires fresh review | REREVIEW_PENDING |

## 声明状态

- `VERIFIED_PARTIAL / IMPLEMENTED_LOCAL / REMEDIATED_AFTER_ROUND2_NO_GO / REREVIEW_PENDING`
