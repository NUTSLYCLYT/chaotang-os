# S6 Release Commander evidence

Status: `IMPLEMENTED_LOCAL / INDEPENDENT REVIEW GO`. This is not a production deployment attestation.

Final independent review found no CRITICAL, HIGH or MEDIUM issues after the terminal-pending crash recovery and phase-revert fault tests were added.

## Implemented controls

- SQLite `release_runs` is the authoritative state machine: `planned -> locked -> building -> starting -> verifying -> ready`, with explicit `failed` and `rolled_back` terminal paths.
- `release:production` is a fenced singleton resource. Two real Commander processes cannot both enter `locked`.
- Every run binds exact HEAD, attestation digest, build ID, artifact digest, task, Commander and fencing epoch. Old credentials fail closed.
- The freeze window rejects new feature write/integration leases while a release is locked through verification.
- Dirty tracked state, non-allowlisted untracked state, mismatched build provenance, failed checks or any production SKIP produce `failed`; they never alias READY.
- Resume reacquires a newer fencing epoch and returns to `locked`; the complete safety sequence must run again.
- Long build/gate commands run asynchronously while the Commander heartbeats; heartbeat failure terminates the child process and fails closed. A failed running candidate is stopped and verified before the run may enter `failed`.
- Terminal transitions are two phase: `green` / `red` / `rollback_verified` plus `release_pending` are durably recorded before resource release, and only a confirmed release may become `released` / `failed` / `rolled_back`.
- Rollback uses the S5 stop/start boundary and an exclusive build lock, verifies the prior READY release's commit, build ID and artifact digest twice, and cannot be claimed through the public transition API.
- CLI credentials are accepted only from a mode-0600 file; raw nonce arguments are rejected.
- S5 production build/start wrappers and the existing production gate now require the active Commander credential. A bypass exists only behind the explicit test adapter pair.
- Runtime release JSON and SQLite audit events record every state transition; raw release nonce is never persisted in release logs.
- The existing `prod-release-gate.mjs` remains the product gate and was minimally wrapped with Commander authorization; its browser, true-chain and jiqun logic was not replaced.

## Focused tests

```bash
node --test scripts/release-commander.nodetest.mjs
node --test --test-concurrency=1 frontend/scripts/safe-prod-wrappers.nodetest.mjs
```

Current results: Commander `15/15 passed`; wrapper authorization/lifecycle `8/8 passed`. Combined S1/S2/S6 control-plane regression: `48/48 passed`. Root harness doctor: `0 errors, 0 warnings`.

Coverage includes two real competing CLI processes, ordered transitions, exact provenance binding, old epoch rejection, dirty failure, resume with a newer epoch, no false READY, freeze rejection, rollback success/failure, build-lock ownership during rollback, exact prior-build identity, 0600 credential-file enforcement, non-production dry-run terminal behavior, and direct production-start denial without Commander authority.

## Existing production gate attempt

```bash
NODE_ENV=test CHAOTANG_CONTROL_PLANE_TEST_ADAPTER=1 CHAOTANG_TEST_COMMANDER_BYPASS=1 NEXT_PUBLIC_API_MODE=real pnpm gate:prod-release
```

Result: `RED`, correctly not READY. `prod-doctor` was `PROD` with 4/4 checks and live true-chain ready. The unchanged `final-release-harness` stopped on missing strict-auth token for `study-edict-contract`; downstream page/resource/mobile checks were skipped by that existing gate. S6 treats this failure/SKIP combination as release STOP and does not convert it to READY.
