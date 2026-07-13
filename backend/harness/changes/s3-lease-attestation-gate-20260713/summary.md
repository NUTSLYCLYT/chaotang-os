# S3 lease attestation closeout integration

| Field | Value |
| --- | --- |
| Change ID | s3-lease-attestation-gate-20260713 |
| Status | RETURNED_FOR_FIX |
| Owner | backend harness |
| Date | 2026-07-13 |

- Scope: `backend/scripts/commit_closeout_check.py` delegates optional candidate verification to the root authoritative lease-attestation gate. It does not own attestation storage or control-plane policy.
- Rollback: remove the optional CLI argument; root integration policy remains authoritative.

## Independent review — 2026-07-14

- Decision: returned for correction; do not count this backend adapter as an accepted release capability.
- Evidence: root lease-attestation tests pass 9/9, but the backend closeout suite is 8/9 and the existing change record still says combined verification is pending.
- Required correction: add a focused test for `--verify-lease-attestation` delegation/fail-closed behavior, remove the repository-shape-dependent duplicate-doc fixture failure, then rerun the combined backend/root gate. External authority configuration remains an S10 requirement even after code acceptance.
