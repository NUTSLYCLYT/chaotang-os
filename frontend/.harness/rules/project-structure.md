# Rule: Project Structure

## Current Shape

This is a Next.js App Router project, not the smaller Vite reference scaffold. The harness structure is adapted to the existing codebase rather than forcing a destructive folder migration.

```text
src/
  app/          Next.js routes, route handlers, layouts, server/client entry points
  components/   reusable visual components that predate feature slicing
  features/     product capability slices and UI/workflow modules
  core/         domain engines, CourtOS protocol, pure business logic, evaluators
  lib/          shared runtime utilities, adapters, persistence helpers
  shared/       stable shared types/metadata/public helpers
  types/        cross-cutting TypeScript contracts
e2e/            Playwright browser tests
tests/          non-browser test harnesses and evaluation fixtures
scripts/        programmable gates, guards, migration and release utilities
docs/           durable product/architecture docs
dev/            temporary notes, handoffs, release records, artifacts
harness/        domain evaluation harness assets
.harness/       agent operating system: rules, skills, wiki, changes, templates
```

## Dependency Direction

Prefer this direction for new work:

```text
src/app -> src/features -> src/core | src/lib | src/shared | src/types
src/features -> src/core | src/lib | src/shared | src/types
src/core -> src/lib | src/shared | src/types
src/lib -> src/shared | src/types
src/shared -> src/types
```

Rules:

- `src/app` may compose everything, but route handlers must keep auth, tenant, and source-label boundaries explicit.
- `src/features/{slice}` should not import another feature's internals. Share through `src/core`, `src/lib`, `src/shared`, or a public entry.
- `src/core/courtos/**` owns CourtOS domain logic. UI must not duplicate core algorithms to create prettier but divergent answers.
- `src/lib` must not import UI or route modules.
- `src/shared` must remain business-light and stable.
- `dev/_attic` and retired routes are reference only; do not wire new production paths to them.

## Root Directory Discipline

New scratch files do not belong in the repo root. Use:

- `dev/notes/` for analysis.
- `dev/handoffs/` for handoff records.
- `dev/release/` for release records.
- `dev/artifacts/` for generated evidence.
- `.harness/changes/{change-id}/` for active change audit trails.

Root remains for framework-required files, stable entry docs, source/test/script directories, and `.harness`.

## High-Risk Areas

Treat these as high-risk and require review plus a regression assertion when changed:

- Auth, invite, session, tenant isolation, privileged write routes.
- Main `tasks` table or shared ledgers read by briefing, Shiguan, KPI, or archive surfaces.
- UI that gives decision/court verdicts visual authority.
- LIVE/MIXED/DEMO source labels and evidence paths.
- Release, production, port, base-path, or nginx assumptions.
