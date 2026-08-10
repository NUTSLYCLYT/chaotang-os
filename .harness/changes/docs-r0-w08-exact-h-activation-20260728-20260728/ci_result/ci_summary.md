# CI 摘要：docs-r0-w08-exact-h-activation-20260728-20260728

## Commands

| Command | Exit | Result | Coverage | Time |
| --- | ---: | --- | --- | --- |
| pre-commit `node scripts/execution-authority-v2.mjs --check` | 1 | `INVALID_EXECUTION_AUTHORITY`; dirty manifest rejected | expected dirty fail-closed | 2026-07-28 |
| `node --test --test-name-pattern "professional reassignment gate" scripts/execution-authority-v2.nodetest.mjs` | 0 | PASS | focused professional gate regression | 2026-07-28 |
| `node --test scripts/execution-authority-v2.nodetest.mjs` | 0 | `74 passed` | authority v2 regression | 2026-07-28 |
| `node scripts/execution-authority.mjs --check` | 0 | `VALID_INACTIVE_GUARD` | v1 guard | 2026-07-28 |
| pre-integration `node scripts/execution-authority-v2.mjs --check` | 1 | `STOP / INVALID_EXECUTION_AUTHORITY / active-packet EXT ref must equal pinned HEAD` | expected pre-integration fail-closed | 2026-07-28 |
| pre-integration `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08` | 1 | `STOP / INVALID_EXECUTION_AUTHORITY / active-packet EXT ref must equal pinned HEAD` | expected pre-integration fail-closed | 2026-07-28 |
| pre-integration `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W09` | 1 | `STOP / INVALID_EXECUTION_AUTHORITY / active-packet EXT ref must equal pinned HEAD` | expected pre-integration fail-closed | 2026-07-28 |
| pre-integration `node scripts/harness-doctor.mjs` | 1 | `execution authority v2: active-packet EXT ref must equal pinned HEAD` | expected pre-integration fail-closed | 2026-07-28 |
| `git diff --check -- . ':(exclude).harness/changes/docs-r0-w08-exact-h-activation-20260728-20260728/review_inputs/activation-candidate.diff'` | 0 | PASS | source diff sanity; excludes exact review-package artifact bytes | 2026-07-28 |

## Declared State

- `CANDIDATE`
- `PRE_INTEGRATION`
- `NOT_DEPLOYED`
- `NO_W09_ACTIVATION`

## Result

Candidate is ready for controlled fast-forward into local `feature-chaotang-ext`.
It is not a production deployment and not a W09 activation.
