# P14 Exact30 Gate A Observation Lifecycle Corrective Lineage Successor Plan

## Status

`DRAFT DOCUMENT CLASSIFICATION / LIVE STATE SELECTED BY MECHANICAL LIFECYCLE TABLE`

## Objective

Carry the complete P14 trusted-artifact exact30 value forward from `ext-dev@43dc866bb4a0305ecdc8d92d7fe906d831c04720`, repairing only the existing RC1 edge/CDP observation lifecycle. Trigger-first failures must synchronously cancel their own pre-registered observations, preserve the original trigger error and leave no timer, listener, waiter, active identity or late rejection. Gate A ends at policy-blocked local byte evidence with exit `86`; it does not verify or push a product candidate and does not deploy.

## Frozen Facts

- Base commit/tree: `43dc866bb4a0305ecdc8d92d7fe906d831c04720 / fcb5cc8278fecbcf02485ea4f433010ace243872`.
- Exact30 donor worktree: `/home/ubuntu/Projects/chaotang-os/.worktrees/p14-exact30-gate-a-lifecycle-truth-corrective-successor-candidate-20260901`.
- Donor HEAD/tree: `c6bcaf524fbd6dd5984337b429e279d1791158c8 / 37a9e25c184b873c87bb65422482e70a32e31071`.
- Donor identity: exactly 30 modified `100644` paths; bundle `sha256:27c544f37e9549d3a99f66ace498bccd8c3a8d5e2d94ce028773fe48b4be4882`; full-index diff `sha256:6af72651a1da268e32f3c29af6642afcd496f6792eae4bb8817e787fb9da2e18`.
- Donor disposition: `BYTE_DONOR_ONLY / NO_CANDIDATE_IDENTITY / NO_VERIFICATION_INHERITANCE`.
- Old `fb5d3f4a… / 82718add…` three-file draft: `STOP / REMOTE_BASE_DRIFT / BYTE_DONOR_ONLY / NO_REANCHOR`; no canonical freeze, approval, authority or candidate identity.
- From donor HEAD to current base there are exactly five direct single-parent commits and zero changed-path overlap with exact30.
- Corrective paths are exactly `scripts/run_rc1_release_acceptance.mjs` and `scripts/run_rc1_release_acceptance.test.mjs`; the other 28 candidate paths are immutable donor bytes.
- Current governance scope creates only three proposed files. It grants no product or deployment authority.

## Execution DAG

1. `BASE_AND_DONOR_FREEZE`: live remote, base/tree, five-commit ancestry, zero overlap, donor HEAD/tree/status/modes, bundle and full-index diff.
2. `THREE_FILE_GOVERNANCE`: strict JSON, duplicate-key rejection, Draft 2020-12 schema, manifest validation, Task contract, exact paths/modes and internal consistency.
3. `INDEPENDENT_DRAFT_REVIEW`: Governance, Python and Security reviews; zero P0–P2 required.
4. `OWNER_CANONICAL_FREEZE`: report canonical/raw/bundle identities and stop for the exact approval-materialization authorization.
5. `APPROVAL_DIRECT_CHILD`: future formal approval + Task + Plan only, direct single-parent child of the current base; ordinary fast-forward only.
6. `AUTHORITY_ONCE`: future product authority may run exactly once from the clean pushed approval inside a fresh standalone hardened `/tmp` repository whose sole origin is exact `git@gitee.com:msxn/chaotang-os.git` and whose local config allowlist pins `core.sshCommand=/usr/bin/ssh -F /dev/null`; the canonical authority remains unchanged.
7. `EXACT30_REMATERIALIZATION`: fresh isolated candidate, ordered `30 MODIFY / 0 ADD`, all `100644`; 28 donor-identical and two corrective.
8. `RED_FIRST`: candidate tests plus donor implementation in an isolated `/tmp` archive must fail the frozen trigger/race nodes.
9. `MINIMAL_GREEN`: one idempotent cancellable observation contract shared by edge/CDP; synchronous own-resource cleanup and promise consumption before original-error rethrow.
10. `FULL_MATRIX`: POSIX preflight; targeted/historical negatives; backend shards; frontend offline tests/lint/typecheck/build; release regressions; Harness/Doctor; authority regression; V2; diff check.
11. `THREE_PRODUCT_REVIEWS`: independent Governance, Python and Security reviews; any P0–P2 is `NO-GO`.
12. `LOCAL_GATE_A_CHILD`: exact30 only, direct child of the approval, clean tree; policy status `BYTE_DONOR_ONLY / NO_CANDIDATE_IDENTITY / NO_VERIFICATION_INHERITANCE / NOT_AUTHORIZED_FOR_PUSH / MUST_NOT_PUSH`.
13. `GATES_00_98`: all positive gates pass while remote remains the approval.
14. `GATE_99_STOP`: fixed exit `86`; no machine candidate verification or product push.
15. `SEPARATE_GATE_B`: fresh successor on then-latest remote, fresh authority, exact30 re-materialization and full revalidation before any candidate landing or reversible RC.

