# Packet 14 — Exact30 Observation Lifecycle RED Contract Corrective Successor

## Status

Draft

Harness document classification: `Draft`. This governance package is `NON_AUTHORIZING / READY_FOR_OWNER_CANONICAL_CONFIRMATION` until its canonical digest is explicitly frozen and its proposed manifest is materialized through a later authorized approval commit.

Task ID: `PACKET-14-EXACT30-OBSERVATION-LIFECYCLE-RED-CONTRACT-CORRECTIVE-SUCCESSOR-20260902`

## Product Definition

This forward-only successor binds `ext-dev@2374d7905b0968897ef6749c13e772d8619f8cbb`, tree `15f53dd12bbe54ac86257eebf6b1efe1b2f5dddf`. The base is the immutable approval commit of the stopped predecessor. The predecessor machine result `GO / APPROVED_FOR_ONE_CHILD` is explicitly abandoned unconsumed because its independent Governance and Python reviews returned P1 on the frozen RED contract. It may not be retried, consumed, inherited or re-anchored.

The stopped predecessor candidate worktree remains untouched at `/home/ubuntu/Projects/chaotang-os/.worktrees/p14-exact30-observation-lifecycle-corrective-lineage-successor-candidate-20260902`, HEAD/tree `2374d7905b0968897ef6749c13e772d8619f8cbb / 15f53dd12bbe54ac86257eebf6b1efe1b2f5dddf`. It contains exactly 30 modified `100644` paths, bundle `sha256:7f0102eb69bf89847c7e5556f16c8a17c1e98add1131ca6be774c256d8705682`, and full-index diff `sha256:6fa08fd9c632e6c162c4fa30cba15eb6c027c9651b5b486a22eaaac4d3dd47ab`. Its disposition is `BYTE_DONOR_ONLY / NO_CANDIDATE_IDENTITY / NO_VERIFICATION_INHERITANCE`.

The older exact30 donor at `/home/ubuntu/Projects/chaotang-os/.worktrees/p14-exact30-gate-a-lifecycle-truth-corrective-successor-candidate-20260901`, HEAD/tree `c6bcaf524fbd6dd5984337b429e279d1791158c8 / 37a9e25c184b873c87bb65422482e70a32e31071`, remains the immutable source for 28 paths. Its bundle is `sha256:27c544f37e9549d3a99f66ace498bccd8c3a8d5e2d94ce028773fe48b4be4882`; its full-index diff is `sha256:6af72651a1da268e32f3c29af6642afcd496f6792eae4bb8817e787fb9da2e18`.

The stopped review established two separate facts:

- the product correction is substantively sound: the direct RC1 acceptance file passes `70/70`, the focused exact nodes pass `19/19`, and Security Review is `GO / P0=0 / P1=0 / P2=0 / P3=0`;
- the predecessor's claimed “real RED” is invalid: the older donor does not export the six test seams required by the 11 new nodes, so every donor run fails at module API lookup before executing lifecycle behavior.

This successor does not falsify or weaken RED. It records `PROOF_GAP_NOT_IMPLEMENTATION_DEFECT / DONOR_HAS_NO_STABLE_TEST_SEAM`, removes the invalid claim that missing exports prove the lifecycle defect, and replaces it with a closed proof set: descriptor-bound donor interface audit, direct candidate behavioral tests using real edge and CDP implementations, full release regressions, and three independent reviews. No source rewriting, data URL, synthetic fallback or title-only assertion is allowed.

Lifecycle projection:

| Mechanical condition | Effective state |
| --- | --- |
| proposed package only | `DRAFT / NON_AUTHORIZING` |
| formal approval local only | `FORMAL_APPROVAL_LOCAL_ONLY / NON_AUTHORIZING` |
| formal approval pushed, before machine run | `FORMAL_APPROVAL_PUSHED / AUTHORITY_NOT_YET_CONSUMED` |
| machine returns GO while remote equals approval | `APPROVED_FOR_ONE_CHILD` |
| transport/machine STOP, remote drift, scope drift or independent P0–P2 | `STOP / ABANDONED / NO_RETRY / NO_INHERITANCE` |
| exact30 local direct child passes gates 00–98 and all reviews | `GATE_A_BYTE_DONOR_CHILD / MUST_NOT_PUSH / GATE_B_REQUIRED` |
| gate 99 | mandatory `STOP / GATE_B_REQUIRED`, exit `86` |

## Acceptance Criteria

