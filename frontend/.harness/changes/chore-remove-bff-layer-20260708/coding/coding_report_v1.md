# Coding Report v1: chore-remove-bff-layer-20260708

## Changes

- Deleted the frontend BFF route tree at `src/app/api/**`.
- Deleted the hidden SSE proxy route at `src/app/jiqun/api/**`.
- Removed Next.js API/proxy rewrites from `next.config.ts`.
- Changed generic and jiqun API clients to use explicit backend base URLs.
- Updated middleware, launch whitelist, release smoke scripts, and harness docs to remove frontend BFF ownership.

## Notes

- Runtime pages may still contain old `/api/**` display text or fetch paths; those now represent backend-alignment follow-up work, not frontend route handlers.
- `NEXT_PUBLIC_JIQUN_API_URL` or `NEXT_PUBLIC_CHAOTANG_API_URL` should be set when browser code needs direct jiqun access.

## Files Changed

- TBD

## Key Decisions

- TBD

## Verification

- TBD
