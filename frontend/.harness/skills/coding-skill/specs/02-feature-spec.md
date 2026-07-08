# Coding Spec 02 — Features

Use for files under `src/features/**`.

## Responsibilities

- Product capability slices and workflow UI.
- View models and orchestration of user-facing interactions.
- Composition around domain logic from `src/core` and adapters from `src/lib`.

## Rules

- Do not import another feature's internals when a core/lib/shared abstraction is more appropriate.
- Do not duplicate CourtOS or backend swarm algorithms for display convenience.
- Carry LIVE / MIXED / DEMO source information through view models when it affects user trust.
- New feature UI should dissolve into existing loop stations before creating new surfaces.

## Verification

- targeted component/page checks
- Playwright for user-visible flows
- domain tests when feature logic transforms decisions, risks, or source labels
