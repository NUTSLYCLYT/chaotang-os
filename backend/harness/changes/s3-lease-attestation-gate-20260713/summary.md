# S3 lease attestation closeout integration

| Field | Value |
| --- | --- |
| Change ID | s3-lease-attestation-gate-20260713 |
| Status | READY_FOR_REVIEW |
| Owner | backend harness |
| Date | 2026-07-13 |

- Scope: `backend/scripts/commit_closeout_check.py` delegates optional candidate verification to the root authoritative lease-attestation gate. It does not own attestation storage or control-plane policy.
- Rollback: remove the optional CLI argument; root integration policy remains authoritative.
