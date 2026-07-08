# Coding Spec 04 — Lib, Shared, Types

Use for files under `src/lib/**`, `src/shared/**`, and `src/types/**`.

## Responsibilities

- Stable utilities, adapters, stores, cross-cutting contracts, and type definitions.
- Runtime bridges to backend/BFF systems.
- Shared metadata and common helpers.

## Rules

- `src/lib` and `src/shared` must not import UI/page modules.
- Shared contracts should be stable and named clearly.
- External payloads need validation or explicit normalization.
- Money/cost/quantity fields must state units.
- Avoid hidden global state unless the file already owns that pattern and tests cover it.

## Verification

- `pnpm exec tsc --noEmit`
- focused node tests for helpers/adapters
- relevant guard scripts for auth/tenant/realdata boundaries
