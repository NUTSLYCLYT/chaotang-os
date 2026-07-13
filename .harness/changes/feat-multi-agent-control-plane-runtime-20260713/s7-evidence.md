# S7 External Test Identity Manager evidence

Status: `IMPLEMENTED_LOCAL / INDEPENDENT SECURITY REVIEW GO / EXTERNAL TRUST PROVISIONING REQUIRED`. This is not a production identity provider and is not `ENFORCED`.

## Security boundary

- The production FastAPI application contains no identity-fabrication endpoint. Startup enumerates normalized route path/name/tag metadata and rejects `test-session`, `test-identity`, and slash/underscore variants.
- Production JWT verification explicitly rejects the CI sidecar issuer, environment, audience, or scope, including a CI-shaped token signed with the production JWT secret.
- Exchange credentials use an independent Ed25519 issuer/audience/scope, a maximum 30-minute TTL, one-time `jti`, quota, SHA-256-only persistence, and transactional replay/revoke state. An exchange credential is never accepted or emitted as a business Bearer. CLI workers receive only the public verifier and cannot issue credentials; the signing private key exists only in the external provisioner.
- Isolation authorization is Ed25519 signed. The verifier ignores caller-supplied public-key environment variables and loads only the key named by the **committed HEAD** manifest from an owner-protected trust store below `git-common-dir`. It verifies key ID, SHA-256 fingerprint, exact CLI environment, exact loopback origin, database inode, signed socket inode/PID/start ticks, expiry, session quota, and signed provision/dispose commands.
- The private key is not read by any worker or CLI code. It belongs only to the external isolation provisioner.
- Exchange and business-token files must be owner-only, mode 0600, outside the worktree, and below an owner-only directory. They are consumed and removed; neither token travels in argv or normal stdout.

## Transactional lifecycle and recovery

The owner-only, non-symlink sidecar SQLite ledger records an attestation-use counter and every `pending -> active -> disposing -> disposed/failed` lifecycle without storing passwords or raw tokens. `resolve` creates the pending row before consuming credentials. Exchange consumption and lifecycle session binding commit in one SQLite transaction. The future business-token path is persisted before the file write. Registration/provision, login, `/api/auth/me`, JSON parsing, token-file creation, and ledger update are one cleanup domain: any failure revokes the sidecar session, removes the token path, runs the signed disposal, proves the database is gone and the API is unreachable, then closes the lifecycle. A failed cleanup stays pending instead of being reported successful.

Normal Playwright cleanup invokes `finalize --lifecycle`. It runs the attested token-revoke command and closes only that lifecycle; a SQLite refcount keyed by exact database/API isolation allows only the final lifecycle to atomically claim disposal. The claim is retained as `isolation_disposing` through every retry and is closed only after verified physical disposal, so repeated SIGKILLs after the claim but before server/database destruction are resumable and cannot falsely close the ledger. `finalize-all` is the force-clean job-level recovery for all lifecycles sharing an isolation. CI must install it as a job-level finalizer, for example:

```bash
trap 'node scripts/test-identity.mjs finalize-all --cwd "$PWD"' EXIT
```

## Real 50-session proof

`node --test scripts/test-identity.nodetest.mjs` starts a real isolated FastAPI backend using the repository's production auth router. A trusted signed provision command creates 50 different tenant/user rows in the isolated SQLite database. Fifty barrier-synchronized CLI processes then consume 50 different exchange credentials, provision/login through the isolated backend, and receive 50 different production-format business JWTs through mode-0600 files.

The test calls the real `/api/auth/me` with every Bearer and proves each response matches that process's unique tenant and subject; all 50 tenants and all 50 tokens are distinct. Every business JWT is decoded after the authenticated `/api/auth/me` round trip and rejected unless its expiry is within both 30 minutes and the signed isolation lifetime. The suite SIGKILLs one worker immediately after exchange and another immediately after its business-token write, then proves later cleanup revokes both sessions and removes the orphan token. It cleans one ordinary session and proves that Bearer becomes `401` while another session remains authenticated and the database/API remain alive. It concurrently finalizes two sessions while a third remains and proves neither can dispose early. Finally it SIGKILLs the last owner twice after the atomic disposal claim, proves the same sole `isolation_disposing` recovery sentinel and live database survive both crashes, then resumes a third time and proves database/API destruction. A provision failure is isolated to its lifecycle rather than destroying peers. The protected runtime and test artifacts contain neither private signing material nor any of the 50 business tokens. Caller-selected self-signed keys, cross-environment attestations, a 51st attestation use, 24-hour business JWTs, expiry/replay/audience/scope errors, unprotected state storage, worker-side issuance, and production CI claims all fail closed.

Final independent rereview verdict: `GO`; zero remaining CRITICAL, HIGH, or MEDIUM findings.

Latest focused result: `6 passed, 0 failed`; backend production-boundary result: `7 passed`; frontend TypeScript: `0 errors`. The adjacent auth regression set also passed `79/79`.

## Honest external limitation

The checked-in manifest intentionally remains `testIdentityTrust.status=EXTERNAL_REQUIRED`: a repository commit cannot create an independently protected CI signing identity. Before real CI materialization, an administrator must commit the reviewed `keyId` and public-key SHA-256, set status `PINNED`, provision the matching public key under `<git-common-dir>/chaotang-harness/`, and keep the private key in the protected provisioner. This is the same external enforcement boundary recorded for S3; local tests use an ephemeral committed fixture manifest and protected trust store. No production or Gitee enforcement is claimed.

## Verification

```bash
node --test scripts/test-identity.nodetest.mjs
python3 -m pytest -q backend/tests/test_production_has_no_test_identity_routes.py
cd frontend && pnpm exec tsc --noEmit -p tsconfig.json
python3 backend/scripts/harness_doctor.py
node scripts/harness-doctor.mjs
git diff --check
```
