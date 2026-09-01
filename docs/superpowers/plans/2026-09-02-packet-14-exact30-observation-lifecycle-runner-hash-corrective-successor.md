# P14 Exact30 Observation Lifecycle Runner Hash Corrective Successor Plan

## Status

`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CANONICAL_CONFIRMATION`

## Objective

Close the deterministic cold-release regression without changing the exact30 path scope. Bind `sqlite_backup` to the actual reviewed RC1 runner bytes, run the complete matrix, and stop Gate A before product verification or push.

## Frozen Facts

- Base: `76470ca5fe89135493d8b1a54509623800316c85 / 87d16b7c5e9ea998bd8e121dfe4e987e855626b3`.
- Stopped authority: `ABANDONED_UNCONSUMED / NO_RETRY / NO_INHERITANCE`.
- Stopped donor: `/home/ubuntu/Projects/chaotang-os/.worktrees/p14-exact30-observation-red-contract-successor-candidate-20260902`; 30 modified `100644` paths, bundle `7f0102eb…`, full diff `6fa08fd9…`.
- Real RED: `tests/test_sqlite_backup.py::test_cli_rejects_a_prebuilt_cold_writer_session`, actual runner `81082771…`, stale trusted digest `3fe34c4a…`.
- Exact correction: one literal in `backend/app/operations/sqlite_backup.py`; corrected identity `194632` bytes / raw `92b4bc…` / blob `cd6313…`.
- Expected exact30: 29 donor-identical + 1 corrected; bundle `65e96c…`; full-index diff `4a8c43…`.
- Lifecycle evidence remains 19/19 and RC1 70/70; it does not override the Python P1.

## Execution DAG

1. `STOP_PREDECESSOR`: freeze old authority and donor as evidence only.
2. `THREE_FILE_GOVERNANCE`: strict JSON, duplicate-key rejection, schema, manifest, Task contract, paths/modes and internal consistency.
3. `THREE_DRAFT_REVIEWS`: Governance, Python and Security all zero P0–P2.
4. `CANONICAL_FREEZE`: freeze canonical/raw/bundle identities.
5. `APPROVAL_DIRECT_CHILD`: one three-file child of `76470ca5…`, ordinary fast-forward only.
6. `AUTHORITY_ONCE`: one canonical product-authority run; STOP ends the lineage.
7. `EXACT30_REMATERIALIZATION`: donor bytes plus one exact trusted-hash replacement.
8. `REAL_RED_GREEN`: preserve the external exact-node RED/GREEN record; Gate 07 AST-locks that node's first trusted-hash assertion and mechanically evaluates the same production contract on descriptor-bound donor and committed candidate bytes.
9. `FULL_MATRIX`: focused, backend shards, frontend, release, Harness, Doctor, authority regression, V2 and diff.
10. `THREE_PRODUCT_REVIEWS`: zero P0–P2.
11. `LOCAL_GATE_A_CHILD`: direct child, local evidence only.
12. `GATES_00_98`: all positive gates pass while remote remains approval.
13. `GATE_99_STOP`: fixed exit 86.
14. `SEPARATE_GATE_B`: latest-base authority, candidate verification, ordinary fast-forward and reversible RC; no production deployment.

## Exact Scope Contract

The manifest's ordered 30 paths are the complete scope. All remain `MODIFY / 100644`. Twenty-nine equal the stopped donor. Only `backend/app/operations/sqlite_backup.py` may change, and only by replacing the stale `3fe34c4a…` runner digest with the actual `81082771…` digest. The final file, bundle and full diff must equal the frozen identities above. No test edit or second product correction is allowed.

## RED/GREEN Contract

The preserved external diagnostic executed the exact existing pytest node and recorded stopped-donor RED `1 failed` followed by single-replacement GREEN `1 passed`. Gate 07 does not impersonate that full pytest run: it uses a link-free `/tmp` archive, mechanically locks the unique test function's first trusted-runner `assert` AST, imports the production module with `/usr/bin/python3 -I -B`, rejects any `__pycache__`, and evaluates that exact hash contract against committed candidate bytes and an `O_NOFOLLOW` descriptor-bound stopped donor. Missing exports, AST drift, source rewriting in GREEN, bytecode reuse, skips and synthetic fallback never count. The complete matrix runs the actual node on the committed candidate.

## Verification Matrix

- Exact remote, approval parent, exact30 status/order/modes, final bundle and full diff.
- Descriptor-bound stopped donor identity and historical proof-gap audit.
- Real runner-hash RED followed by candidate GREEN.
- Direct observation lifecycle 19/19 and RC1 70/70.
- Historical negative contracts, focused/Ruff coverage and three isolated backend shards.
- Frontend offline dependency identity, tests, lint, typecheck and production build.
- Release regressions, root Harness, Doctor, authority regression, V2 and diff check.
- Independent Governance, Python and Security reviews with zero P0–P2.
- Gate99 fixed exit 86 and no product push.

## Stop Conditions

- Remote, approval, donor or stopped-authority drift.
- Any path/mode/status outside exact30 or any second corrected file.
- RED not produced by the exact stopped donor identity or GREEN not produced by committed candidate bytes.
- Any test relaxation, bundle/diff mismatch, critical gate failure or independent P0–P2.
- Candidate verification, product push, Pilot, Release or deployment during Gate A.

## Rollback

Abandon an unmaterialized draft locally. After governance push, use only a new forward successor. Never clean donor worktrees. Gate A stays local; Gate B and production deployment remain separately governed.