## Exact Scope Contract

The manifest's ordered `request.productPaths` is the only exact30 fact source. The candidate must be `30 MODIFY / 0 ADD`, all `100644`. Gate 01 mechanically binds donor HEAD/tree, all 30 dirty paths/modes, bundle and full-index diff, verifies donor-to-base ancestry and exact30 zero overlap, compares 28 donor-identical paths and requires only the two corrective paths to differ. The separately frozen five-commit single-parent lineage remains a governance fact rather than an overstated Gate 01 claim.

The two corrective paths may add cancellation implementation and additive tests only. The test file must retain every donor line in order. A title without substantive cleanup assertions does not satisfy the contract. A third corrective path, 31st path, mode change, donor drift or test deletion immediately stops the lineage.

## Lifecycle Contract

The Task's `## Status` is the Harness document classification, not live authority. The Task's mechanical lifecycle table is the only prose projection of current state; immutable Git identity, live remote HEAD, formal manifest, machine result, product-child state, verification and independent review evidence select its active row.

Proposed-only remains draft/non-authorizing. A local formal approval remains local-only/non-authorizing. Exact ordinary fast-forward advances only to approval-pushed/authority-not-yet-consumed. Machine GO advances to one-child authority only while the remote still equals that approval. Authority execution occurs in a freshly initialized standalone `/tmp` repository with an empty template, exact origin `git@gitee.com:msxn/chaotang-os.git`, hardened Git environment, exact detached approval and explicit minimal local-config allowlist. That allowlist pins `core.sshCommand=/usr/bin/ssh -F /dev/null`, so canonical authority Git subprocesses cannot read user SSH configuration; the setting is rechecked after execution and never touches the mutable main repository. It runs the same canonical `product-authority.m0.v1`; it is not a second authority. A local exact30 child first enters verification-pending; all positive gates and reviews move it only to Gate A byte-donor evidence, while any failure abandons it. Gate 99 always advances to `STOP / GATE_B_REQUIRED`. Transport failure, remote drift or machine STOP is terminal with no retry or inheritance. Gate B is a new successor from then-current remote, uses the same standalone pinned-SSH isolation for canonical candidate verification and may not inherit a Gate A child identity.

## Observation Contract

One cancellable handle owns an observation identity and is idempotent. Registration may occur before the trigger, but every trigger-error branch must cancel synchronously, remove its own timer/listener/waiter/active identity, consume the registered promise and rethrow the original trigger error. Cancellation may not cancel unrelated observations.

Required trigger sites:

- generic `observedBrowserAction`;
- `uiResume -> page.navigate`;
- `lookup -> page.evaluate`, including `clickedLookup=false`;
- `confirm -> page.evaluate`, including `clickedConfirm=false`;
- CDP `Page.navigate` send rejection;
- CDP `Page.navigate` returned `errorText`.

