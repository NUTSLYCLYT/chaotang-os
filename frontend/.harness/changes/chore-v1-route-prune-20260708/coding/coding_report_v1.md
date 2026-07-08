# Coding Report v1: chore-v1-route-prune-20260708

## Files Changed

- Moved canonical App Router pages to `/dadian`, `/shangshufang`, `/junjichu`, `/liubu`, `/zhusi`, `/shiguan`.
- Moved non-1.0 page routes to `dev/_attic/v1-route-prune-20260708/`.
- Updated route registry, auth/public route guards, production launch whitelist, login/enter redirects, and legacy redirects.

## Key Decisions

- Kept page UI implementations intact and changed only route placement/wiring.
- Preserved legacy URLs as temporary 307 redirects.
- Used public v1 pinyin slugs for 六部/司 while mapping to existing internal bureau implementations.

## Verification

- `pnpm exec tsc --noEmit`: pass
- `NEXT_PUBLIC_API_MODE=real pnpm build`: pass
