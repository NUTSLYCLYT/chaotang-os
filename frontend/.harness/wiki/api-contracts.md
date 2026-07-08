# API Contracts

## Contract Rule

Frontend-owned BFF routes are retired. Do not create `src/app/api/**` route handlers for runtime behavior; browser-facing data contracts should point to an explicit backend service such as `jiqun_ai`, or to a documented external source.

The frontend should not use `/chaotang/api/**` as a proxy contract. Local and production integrations should use explicit backend base URLs:

- Server-side adapters: `JIQUN_API_URL`.
- Browser-facing adapters: `NEXT_PUBLIC_JIQUN_API_URL` or `NEXT_PUBLIC_CHAOTANG_API_URL`.
- Real backend mode, when needed locally: `NEXT_PUBLIC_API_MODE=real`.

If a dev server such as 3002 or 3003 is not reaching backend 8081, diagnose environment variables, backend reachability, CORS/auth expectations, and the typed adapter contract. Do not solve it by recreating a frontend BFF layer.

## Auth / Privileged Writes

High-risk backend contracts include:

- any handler writing tasks, ledgers, archives, preferences, or tenant-visible state

Rules:

- Decode-only auth is not authorization for privileged writes.
- Tenant isolation and CSRF/same-origin assumptions must be explicit.
- Idempotency matters for decision/write endpoints.
- Add regression tests for fixes in these areas.

## Backend Boundary

When frontend code calls `jiqun_ai` or a real provider contract:

- Include timeout/error behavior.
- Preserve source labels.
- Do not turn fallback success into LIVE claims.
- Keep the frontend contract documented in the active change.

## Validation

New contracts should use Zod or explicit runtime validation at the boundary. Do not cast untrusted payloads directly into domain types.
