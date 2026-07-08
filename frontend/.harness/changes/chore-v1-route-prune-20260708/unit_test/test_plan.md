# Test Plan: chore-v1-route-prune-20260708

## Unit / Node Tests

- Static/type verification for route module compatibility.
- Production build verification for generated static route params.

## Commands

- `pnpm exec tsc --noEmit`
- `NEXT_PUBLIC_API_MODE=real pnpm build`
