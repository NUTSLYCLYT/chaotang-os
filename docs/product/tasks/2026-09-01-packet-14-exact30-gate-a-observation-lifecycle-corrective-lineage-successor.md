# Packet 14 — Exact30 Gate A Observation Lifecycle Corrective Lineage Successor

## Status

Draft

Harness document classification: `Draft`. This field is not the live product-authority state. The active lifecycle row below is selected mechanically from Git identity, live remote HEAD, formal approval identity, machine result, product-child state, verification and independent review evidence.

Task ID: `PACKET-14-EXACT30-OBSERVATION-LIFECYCLE-CORRECTIVE-LINEAGE-SUCCESSOR-20260901`

## Product Definition

This forward-only successor binds canonical `ext-dev@43dc866bb4a0305ecdc8d92d7fe906d831c04720`, tree `fcb5cc8278fecbcf02485ea4f433010ace243872`. It preserves the complete P14 trusted-artifact exact30 value and closes the independent-review defect in the existing RC1 acceptance transport: an edge or CDP observation can be registered before its trigger, then outlive a trigger failure and leave a timer, listener, waiter, active expectation or late rejected promise outside the original control flow.

The exact30 donor remains untouched at `/home/ubuntu/Projects/chaotang-os/.worktrees/p14-exact30-gate-a-lifecycle-truth-corrective-successor-candidate-20260901`, HEAD/tree `c6bcaf524fbd6dd5984337b429e279d1791158c8 / 37a9e25c184b873c87bb65422482e70a32e31071`. It is exactly 30 modified `100644` paths with bundle `sha256:27c544f37e9549d3a99f66ace498bccd8c3a8d5e2d94ce028773fe48b4be4882` and full-index diff `sha256:6af72651a1da268e32f3c29af6642afcd496f6792eae4bb8817e787fb9da2e18`. Its disposition is `BYTE_DONOR_ONLY / NO_CANDIDATE_IDENTITY / NO_VERIFICATION_INHERITANCE`.

The earlier three-file draft based on `fb5d3f4af426f6140ef905ff015721692396d084 / 82718add3837287871b9905188e4428767094885` is frozen in its original worktree as `STOP / REMOTE_BASE_DRIFT / BYTE_DONOR_ONLY / NO_REANCHOR`. It has no approval, canonical freeze, authority, candidate or passing identity and is not modified by this successor.

Mechanical ancestry from donor HEAD `c6bcaf52…` to the new base contains exactly five direct single-parent commits: `74200072…`, `3f0cda28…`, `fb5d3f4a…`, `4fcd02ef…`, and `43dc866b…`. Their changed paths have zero overlap with the manifest's exact30 product paths. The current base is therefore a new lineage, not a re-anchor of either predecessor.

Lifecycle projection:

| Mechanical condition | Effective state |
| --- | --- |
| only the proposed draft exists and no formal approval commit exists | `DRAFT / NON_AUTHORIZING` |
| formal approval is a local direct child of the frozen base while remote still equals the base | `FORMAL_APPROVAL_LOCAL_ONLY / NON_AUTHORIZING / DO_NOT_AUTHORIZE_OR_PUSH_PRODUCT` |
| formal approval is the remote direct child of the frozen base before machine GO | `FORMAL_APPROVAL_PUSHED / AUTHORITY_NOT_YET_CONSUMED` |
| machine returns `GO / APPROVED_FOR_ONE_CHILD`, remote still equals the formal approval and no product child exists | `APPROVED_FOR_ONE_CHILD` |
| approval transport fails, remote drifts or machine authority returns `STOP` | `AUTHORITY_OR_TRANSPORT_STOP / ABANDONED / NO_RETRY / NO_INHERITANCE` |
| independent P0–P2, verification failure or scope drift occurs before a product child | `ABANDONED_AFTER_REVIEW_OR_VERIFICATION_STOP / NO_RETRY / NO_INHERITANCE` |
| exact30 direct child exists and gates/reviews remain incomplete | `GATE_A_CHILD_CREATED / VERIFICATION_PENDING / NO_CANDIDATE_ACCEPTANCE / MUST_NOT_PUSH` |
| any positive gate or independent review fails after the product child | `GATE_A_CHILD_FAILED / ABANDONED / MUST_NOT_PUSH / NO_RETRY / NO_INHERITANCE` |
| gates 00–98 and the required reviews pass before gate 99 | `GATE_A_BYTE_DONOR_CHILD / NO_CANDIDATE_ACCEPTANCE / NOT_AUTHORIZED_FOR_PUSH / MUST_NOT_PUSH` |
| gate 99 executes after all positive gates and reviews pass | mandatory `STOP / GATE_B_REQUIRED` with exit `86` |

After materialization, the formal manifest under `request.approvalPath` is the only machine authority source. The proposed path is a pre-materialization byte donor only and never defines live authority or product scope.

## Acceptance Criteria

