# S7 External Test Identity Manager

Date: 2026-07-13

| Field | Value |
| --- | --- |
| Change ID | s7-external-test-identity-manager-20260713 |
| Status | INDEPENDENT_SECURITY_REVIEW_GO |
| Owner | backend harness + root control plane |
| Date | 2026-07-13 |

This security-sensitive cross-line change does not add a backend test-identity endpoint. Backend ownership is limited to two production invariants:

1. `web.main` fails startup if normalized route path/name/tag metadata contains test-session or test-identity, including underscore and slash spellings.
2. `src.tenant.verify_token` rejects the independent CI sidecar issuer/environment/audience/scope even when a CI-shaped token is signed with the production secret.

The external provisioner alone owns Ed25519 issuance/private-key access. The root control plane owns committed-HEAD public trust verification, persistent lifecycle recovery and token-file handling; workers cannot issue credentials. The frontend helper consumes a one-time business-token file and calls the root finalizer. A real isolated FastAPI test provisions 50 distinct tenant users, logs all 50 in through the existing `/api/auth/login` contract, validates each <=30-minute production-format Bearer through `/api/auth/me`, injects two SIGKILL windows, and disposes the backend/database.

External CI trust provisioning remains required and is explicitly not claimed as enforced.

Verification:

```bash
python3 -m pytest -q tests/test_production_has_no_test_identity_routes.py
python3 scripts/harness_doctor.py
```

Rollback: revert the S7 commit. No production database migration or production identity route is introduced. Remove any externally provisioned S7 public key only after CI has stopped using the corresponding key ID.
