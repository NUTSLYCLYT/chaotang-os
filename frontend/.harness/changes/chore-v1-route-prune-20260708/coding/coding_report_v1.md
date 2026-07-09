# Coding Report v1: chore-v1-route-prune-20260708

## Files Changed

- Moved canonical App Router pages to `/dadian`, `/shangshufang`, `/junjichu`, `/liubu`, `/zhusi`, `/shiguan`.
- Moved non-1.0 page routes to `dev/_attic/v1-route-prune-20260708/`.
- 更新 route registry、auth/public route guard、production launch whitelist、login/enter redirect 和旧路径 redirect。

## Key Decisions

- Kept page UI implementations intact and changed only route placement/wiring.
- 旧 URL 以临时 307 redirect 兼容。
- Used public v1 pinyin slugs for 六部/司 while mapping to existing internal bureau implementations.

## Verification

- `pnpm exec tsc --noEmit`: pass
- `NEXT_PUBLIC_API_MODE=real pnpm build`: pass