- [ ] The proposed approval, Task and Plan bind only `43dc866b… / fcb5cc82…`; all older governance and authority identities remain donor/history only.
- [ ] A future formal approval commit is a direct single-parent child of `43dc866b…` and contains exactly the formal manifest, this Task and this Plan, all `100644`.
- [ ] Machine product authority may run once only after that approval is ordinary-fast-forwarded and the live remote is verified. It must run from a freshly initialized standalone `/tmp` repository with an empty template, exact origin `git@gitee.com:msxn/chaotang-os.git`, hardened Git environment, exact detached approval identity and an explicit local-config allowlist. That ephemeral repository must set and verify `core.sshCommand=/usr/bin/ssh -F /dev/null` before and after authority execution; the mutable main repository continues to reject `core.sshCommand`. This is an isolated execution environment for the existing canonical authority, not a second authority. Any machine or transport `STOP` terminates the successor.
- [ ] A fresh isolated candidate re-materializes exactly the ordered 30 `request.productPaths`, remains `30 MODIFY / 0 ADD`, all `100644`, with no untracked or 31st path.
- [ ] Donor HEAD/tree, the exact 30 dirty paths, bundle and full-index diff are mechanically rechecked before byte transfer.
- [ ] Twenty-eight candidate paths remain byte-for-byte identical to the donor; new corrective edits are limited to `scripts/run_rc1_release_acceptance.mjs` and `scripts/run_rc1_release_acceptance.test.mjs`.
- [ ] One idempotent cancellable observation contract is used across edge and CDP paths; it owns and synchronously clears only its timer/listener/waiter/active identity and consumes its registered promise before rethrowing the original trigger error.
- [ ] Edge trigger failures are covered at all four sites: generic `observedBrowserAction`, `uiResume -> page.navigate`, `lookup -> page.evaluate` with `clickedLookup=false`, and `confirm -> page.evaluate` with `clickedConfirm=false`.
- [ ] CDP trigger failures cover both `Page.navigate` send rejection and a returned `errorText`; both paths cancel the pre-registered load observation before rethrow.
- [ ] Tests prove idempotent double cancellation, event-wins and trigger-wins races, settle-exactly-once, unchanged timeout error semantics, unchanged success behavior, `assertIdle`, zero active/timer/listener/waiter counts and no `unhandledRejection` one event-loop turn later.
- [ ] Two stale-handle isolation tests prove that a cancelled/completed observation A cannot cancel, settle or mutate successor observation B: one edge cancellation case and one CDP callback case. Each observation uses a non-reusable opaque identity token, and B settles only through its own event.
- [ ] The runner test file is exact donor bytes followed only by an EOF suffix. No donor byte, test title, assertion or negative case may be deleted, modified, skipped, todo-marked or replaced by a title-only/empty test; the suffix must contain substantive behavior assertions and must not inspect donor hashes, donor paths, Git archives, environment variables or other gate-aware markers.
- [ ] Real RED is produced in a hardened `/tmp` archive containing candidate tests bound byte-for-byte to candidate HEAD plus an `O_NOFOLLOW`/before-after-`fstat`/mode/size/raw/blob verified donor implementation. The archive rejects links and unsupported members. The eleven frozen trigger/race/stale-isolation nodes must fail there and pass only on the candidate implementation.
- [ ] POSIX preflight proves `/tmp` is ext4, Python and Node resolve it as their temporary directory, and create/read/write/truncate/chmod/delete all work after closing `mkstemp` descriptors.
- [ ] Frontend tests, Doctor tests, release regression and product-authority regression use process-local `TMPDIR=/tmp TEMP=/tmp TMP=/tmp`; no persistent environment or Git configuration is changed.
- [ ] Remote checks reject include paths, SSH variant, origin upload-pack/proxy, protocol-ext, credential helper, fsmonitor, HTTP overrides and URL rewrite configuration before using the fixed literal Gitee remote. In the ephemeral standalone repository only, the sole permitted SSH override is exact local `core.sshCommand=/usr/bin/ssh -F /dev/null`; every other local config key is rejected unless named by the frozen minimal repository allowlist.
- [ ] The complete backend, frontend, release, Harness, Doctor, authority-regression, V2 and diff-check matrix passes.
- [ ] Governance, Python and Security independent reviews return zero P0–P2 before any Gate A local product child is accepted as evidence.
- [ ] Gate 99 remains the intentional exit `86`. A Gate A child is `BYTE_DONOR_ONLY / NO_CANDIDATE_IDENTITY / NO_VERIFICATION_INHERITANCE / NOT_AUTHORIZED_FOR_PUSH / MUST_NOT_PUSH`; no machine candidate verification, product push, Pilot, Release or deployment occurs.
- [ ] Any later Gate B starts from then-current `origin/ext-dev`, uses a fresh successor approval, re-materializes exact30 as a new direct child and reruns all verification; it inherits no Gate A candidate identity.

## Delivery Constraints

