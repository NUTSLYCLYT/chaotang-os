# Architecture

## System

`chaotang-web-lyt` is the frontend experience line for Chaotang OS.

```text
Browser
  -> Next.js App Router pages in src/app
  -> feature UI/workflows in src/features
  -> CourtOS/domain engines in src/core/courtos and src/core/*
  -> adapters/utilities in src/lib
  -> direct backend contracts / jiqun_ai / external sources
```

## Main Product Loop

```text
Operating signal
  -> Shangshufang
  -> decree / task
  -> Junjichu orchestration
  -> ministry review
  -> memorial / report
  -> boss decision
  -> Shiguan archive and recall
```

## State and Data

- UI state: React state, lightweight client stores, and URL state.
- Runtime data: direct backend contracts and typed fetch adapters.
- Domain logic: `src/core/**`, especially `src/core/courtos/**`.
- Backend truth: `jiqun_ai` and real provider/database paths.
- Evaluation assets: `harness/**` and `tests/swarm-eval/**`.

## Evidence Boundary

UI must not blur:

- LIVE: real model, real run, real record.
- MIXED: real source with fallback.
- DEMO: fixture/static/mock.

When a component displays a result from a fallback or sample, the view model should carry a source label or the page should disclose the boundary.

## Release Path

- Dev HMR: `pnpm dev`, port 3002.
- Production build: `pnpm build`.
- Production start: `pnpm start`, port 3050.
- Release gates: `pnpm harness:chaotang:gates`, `pnpm gate:prod-release`, plus domain guards as needed.

## Historical Assets

`dev/_attic` and old docs are reference material. Production routes should not depend on retired code unless a change explicitly restores it and adds verification.
