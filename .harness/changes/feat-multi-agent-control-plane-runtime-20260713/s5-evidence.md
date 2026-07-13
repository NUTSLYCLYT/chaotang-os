# S5 Immutable Build Manager evidence

Status: `IMPLEMENTED_LOCAL / INDEPENDENT REVIEW GO`. This is not yet production ENFORCED.

## Review remediation

Two independent review rounds returned `NO-GO`; all reported findings now have focused code and regression coverage:

- The production `safe-prod-build` wrapper owns compare-then-atomic-rename restoration of Next's `tsconfig.json` edit, and `buildCandidate` rejects any post-run dirty worktree before publishing.
- Readiness requires one exact socket-owner PID, HTTP `200` without redirects, a non-empty exact BUILD_ID manifest response, and a newly verified release/build identity. A matching-owner `404` is rejected.
- Stale operation recovery validates schema, build-lock key, monotonic fencing epoch, nonce commitment shape, full OS holder identity, and the exact `.candidate-${release_id}` path. Recovery is audited before deletion; a malicious pointer to a published release fails closed and does not delete it.
- The start supervisor handles `SIGTERM`, `SIGINT`, uncaught exceptions, and unhandled rejections by converging the detached child. Lock release requires the captured process identity and every live member of its PGID to be gone, followed by an empty socket-owner check.
- Immutable identity covers `next/`, `public/`, and the copied runtime `next.config.ts`; all are read-only and digested. Next starts with the immutable release root as cwd.
- Build environment is frozen to a small controlled runner environment. The manifest records the allowlisted semantic environment and its SHA-256 commitment.
- Activation uses a mutex, fencing regression guard, temp pointer, atomic rename, file fsync, and directory fsync.

## Focused verification

```bash
node --experimental-strip-types --test frontend/scripts/safe-prod-lifecycle.nodetest.ts
node --test --test-concurrency=1 frontend/scripts/safe-prod-wrappers.nodetest.mjs
```

Results: core/fault tests `13 passed`; process wrapper tests `7 passed`.

Coverage includes 50 interrupted candidates, half builds, old chunks, pointer/config/public mutation, rollback, pre/post dirty rejection, stale fencing, concurrent operations, strict stale-operation recovery, published-release deletion denial, exact process identity, double starter, readiness timeout, wrong BUILD_ID/404, child crash, heartbeat failure, TERM-to-KILL, and supervisor SIGTERM convergence.

## Two consecutive real production-wrapper builds

```bash
CHAOTANG_KEEP_S5_EVIDENCE=1 node scripts/immutable-build-real-evidence.mjs
```

The evidence runner creates a clean isolated repository snapshot containing the current S5 diff, then invokes the real `frontend/scripts/safe-prod-build.mjs` twice. It does not call `buildCandidate` with a special evidence runner. The explicit test adapter only redirects the preflight port because the shared host's `3050` is already occupied; the production build wrapper, `pnpm build`, CAS restoration, post-dirty check, immutable publish, and activation paths are unchanged.

- Source HEAD: `ac9b0020d25038a9fd909d53a7519c211c49fe01`
- Clean evidence snapshot commit: `6ba701f55c2f44d8b3a9628292fd8ad5d44abcba`
- Manifest environment: `NEXT_PUBLIC_API_MODE=real`, `NODE_ENV=production`, `BASE_PATH=/chaotang`, `NEXT_PUBLIC_BASE_PATH=/chaotang`, `CHAOTANG_BACKEND_API_URL=http://127.0.0.1:8081`
- Controlled runner environment commitment: `a159b410fa1b6a119290dca2fe2a4afd72913a01dc2b98f93783ee090ac1603e`

| Release | Time | BUILD_ID | Files | Artifact digest |
| --- | --- | --- | ---: | --- |
| `s5-wrapper-r1-20260713` | `06:08:55.385Z–06:09:32.445Z` | `R5qvE0EtD0hX9dRlHS0p5` | 623 | `3133bd66103a3237da8697508f99a1a5f3ec6bf76249bddafac86c766c3479e7` |
| `s5-wrapper-r2-20260713` | `06:09:32.445Z–06:10:09.593Z` | `k2agqinBGv37TYu2s5S9C` | 623 | `0003337faa1738c138f25101ed7a66a145129eba829b337f4afe60c6231ededc` |

Each release contains 446 Next files, 176 public files, and one digested runtime config. Both wrapper logs record independent generated-tsconfig commitments and the same restored source commitment. Active switched `r1 -> r2`, then verified rollback switched `r2 -> r1`; isolated repository status remained empty.

The rolled-back immutable `r1` was then started by the real `safe-prod-start` wrapper and stopped by `safe-prod-stop`. Readiness proved socket owner PID `274921`, HTTP `200`, 1170 response bytes, and exact path `/chaotang/_next/static/R5qvE0EtD0hX9dRlHS0p5/_buildManifest.js`. This run also exposed and fixed an absolute-`distDir` duplication bug; runtime now uses release-root cwd plus relative `NEXT_DIST_DIR=next` while retaining absolute identity in the runtime record.

- Primary checkout commitment before/after: `414a77ad3551e2ca134d93c3334d14e2a592b11fc37ea7e6a2ed230e733425fe`.
- True control-plane DB SHA-256 before/after: `505ddf548c92a9a02c3f67dd1fa44b172869641fe636462488f70d34ca6a2207`.
- Machine result and wrapper logs: `artifacts/s5-real-build/`.
- Final independent review: `GO`; no remaining CRITICAL/HIGH/MEDIUM in S5 scope. Fresh reviewer runs: core `13/13`, wrapper `7/7`, root/frontend doctors `0/0`, syntax and diff checks clean.
