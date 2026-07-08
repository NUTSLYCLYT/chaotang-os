# Release Notes 2026-06-18

## Mainline

- `master` is the mainline branch for `chaotang-web-lyt`.
- Current mainline head during this pass: `fc49c8e feat(shangshufang): surface loop trace id`.
- Weekly integration branch landed first: `integration/courtos-master-fusion-20260618`.
- Bulk deletion stash `stash@{5}` is marked `DO_NOT_APPLY_BULK`; do not apply it to `master` or integration branches.

## This Slice

Branch: `fix/shangshufang-loop-trace`

- Return `archive_hints` from `/api/court/shangshufang/draft-edict`.
- Surface archive recall evidence inside the draft edict view.
- Show explicit no-recall copy when no similar archive case is found.
- Append stable `TRACE` context to user-visible decision, status, confirmation, and error notices.
- Keep `/api/court/shangshufang/home` E2E mocks aligned with the current contract: `pending_evidence_tasks` plus `archive_hints`.

## Validation

Passed:

- `pnpm exec tsc --noEmit`
- `pnpm build`
- New archive-recall E2E cases inside `e2e/shangshufang-ux.spec.ts`
- `e2e/courtos-mvp-loop.spec.ts`

Known red tests in the broader `e2e/shangshufang-ux.spec.ts` run:

- Old assertions still expect the removed or renamed `相关入口` affordance.
- The unavailable-DB banner assertion no longer matches current page state.
- Several swarm callback assertions still depend on older display copy or backend callback behavior.

These should be handled as a separate E2E contract refresh, not mixed into the trace/archive recall slice.

## Next Deletion Slice

Start with proof-only deletion candidates, not `stash@{5}` bulk apply:

1. stale prompts or schemas with zero `rg` references,
2. generated or duplicate docs with current replacements,
3. dead route aliases only after a Playwright route inventory confirms no entrypoint depends on them.

Every deletion batch should stay under about 20 files, run `pnpm exec tsc --noEmit`, `pnpm build`, and at least the route-specific E2E smoke before merging.
