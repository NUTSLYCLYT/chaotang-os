# Spec: chore-remove-bff-layer-20260708

## Background

User directed the frontend project to remove the BFF layer entirely. The frontend should no longer own Next.js route handlers or same-origin proxy rewrites; runtime truth should live in backend services such as `jiqun_ai`.

## Scope

- Delete frontend-owned `src/app/api/**` route handlers.
- Delete the hidden `src/app/jiqun/api/**` SSE proxy route.
- Remove Next.js rewrite proxy configuration for `/api/v1`, `/socket.io`, and `/jiqun/api`.
- Update frontend runtime adapters to use explicit backend URLs instead of same-origin BFF paths.
- Update harness ownership docs and release scripts that assumed frontend BFF endpoints.

## Non-goals

- Do not implement replacement backend endpoints in the frontend repository.
- Do not migrate deleted route logic into another frontend directory.
- Do not change product pages beyond removing BFF assumptions.

## Acceptance Criteria

- `src/app/api` no longer exists.
- No route handler remains under an `/api/` app path.
- `next.config.ts` no longer defines API/proxy rewrites.
- TypeScript and production build complete.

## Risks

- Pages that still call old `/api/**` URLs at runtime will need backend endpoint alignment.
- Direct browser calls to backend services may need CORS/auth configuration outside the frontend repo.
- Some legacy nodetests and scripts still document old API route names and may need a follow-up cleanup.

## Verification Plan

- `pnpm exec tsc --noEmit`
- `NEXT_PUBLIC_API_MODE=real NEXT_DIST_DIR=.next-bff-removal-check pnpm build`
- Search for remaining app route handlers under `/api/`.
