# CI 摘要：docs-r0-w08-professional-reassignment-20260728-20260728

## Commands

| Command | Exit | Result | Coverage | Time |
| --- | ---: | --- | --- | --- |
| pre-commit `node --test scripts/execution-authority-v2.nodetest.mjs` | 1 | `70 passed / 3 failed`; dirty manifest rejected | expected fail-closed before candidate commit | 2026-07-28 |
| `node --test scripts/execution-authority-v2.nodetest.mjs` | 0 | `73 passed` | authority v2 regression | 2026-07-28 |
| `node scripts/execution-authority.mjs --check` | 0 | `VALID_INACTIVE_GUARD` | v1 remains non-authorizing guard | 2026-07-28 |
| `node scripts/execution-authority-v2.mjs --check` | 0 | `VALID_STRUCTURE / STRUCTURALLY_VALID_NOT_AN_AUTHORIZATION` | structure | 2026-07-28 |
| `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08` | 2 | `STOP / NO_ACTIVE_WORK_PACKAGE` | W08 remains inactive | 2026-07-28 |
| `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W09` | 2 | `STOP / NO_ACTIVE_WORK_PACKAGE` | W09 remains inactive | 2026-07-28 |
| `node scripts/harness-doctor.mjs` | 0 | `project-harness-doctor: 0 errors, 0 warning(s)` | root harness | 2026-07-28 |
| `git diff --check` | 0 | PASS | diff sanity | 2026-07-28 |

## Current Result

Professional roles have been reassigned away from the default owner. W08 and
W09 remain inactive.

## Unverified Areas

- no product/browser/backend acceptance was run; this Packet is governance-only

## Declared State

- `CANDIDATE`
- `NON_AUTHORIZING`
- `NOT_DEPLOYED`
- `NO_PRODUCT_CODE_CHANGE`
