# Complete only-worktree semantic migration design

## Status

Approved in conversation on 2026-07-27. The selected approach is to migrate
the complete source worktree snapshot semantically, rather than merge only its
branch ref or overwrite the target tree.

## Problem

Merge commit `a6f199931086635f4d254fc940e06c57f758080c` used
`df037478d50f4681103a4d62de4f959e51a55856` as its source parent. The complete
court visual migration had existed as
`734b0aad07eb9b48469e9263e24cdd68fee1c4e4`, but the source branch was reset to
`df037478` before the merge. The source worktree also contains later,
uncommitted visual fidelity work.

The prior integration therefore omitted 108 source worktree entries: 43
modified files, 4 deletions, and 61 untracked files. Its passing tests and
harness were false confidence because they still accepted placeholder pages
and did not inventory dirty source worktree state.

## Source of truth

The migration input is the filesystem snapshot at:

`D:\workspace\chaotang-os-harness-only-worktree`

The snapshot is interpreted in two layers:

1. `734b0aad07eb9b48469e9263e24cdd68fee1c4e4`, the recoverable complete court
   visual migration baseline.
2. The current source worktree delta after that baseline, including later
   controllers, visual primitives, assets, integration changes, tracked
   modifications, explicit deletions, and untracked files.

Every one of the 108 source status entries must have a recorded disposition:
integrated, semantically superseded by an equivalent target implementation, or
intentionally rejected with a contract-specific reason. No entry may be
silently ignored.

## Target invariants

The target remains `harness-only` and must preserve all behavior that predates
or was added by the first merge:

- authenticated FastAPI ownership and opaque revocable sessions;
- same-origin Next.js BFF cookie forwarding;
- per-user Shiguan archive, recall, review, and statistics isolation;
- `MEMORIAL` and `REPLY` as the only archive document types;
- immutable adopted Jinyiwei evidence references and MCP access provenance;
- deterministic Jinyiwei evidence orchestration and approved MCP boundaries;
- ADR 0028 as the decree/evidence/archive governance baseline;
- public `/`, `/health`, login, and registration boundaries;
- no real model or uncontrolled external-network call during tests.

Source files based on the older archive payload must be extended for
`evidenceReferences`; they must not replace the target decoder or silently
drop evidence fields.

## Integration architecture

### Recovery layer

Use `734b0aad` as a reviewable visual delta, not as an overwrite. Recover
non-conflicting visual components, controllers, assets, tests, and
documentation by path. Apply the later source worktree delta on top only after
the baseline behavior is represented.

### Shared shell and route layer

Migrate the immersive court shell, capability controls, quick dock, edict
stage, global theme, Chinese root layout, and shared reply-feed projection.
Protected routes continue to use `requireUser()` and `CourtShell` or the
approved equivalent server boundary.

### Product surface layer

- `/study` uses the complete source Study workspace while retaining the
  authenticated decree BFF and current response contract.
- `/dadian` uses `DadianOverviewController` and `DadianScene`, with abort,
  retry, stale-response protection, and authenticated overview loading.
- `/junjichu` replaces `CourtPlaceholderPage` with the read-only
  `JunjichuClient` and controller-backed scene.
- `/liubu`, department routes, and all 39 office routes replace
  `department-demo` with the source ministries visual directory and read-only
  REPLY projection.
- `/shiguan` uses the source controller and workspace, extended to display
  immutable evidence references and preserve independent archive/statistics
  settlement.

The four legacy `frontend/src/features/department-demo/` files are deleted
only after all ministry routes and tests use `ministries-visual`.

### Owner propagation repair

The authenticated user ID must flow from the decree endpoint into the
Chancellor graph/evidence session and then into `ShiguanSource` recall and
archive loading. The source boundary must not swallow a missing owner
signature as `shiguan_unavailable`.

### Integration verification repair

`scripts/verify_integration.mjs` must validate:

- `/` as the public WelcomeGate;
- `/health` as the backend health presentation;
- protected routes and BFF behavior without invoking real models;
- success and backend-unavailable health scenarios on the correct route.

## Error and concurrency behavior

- Controller requests are abortable and generation-gated so stale responses
  cannot replace newer state.
- Shiguan archives and statistics settle independently; one failure does not
  erase the last known good state of the other.
- Authentication failures redirect only to allowlisted login destinations.
- Unsupported or malformed payloads fail with stable, non-sensitive UI
  messages.
- Read-only court pages must not issue business write requests.
- Owner propagation failures are surfaced by tests rather than converted into
  an unexplained source-unavailable result.

## Test strategy

Testing follows red-green-refactor for behavior absent from the target:

1. Update route/source guards to expect real Junjichu and ministries views;
   verify they fail against the current target.
2. Add controller tests for Dadian and Shiguan concurrency, abort, retry,
   authentication, independent settlement, and last-known-good behavior.
3. Add payload tests covering the complete target archive contract, including
   immutable evidence references and MCP access metadata.
4. Add owner propagation tests across API, graph/evidence session, Shiguan
   recall, and archive loading.
5. Add visual source and asset guards for every migrated product surface.
6. Run frontend lint, typecheck, all tests, and production build.
7. Run backend Ruff and all tests.
8. Run `scripts/verify_integration.mjs` with its documented safe local
   process lifecycle.
9. Run all four repository harness commands and `git diff --check`.

No test may use a real DeepSeek call. Network behavior uses injected clients
or the repository's explicit safe local integration harness.

## Completeness gate

Before completion, generate a disposition report for all 108 original source
worktree status entries. The gate fails if:

- a source-only file has no target equivalent or rejection reason;
- a tracked source deletion remains accidentally referenced;
- the target still renders a placeholder where the source has a real view;
- target archive evidence fields are absent from a migrated payload decoder;
- the source worktree contains an unaccounted entry;
- the final working tree contains unresolved conflicts or unrelated changes.

The two failure memories created during diagnosis remain part of the
correction:

- `docs/failures/2026-07-27-branch-merge-omitted-worktree-state.md`
- `docs/failures/2026-07-27-mixed-market-stock-evidence-unavailable.md`

## Delivery boundary

The correction may create local commits on `harness-only`. It must not push,
delete the source worktree, rewrite the source branch, expose credentials,
invoke real models, or broaden approved MCP capabilities.
