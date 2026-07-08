# Coding Spec 01 — App Routes and Pages

Use for files under `src/app/**`.

## Responsibilities

- Route composition, layouts, metadata, server/client boundaries.
- Next.js route handlers as BFF adapters.
- Browser-visible page state and navigation.

## Rules

- Do not place core business algorithms in page files.
- Add `"use client"` only when interactive browser behavior is required.
- Keep route handlers explicit about auth, tenant, source labels, fallback, and idempotency.
- Preserve base path `/chaotang`, dev port 3002, production port 3050.
- For new pages, state which main loop station they strengthen.

## Verification

- `pnpm exec tsc --noEmit`
- targeted Playwright for browser behavior
- `pnpm build` for route/build changes
