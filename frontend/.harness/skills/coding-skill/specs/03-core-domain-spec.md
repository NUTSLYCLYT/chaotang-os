# Coding Spec 03 — Core Domain

Use for files under `src/core/**`.

## Responsibilities

- CourtOS internal protocol and domain engines.
- Ministry logic, decision loops, evidence gates, archive learning, and pure business rules.
- Shared domain contracts that UI reads but should not reimplement.

## Rules

- Prefer pure functions and explicit inputs/outputs.
- Unknown domain codes must warn or fail fast, not silently fall back.
- If logic is live-path bearing, avoid parallel implementations for the same intent.
- If duplicate-looking logic is fallback-only, document that boundary before refactoring it away.
- High-risk domain changes require a regression node test.

## Verification

- `pnpm test:core`
- targeted `node --experimental-strip-types --test path/to/file.nodetest.ts`
- `pnpm exec tsc --noEmit`
