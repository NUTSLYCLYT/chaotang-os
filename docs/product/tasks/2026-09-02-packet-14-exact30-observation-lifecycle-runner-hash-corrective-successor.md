# Packet 14 — Exact30 Observation Lifecycle Runner Hash Corrective Successor

## Status

Draft

Harness document classification: `Draft`. This package is `NON_AUTHORIZING / READY_FOR_OWNER_CANONICAL_CONFIRMATION` until its canonical digest is frozen and the proposed manifest is materialized in a later authorized approval commit.

Task ID: `PACKET-14-EXACT30-OBSERVATION-LIFECYCLE-RUNNER-HASH-CORRECTIVE-SUCCESSOR-20260902`

## Product Definition

This forward-only successor binds `ext-dev@76470ca5fe89135493d8b1a54509623800316c85`, tree `87d16b7c5e9ea998bd8e121dfe4e987e855626b3`. That commit is the immutable approval of the stopped RED-contract successor. Its machine result `GO / APPROVED_FOR_ONE_CHILD` is abandoned unconsumed because the re-materialized exact30 failed independent Python Review with one deterministic P1. The authority may not be retried, consumed, inherited or re-anchored.

The stopped exact30 worktree remains untouched at `/home/ubuntu/Projects/chaotang-os/.worktrees/p14-exact30-observation-red-contract-successor-candidate-20260902`, HEAD/tree `76470ca5fe89135493d8b1a54509623800316c85 / 87d16b7c5e9ea998bd8e121dfe4e987e855626b3`. It contains exactly 30 modified `100644` paths, bundle `sha256:7f0102eb69bf89847c7e5556f16c8a17c1e98add1131ca6be774c256d8705682`, and full-index diff `sha256:6fa08fd9c632e6c162c4fa30cba15eb6c027c9651b5b486a22eaaac4d3dd47ab`. Its disposition is `BYTE_DONOR_ONLY / NO_CANDIDATE_IDENTITY / NO_VERIFICATION_INHERITANCE`.

The real defect is closed and reproducible. `scripts/run_rc1_release_acceptance.mjs` now hashes to `sha256:81082771483df0fd16f7b0e3eb91c823a648c5a163f69a3aaa267007a5738a51`, while `backend/app/operations/sqlite_backup.py` still trusts the predecessor hash `sha256:3fe34c4a778a46af7834e28e5cf8ae15df63a3ef65c870b8048972bda2d6fc21`. `validate_writer_stop_evidence()` therefore rejects writer-stop evidence created by the corrected runner. The existing node `backend/tests/test_sqlite_backup.py::test_cli_rejects_a_prebuilt_cold_writer_session` is real RED. A descriptor-bound `/tmp` reconstruction of the stopped donor fails `1/1`; replacing only the frozen trusted digest makes the same node pass `1/1`.

The future candidate keeps the exact ordered 30 product paths and `30 MODIFY / 0 ADD`. Twenty-nine paths remain byte-identical to the stopped donor. The sole additional byte correction is in `backend/app/operations/sqlite_backup.py`: replace the one frozen old runner digest with the actual reviewed runner digest. The resulting file is `194632` bytes, raw `sha256:92b4bc94215214f823fb866269d98662e6a735ad6d1cc1d149bccf0e84246078`, blob `cd63139dd58aad8af94c2fa8ed6d90e3b6d76dba`; the final exact30 bundle is `sha256:65e96c569f6d7a1f707ff96f5cf574b33b28cb722e871f7033a5118f17044a7b` and full-index diff is `sha256:4a8c431670e6e80ec61fc432782fa5164c7b354e4d6475813f89255f9e0ed77e`.

Gate A remains local byte evidence only. It must end at `STOP / GATE_B_REQUIRED`, fixed exit `86`; it cannot run machine candidate verification or push a product child. A separate Gate B successor is required before a reversible Release Candidate. Production deployment is outside scope.

## Acceptance Criteria

