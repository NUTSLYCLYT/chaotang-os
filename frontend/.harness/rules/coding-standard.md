# Rule: Coding Standard

## TypeScript

- Keep `strict` on.
- Prefer explicit parameter and return types for exported functions.
- Use `unknown` plus narrowing instead of `any`.
- Use stable shared/domain types from `src/types`, `src/shared`, or `src/core` instead of redefining contracts locally.
- Avoid silent fallbacks for domain enums and department codes. Unknown code means warn or fail fast, not `?? code`.

## Data Contracts

- External data entering the app should be validated or normalized at the boundary.
- Zod is the preferred schema tool for new contracts.
- IDs are strings.
- Timestamps crossing boundaries are ISO-8601 strings.
- Numbers that represent money, cost, or business-critical quantities need explicit unit semantics.

## Next.js

- This repo uses Next.js 16 App Router.
- Do not add frontend-owned BFF route handlers. Backend runtime truth belongs in `jiqun_ai` or another explicit backend service.
- Do not use `/chaotang/api/**` as a replacement proxy path; connect through documented backend base URLs and typed adapters.
- Server and client boundaries must be explicit. Add `"use client"` only where interactive browser behavior is required.
- Base path `/chaotang` and port discipline are product constraints, not local preferences.

## React / UI

- Preserve existing design tokens and global CSS unless the change explicitly targets the design system.
- Do not create a new page/surface when the capability can dissolve into the main loop.
- Interactive controls must be accessible with semantic elements and labels.
- Visual changes that affect decision weight require screenshots or Playwright evidence.

## Logging and Errors

- No casual `console.log` in production paths.
- `console.warn` / `console.error` must include a useful prefix.
- Do not swallow errors silently. Surface them to UI, return typed failure, or log with context.

## Tests and Guards

- Prefer small focused node tests for domain logic.
- Use Playwright for route-level/browser behavior.
- High-risk fixes require a regression assertion.
- Existing guard scripts are part of the product harness. Do not remove one without replacing its protection.
