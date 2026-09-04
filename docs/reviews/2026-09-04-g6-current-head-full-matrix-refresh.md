# G6 Current HEAD Full Matrix Refresh · 2026-09-04

## Status

Review

## Baseline

- Repository: `gitee.com/msxn/chaotang-os`
- Branch: `origin/ext-dev`
- Verified HEAD: `439eac66e278504158871445fe987f8cbbd54033`
- Verified tree: `59e8a1f6c42d003e80262df79eb26d1ff4267ccd`
- Verification mode: local non-production full-matrix refresh
- Production deployment: not authorized and not performed

This document records the verification refresh after the docs-only G4/G5/G6
convergence commits. It does not approve production deployment, external
publication, branch cleanup, legacy-route retirement, or real customer-data use.

## Environment notes

Two ordinary sandbox limitations were observed and classified before rerunning
the affected checks in the normal local validation environment:

- frontend BFF tests that open local `127.0.0.1` stub servers fail in the
  ordinary sandbox with `listen EPERM`;
- root Harness and related authority tests that spawn local Git processes fail
  in the ordinary sandbox with `spawnSync git EPERM`;
- backend full pytest started in the ordinary sandbox remained silent long
  enough to be treated as an untrusted environment run and was interrupted.

The checks below were then rerun with the established local process boundary
and POSIX `/tmp` where required. No repository file, Git configuration, system
configuration, credential, or product runtime was modified for the reruns.

## Verification results

| Check | Result |
| --- | --- |
| Backend Ruff | `PASS` |
| Backend full pytest | `4558 passed, 4 skipped, 3 warnings` |
| Frontend Node tests | `724 passed` |
| Frontend lint | `PASS` |
| Frontend typecheck | `PASS` |
| Frontend production build | `PASS` |
| Root Harness | `PASS`, 159 baseline files |
| Harness self-test | `PASS`, 175 checks |
| Harness doctor | `PASS / STRUCTURE_VALID_NON_AUTHORIZING` |
| Harness doctor tests | `10/10` |
| Stop hook self-test | `PASS`, 3 checks |
| Product-authority regression | `12/12` with process-level `TMPDIR=/tmp` |
| V2 convergence check | `PASS / nonAuthorizing` |
| V2 convergence tests | `20 passed / 1 skipped` |
| `git diff --check` | `PASS` |

The backend warnings are known non-blocking framework or serializer warnings and
did not produce failed tests.

## RC interpretation

The current `ext-dev` HEAD remains a valid non-production roadshow RC baseline.
The docs-only G4 business-entrance target, G5 Mingshuo vertical target, and G6
synthetic E2E evidence records did not break backend, frontend, Harness,
authority-regression, V2 convergence, or build gates.

Safe claim:

`CURRENT_HEAD_FULL_MATRIX_REFRESH_PASS / ROADSHOW_RC_STILL_VALID_NON_PRODUCTION`

Unsafe claim:

`PRODUCTION_RELEASE_APPROVED`

Production release still requires the separate production deployment,
credential, real customer data, rollback, pilot, and business outcome gates.

## Next convergence target

Continue with the same single-mainline approach:

1. keep the roadshow demo chain stable;
2. create a narrow G4 business-entrance observation successor before runtime
   consolidation;
3. create a Mingshuo fact-pack successor before vertical execution;
4. run golden tasks and browser evidence before stronger RC or pilot claims;
5. do not bulk-merge old branches or dirty donor worktrees.

## Decision

`G6_CURRENT_HEAD_FULL_MATRIX_REFRESH_PASS / PRODUCTION_DEPLOYMENT_NOT_AUTHORIZED`