- [ ] A future approval commit is a direct single-parent child of `76470ca5…` and contains only the formal manifest, this Task and this Plan, all `100644`.
- [ ] The stopped authority is `ABANDONED_UNCONSUMED / NO_RETRY / NO_INHERITANCE`.
- [ ] A fresh candidate has exactly the manifest's ordered 30 modified paths, no add/delete/rename, no 31st path, all `100644`.
- [ ] Twenty-nine candidate files equal the stopped donor; only `backend/app/operations/sqlite_backup.py` differs by the one frozen runner digest replacement.
- [ ] The candidate file identity, exact30 bundle and full-index diff equal `92b4bc… / cd6313…`, `65e96c…`, and `4a8c43…` respectively.
- [ ] The preserved external diagnostic records the exact regression node as `1 failed` on stopped donor bytes and `1 passed` after the single digest replacement; Gate 07 separately AST-locks that node's first trusted-hash assertion and evaluates the same production hash contract with isolated, bytecode-free candidate/donor imports.
- [ ] Candidate tests import committed candidate code; no data URL, source rewrite in GREEN, fallback implementation, skip, xfail or gate-aware test subject is allowed.
- [ ] Observation lifecycle remains `19/19` and the full RC1 acceptance file remains exactly `70/70`.
- [ ] Backend, frontend, release, Harness, Doctor, authority regression, V2 and diff-check gates pass under process-local POSIX temp normalization.
- [ ] Governance, Python and Security reviews return zero P0–P2 after re-materialization.
- [ ] Gate 99 exits `86`; Gate A is never pushed and never consumes final candidate identity.

## Delivery Constraints

- Canonical base: `76470ca5fe89135493d8b1a54509623800316c85 / 87d16b7c5e9ea998bd8e121dfe4e987e855626b3`.
- Approval paths are exactly the formal approval, this Task and this Plan.
- Product paths remain the manifest's exact ordered 30 paths.
- Product correction is restricted to the one existing trusted runner digest literal in `backend/app/operations/sqlite_backup.py`; all other 29 files are byte-for-byte donor re-materialization.
- Do not modify tests to obtain GREEN, readiness validators, Harness, authority, locks, wheelhouse, unrelated paths, customer data or deployment state.
- No merge, cherry-pick, rebase, force-push, product push, Pilot, Release or deployment is authorized by this draft.

## Affected Modules

- 模块：P14 trusted-artifact Gate A exact30, cold-release writer-stop evidence binding, and existing RC1 observation lifecycle.
- 允许路径：the manifest's ordered exact30; actual new correction is limited to `backend/app/operations/sqlite_backup.py`.

## Technical Plan

1. Freeze the stopped authority and exact30 donor without modifying or deleting them.
2. Validate and independently review this three-file governance package.
3. After canonical freeze, create and ordinary-fast-forward one formal three-file approval.
4. Run product authority once; any machine STOP terminates the lineage.
5. Re-materialize the exact30 donor in one fresh worktree and replace only the frozen trusted digest.
6. Commit one local direct child, then prove exact paths, 29+1 identity, bundle and diff.
7. Reconstruct the descriptor-bound stopped donor in `/tmp`; AST-lock the existing node's first trusted-hash assertion, mechanically prove its production contract is RED on stopped donor bytes and GREEN on candidate bytes without `.pyc`, then run the actual node again in the complete matrix.
8. Obtain independent Governance, Python and Security GO with zero P0–P2.
9. End Gate A at gate 99 exit `86`; do not verify-candidate or push.
10. Use a separate latest-base Gate B successor for candidate verification, ordinary fast-forward and reversible RC.

## Implementation Report

The predecessor product child was never committed or pushed. Direct lifecycle verification is green (`19/19`, RC1 `70/70`), but independent Python Review found `269 passed / 1 failed`. The only failure is the existing trusted-runner assertion at `backend/tests/test_sqlite_backup.py:1227`. A separate POSIX `/tmp` diagnostic reproduced exact RED and exact GREEN with only the trusted digest changed. The calculated final identities are frozen above; no repository product byte has been modified by this governance draft.

## Acceptance Review

Reviewers must confirm that this package neither hides the Python P1 nor reuses the stopped authority. The RED reconstruction must be bound to the exact stopped donor file and current candidate runner; GREEN must use committed candidate bytes. Any second correction, 31st path, test relaxation, bundle drift, P0–P2, authority reuse, remote drift, product push or deployment is `NO-GO`.

## Rollback

Before approval materialization, abandon only this isolated draft. Never delete or clean donor worktrees. Pushed governance is immutable and may only be superseded forward. A future Gate A child remains local evidence; Gate B and production deployment remain separate.
