# Tasks: chore-remove-bff-layer-20260708

## Task 1

- Objective: Remove frontend BFF route handlers.
- Input: `src/app/api/**`, `src/app/jiqun/api/**`.
- Output: Deleted route handler trees.
- Acceptance: `Test-Path src/app/api` is false and no `src/app/**/api/**/route.ts` remains.
- Dependencies: User explicitly requested direct deletion.

## Task 2

- Objective: Remove same-origin proxy assumptions.
- Input: `next.config.ts`, `src/lib/api.ts`, `src/lib/jiqun-api.ts`, `useJiqunRunProgress`.
- Output: No Next rewrites; adapters use explicit backend base URLs.
- Acceptance: TypeScript passes.
- Dependencies: Backend URL envs must be supplied in deployed environments.

## Task 3

- Objective: Update project rules and release checks.
- Input: `.harness/**`, release scripts.
- Output: Frontend ownership excludes BFF; smoke checks avoid retired frontend API endpoints.
- Acceptance: Build passes and audit files are updated.
- Dependencies: None.