- [ ] A future approval commit is a direct single-parent child of `2374d790…` and contains only the formal manifest, this Task and this Plan, all `100644`.
- [ ] The stopped predecessor authority is recorded as `ABANDONED_UNCONSUMED / NO_RETRY / NO_INHERITANCE`.
- [ ] A fresh candidate re-materializes exactly the ordered 30 product paths from the stopped byte donor, stays `30 MODIFY / 0 ADD`, all `100644`, with no 31st path.
- [ ] Candidate bundle and full-index diff equal `sha256:7f0102eb…` and `sha256:6fa08fd9…`; all 30 candidate bytes equal the stopped byte donor.
- [ ] Relative to the older exact30 donor, exactly 28 paths are byte-identical and only `scripts/run_rc1_release_acceptance.mjs` plus `scripts/run_rc1_release_acceptance.test.mjs` differ.
- [ ] The two corrected files remain exact identities: implementation `425566` bytes, raw `sha256:81082771483df0fd16f7b0e3eb91c823a648c5a163f69a3aaa267007a5738a51`, blob `ca4745d83ff8b69d81a1165c23726abb22fa8844`; test `162874` bytes, raw `sha256:58f4fafb251bfaef7a4c794ab0c74607d8e52852f6dcc4abc831f09c4f6e98ba`, blob `3ad77ab130e4ac3a05d9b41b33b0951b0b927cd3`.
- [ ] The older donor interface audit proves the six direct seams are absent. This is recorded only as a proof gap and is never counted as behavioral RED.
- [ ] Candidate tests directly import candidate code; source rewriting, `data:` modules, fallback implementations and gate-aware fixtures are forbidden.
- [ ] The 14 lifecycle nodes and five historical nodes pass directly; the complete RC1 acceptance file passes `70/70`.
- [ ] Real localhost edge A/B isolation and real `PrepushCdpClient` stale-callback isolation pass; timeout-first keeps the original trigger error object and produces no `unhandledRejection`.
- [ ] The complete backend, frontend, release, Harness, Doctor, authority-regression, V2 and diff-check matrix passes under process-local POSIX temp normalization.
- [ ] Governance, Python and Security reviews return zero P0–P2 after re-materialization.
- [ ] Gate 99 remains exit `86`; Gate A creates no pushable candidate identity. Gate B requires a new successor on then-current `ext-dev`.

## Delivery Constraints

- Canonical base: `2374d7905b0968897ef6749c13e772d8619f8cbb / 15f53dd12bbe54ac86257eebf6b1efe1b2f5dddf`.
- Approval paths are exactly the formal approval, this Task and this Plan.
- Product paths remain the exact ordered 30 paths from the manifest.
- No product edits are authorized beyond byte-for-byte re-materialization of the stopped exact30 donor.
- Do not modify readiness validators, Harness, authority, locks, wheelhouse, unrelated product paths, customer data or deployment state.
- No merge, cherry-pick, rebase, force-push, product push, Pilot, Release or deployment is authorized by this draft.

## Affected Modules

- 模块：P14 trusted-artifact Gate A exact30 and the existing RC1 edge/CDP observation lifecycle.
- 允许路径：the manifest's exact ordered 30 product paths; all are byte-for-byte donor re-materialization only.

## Technical Plan

1. Verify live remote/base and freeze both donor worktrees without modifying them.
2. Validate this three-file governance package and obtain independent Governance, Python and Security review with zero P0–P2.
3. After canonical confirmation, materialize one formal approval commit and ordinary-fast-forward it.
4. Run canonical product authority once in the existing hardened standalone-repository pattern; any STOP terminates the lineage.
5. Re-materialize the stopped exact30 bytes into one fresh isolated candidate and prove exact path/mode/bundle/diff identity.
6. Run the donor interface proof-gap gate, direct 19-node behavioral gate, full RC1 `70/70`, and the complete frozen matrix.
7. Re-run three independent reviews. Only then may one local Gate A direct child be created as non-pushable byte evidence.
8. Run gates 00–98 and mandatory Gate99 exit `86`; do not verify-candidate or push.
9. A separate Gate B successor may later re-materialize and verify the bytes for a reversible RC.

## Implementation Report

The predecessor stopped before any product commit or push. Fresh mechanical evidence shows donor diagnostics now exit cleanly with exactly 11 failures, but every failure is a missing-export `TypeError`; therefore the run is not behavioral RED. Candidate direct tests pass `70/70`. Governance and Python reviews both classify the predecessor as `NO-GO / P1=1` solely for the RED truth claim; Security Review is GO. Current exact30 bytes remain uncommitted and untouched as donor evidence.

## Acceptance Review

This package is a governance correction, not a product pass. Reviewers must confirm that it does not relabel missing exports as real defect RED, does not relax any lifecycle assertion, binds the exact stopped bytes, preserves the 28+2 split, and retains the Gate A no-push / Gate B-required boundary. Any P0–P2, third corrective path, byte drift, synthetic test subject, authority reuse or remote drift is `NO-GO`.

## Rollback

Before approval materialization, abandon only this isolated draft. Never delete or clean either donor worktree. Pushed governance is immutable and may only be superseded forward. Gate A remains local evidence only; production deployment is outside scope.
