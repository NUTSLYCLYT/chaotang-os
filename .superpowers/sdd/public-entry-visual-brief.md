# Public entry visual migration brief

## Scope

Migrate the visual shells of the existing public entry routes from `dev`, while retaining the current authentication and invitation behaviour:

- `frontend/src/app/page.tsx`
- `frontend/src/app/enter/page.tsx`
- `frontend/src/app/login/page.tsx`
- `frontend/src/app/register/page.tsx`
- `frontend/src/app/invite/page.tsx`
- `frontend/src/app/invite/[code]/page.tsx`
- directly related CSS modules/components/tests only.

## Contract

- Retain current auth BFF use, validation, redirects, invitation semantics, accessibility labels and tests.
- Source the public visual language from the corresponding `dev` pages, but do not copy its deprecated auth/store/API implementation.
- Use local CSS modules and existing project conventions; no Tailwind, Lucide, dev hooks, dev API clients, mock users or fake invitations.
- Do not alter `frontend/src/app/api/**`, `frontend/src/lib/auth/**`, backend contracts, session cookies or protected routes.
- Do not invent product behaviour.  If a dev-only visual control has no live equivalent, make it a harmless link or omit it.

## Required verification

Use TDD: capture a focused failing test before implementation. Then run focused tests, lint, typecheck, complete frontend test suite, production build and `git diff --check`. Do not commit or push. Write a concise implementation/verification report to `.superpowers/sdd/public-entry-visual-report.md`.
