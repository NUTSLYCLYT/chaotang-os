# CI Summary: chore-remove-bff-layer-20260708

- `pnpm exec tsc --noEmit`: PASS.
- `NEXT_PUBLIC_API_MODE=real NEXT_DIST_DIR=.next-bff-removal-check pnpm build`: PASS.
- Route residue check: `src/app/api` is absent and no `src/app/**/api/**/route.ts` remains.

Note: initial build without `NEXT_PUBLIC_API_MODE=real` was blocked by the existing release gate, then passed with the required env.

## Commands

- TBD

## Result

PENDING