- Canonical base: `43dc866bb4a0305ecdc8d92d7fe906d831c04720 / fcb5cc8278fecbcf02485ea4f433010ace243872`.
- Approval commit paths are exactly the future formal approval, this Task and this Plan.
- Product paths remain the manifest's exact ordered 30 paths. No add, remove, rename, reorder, status drift or mode drift is allowed.
- Review correction is confined to the two existing CDP/edge paths `scripts/run_rc1_release_acceptance.mjs` and `scripts/run_rc1_release_acceptance.test.mjs`.
- The other 28 exact30 paths, especially `backend/app/operations/runtime_data_registry.py`, `backend/tests/test_accounting_confirmation_api.py`, and `backend/tests/test_report_artifacts_api.py`, must retain donor raw/blob/byte identity.
- Do not modify readiness validators, Harness, authority, locks, wheelhouse, protected exact2, unrelated product paths, customer data or deployment state.
- Process-local POSIX temp normalization is verification-only. No system, user, Git, Python, pytest, npm or Node configuration may be persisted.
- No merge, cherry-pick, rebase, force-push, product push, Pilot, Release, publication or deployment is authorized by this draft.

## Affected Modules

- 模块：P14 trusted-artifact Gate A exact30 and the existing RC1 edge/CDP observation lifecycle.
- 允许路径：the manifest's exact ordered 30 product paths; corrective edits are further restricted to `scripts/run_rc1_release_acceptance.mjs` and `scripts/run_rc1_release_acceptance.test.mjs`.

## Technical Plan

1. Recheck the live remote, canonical base/tree, donor HEAD/tree/status/modes, donor bundle/full-index diff, five-commit ancestry and zero-overlap proof.
2. Freeze this new proposed three-file governance package; the old `fb5d3f4a…` draft remains untouched and terminal.
3. After a future Owner canonical confirmation, materialize only the formal approval, Task and Plan and ordinary-fast-forward that direct child.
4. Create a fresh standalone `/tmp` repository with an empty template, hardened environment, exact origin `git@gitee.com:msxn/chaotang-os.git` and minimal local-config allowlist; set exact local `core.sshCommand=/usr/bin/ssh -F /dev/null`, fetch only the exact pushed approval, detach it, verify tree/three approval paths/raw/canonical identity and clean state, then run the repository's canonical product authority exactly once. Recheck the allowlist and exact SSH command afterward. Any transport or machine `STOP` ends the lineage.
5. In a fresh candidate, copy all exact30 donor bytes; prove 28 paths remain identical and only the two existing RC1 runner paths differ.
6. Append real negative tests first. In hardened `/tmp`, bind candidate test bytes to candidate HEAD, combine them with a descriptor-verified donor implementation and prove the eleven trigger/race/stale-isolation nodes fail for the real defect.
7. Implement one narrow cancellable observation handle. Register before trigger; on trigger error, synchronously cancel its own resources, attach/consume the observation promise, then rethrow the original error. Preserve success and timeout semantics.
8. Run the manifest's complete process-normalized matrix and three independent reviews.
9. A future local Gate A product child may be created only as non-pushable-by-policy byte evidence. Gate 99 exits `86`.
10. Any candidate verification or product landing requires a separate Gate B successor from the then-latest remote and complete re-materialization/revalidation. Gate B uses the same fresh standalone-repository isolation for the canonical machine candidate verifier.

## Implementation Report

Read-only diagnosis and successor drafting are complete. `origin/ext-dev` was verified and advanced by ordinary fast-forward to the independently verified Honglusi product child `43dc866b…` before this package was created. The P14 donor remains unmodified. Mechanical recomputation confirmed its exact 30 paths, bundle and full-index diff. The five intervening commits have zero exact30 overlap.

The predecessor draft's three independent reviews identified incomplete donor locking, incomplete edge/CDP trigger coverage, missing real RED, insufficient race/residual-resource assertions, incomplete POSIX normalization, incomplete SSH-config rejection and inaccurate Gate A “unpushable” wording. This successor encodes all of those points as gates and constraints. No P14 product file, formal approval, authority, candidate commit, product push, Pilot, Release or deployment has occurred under this successor.

## Acceptance Review

This section records the drafting checkpoint only: the first lifecycle row applies now, `DRAFT / NON_AUTHORIZING`. It is not a durable live-authority declaration. After any approval commit, push, transport check, machine result, product child or review transition, operators must select the matching lifecycle row above. Governance review verifies the new lineage, old-draft no-reanchor boundary, exact30/28+2 scope and Gate A/Gate B lifecycle. Python review verifies donor identities, backend/runtime-lock evidence and real RED/GREEN mechanics. Security review verifies fail-closed cancellation, original-error preservation, race behavior, zero residual resources, no late rejection and hardened remote/temp contracts. Any P0–P2, remote drift, old identity reuse, 31st path, third corrective path, donor test deletion, synthetic RED or matrix failure is `NO-GO`.

## Rollback

Before approval materialization, abandon only this isolated new draft; never clean or delete either donor worktree. Pushed governance is immutable and may only be superseded forward. A future Gate A local product child is technically a Git commit but remains `NOT_AUTHORIZED_FOR_PUSH / MUST_NOT_PUSH`; it may be retained as byte evidence or abandoned without moving the remote. Gate B alone may later bind a fresh candidate, rollback identity and reversible RC. Production deployment remains excluded.