Required lifecycle proofs include double cancel, event-wins and trigger-wins races, exactly-once settlement, unchanged timeout code/message, unchanged success behavior, `assertIdle`, zero active/timer/listener/waiter counts and no `unhandledRejection` after one event-loop turn. Two additional isolation tests use non-reusable opaque observation identities: after observation A is cancelled/completed, a stale edge cancellation or stale CDP callback for A cannot affect active successor B, and B settles only through its own event.

## RED / GREEN Contract

The runner test file must equal the frozen donor test bytes followed by one EOF-only suffix containing exact named nodes for all edge/CDP trigger sites, idempotency, both race outcomes, both stale-successor isolation cases, timeout semantics, late rejection and success preservation. The suffix must contain substantive behavior assertions and no donor-hash/path/archive/environment or other gate-aware markers. Gate 08 builds a link-free candidate-HEAD archive in `/tmp`, proves the extracted test bytes equal candidate HEAD, replaces only the implementation with an `O_NOFOLLOW` and before/after-`fstat` verified donor file, and requires the eleven trigger/race/stale-isolation nodes to report `not ok`. It then runs five historical plus fourteen new nodes—nineteen exact nodes total—on the candidate and requires every named node to report `ok`. Synthetic assertion failure, title-only tests, skipped/todo tests or donor implementation mutation is not valid RED.

## Verification Matrix

- Exact `git@gitee.com:msxn/chaotang-os.git` origin before and after matrix; the standalone local config is a frozen minimal allowlist whose only SSH override is exact `core.sshCommand=/usr/bin/ssh -F /dev/null`. It rejects include paths, `ssh.variant`, origin upload-pack/proxy, `core.fsmonitor`, `credential.helper`, HTTP overrides, `protocol.ext.allow` and URL rewrites. Machine authority and later Gate B verification use fresh standalone hardened repositories, never the mutable main-repository config or user SSH configuration.
- POSIX preflight: `/tmp` is ext4; Python and Node temp roots are `/tmp`; create/read/write/truncate/chmod/delete succeeds with descriptors closed.
- Exact30 path/order/status/mode, donor bundle/full-index diff, donor-to-base ancestry, exact30 zero overlap and 28/2 split; the five-commit single-parent list remains a separately frozen governance fact.
- Additive-only test contract, real RED and exact named GREEN nodes.
- Historical Python negatives, focused/Ruff coverage and three isolated backend runtime-lock shards.
- Offline frontend dependency identity, tests, lint, typecheck and production build; temp-sensitive tests use process-local POSIX variables.
- Release evidence/build/deployment/RC1/offline verification regressions.
- Root Harness/check/self-test/hook, Doctor check/tests, product-authority regression, V2 check/tests and `git diff --check`.
- Independent Governance, Python and Security reviews with zero P0–P2.
- Gate 99 fixed exit `86`.

## Stop Conditions

- Remote, base/tree, donor identity, lineage, approval path or bundle/diff drift.
- Old draft/authority reuse, re-anchor, verification inheritance or any machine/transport `STOP`.
- Path count/order/status/mode drift, a 31st path, a third corrective path or a changed immutable donor path.
- Missing edge/CDP trigger coverage, non-idempotent cancellation, lost original error, residual handle, wrong race result, altered timeout/success behavior or late rejection.
- Deleted/modified donor test line, skipped/todo/title-only test, synthetic RED or a donor test that no longer executes.
- Non-POSIX temp behavior, persistent environment/config change, backend/frontend/release/Harness/Doctor/authority/V2/diff failure.
- Any independent P0–P2.
- Machine candidate verification, product push, Pilot, Release or deployment during Gate A.

## Rollback

Before formal approval, discard only this isolated draft and preserve both donor worktrees. After governance push, correct only through another forward-only successor. A Gate A local child is technically commit-capable but remains `NOT_AUTHORIZED_FOR_PUSH / MUST_NOT_PUSH`; abandoning it does not move remote. Gate B must start from the latest remote and cannot inherit Gate A candidate identity. Production deployment remains outside both this authorization and this plan.
